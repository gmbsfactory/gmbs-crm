"use client"

import React, { useCallback, useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { useContextualAIAction } from "@/hooks/useContextualAIAction"
import { useAIDataSummary, type SummaryPeriod } from "@/hooks/useAIDataSummary"
import { detectContext } from "@/lib/ai/context-detector"
import type { AIActionType, AIPageContext } from "@/lib/ai/types"
import { AIAssistantDialog } from "./AIAssistantDialog"
import { AIActionsPanel } from "./AIActionsPanel"
import { AIFloatingBubble } from "./AIFloatingBubble"

/**
 * Provider global qui installe les raccourcis clavier IA et rend les dialogs.
 * A placer dans le layout principal (app/layout.tsx), dans le <main>.
 *
 * Raccourcis :
 * - Cmd/Ctrl + Shift + A : Ouvrir le menu des actions IA
 * - Cmd/Ctrl + Shift + R : Resume contextuel
 * - Cmd/Ctrl + Shift + S : Suggestions
 * - Cmd/Ctrl + Shift + F : Trouver artisan (sur page detail intervention)
 */
export function AIShortcutsProvider() {
  const pathname = usePathname()
  const { executeAction, state, close } = useContextualAIAction()
  const { collectSummary } = useAIDataSummary()
  const [actionsOpen, setActionsOpen] = useState(false)
  const [context, setContext] = useState<AIPageContext | null>(null)

  // Update context when pathname changes
  useEffect(() => {
    setContext(detectContext(pathname))
  }, [pathname])

  // Get entity data and optional history context from the currently open modal or page.
  // Reads from data attributes set by InterventionModalContent.
  const getEntityData = useCallback((): { entity: Record<string, unknown>; history: Record<string, unknown> | null } | null => {
    const dataEl = document.querySelector('[data-ai-entity]')
    if (!dataEl) return null
    try {
      const raw = dataEl.getAttribute('data-ai-entity')
      if (!raw) return null
      const entity = JSON.parse(raw) as Record<string, unknown>
      let history: Record<string, unknown> | null = null
      const historyRaw = dataEl.getAttribute('data-ai-history')
      if (historyRaw) {
        try {
          history = JSON.parse(historyRaw) as Record<string, unknown>
        } catch {
          // Invalid history JSON, continue without it
        }
      }
      return { entity, history }
    } catch {
      // Invalid JSON, ignore
      return null
    }
  }, [])

  // Execute an action with entity data and optional history context
  const handleAction = useCallback((action: AIActionType) => {
    const data = getEntityData()
    executeAction(action, data?.entity ?? null, data?.history ?? null)
  }, [executeAction, getEntityData])

  // Handle data_summary action: collect real data first, then execute
  const handleDataSummaryAction = useCallback(async (period: SummaryPeriod) => {
    try {
      const summaryData = await collectSummary(period)
      executeAction('data_summary', null, null, summaryData)
    } catch {
      // If data collection fails, execute without summary data (fallback prompt)
      executeAction('data_summary', null, null, null)
    }
  }, [collectSummary, executeAction])

  // Handle action from the actions panel
  const handleSelectAction = useCallback((action: AIActionType, period?: SummaryPeriod) => {
    setActionsOpen(false)
    if (action === 'data_summary' && period) {
      handleDataSummaryAction(period)
    } else {
      handleAction(action)
    }
  }, [handleAction, handleDataSummaryAction])

  // Handle secondary action from the dialog footer
  const handleDialogAction = useCallback((action: AIActionType) => {
    handleAction(action)
  }, [handleAction])

  // Install keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Only handle Cmd/Ctrl + Shift + key
      if (!e.shiftKey || !(e.metaKey || e.ctrlKey)) return

      const key = e.key.toUpperCase()

      switch (key) {
        case 'A': {
          e.preventDefault()
          // Toggle actions panel
          if (actionsOpen) {
            setActionsOpen(false)
          } else {
            // Close AI dialog if open, then open panel
            if (state.isOpen) close()
            setActionsOpen(true)
          }
          break
        }
        case 'R': {
          e.preventDefault()
          handleAction('summary')
          break
        }
        case 'S': {
          e.preventDefault()
          handleAction('suggestions')
          break
        }
        case 'F': {
          e.preventDefault()
          handleAction('find_artisan')
          break
        }
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [actionsOpen, state.isOpen, close, handleAction])

  return (
    <>
      {/* Floating AI bubble (visible when actions are available) */}
      <AIFloatingBubble
        context={context}
        onActivate={() => setActionsOpen(true)}
      />

      {/* Actions panel (Cmd+Shift+A) */}
      <AIActionsPanel
        isOpen={actionsOpen}
        onClose={() => setActionsOpen(false)}
        onSelectAction={handleSelectAction}
        context={context}
      />

      {/* Result dialog */}
      <AIAssistantDialog
        state={state}
        onClose={close}
        onAction={handleDialogAction}
      />
    </>
  )
}
