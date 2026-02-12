"use client"

import React from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { ACTION_LABELS, ACTION_DESCRIPTIONS } from "@/lib/ai/prompts"
import type { AIActionType, AIPageContext } from "@/lib/ai/types"
import { cn } from "@/lib/utils"

interface AIActionsPanelProps {
  isOpen: boolean
  onClose: () => void
  onSelectAction: (action: AIActionType) => void
  context: AIPageContext | null
}

/**
 * Icons for each action type
 */
const ACTION_ICONS: Record<AIActionType, string> = {
  summary: 'R',
  next_steps: 'E',
  email_artisan: 'A',
  email_client: 'C',
  find_artisan: 'F',
  suggestions: 'S',
  stats_insights: 'I',
}

/**
 * Keyboard shortcut hints for each action
 */
const ACTION_SHORTCUTS: Partial<Record<AIActionType, string>> = {
  summary: 'R',
  suggestions: 'S',
  find_artisan: 'F',
}

/**
 * Panel de selection des actions IA disponibles.
 * Affiche dans le contexte courant (page + entite).
 * Ouvert via Cmd+Shift+A.
 */
export function AIActionsPanel({ isOpen, onClose, onSelectAction, context }: AIActionsPanelProps) {
  const actions = context?.availableActions ?? []

  if (actions.length === 0 && isOpen) {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-[400px] bg-background border border-border shadow-lg rounded-lg p-0 z-[100]" overlayClassName="z-[99]">
          <DialogHeader className="px-6 pt-6 pb-4">
            <DialogTitle className="text-base font-semibold">AI Assistant</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Aucune action IA disponible sur cette page.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[440px] bg-background border border-border shadow-lg rounded-lg p-0 z-[100]" overlayClassName="z-[99]">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="text-base font-semibold flex items-center gap-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-70"><path d="M12 2a4 4 0 0 0-4 4v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2h-2V6a4 4 0 0 0-4-4z"/><circle cx="12" cy="15" r="2"/></svg>
            AI Assistant
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {context?.page ? `Page : ${context.page.replace(/_/g, ' ')}` : 'Selectionnez une action'}
          </DialogDescription>
        </DialogHeader>

        <div className="px-3 pb-3">
          {actions.map((action) => (
            <button
              key={action}
              onClick={() => {
                onClose()
                onSelectAction(action)
              }}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-left",
                "hover:bg-muted/70 transition-colors group"
              )}
            >
              {/* Icon circle */}
              <div className="flex-shrink-0 w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
                {ACTION_ICONS[action]}
              </div>
              {/* Label + description */}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{ACTION_LABELS[action]}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {ACTION_DESCRIPTIONS[action]}
                </div>
              </div>
              {/* Shortcut hint */}
              {ACTION_SHORTCUTS[action] && (
                <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded border border-border bg-muted text-[10px] text-muted-foreground font-mono">
                  {navigator.platform?.includes('Mac') ? '⌘⇧' : 'Ctrl+Shift+'}{ACTION_SHORTCUTS[action]}
                </kbd>
              )}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
