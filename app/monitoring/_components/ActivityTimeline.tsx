"use client"

import {
  Plus,
  Edit,
  ArrowRight,
  MessageSquare,
  FileText,
  DollarSign,
  CreditCard,
  UserPlus,
  Activity,
  type LucideIcon,
} from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"

interface RecentAction {
  action_type: string
  intervention_id: string
  occurred_at: string
}

interface ActivityTimelineProps {
  actions: RecentAction[]
}

const ACTION_CONFIG: Record<string, { icon: LucideIcon; label: string }> = {
  CREATE: { icon: Plus, label: "Creation" },
  UPDATE: { icon: Edit, label: "Modification" },
  STATUS_CHANGE: { icon: ArrowRight, label: "Changement de statut" },
  COMMENT_ADD: { icon: MessageSquare, label: "Commentaire" },
  DOCUMENT_ADD: { icon: FileText, label: "Document ajoute" },
  COST_ADD: { icon: DollarSign, label: "Cout ajoute" },
  PAYMENT_ADD: { icon: CreditCard, label: "Paiement ajoute" },
  ARTISAN_ASSIGN: { icon: UserPlus, label: "Artisan assigne" },
}

function formatTimeAgo(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return "a l'instant"
  if (mins < 60) return `il y a ${mins}min`
  const hours = Math.floor(mins / 60)
  return `il y a ${hours}h${mins % 60 > 0 ? ` ${mins % 60}min` : ""}`
}

export function ActivityTimeline({ actions }: ActivityTimelineProps) {
  if (actions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        Aucune action recente
      </p>
    )
  }

  return (
    <ScrollArea className="max-h-[300px]">
      <div className="space-y-1 pr-3">
        {actions.map((action, index) => {
          const config = ACTION_CONFIG[action.action_type] ?? {
            icon: Activity,
            label: action.action_type,
          }
          const Icon = config.icon

          return (
            <div
              key={`${action.intervention_id}-${index}`}
              className="flex items-start gap-3 rounded-md px-3 py-2.5 transition-colors hover:bg-muted/50"
            >
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium leading-tight">
                  {config.label}
                </p>
                <div className="flex items-center justify-between gap-2 mt-0.5">
                  <span className="text-xs text-muted-foreground font-mono truncate">
                    {action.intervention_id}
                  </span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatTimeAgo(action.occurred_at)}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </ScrollArea>
  )
}
