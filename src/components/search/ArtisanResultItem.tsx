import * as React from "react"
import type { SearchResult } from "@/types/search"
import type { ArtisanSearchRecord } from "@/types/search"
import { getHighlightSegments } from "@/components/search/highlight"
import { METIER_ICON_MAP, getMatchLabel } from "@/components/search/constants"

interface ArtisanResultItemProps {
  result: SearchResult<ArtisanSearchRecord>
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

const formatPhone = (value: string | null | undefined) => {
  if (!value) return null
  const digits = value.replace(/\D+/g, "")
  if (digits.length < 4) return value
  return digits.replace(/(\d{2})(?=\d)/g, "$1 ").trim()
}

const getDisplayName = (record: ArtisanSearchRecord) => {
  const parts = [record.prenom, record.nom].filter(Boolean)
  if (parts.length === 0) {
    return record.raison_sociale ?? record.plain_nom ?? "Artisan"
  }
  return parts.join(" ")
}

export function ArtisanResultItem({ result, query, matchLabel, onClick, isActive }: ArtisanResultItemProps) {
  const { data, score } = result
  const code = data.numero_associe ?? "—"
  const displayName = getDisplayName(data)
  const company = data.raison_sociale ?? null
  const phone = formatPhone(data.telephone ?? data.telephone2 ?? null)
  const primaryMetier = React.useMemo(() => {
    const primary = data.metiers.find((entry) => entry.is_primary)
    return primary?.metier ?? data.metiers[0]?.metier ?? null
  }, [data.metiers])
  const metierLabel = primaryMetier?.label ?? null
  const metierCode = primaryMetier?.code ?? ""
  const metierEmoji = metierCode && METIER_ICON_MAP[metierCode.toUpperCase()] ? METIER_ICON_MAP[metierCode.toUpperCase()] : "🔧"
  const interventionsCount = data.activeInterventionCount ?? 0

  const nameSegments = getHighlightSegments(displayName, query)
  const companySegments = company ? getHighlightSegments(company, query) : null
  const codeSegments = getHighlightSegments(code, query)

  const bestMatch = score >= 95
  const resolvedMatchLabel = getMatchLabel(matchLabel ?? result.matchedFields[0])

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
      id={`search-result-artisan-${data.id}`}
      className={`flex items-start gap-3 p-3 transition-colors border-b last:border-b-0 ${
        onClick ? 'cursor-pointer' : ''
      } ${isActive ? 'bg-accent' : 'hover:bg-accent/50'}`}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      role={onClick ? "option" : undefined}
      aria-selected={isActive}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="flex-1 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <span className="rounded border px-2 py-0.5 font-mono text-xs uppercase tracking-wide">
                {renderSegments(codeSegments)}
              </span>
              <span>{renderSegments(nameSegments)}</span>
              {bestMatch ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-[10px] font-medium text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200">
                  ⭐ Meilleur match
                </span>
              ) : null}
            </div>
            {companySegments ? (
              <div className="text-xs text-muted-foreground">{renderSegments(companySegments)}</div>
            ) : null}
          </div>
          <div className="text-[10px] font-mono text-muted-foreground">SCORE: {Math.round(score)}</div>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          {phone ? (
            <div className="flex items-center gap-1">
              <span>📞</span>
              <span>{phone}</span>
            </div>
          ) : null}
          {metierLabel ? (
            <div className="flex items-center gap-1">
              <span>{metierEmoji}</span>
              <span>{metierLabel}</span>
            </div>
          ) : null}
          <div className="flex items-center gap-1">
            <span>📊</span>
            <span>
              {interventionsCount} intervention{interventionsCount > 1 ? "s" : ""} active{interventionsCount > 1 ? "s" : ""}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span>🎯</span>
          <span>Match: {resolvedMatchLabel}</span>
        </div>
      </div>
    </div>
  )
}
