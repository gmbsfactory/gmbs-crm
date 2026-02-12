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
 * Optimise pour la vitesse : prefetch au modal open, cache TanStack Query.
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
   * Read entity ID from DOM data-ai-entity (for cache key when modal is open)
   */
  const getEntityIdFromDOM = useCallback((): string | null => {
    if (typeof document === 'undefined') return null
    const el = document.querySelector('[data-ai-entity]')
    if (!el) return null
    try {
      const raw = el.getAttribute('data-ai-entity')
      if (!raw) return null
      const parsed = JSON.parse(raw)
      return (parsed.id as string) ?? null
    } catch {
      return null
    }
  }, [])

  /**
   * Detecte le contexte courant, enrichi avec les infos de vue active
   * et la detection de modal ouvert (data-ai-entity dans le DOM)
   */
  const getContext = useCallback((): AIPageContext => {
    const baseContext = detectContext(pathname)
    const enriched = enrichContextWithView(baseContext, viewContext)

    // Detect open modal: if data-ai-entity exists, upgrade to detail-level actions
    if (typeof document !== 'undefined') {
      const entityEl = document.querySelector('[data-ai-entity]')
      if (entityEl && (baseContext.page === 'intervention_list' || baseContext.page === 'artisan_list')) {
        const entityId = getEntityIdFromDOM()
        return {
          ...enriched,
          entityId: entityId ?? enriched.entityId,
          entityType: baseContext.page === 'intervention_list' ? 'intervention' : 'artisan',
          availableActions: baseContext.page === 'intervention_list'
            ? ['summary', 'next_steps', 'email_artisan', 'email_client', 'find_artisan', 'suggestions'] as AIActionType[]
            : ['summary', 'suggestions'] as AIActionType[],
        }
      }
    }

    return enriched
  }, [pathname, viewContext, getEntityIdFromDOM])

  /**
   * Core fetch logic shared by executeAction and prefetchAction
   */
  const callEdgeFunction = useCallback(async (
    action: AIActionType,
    context: AIPageContext,
    entityData?: Record<string, unknown> | null,
    historyContext?: Record<string, unknown> | null,
    summaryData?: AIDataSummary | null,
    userInstruction?: string | null,
  ): Promise<AIContextualActionResponse> => {
    // Anonymize entity data
    let anonymizedData: Record<string, unknown> | null = null
    if (entityData) {
      if (context.entityType === 'intervention') {
        anonymizedData = anonymizeIntervention(entityData) as unknown as Record<string, unknown>
      } else if (context.entityType === 'artisan') {
        anonymizedData = anonymizeArtisan(entityData) as unknown as Record<string, unknown>
      }
    }

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
        user_instruction: userInstruction ?? undefined,
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

    return result
  }, [])

  /**
   * Execute une action IA (avec dialog).
   */
  const executeAction = useCallback(async (
    action: AIActionType,
    entityData?: Record<string, unknown> | null,
    historyContext?: Record<string, unknown> | null,
    summaryData?: AIDataSummary | null,
    userInstruction?: string | null,
  ) => {
    const context = getContext()

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
      // Check TanStack Query cache first
      const entityId = context.entityId
      if (entityId && action !== 'data_summary' && action !== 'suggestions' && action !== 'stats_insights') {
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

      const result = await callEdgeFunction(action, context, entityData, historyContext, summaryData, userInstruction)

      // Cache result in TanStack Query
      if (entityId) {
        queryClient.setQueryData(aiKeys.action(action, entityId), result)
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
  }, [getContext, queryClient, callEdgeFunction])

  /**
   * Prefetch silencieux : appelle l'Edge Function et cache le resultat
   * sans ouvrir le dialog ni modifier le state.
   * Utilise pour pre-charger summary + next_steps a l'ouverture du modal.
   */
  const prefetchAction = useCallback(async (
    action: AIActionType,
    entityData?: Record<string, unknown> | null,
    historyContext?: Record<string, unknown> | null,
  ) => {
    const context = getContext()
    const entityId = context.entityId
    if (!entityId) return

    // Skip if already cached
    const cached = queryClient.getQueryData<AIContextualActionResponse>(aiKeys.action(action, entityId))
    if (cached) return

    try {
      const result = await callEdgeFunction(action, context, entityData, historyContext)
      queryClient.setQueryData(aiKeys.action(action, entityId), result)
    } catch {
      // Silent fail for prefetch
    }
  }, [getContext, queryClient, callEdgeFunction])

  const close = useCallback(() => {
    setState(prev => ({ ...prev, isOpen: false }))
  }, [])

  const getAvailableActions = useCallback((): AIActionType[] => {
    return getContext().availableActions
  }, [getContext])

  return {
    executeAction,
    prefetchAction,
    state,
    close,
    getContext,
    getAvailableActions,
  }
}
