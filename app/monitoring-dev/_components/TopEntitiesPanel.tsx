"use client"

import { useMemo } from "react"
import { useTopEntities } from "@/hooks/useTopEntities"
import { useReferenceDataQuery } from "@/hooks/useReferenceDataQuery"
import { useInterventionModal } from "@/hooks/useInterventionModal"
import { useArtisanModal } from "@/hooks/useArtisanModal"
import { categoryMeta, categoryOf } from "@/lib/monitoring/activity-categories"
import { Skeleton } from "@/components/ui/skeleton"

function fmtDateTime(iso: string | null): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
}
function initialsOf(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean)
  if (!p.length) return "?"
  return (p.length === 1 ? p[0].slice(0, 2) : p[0][0] + p[p.length - 1][0]).toUpperCase()
}
const tint = (c: string, a = 0.08) =>
  c.startsWith("#") ? `${c}${Math.round(a * 255).toString(16).padStart(2, "0")}` : c.replace(/\)\s*$/, ` / ${a})`)

interface TopEntitiesPanelProps {
  startDate: Date
  endDate: Date
  userIds: string[]
}

/** Dossiers (interventions/artisans) les plus actifs : type, dernière action + auteur, contributeurs. */
export function TopEntitiesPanel({ startDate, endDate, userIds }: TopEntitiesPanelProps) {
  const scoped = userIds.length ? userIds : null
  const { data, isLoading, isError } = useTopEntities(startDate, endDate, 20, scoped)
  const { data: refData } = useReferenceDataQuery()
  const interventionModal = useInterventionModal()
  const artisanModal = useArtisanModal()

  const userMap = useMemo(() => {
    const map = new Map<string, { name: string; color: string | null }>()
    const list = refData?.allUsers ?? refData?.users ?? []
    for (const u of list) {
      const name = [u.firstname, u.lastname].filter(Boolean).join(" ") || u.username || u.code_gestionnaire || "—"
      map.set(u.id, { name, color: u.color })
    }
    return map
  }, [refData])

  if (isLoading) {
    return (
      <div className="space-y-2 p-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-lg" />
        ))}
      </div>
    )
  }
  if (isError) {
    return <p className="py-6 text-center text-sm text-destructive">Erreur lors du chargement des dossiers.</p>
  }
  const entities = data ?? []
  if (entities.length === 0) {
    return <p className="py-10 text-center text-sm italic text-muted-foreground">Aucun dossier actif sur la période.</p>
  }

  return (
    <div className="h-full min-h-0 space-y-2 overflow-y-auto p-3">
      {entities.map((e) => {
        const isInter = e.entity_type === "intervention"
        const color = isInter ? "hsl(var(--chart-3))" : "hsl(var(--chart-1))"
        const lastLabel = e.last_action_type ? categoryMeta(categoryOf(e.last_action_type)).label : "—"
        const contributors = (e.actors ?? [])
          .map((a) => {
            const u = a.actor_user_id ? userMap.get(a.actor_user_id) : undefined
            const c = a.color || u?.color || "hsl(var(--muted-foreground))"
            const name = u?.name ?? "—"
            return { name, initials: initialsOf(name), color: c, count: a.count, width: e.count > 0 ? (a.count / e.count) * 100 : 0 }
          })
          .sort((a, b) => b.count - a.count)
        const multi = contributors.length > 1
        return (
          <button
            key={`${e.entity_type}-${e.entity_id}`}
            type="button"
            onClick={() => (isInter ? interventionModal.open(e.entity_id) : artisanModal.open(e.entity_id))}
            className="flex w-full items-center gap-3 rounded-lg border border-border p-2.5 text-left transition-colors hover:bg-muted/50"
            style={{ borderLeft: `4px solid ${color}` }}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span style={{ color }}>{isInter ? "◳" : "◈"}</span>
                <span className="truncate font-mono text-[12px] font-extrabold" style={{ color }}>
                  {e.entity_label ?? e.entity_id.slice(0, 8)}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  {isInter ? "inter" : "artisan"}
                </span>
              </div>
              <span className="mt-0.5 block truncate text-[10.5px] text-muted-foreground">
                Dernière : {lastLabel} · {fmtDateTime(e.last_action_at)}
                {e.last_actor?.display ? ` · ${e.last_actor.display}` : ""}
              </span>
              {contributors.length > 0 && (
                <div className="mt-1.5 flex h-[18px] overflow-hidden rounded-md bg-muted/50">
                  {contributors.map((c, i) => (
                    <div
                      key={i}
                      title={`${c.name} · ${c.count} action${c.count > 1 ? "s" : ""}`}
                      className="flex items-center justify-center gap-1 overflow-hidden"
                      style={{ width: `${c.width}%`, minWidth: "22px", background: c.color }}
                    >
                      <span className="text-[8px] font-extrabold text-white">{c.initials}</span>
                      <span className="text-[9px] font-extrabold tabular-nums text-white" style={{ textShadow: "0 1px 1px rgba(0,0,0,.22)" }}>{c.count}</span>
                    </div>
                  ))}
                </div>
              )}
              {multi && (
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <span className="text-[8.5px] font-bold uppercase tracking-wide text-muted-foreground">{contributors.length} intervenants ·</span>
                  {contributors.map((c, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 rounded-full py-px pl-0.5 pr-1.5 text-[10px] font-bold"
                      style={{ background: tint(c.color, 0.08), color: c.color }}
                    >
                      <span className="flex h-[15px] w-[15px] items-center justify-center rounded-full text-[7.5px] font-extrabold text-white" style={{ background: c.color }}>{c.initials}</span>
                      {c.count} action{c.count > 1 ? "s" : ""}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex shrink-0 flex-col items-center">
              <span className="text-[19px] font-extrabold tabular-nums" style={{ color }}>{e.count}</span>
              <span className="text-[8.5px] font-bold uppercase tracking-wide text-muted-foreground">actions</span>
            </div>
          </button>
        )
      })}
    </div>
  )
}
