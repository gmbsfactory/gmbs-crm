"use client"

import { useMemo } from "react"
import { usePagePresenceContext } from "@/contexts/PagePresenceContext"
import { useGlobalActivityFeed } from "@/hooks/useGlobalActivityFeed"
import { useActivityHeatmap } from "@/hooks/useActivityHeatmap"
import { useTopEntities } from "@/hooks/useTopEntities"
import { pageColor, pageLabel, pageTint } from "@/lib/monitoring/activity-categories"
import { cn } from "@/lib/utils"
import type { HeatmapCell } from "@/types/monitoring"

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
function fmtAgo(iso: string): string {
  const diff = Math.round((Date.now() - new Date(iso).getTime()) / 60_000)
  if (diff < 1) return "à l'instant"
  if (diff < 60) return `il y a ${diff} min`
  const h = Math.floor(diff / 60)
  return `il y a ${h}h${(diff % 60).toString().padStart(2, "0")}`
}
function fmtTime(iso: string | null): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
}

interface PulseViewProps {
  startDate: Date
  endDate: Date
  userIds: string[]
  onToggleUser: (userId: string) => void
  selectedIds?: string[]
}

export function PulseView({ startDate, endDate, userIds, onToggleUser, selectedIds = [] }: PulseViewProps) {
  const scoped = userIds.length ? userIds : null
  const singleDay = endDate.getTime() - startDate.getTime() <= 36 * 3_600_000
  const bucket = singleDay ? "hour" : "day"

  const presence = usePagePresenceContext()
  const online = useMemo(() => presence?.allUsers ?? [], [presence?.allUsers])

  const feed = useGlobalActivityFeed({ startDate, endDate, userIds: scoped })
  const { data: heatmap } = useActivityHeatmap(startDate, endDate, bucket, scoped)
  const { data: topEntities } = useTopEntities(startDate, endDate, 10, scoped)

  const lastActionByUser = useMemo(() => {
    const map = new Map<string, { text: string; at: string }>()
    const rows = feed.data?.pages.flatMap((p) => p.items) ?? []
    for (const r of rows) {
      const uid = r.actor?.user_id
      if (!uid || map.has(uid)) continue
      map.set(uid, { text: r.entity_label ? `${r.action_type} · ${r.entity_label}` : r.action_type, at: r.occurred_at })
    }
    return map
  }, [feed.data])

  const grid = useMemo(() => {
    const cells: HeatmapCell[] = heatmap ?? []
    const buckets = Array.from(new Set(cells.map((c) => c.bucket))).sort()
    const shown = bucket === "day" ? buckets.slice(-14) : buckets
    const byUser = new Map<string, { name: string; color: string | null; counts: Map<string, number> }>()
    let max = 1
    for (const c of cells) {
      const name = [c.firstname, c.lastname].filter(Boolean).join(" ") || c.code_gestionnaire || "—"
      const entry = byUser.get(c.user_id) ?? { name, color: c.color, counts: new Map() }
      entry.counts.set(c.bucket, (entry.counts.get(c.bucket) ?? 0) + c.count)
      if ((entry.counts.get(c.bucket) ?? 0) > max) max = entry.counts.get(c.bucket)!
      byUser.set(c.user_id, entry)
    }
    const rows = Array.from(byUser.entries()).map(([userId, e]) => ({ userId, ...e }))
    return { buckets: shown, rows, max }
  }, [heatmap, bucket])

  const headLabel = (b: string) => (bucket === "hour" ? `${parseInt(b, 10)}h` : b.slice(5))

  return (
    <div className="grid h-full min-h-0 grid-cols-1 gap-3 lg:grid-cols-[25fr_45fr_30fr]">
      {/* Rail live */}
      <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-3 text-sm font-extrabold">
          <span className="h-2 w-2 animate-pulse rounded-full" style={{ background: "hsl(var(--success-hsl))" }} />
          Pouls live
        </div>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
          {online.length === 0 && <p className="py-8 text-center text-sm italic text-muted-foreground">Personne en ligne.</p>}
          {online.map((u) => {
            const last = lastActionByUser.get(u.userId)
            return (
              <button
                key={u.userId}
                type="button"
                onClick={() => onToggleUser(u.userId)}
                className={cn(
                  "flex w-full items-start gap-2.5 rounded-xl border p-2.5 text-left hover:bg-muted/50",
                  selectedIds.includes(u.userId) ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "border-border"
                )}
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[12px] font-extrabold text-white"
                  style={{ background: u.color || "hsl(var(--primary))" }}
                >
                  {initialsOf(u.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-[12.5px] font-bold">{u.name}</span>
                    <span
                      className="shrink-0 rounded px-1.5 text-[9.5px] font-bold"
                      style={{ background: pageTint(u.currentPage), color: pageColor(u.currentPage) }}
                    >
                      {pageLabel(u.currentPage)}
                    </span>
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                    {last ? last.text : "aucune action"}
                  </span>
                  {last && <span className="mt-0.5 block font-mono text-[10px]" style={{ color: u.isIdle ? "hsl(var(--warning-hsl))" : "hsl(var(--success-hsl))" }}>{fmtAgo(last.at)}</span>}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Heatmap */}
      <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <span className="text-sm font-extrabold">Carte d&apos;activité</span>
          <span className="text-[11px] font-medium text-muted-foreground">
            {bucket === "hour" ? "par heure" : "par jour"} · intensité = nb d&apos;actions
          </span>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-4">
          {grid.rows.length === 0 ? (
            <p className="py-10 text-center text-sm italic text-muted-foreground">
              Aucune donnée (la RPC get_activity_heatmap doit être déployée).
            </p>
          ) : (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5">
                <div className="w-[92px] shrink-0" />
                <div className="grid flex-1 gap-1" style={{ gridTemplateColumns: `repeat(${grid.buckets.length}, 1fr)` }}>
                  {grid.buckets.map((b) => (
                    <span key={b} className="text-center font-mono text-[10px] font-semibold text-muted-foreground">{headLabel(b)}</span>
                  ))}
                </div>
              </div>
              {grid.rows.map((r) => (
                <div key={r.userId} className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onToggleUser(r.userId)}
                    className={cn(
                      "flex w-[92px] shrink-0 items-center gap-1.5 rounded px-1 py-0.5 hover:bg-muted/50",
                      selectedIds.includes(r.userId) && "bg-primary/10 ring-1 ring-primary/30"
                    )}
                  >
                    <span className="h-5 w-5 shrink-0 rounded-full text-[9px] font-extrabold text-white" style={{ background: r.color || "hsl(var(--primary))", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {initialsOf(r.name)}
                    </span>
                    <span className="truncate text-[11px] font-medium">{r.name.split(" ")[0]}</span>
                  </button>
                  <div className="grid flex-1 gap-1" style={{ gridTemplateColumns: `repeat(${grid.buckets.length}, 1fr)` }}>
                    {grid.buckets.map((b) => {
                      const v = r.counts.get(b) ?? 0
                      const ratio = v / grid.max
                      return (
                        <div
                          key={b}
                          title={`${r.name} · ${b} · ${v} action${v > 1 ? "s" : ""}`}
                          className="flex h-6 items-center justify-center rounded text-[10px] font-extrabold tabular-nums"
                          style={{
                            background: v === 0 ? "hsl(var(--muted) / 0.35)" : `hsl(var(--primary) / ${(0.16 + 0.62 * ratio).toFixed(2)})`,
                            color: v === 0 ? "transparent" : ratio > 0.5 ? "#fff" : "hsl(var(--primary))",
                          }}
                        >
                          {v || ""}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Dossiers les plus actifs */}
      <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="shrink-0 border-b border-border px-4 py-3 text-sm font-extrabold">Dossiers les plus actifs</div>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
          {(topEntities ?? []).length === 0 && (
            <p className="py-8 text-center text-sm italic text-muted-foreground">Aucune donnée.</p>
          )}
          {(topEntities ?? []).map((e) => {
            const isInter = e.entity_type === "intervention"
            const color = isInter ? "hsl(var(--chart-3))" : "hsl(var(--chart-1))"
            return (
              <div
                key={`${e.entity_type}-${e.entity_id}`}
                className="flex items-center gap-3 rounded-xl border border-border p-2.5"
                style={{ borderLeft: `4px solid ${color}` }}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span style={{ color }}>{isInter ? "◳" : "◈"}</span>
                    <span className="truncate font-mono text-[12px] font-extrabold" style={{ color }}>
                      {e.entity_label ?? e.entity_id.slice(0, 8)}
                    </span>
                  </div>
                  <span className="mt-0.5 block text-[10.5px] text-muted-foreground">
                    dernière action {fmtTime(e.last_action_at)}
                  </span>
                </div>
                <div className="flex shrink-0 flex-col items-center">
                  <span className="text-[17px] font-extrabold tabular-nums" style={{ color }}>{e.count}</span>
                  <span className="text-[8.5px] font-bold uppercase tracking-wide text-muted-foreground">actions</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
