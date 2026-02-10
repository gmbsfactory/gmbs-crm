"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Github, FileText, DollarSign } from "lucide-react"

const ACTIONS = [
  { id: "github", label: "Github", description: "Voir le ticket lié", icon: Github },
  { id: "docs", label: "Documents", description: "Gérer les fichiers", icon: FileText },
  { id: "earn", label: "Marge", description: "Ajuster la rentabilité", icon: DollarSign },
]

export interface AnimatedCardProps {
  statusColor?: string
  isKeyboardMode?: boolean
  selectedCardIndex?: number
  selectedActionIndex?: number
  onCardSelect?: (index: number) => void
  onMouseEnter?: () => void
  onMouseLeave?: () => void
}

export default function AnimatedCard({
  statusColor = "#6366F1",
  isKeyboardMode = false,
  selectedCardIndex = -1,
  selectedActionIndex = -1,
  onCardSelect,
  onMouseEnter,
  onMouseLeave,
}: AnimatedCardProps) {
  return (
    <div
      className="w-[220px] rounded-lg border border-border/60 bg-card p-3 shadow-lg transition-all"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">
        Actions rapides
      </div>
      <div className="space-y-2">
        {ACTIONS.map((action, index) => {
          const Icon = action.icon
          const isActive = selectedCardIndex === index && isKeyboardMode && selectedActionIndex === 2
          return (
            <button
              key={action.id}
              type="button"
              className={cn(
                "w-full rounded-lg border border-transparent bg-muted/30 px-3 py-2 text-left transition-all",
                "hover:border-muted-foreground/20 hover:bg-muted/50 hover:shadow-sm",
                isActive && "ring-2 ring-offset-1",
              )}
              style={isActive ? { boxShadow: `0 0 0 2px ${statusColor}` } : undefined}
              onFocus={() => onCardSelect?.(index)}
              onMouseEnter={() => onCardSelect?.(index)}
              onClick={() => onCardSelect?.(index)}
            >
              <div className="flex items-center gap-3">
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-md bg-muted"
                  style={isActive ? { backgroundColor: statusColor, color: "white" } : undefined}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <div>
                  <div className="text-sm font-semibold text-foreground">{action.label}</div>
                  <div className="text-xs text-muted-foreground">{action.description}</div>
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
