"use client"

import { useCallback, useEffect } from "react"

interface UsePageKeyboardShortcutsOptions {
  /** Pastilles de vue : liste ordonnée des IDs */
  viewIds?: string[]
  /** ID de la vue active */
  activeViewId?: string | null
  /** Callback pour changer de vue */
  onViewChange?: (id: string) => void
  /** Callback page suivante */
  onNextPage?: () => void
  /** Callback page précédente */
  onPreviousPage?: () => void
  /** Désactiver le hook */
  enabled?: boolean
}

function shouldIgnoreEvent(): boolean {
  const el = document.activeElement
  if (el) {
    const tag = el.tagName
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true
    if ((el as HTMLElement).isContentEditable) return true
  }
  if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return true
  return false
}

export function usePageKeyboardShortcuts({
  viewIds,
  activeViewId,
  onViewChange,
  onNextPage,
  onPreviousPage,
  enabled = true,
}: UsePageKeyboardShortcutsOptions) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return
      if (shouldIgnoreEvent()) return

      // Shift + ←/→ → pagination
      if (e.shiftKey) {
        e.preventDefault()
        if (e.key === "ArrowRight") onNextPage?.()
        else onPreviousPage?.()
        return
      }

      // ←/→ → pastilles de vue
      if (viewIds && viewIds.length > 0 && onViewChange && activeViewId) {
        const idx = viewIds.indexOf(activeViewId)
        if (idx === -1) return

        e.preventDefault()
        if (e.key === "ArrowRight") {
          const next = idx < viewIds.length - 1 ? idx + 1 : 0
          onViewChange(viewIds[next])
        } else {
          const prev = idx > 0 ? idx - 1 : viewIds.length - 1
          onViewChange(viewIds[prev])
        }
      }
    },
    [enabled, viewIds, activeViewId, onViewChange, onNextPage, onPreviousPage],
  )

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleKeyDown])
}
