"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { useContextualAIAction } from "@/hooks/useContextualAIAction"
import { useAIDataSummary, type SummaryPeriod } from "@/hooks/useAIDataSummary"
import { detectContext, enrichContextWithView } from "@/lib/ai/context-detector"
import { useAIContextStore } from "@/stores/ai-context-store"
import { useAIPanelStore } from "@/stores/ai-panel-store"
import { useAIActionExecutor } from "@/hooks/useAIActionExecutor"
import type { AIActionType, AIPageContext, AISuggestedAction } from "@/lib/ai/types"
import { AIAssistantDialog } from "./AIAssistantDialog"
import { AIActionsPanel } from "./AIActionsPanel"
import { AIFloatingBubble } from "./AIFloatingBubble"
import { AISidePanel } from "./AISidePanel"

/**
 * Actions disponibles quand un modal d'intervention est ouvert
 * (detecte via data-ai-entity dans le DOM)
 */
const MODAL_INTERVENTION_ACTIONS: AIActionType[] = [
  'summary', 'next_steps', 'email_artisan', 'email_client', 'find_artisan', 'suggestions',
]

/**
 * Lit l'ID de l'entite depuis le DOM (data-ai-entity)
 */
function getEntityIdFromDOM(): string | null {
  if (typeof document === 'undefined') return null
  const el = document.querySelector('[data-ai-entity]')
  if (!el) return null
  try {
    const raw = el.getAttribute('data-ai-entity')
    if (!raw) return null
    const parsed = JSON.parse(raw) as Record<string, unknown>
    return (parsed.id as string) ?? null
  } catch {
    return null
  }
}

/**
 * Verifie si un modal d'intervention est ouvert
 */
function isInterventionModalOpen(): boolean {
  if (typeof document === 'undefined') return false
  return !!document.querySelector('[data-ai-entity]')
}

/**
 * Provider global qui installe les raccourcis clavier IA et rend les dialogs.
 * A placer dans le layout principal (app/layout.tsx), dans le <main>.
 *
 * Raccourcis :
 * - Cmd/Ctrl + Shift + A : Ouvrir le menu des actions IA
 * - Cmd/Ctrl + Shift + R : Resume contextuel
 * - Cmd/Ctrl + Shift + S : Suggestions
 * - Cmd/Ctrl + Shift + F : Trouver artisan (sur page detail intervention)
 * - Cmd/Ctrl + Shift + P : Toggle panneau IA lateral (next_steps)
 */
export function AIShortcutsProvider() {
  const pathname = usePathname()
  const { executeAction, prefetchAction, state, close } = useContextualAIAction()
  const { collectSummary } = useAIDataSummary()
  const viewContext = useAIContextStore((s) => s.viewContext)
  const [actionsOpen, setActionsOpen] = useState(false)
  const [context, setContext] = useState<AIPageContext | null>(null)
  const lastPrefetchedEntityId = useRef<string | null>(null)

  // AI Panel store
  const { isPanelOpen, panelInterventionId, openPanel, closePanel } = useAIPanelStore()

  // AI Action executor (for side panel buttons)
  const aiExecutor = useAIActionExecutor(panelInterventionId ?? '')

  // Track if we should show the side panel vs dialog
  const showSidePanel = isPanelOpen && state.currentAction === 'next_steps'

  // Update context when pathname or view context changes
  // Also detect if a modal with entity data is open (data-ai-entity in DOM)
  useEffect(() => {
    const base = detectContext(pathname)
    const enriched = enrichContextWithView(base, viewContext)

    // Detect open modal: if data-ai-entity exists, we have a detail entity open
    const entityEl = document.querySelector('[data-ai-entity]')
    if (entityEl && (base.page === 'intervention_list' || base.page === 'artisan_list')) {
      // Modal is open from a list page → upgrade available actions to detail-level
      setContext({
        ...enriched,
        entityType: base.page === 'intervention_list' ? 'intervention' : 'artisan',
        availableActions: base.page === 'intervention_list'
          ? MODAL_INTERVENTION_ACTIONS
          : ['summary', 'suggestions'],
      })
    } else {
      setContext(enriched)
    }
  }, [pathname, viewContext])

  // Re-detect context when modals open/close (MutationObserver on data-ai-entity)
  // Also PREFETCH summary + next_steps in background when a new modal opens
  useEffect(() => {
    const observer = new MutationObserver(() => {
      const base = detectContext(pathname)
      const enriched = enrichContextWithView(base, viewContext)
      const entityEl = document.querySelector('[data-ai-entity]')

      if (entityEl && (base.page === 'intervention_list' || base.page === 'artisan_list')) {
        setContext({
          ...enriched,
          entityType: base.page === 'intervention_list' ? 'intervention' : 'artisan',
          availableActions: base.page === 'intervention_list'
            ? MODAL_INTERVENTION_ACTIONS
            : ['summary', 'suggestions'],
        })

        // PREFETCH: when a new modal opens, pre-load summary + next_steps in background
        try {
          const raw = entityEl.getAttribute('data-ai-entity')
          if (raw) {
            const parsed = JSON.parse(raw) as Record<string, unknown>
            const entityId = parsed.id as string
            if (entityId && entityId !== lastPrefetchedEntityId.current) {
              lastPrefetchedEntityId.current = entityId
              let history: Record<string, unknown> | null = null
              const historyRaw = entityEl.getAttribute('data-ai-history')
              if (historyRaw) {
                try { history = JSON.parse(historyRaw) as Record<string, unknown> } catch { /* ignore */ }
              }
              // Fire prefetch for summary and next_steps in parallel (silent, no UI)
              prefetchAction('summary', parsed, history)
              prefetchAction('next_steps', parsed, history)
            }
          }
        } catch {
          // Prefetch is best-effort, never block
        }
      } else {
        setContext(enriched)
        lastPrefetchedEntityId.current = null
        // Modal closed → close AI panel too
        if (isPanelOpen) closePanel()
      }
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-ai-entity'],
    })

    return () => observer.disconnect()
  }, [pathname, viewContext, prefetchAction, isPanelOpen, closePanel])

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

  // Execute an action with entity data and optional history context.
  // For next_steps on wide screen with modal open: open side panel instead of dialog.
  const handleAction = useCallback(async (action: AIActionType, userInstruction?: string) => {
    const data = getEntityData()

    // On list pages without a modal open, collect real data for suggestions/stats_insights
    if (!data && (action === 'suggestions' || action === 'stats_insights')) {
      try {
        const summaryData = await collectSummary('month')
        executeAction(action, null, null, summaryData, userInstruction)
      } catch {
        // Fallback: execute without summary data
        executeAction(action, null, null, null, userInstruction)
      }
      return
    }

    // next_steps with modal open + wide screen → open side panel
    if (action === 'next_steps' && isInterventionModalOpen()) {
      const entityId = getEntityIdFromDOM()
      if (entityId && typeof window !== 'undefined' && window.innerWidth >= 1280) {
        openPanel(entityId)
      }
    }

    executeAction(action, data?.entity ?? null, data?.history ?? null, null, userInstruction)
  }, [executeAction, getEntityData, collectSummary, openPanel])

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

  // Handle action from the actions panel (with optional period for data_summary, or user instruction for suggestions)
  const handleSelectAction = useCallback((action: AIActionType, period?: SummaryPeriod, userInstruction?: string) => {
    setActionsOpen(false)
    if (action === 'data_summary' && period) {
      handleDataSummaryAction(period)
    } else {
      handleAction(action, userInstruction)
    }
  }, [handleAction, handleDataSummaryAction])

  // Handle secondary action from the dialog/panel footer
  const handleDialogAction = useCallback((action: AIActionType) => {
    handleAction(action)
  }, [handleAction])

  // Handle AI action button click from side panel
  const handleExecuteAIAction = useCallback((action: AISuggestedAction) => {
    aiExecutor.executeAction(action)
  }, [aiExecutor])

  // Handle side panel close
  const handleCloseSidePanel = useCallback(() => {
    closePanel()
    close()
  }, [closePanel, close])

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
            // Close AI dialog/panel if open, then open panel
            if (state.isOpen) close()
            if (isPanelOpen) closePanel()
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
        case 'P': {
          e.preventDefault()
          // Toggle AI side panel for next_steps
          if (isPanelOpen) {
            handleCloseSidePanel()
          } else if (isInterventionModalOpen()) {
            handleAction('next_steps')
          }
          break
        }
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [actionsOpen, state.isOpen, close, handleAction, isPanelOpen, closePanel, handleCloseSidePanel])

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

      {/* Side panel for next_steps (wide screen) or Sheet (narrow screen) */}
      {showSidePanel ? (
        <AISidePanel
          state={state}
          onClose={handleCloseSidePanel}
          onExecuteAction={handleExecuteAIAction}
          onAction={handleDialogAction}
        />
      ) : (
        /* Standard result dialog for all other actions */
        <AIAssistantDialog
          state={state}
          onClose={close}
          onAction={handleDialogAction}
        />
      )}
    </>
  )
}
