"use client"

import { useMemo, useState } from "react"
import { format, formatDistanceToNow, isValid, parseISO } from "date-fns"
import { fr } from "date-fns/locale"
import { ArrowRight, ChevronDown, ExternalLink } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"
import type { InterventionHistoryItem } from "@/hooks/useInterventionHistory"
import { HistoryItemIcon } from "./HistoryItemIcon"

const FIELD_LABELS: Record<string, string> = {
  adresse: "Adresse",
  code_postal: "Code postal",
  ville: "Ville",
  contexte_intervention: "Contexte",
  consigne_intervention: "Consigne",
  agence_id: "Agence",
  metier_id: "Métier",
  assigned_user_id: "Assigné à",
  date_prevue: "Date prévue",
  date_termine: "Date terminée",
  is_active: "Actif",
  reference_agence: "Référence agence",
  telephone_locataire: "Téléphone",
  nom_locataire: "Locataire",
}

const COST_TYPE_LABELS: Record<string, string> = {
  sst: "SST",
  materiel: "Matériel",
  intervention: "Intervention",
  marge: "Marge",
}

const MAX_DIFF_FIELDS = 4

const formatCurrency = (amount: number, currency?: string | null) => {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: currency || "EUR",
  }).format(amount)
}

const truncate = (value: string, max = 100) => {
  if (value.length <= max) return value
  return `${value.slice(0, max - 3)}…`
}

const safeParseDate = (value: string | null | undefined) => {
  if (!value) return null
  const parsed = parseISO(value)
  if (isValid(parsed)) return parsed
  const fallback = new Date(value)
  return Number.isNaN(fallback.getTime()) ? null : fallback
}

const formatValue = (value: unknown, field?: string): string => {
  if (value === null || value === undefined || value === "") return "—"
  if (typeof value === "boolean") return value ? "Oui" : "Non"
  if (typeof value === "number") {
    if (field && /amount|cost|cout|marge/i.test(field)) {
      return formatCurrency(value)
    }
    return new Intl.NumberFormat("fr-FR").format(value)
  }
  if (typeof value === "string") {
    const trimmed = value.trim()
    if (!trimmed) return "—"
    const maybeDate = safeParseDate(trimmed)
    if (maybeDate && /t/i.test(trimmed)) {
      return format(maybeDate, "dd/MM/yyyy HH:mm", { locale: fr })
    }
    return truncate(trimmed, 150)
  }
  if (Array.isArray(value)) {
    return value.map((item) => formatValue(item, field)).join(", ")
  }
  if (typeof value === "object") {
    try {
      return truncate(JSON.stringify(value), 150)
    } catch {
      return "—"
    }
  }
  return String(value)
}

const getActorLabel = (item: InterventionHistoryItem) => {
  return item.actor_display || item.actor_code || "Système"
}

const getActionLabel = (item: InterventionHistoryItem) => {
  return item.action_label || item.action_type || "Action"
}

const getSummary = (item: InterventionHistoryItem) => {
  const actionType = (item.action_type || "").toUpperCase()
  const oldValues = item.old_values ?? {}
  const newValues = item.new_values ?? {}

  if (actionType === "STATUS_CHANGE") {
    const fromStatus = (oldValues as Record<string, unknown>)?.status_code ?? (oldValues as Record<string, unknown>)?.status_id
    const toStatus = (newValues as Record<string, unknown>)?.status_code ?? (newValues as Record<string, unknown>)?.status_id
    return (
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="history-item-status-badge">
          {formatValue(fromStatus)}
        </Badge>
        <ArrowRight className="h-3 w-3 text-muted-foreground" />
        <Badge className="history-item-status-badge history-item-status-badge--new">
          {formatValue(toStatus)}
        </Badge>
      </div>
    )
  }

  if (actionType.startsWith("COST_")) {
    const values = actionType.endsWith("DELETE") ? oldValues : newValues
    const costTypeRaw = (values as Record<string, unknown>)?.cost_type as string | undefined
    const costType = costTypeRaw ? COST_TYPE_LABELS[costTypeRaw] || costTypeRaw : "Coût"
    const amount = (values as Record<string, unknown>)?.amount as number | null | undefined
    const label = (values as Record<string, unknown>)?.label as string | undefined
    if (!amount && !label) return null
    return (
      <div className="history-item-summary-text">
        <span className="font-medium">{label || costType}</span>
        {amount !== null && amount !== undefined && (
          <span className="ml-2 history-item-amount">
            {formatCurrency(amount, (values as Record<string, unknown>)?.currency as string | null)}
          </span>
        )}
      </div>
    )
  }

  if (actionType.startsWith("PAYMENT_")) {
    const values = actionType.endsWith("DELETE") ? oldValues : newValues
    const amount = (values as Record<string, unknown>)?.amount as number | null | undefined
    const paymentType = (values as Record<string, unknown>)?.payment_type as string | undefined
    const reference = (values as Record<string, unknown>)?.reference as string | undefined
    if (!amount && !paymentType && !reference) return null
    return (
      <div className="history-item-summary-text">
        {paymentType && <span className="font-medium">{paymentType}</span>}
        {amount !== null && amount !== undefined && (
          <span className="ml-2 history-item-amount">
            {formatCurrency(amount, (values as Record<string, unknown>)?.currency as string | null)}
          </span>
        )}
        {reference && <span className="ml-2 text-muted-foreground">#{reference}</span>}
      </div>
    )
  }

  if (actionType.startsWith("DOCUMENT_")) {
    const values = actionType.endsWith("DELETE") ? oldValues : newValues
    const filename = (values as Record<string, unknown>)?.filename as string | undefined
    const kind = (values as Record<string, unknown>)?.kind as string | undefined
    if (!filename && !kind) return null
    return (
      <div className="history-item-summary-text">
        <span className="font-medium">{truncate(filename || "Document", 60)}</span>
        {kind && <Badge variant="outline" className="ml-2 text-[9px]">{kind}</Badge>}
      </div>
    )
  }

  if (actionType.startsWith("COMMENT_")) {
    const values = actionType.endsWith("DELETE") ? oldValues : newValues
    const content = (values as Record<string, unknown>)?.content as string | undefined
    if (!content) return null
    return (
      <div className="history-item-summary-text italic">
        &ldquo;{truncate(content, 100)}&rdquo;
      </div>
    )
  }

  if (actionType.startsWith("ARTISAN_")) {
    const values = actionType.endsWith("UNASSIGN") ? oldValues : newValues
    const artisanOrder = (values as Record<string, unknown>)?.artisan_order as number | undefined
    return (
      <div className="history-item-summary-text">
        {artisanOrder !== undefined && (
          <Badge variant="outline" className="text-[9px]">Position {artisanOrder}</Badge>
        )}
      </div>
    )
  }

  if (actionType === "CREATE") {
    const idInter = (newValues as Record<string, unknown>)?.id_inter as string | undefined
    const adresse = (newValues as Record<string, unknown>)?.adresse as string | undefined
    if (!idInter && !adresse) return null
    return (
      <div className="history-item-summary-text">
        {idInter && <Badge variant="outline" className="font-mono text-[9px]">#{idInter}</Badge>}
        {adresse && <span className="ml-2">{truncate(adresse, 50)}</span>}
      </div>
    )
  }

  return null
}

const buildDiffRows = (item: InterventionHistoryItem) => {
  const fields = (item.changed_fields ?? []).filter(Boolean)
  if (fields.length === 0) return null
  const displayFields = fields.slice(0, MAX_DIFF_FIELDS)
  const overflowCount = fields.length - displayFields.length
  const oldValues = item.old_values ?? {}
  const newValues = item.new_values ?? {}

  return (
    <div className="history-item-diff">
      {displayFields.map((field) => {
        const label = FIELD_LABELS[field] || field
        const oldValue = formatValue((oldValues as Record<string, unknown>)[field], field)
        const newValue = formatValue((newValues as Record<string, unknown>)[field], field)
        return (
          <div key={field} className="history-item-diff-row">
            <span className="history-item-diff-label">{label}</span>
            <div className="history-item-diff-values">
              <span className="history-item-diff-old">{oldValue}</span>
              <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground/50" />
              <span className="history-item-diff-new">{newValue}</span>
            </div>
          </div>
        )
      })}
      {overflowCount > 0 && (
        <div className="history-item-diff-overflow">
          + {overflowCount} autre{overflowCount > 1 ? "s" : ""} champ{overflowCount > 1 ? "s" : ""}
        </div>
      )}
    </div>
  )
}

interface HistoryItemProps {
  item: InterventionHistoryItem
  isFirst?: boolean
  isLast?: boolean
}

export function HistoryItem({ item, isFirst, isLast }: HistoryItemProps) {
  const [open, setOpen] = useState(false)
  const occurredAt = useMemo(() => safeParseDate(item.occurred_at), [item.occurred_at])
  const timeLabel = occurredAt ? format(occurredAt, "HH:mm", { locale: fr }) : "—"
  const relativeTime = occurredAt
    ? formatDistanceToNow(occurredAt, { addSuffix: true, locale: fr })
    : "—"

  const actionType = (item.action_type || "").toUpperCase()
  const isUpdateAction = actionType === "UPDATE" || actionType.endsWith("_UPDATE")
  const isDeleteAction = actionType.endsWith("DELETE") || actionType === "ARCHIVE"
  const diffRows = isUpdateAction ? buildDiffRows(item) : null
  const summary = getSummary(item)
  const hasDetails = Boolean(diffRows)

  const actorLabel = getActorLabel(item)
  const actionLabel = getActionLabel(item)
  const changedCount = (item.changed_fields ?? []).length

  const headerContent = (
    <div className="history-item-header">
      <div className="min-w-0 flex-1">
        <div className="history-item-title-row">
          <span className="history-item-action">{actionLabel}</span>
          {isUpdateAction && changedCount > 0 && (
            <Badge variant="secondary" className="history-item-count-badge">
              {changedCount} champ{changedCount > 1 ? "s" : ""}
            </Badge>
          )}
        </div>
        <div className="history-item-meta">
          <span
            className="history-item-actor"
            style={item.actor_color ? { 
              backgroundColor: `${item.actor_color}15`,
              color: item.actor_color,
              borderColor: `${item.actor_color}30`
            } : undefined}
          >
            {actorLabel}
          </span>
          <span className="history-item-separator">•</span>
          <span className="history-item-time" title={occurredAt ? format(occurredAt, "PPPp", { locale: fr }) : undefined}>
            {timeLabel}
          </span>
          <span className="history-item-relative">({relativeTime})</span>
        </div>
      </div>
      {hasDetails && (
        <div className={cn("history-item-chevron", open && "history-item-chevron--open")}>
          <ChevronDown className="h-4 w-4" />
        </div>
      )}
    </div>
  )

  return (
    <div className={cn(
      "history-item",
      isFirst && "history-item--first",
      isLast && "history-item--last",
      isDeleteAction && "history-item--danger"
    )}>
      {/* Timeline connector */}
      <div className="history-item-timeline">
        {!isFirst && <div className="history-item-line history-item-line--top" />}
        <HistoryItemIcon actionType={item.action_type} />
        {!isLast && <div className="history-item-line history-item-line--bottom" />}
      </div>

      {/* Content */}
      <div className="history-item-content">
        {hasDetails ? (
          <Collapsible open={open} onOpenChange={setOpen}>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="history-item-trigger"
              >
                {headerContent}
              </button>
            </CollapsibleTrigger>
            {summary && <div className="history-item-summary">{summary}</div>}
            <CollapsibleContent className="history-item-details">
              {diffRows}
            </CollapsibleContent>
          </Collapsible>
        ) : (
          <>
            {headerContent}
            {summary && <div className="history-item-summary">{summary}</div>}
          </>
        )}
      </div>
    </div>
  )
}
