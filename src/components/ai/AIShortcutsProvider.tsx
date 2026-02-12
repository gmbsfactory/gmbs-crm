"use client"

import React, { useCallback, useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { useContextualAIAction } from "@/hooks/useContextualAIAction"
import { detectContext } from "@/lib/ai/context-detector"
import type { AIActionType, AIPageContext } from "@/lib/ai/types"
import { AIAssistantDialog } from "./AIAssistantDialog"
import { AIActionsPanel } from "./AIActionsPanel"

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
  const [actionsOpen, setActionsOpen] = useState(false)
  const [context, setContext] = useState<AIPageContext | null>(null)

  // Update context when pathname changes
  useEffect(() => {
    setContext(detectContext(pathname))
  }, [pathname])

  // Get entity data from the currently open modal or page
  // This is a simplified approach: the component reads from data attributes
  // on the page, or from the intervention modal state
  const getEntityData = useCallback((): Record<string, unknown> | null => {
    // Try to find entity data from a data attribute on the page
    const dataEl = document.querySelector('[data-ai-entity]')
    if (dataEl) {
      try {
        const raw = dataEl.getAttribute('data-ai-entity')
        if (raw) return JSON.parse(raw)
      } catch {
        // Invalid JSON, ignore
      }
    }
    return null
  }, [])

  // Execute an action with entity data
  const handleAction = useCallback((action: AIActionType) => {
    const entityData = getEntityData()
    executeAction(action, entityData)
  }, [executeAction, getEntityData])

  // Handle action from the actions panel
  const handleSelectAction = useCallback((action: AIActionType) => {
    setActionsOpen(false)
    handleAction(action)
  }, [handleAction])

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
