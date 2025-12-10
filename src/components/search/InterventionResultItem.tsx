import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import type { SearchResult } from "@/types/search"
import type { InterventionSearchRecord } from "@/types/search"
import { getHighlightSegments } from "@/components/search/highlight"
import { getMatchLabel } from "@/components/search/constants"
import { getStatusDisplayLabel } from "@/lib/interventions/deposit-helpers"

interface InterventionResultItemProps {
  result: SearchResult<InterventionSearchRecord>
  query: string
  matchLabel?: string
  onClick?: () => void
  isActive?: boolean
}

const renderSegments = (segments: ReturnType<typeof getHighlightSegments>) => {
  return segments.map((segment, index) => (
    <span
      key={`${segment.text}-${index}`}
      className={segment.isMatch ? "search-highlight" : undefined}
    >
      {segment.text}
    </span>
  ))
}

const formatDate = (value: string | null | undefined) => {
  if (!value) return null
  try {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return null
    return date.toLocaleDateString("fr-FR")
  } catch (_error) {
    return null
  }
}

const resolveIdLabel = (data: InterventionSearchRecord) => {
  if (data.id_inter) return data.id_inter
  return data.id.slice(0, 8).toUpperCase()
}

const computeInitials = (...parts: Array<string | null | undefined>) => {
  const filtered = parts.filter((part) => part && part.trim().length > 0) as string[]
  if (filtered.length === 0) return null
  return filtered
    .map((part) => part.trim()[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 2)
}

export function InterventionResultItem({ result, query, matchLabel, onClick, isActive }: InterventionResultItemProps) {
  const { data, score } = result
  const interventionId = resolveIdLabel(data)
  const title = data.contexte_intervention ?? "Intervention"
  const contact = data.tenant ?? data.clients ?? null
  const clientName = [contact?.firstname, contact?.lastname].filter(Boolean).join(" ")
  const clientDisplay = clientName || "Client inconnu"
  const addressParts = [data.adresse, data.code_postal, data.ville].filter(Boolean)
  const addressDisplay = addressParts.join(", ") || "Adresse non renseignée"

  const sstPayment = data.payments?.find(p => p.payment_type === 'acompte_sst')
  const clientPayment = data.payments?.find(p => p.payment_type === 'acompte_client')
  const statusLabel = getStatusDisplayLabel(
    data.status?.code ?? undefined,
    data.status?.label ?? "Statut inconnu",
    sstPayment,
    clientPayment
  )

  const statusColor = data.status?.color ?? undefined
  const statusCode = data.status?.code ?? undefined
  const dueDate = formatDate(data.due_date ?? data.date_prevue ?? data.date)
  const primaryArtisan = data.primaryArtisan ?? null
  const artisanCode = primaryArtisan?.numero_associe ?? null
  const artisanInitials = artisanCode ?? computeInitials(data.assigned_user?.code_gestionnaire, data.assigned_user?.username)
  const matchFieldLabel = getMatchLabel(matchLabel ?? result.matchedFields[0])
  const bestMatch = score >= 95

  const idSegments = getHighlightSegments(interventionId, query)
  const titleSegments = getHighlightSegments(title, query)
  const clientSegments = getHighlightSegments(clientDisplay, query)
  const addressSegments = getHighlightSegments(addressDisplay, query)

  const itemRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (isActive && itemRef.current) {
      itemRef.current.scrollIntoView({ block: "nearest", behavior: "smooth" })
    }
  }, [isActive])

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.key === "Enter" || e.key === " ") && onClick) {
        e.preventDefault()
        onClick()
      }
    },
    [onClick]
  )

  return (
    <div
      ref={itemRef}
      id={`search-result-intervention-${data.id}`}
      className={`flex items-start gap-3 p-3 transition-colors border-b last:border-b-0 ${onClick ? 'cursor-pointer' : ''
        } ${isActive ? 'bg-accent' : 'hover:bg-accent/50'}`}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      role={onClick ? "option" : undefined}
      aria-selected={isActive}
      tabIndex={onClick ? 0 : undefined}
    >
      <Avatar className="h-9 w-9 bg-primary/10 text-primary">
        <AvatarFallback className="text-xs font-semibold text-primary">
          {artisanInitials ?? "?"}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
              <span className="font-mono font-semibold text-primary">{renderSegments(idSegments)}</span>
              <span>{renderSegments(titleSegments)}</span>
              {bestMatch ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-[10px] font-medium text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200">
                  ⭐ Meilleur match
                </span>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>👤</span>
              <span>{artisanCode ?? "Non assigné"}</span>
              <span>•</span>
              <span>{renderSegments(clientSegments)}</span>
            </div>
          </div>
          <div className="text-[10px] font-mono text-muted-foreground">SCORE: {Math.round(score)}</div>
        </div>

        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <span>📍</span>
          <span className="flex-1 break-words leading-snug">{renderSegments(addressSegments)}</span>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <span>🏷️</span>
            <Badge
              variant="secondary"
              className="px-2 py-0 text-[11px] font-medium"
              style={statusColor ? { backgroundColor: `${statusColor}20`, color: statusColor } : undefined}
            >
              {statusLabel}
            </Badge>
          </div>
          {statusCode ? <span className="text-[10px] uppercase tracking-wide text-muted-foreground/70">{statusCode}</span> : null}
          {dueDate ? (
            <div className="flex items-center gap-1">
              <span>📅</span>
              <span>{dueDate}</span>
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span>🎯</span>
          <span>Match: {matchFieldLabel}</span>
        </div>
      </div>
    </div>
  )
}
