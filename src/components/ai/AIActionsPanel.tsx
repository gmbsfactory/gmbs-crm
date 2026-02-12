"use client"

import React, { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { ACTION_LABELS, ACTION_DESCRIPTIONS } from "@/lib/ai/prompts"
import type { AIActionType, AIPageContext } from "@/lib/ai/types"
import type { SummaryPeriod } from "@/hooks/useAIDataSummary"
import { cn } from "@/lib/utils"

interface AIActionsPanelProps {
  isOpen: boolean
  onClose: () => void
  onSelectAction: (action: AIActionType, period?: SummaryPeriod) => void
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
  data_summary: 'D',
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
 * Labels for period selector buttons
 */
const PERIOD_OPTIONS: Array<{ value: SummaryPeriod; label: string }> = [
  { value: 'week', label: 'Semaine' },
  { value: 'month', label: 'Mois' },
  { value: 'quarter', label: 'Trimestre' },
]

/**
 * Panel de selection des actions IA disponibles.
 * Affiche dans le contexte courant (page + entite).
 * Ouvert via Cmd+Shift+A.
 */
export function AIActionsPanel({ isOpen, onClose, onSelectAction, context }: AIActionsPanelProps) {
  const actions = context?.availableActions ?? []
  const [expandedDataSummary, setExpandedDataSummary] = useState(false)

  // Reset expanded state when dialog closes
  const handleClose = () => {
    setExpandedDataSummary(false)
    onClose()
  }

  if (actions.length === 0 && isOpen) {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
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
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
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
            <div key={action}>
              <button
                onClick={() => {
                  if (action === 'data_summary') {
                    // Toggle the period selector instead of immediately executing
                    setExpandedDataSummary((prev) => !prev)
                    return
                  }
                  handleClose()
                  onSelectAction(action)
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-left",
                  "hover:bg-muted/70 transition-colors group",
                  action === 'data_summary' && expandedDataSummary && "bg-muted/50"
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
                {/* Chevron for data_summary expandable */}
                {action === 'data_summary' && (
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={cn(
                      "text-muted-foreground transition-transform duration-200",
                      expandedDataSummary && "rotate-180"
                    )}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                )}
              </button>

              {/* Period selector for data_summary */}
              {action === 'data_summary' && expandedDataSummary && (
                <div className="ml-11 mr-3 mt-1 mb-2 flex gap-2">
                  {PERIOD_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => {
                        handleClose()
                        onSelectAction('data_summary', option.value)
                      }}
                      className={cn(
                        "flex-1 px-3 py-1.5 rounded-md text-xs font-medium",
                        "border border-border bg-background",
                        "hover:bg-primary hover:text-primary-foreground hover:border-primary",
                        "transition-colors"
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
