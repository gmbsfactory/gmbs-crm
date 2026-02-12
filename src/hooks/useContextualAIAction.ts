"use client"

import { useCallback, useState } from "react"
import { usePathname } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { detectContext, enrichContextWithView, anonymizeIntervention, anonymizeArtisan } from "@/lib/ai"
import { useAIContextStore } from "@/stores/ai-context-store"
import type {
  AIActionType,
  AIActionState,
  AIContextualActionResponse,
  AIDataSummary,
  AIPageContext,
} from "@/lib/ai"
import { getHeaders, SUPABASE_FUNCTIONS_URL } from "@/lib/api/v2/common/utils"
import { safeErrorMessage } from "@/lib/api/v2/common/error-handler"
import { aiKeys } from "@/lib/react-query/queryKeys"

/**
 * Hook pour executer des actions IA contextuelles.
 *
 * Detecte automatiquement le contexte de la page courante (intervention, artisan, dashboard)
 * et envoie une requete a l'Edge Function ai-contextual-action.
 *
 * @example
 * const { executeAction, state, close } = useContextualAIAction()
 *
 * // Executer un resume (Cmd+Shift+R)
 * executeAction('summary', interventionData)
 *
 * // Afficher le dialog
 * if (state.isOpen && state.result) {
 *   <AIAssistantDialog result={state.result} onClose={close} />
 * }
 */
export function useContextualAIAction() {
  const pathname = usePathname()
  const queryClient = useQueryClient()
  const viewContext = useAIContextStore((s) => s.viewContext)

  const [state, setState] = useState<AIActionState>({
    isLoading: false,
    isOpen: false,
    result: null,
    error: null,
    currentAction: null,
    context: null,
  })

  /**
   * Detecte le contexte courant, enrichi avec les infos de vue active
   */
  const getContext = useCallback((): AIPageContext => {
    const baseContext = detectContext(pathname)
    return enrichContextWithView(baseContext, viewContext)
  }, [pathname, viewContext])

  /**
   * Execute une action IA.
   *
   * @param action - L'action a executer (summary, next_steps, email_artisan, etc.)
   * @param entityData - Les donnees brutes de l'entite (seront anonymisees avant envoi)
   * @param historyContext - Contexte d'historique condense (construit par buildHistoryContext)
   */
  const executeAction = useCallback(async (
    action: AIActionType,
    entityData?: Record<string, unknown> | null,
    historyContext?: Record<string, unknown> | null,
    summaryData?: AIDataSummary | null,
  ) => {
    const context = getContext()

    // Verifier que l'action est disponible dans ce contexte
    if (!context.availableActions.includes(action)) {
      setState(prev => ({
        ...prev,
        isOpen: true,
        error: `Action "${action}" non disponible sur cette page.`,
        currentAction: action,
        context,
      }))
      return
    }

    setState({
      isLoading: true,
      isOpen: true,
      result: null,
      error: null,
      currentAction: action,
      context,
    })

    try {
      // Check TanStack Query cache first (skip for data_summary - data changes constantly)
      const entityId = context.entityId
      if (entityId && action !== 'data_summary') {
        const cachedResult = queryClient.getQueryData<AIContextualActionResponse>(
          aiKeys.action(action, entityId)
        )
        if (cachedResult) {
          setState({
            isLoading: false,
            isOpen: true,
            result: cachedResult,
            error: null,
            currentAction: action,
            context,
          })
          return
        }
      }

      // Anonymize entity data before sending to the API
      let anonymizedData: Record<string, unknown> | null = null
      if (entityData) {
        if (context.entityType === 'intervention') {
          anonymizedData = anonymizeIntervention(entityData) as unknown as Record<string, unknown>
        } else if (context.entityType === 'artisan') {
          anonymizedData = anonymizeArtisan(entityData) as unknown as Record<string, unknown>
        }
      }

      // Call Edge Function
      const headers = await getHeaders()
      const response = await fetch(`${SUPABASE_FUNCTIONS_URL}/ai-contextual-action`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action,
          context: {
            page: context.page,
            entityId: context.entityId,
            entityType: context.entityType,
            pathname: context.pathname,
            activeViewId: context.activeViewId,
            activeViewTitle: context.activeViewTitle,
            activeViewLayout: context.activeViewLayout,
            appliedFilters: context.appliedFilters,
            filterSummary: context.filterSummary,
          },
          entity_data: anonymizedData,
          history_context: historyContext ?? undefined,
          summary_data: summaryData ?? undefined,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`HTTP ${response.status}: ${errorText}`)
      }

      const result = await response.json() as AIContextualActionResponse

      if (!result.success) {
        throw new Error(result.error ?? 'Action IA echouee')
      }

      // Cache result in TanStack Query (5 min staleTime)
      if (entityId) {
        queryClient.setQueryData(
          aiKeys.action(action, entityId),
          result,
        )
      }

      setState({
        isLoading: false,
        isOpen: true,
        result,
        error: null,
        currentAction: action,
        context,
      })
    } catch (error) {
      const message = safeErrorMessage(error, "l'action IA")
      setState({
        isLoading: false,
        isOpen: true,
        result: null,
        error: message,
        currentAction: action,
        context,
      })
    }
  }, [getContext, queryClient])

  /**
   * Ferme le dialog IA
   */
  const close = useCallback(() => {
    setState(prev => ({
      ...prev,
      isOpen: false,
    }))
  }, [])

  /**
   * Retourne les actions disponibles dans le contexte courant
   */
  const getAvailableActions = useCallback((): AIActionType[] => {
    return getContext().availableActions
  }, [getContext])

  return {
    executeAction,
    state,
    close,
    getContext,
    getAvailableActions,
  }
}
