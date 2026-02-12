"use client"
import { useEffect } from "react"

export interface KeyboardShortcutsOptions {
  onFocusSearch: () => void
  onClearSearch: () => void
  onSelectAll: () => void
  // AI shortcuts (Option C)
  onAIAssistant?: () => void     // Cmd+Shift+A : Open AI actions panel
  onAISummary?: () => void       // Cmd+Shift+R : Resume contextuel
  onAISuggestions?: () => void   // Cmd+Shift+S : Suggestions
  onAIFindArtisan?: () => void   // Cmd+Shift+F : Trouver artisan
}

export function useKeyboardShortcuts(opts: KeyboardShortcutsOptions) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      // Check if a modal or dialog is open before handling shortcuts
      const hasOpenModal = document.querySelector('[role="dialog"], [role="alertdialog"]')
      const hasOpenMenu = document.querySelector('[role="menu"]')

      // --- AI Shortcuts (Cmd/Ctrl + Shift + key) ---
      // These work even when modals are open (the AI dialog will replace them)
      if (e.shiftKey && (e.metaKey || e.ctrlKey)) {
        switch (e.key.toUpperCase()) {
          case 'A':
            if (opts.onAIAssistant) {
              e.preventDefault()
              opts.onAIAssistant()
              return
            }
            break
          case 'R':
            if (opts.onAISummary) {
              e.preventDefault()
              opts.onAISummary()
              return
            }
            break
          case 'S':
            if (opts.onAISuggestions) {
              e.preventDefault()
              opts.onAISuggestions()
              return
            }
            break
          case 'F':
            if (opts.onAIFindArtisan) {
              e.preventDefault()
              opts.onAIFindArtisan()
              return
            }
            break
        }
      }

      // --- Existing shortcuts ---
      if (e.key === "/" && !e.metaKey && !e.ctrlKey && !hasOpenModal && !hasOpenMenu) {
        e.preventDefault();
        opts.onFocusSearch()
      }
      // Only clear search if no modal is open (modals handle their own Escape)
      if (e.key === "Escape" && !hasOpenModal && !hasOpenMenu) {
        opts.onClearSearch()
      }
      if ((e.key === "a" || e.key === "A") && (e.metaKey || e.ctrlKey) && !e.shiftKey && !hasOpenModal) {
        e.preventDefault();
        opts.onSelectAll()
      }
    }
    window.addEventListener("keydown", h)
    return () => window.removeEventListener("keydown", h)
  }, [opts])
}
