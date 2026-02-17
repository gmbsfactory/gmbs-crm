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
  Wrench,
  MapPin,
  CalendarOff,
  Archive,
  RotateCcw,
  type LucideIcon,
} from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"

interface RecentAction {
  action_type: string
  entity_type: 'intervention' | 'artisan'
  entity_id: string
  entity_label: string | null
  occurred_at: string
  changed_fields: string[] | null
}

interface ActivityTimelineProps {
  actions: RecentAction[]
}

const INTERVENTION_ACTION_CONFIG: Record<string, { icon: LucideIcon; label: string }> = {
  CREATE: { icon: Plus, label: "Creation" },
  UPDATE: { icon: Edit, label: "Modification" },
  STATUS_CHANGE: { icon: ArrowRight, label: "Changement de statut" },
  COMMENT_ADD: { icon: MessageSquare, label: "Commentaire" },
  DOCUMENT_ADD: { icon: FileText, label: "Document ajoute" },
  COST_ADD: { icon: DollarSign, label: "Cout ajoute" },
  COST_UPDATE: { icon: DollarSign, label: "Cout modifie" },
  COST_DELETE: { icon: DollarSign, label: "Cout supprime" },
  PAYMENT_ADD: { icon: CreditCard, label: "Paiement ajoute" },
  PAYMENT_UPDATE: { icon: CreditCard, label: "Paiement modifie" },
  PAYMENT_DELETE: { icon: CreditCard, label: "Paiement supprime" },
  ARTISAN_ASSIGN: { icon: UserPlus, label: "Artisan assigne" },
}

const ARTISAN_ACTION_CONFIG: Record<string, { icon: LucideIcon; label: string }> = {
  CREATE: { icon: Plus, label: "Creation" },
  UPDATE: { icon: Edit, label: "Modification" },
  STATUS_CHANGE: { icon: ArrowRight, label: "Changement de statut" },
  ARCHIVE: { icon: Archive, label: "Archive" },
  RESTORE: { icon: RotateCcw, label: "Restaure" },
  METIER_ADD: { icon: Wrench, label: "Metier ajoute" },
  METIER_REMOVE: { icon: Wrench, label: "Metier retire" },
  ZONE_ADD: { icon: MapPin, label: "Zone ajoutee" },
  ZONE_REMOVE: { icon: MapPin, label: "Zone retiree" },
  ABSENCE_ADD: { icon: CalendarOff, label: "Absence ajoutee" },
  ABSENCE_UPDATE: { icon: CalendarOff, label: "Absence modifiee" },
  ABSENCE_DELETE: { icon: CalendarOff, label: "Absence supprimee" },
  DOCUMENT_ADD: { icon: FileText, label: "Document ajoute" },
  DOCUMENT_UPDATE: { icon: FileText, label: "Document modifie" },
  DOCUMENT_DELETE: { icon: FileText, label: "Document supprime" },
  COMMENT_ADD: { icon: MessageSquare, label: "Commentaire" },
  COMMENT_UPDATE: { icon: MessageSquare, label: "Commentaire modifie" },
  COMMENT_DELETE: { icon: MessageSquare, label: "Commentaire supprime" },
}

const ENTITY_COLORS: Record<string, string> = {
  intervention: "text-blue-500",
  artisan: "text-violet-500",
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
          const configMap = action.entity_type === 'artisan'
            ? ARTISAN_ACTION_CONFIG
            : INTERVENTION_ACTION_CONFIG
          const config = configMap[action.action_type] ?? {
            icon: Activity,
            label: action.action_type,
          }
          const Icon = config.icon
          const entityColor = ENTITY_COLORS[action.entity_type] ?? "text-muted-foreground"

          return (
            <div
              key={`${action.entity_id}-${index}`}
              className="flex items-start gap-3 rounded-md px-3 py-2.5 transition-colors hover:bg-muted/50"
            >
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium leading-tight">
                    {config.label}
                  </p>
                  <span className={`text-[10px] font-medium uppercase ${entityColor}`}>
                    {action.entity_type === 'artisan' ? 'Artisan' : 'Inter.'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 mt-0.5">
                  <span className="text-xs text-muted-foreground truncate">
                    {action.entity_label || action.entity_id.slice(0, 8)}
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
