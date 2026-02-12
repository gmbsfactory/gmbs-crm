"use client"

import { useCallback } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useInterventionsMutations } from "@/hooks/useInterventionsMutations"
import { useInterventionStatuses } from "@/hooks/useInterventionStatuses"
import { aiKeys } from "@/lib/react-query/queryKeys"
import type { AISuggestedAction } from "@/lib/ai/types"

/**
 * Custom events IA pour la communication inter-composants.
 * Le panneau IA est rendu dans un portal separe du modal intervention,
 * donc on utilise des custom events DOM pour decoupler les composants.
 */
export const AI_EVENTS = {
  OPEN_ARTISAN_SEARCH: 'ai:open-artisan-search',
  NAVIGATE_SECTION: 'ai:navigate-section',
  FOCUS_COMMENT: 'ai:focus-comment',
  OPEN_EMAIL_MODAL: 'ai:open-email-modal',
  CHANGE_STATUS: 'ai:change-status',
} as const

interface AIEventDetail {
  interventionId: string
  [key: string]: unknown
}

function dispatchAIEvent(eventName: string, detail: AIEventDetail) {
  window.dispatchEvent(new CustomEvent(eventName, { detail }))
}

/**
 * Hook qui dispatche les clics sur les boutons d'action IA vers les vraies actions CRM.
 * Utilise des custom events DOM pour communiquer avec les composants du modal.
 */
export function useAIActionExecutor(interventionId: string) {
  const queryClient = useQueryClient()
  const { update: updateMutation } = useInterventionsMutations()
  const { getStatusByCode } = useInterventionStatuses()

  const invalidateAICache = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: aiKeys.action('next_steps', interventionId) })
  }, [queryClient, interventionId])

  const executeAction = useCallback(async (action: AISuggestedAction) => {
    const { payload } = action

    switch (payload.type) {
      case 'change_status': {
        const status = getStatusByCode(payload.target_status_code)
        if (!status) return

        if (payload.requires_comment) {
          // Dispatch event pour ouvrir le StatusReasonModal
          dispatchAIEvent(AI_EVENTS.CHANGE_STATUS, {
            interventionId,
            statusId: status.id,
            statusCode: payload.target_status_code,
            statusLabel: payload.target_status_label,
            requiresComment: true,
          })
        } else {
          // Mutation directe
          updateMutation.mutate(
            { id: interventionId, data: { statut_id: status.id } },
            { onSuccess: () => invalidateAICache() },
          )
        }
        break
      }

      case 'assign_artisan': {
        dispatchAIEvent(AI_EVENTS.OPEN_ARTISAN_SEARCH, {
          interventionId,
          metierCode: payload.metier_code,
          codePostal: payload.code_postal,
        })
        break
      }

      case 'navigate_section': {
        dispatchAIEvent(AI_EVENTS.NAVIGATE_SECTION, {
          interventionId,
          section: payload.section,
        })
        break
      }

      case 'send_email': {
        dispatchAIEvent(AI_EVENTS.OPEN_EMAIL_MODAL, {
          interventionId,
          emailType: payload.email_type,
        })
        break
      }

      case 'add_comment': {
        dispatchAIEvent(AI_EVENTS.FOCUS_COMMENT, {
          interventionId,
        })
        break
      }
    }
  }, [interventionId, getStatusByCode, updateMutation, invalidateAICache])

  return { executeAction }
}
