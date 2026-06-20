"use client"

import { useMemo } from "react"
import { cn } from "@/lib/utils"
import { usePagePresenceContext } from "@/contexts/PagePresenceContext"
import { useTeamWeeklyStats, type DailyBreakdown } from "@/hooks/useTeamWeeklyStats"
import { pageColor, pageLabel, pageTint } from "@/lib/monitoring/activity-categories"

type LiveStatus = "active" | "idle" | "offline"

const STATUS_TOKEN: Record<LiveStatus, string> = {
  active: "--success-hsl",
  idle: "--warning-hsl",
  offline: "--muted-foreground",
}
const statusColor = (s: LiveStatus) => `hsl(var(${STATUS_TOKEN[s]}))`
const statusTint = (s: LiveStatus, a = 0.16) => `hsl(var(${STATUS_TOKEN[s]}) / ${a})`
const STATUS_TAG: Record<LiveStatus, string> = { active: "en ligne", idle: "idle", offline: "hors ligne" }
const STATUS_ORDER: Record<LiveStatus, number> = { active: 0, idle: 1, offline: 2 }

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
function fmtDur(ms: number): string {
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  return h > 0 ? `${h}h${m.toString().padStart(2, "0")}` : `${m}min`
}
function periodDistribution(days: DailyBreakdown[] | undefined): { width: string; color: string; title: string }[] {
  if (!days?.length) return []
  const byPage: Record<string, number> = {}
  for (const d of days) for (const p of d.pages) byPage[p.page] = (byPage[p.page] ?? 0) + p.duration_ms
  const total = Object.values(byPage).reduce((a, b) => a + b, 0) || 1
  return Object.entries(byPage)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([page, ms]) => {
      const pct = Math.round((ms / total) * 100)
      return { width: `${pct}%`, color: pageColor(page), title: `${pageLabel(page)} ${pct}%` }
    })
}

interface LiveRow {
  userId: string
  name: string
  initials: string
  color: string | null
  status: LiveStatus
  statusText: string
  screen: string
  actions: number
  currentPage: string | null
  hasEntity: boolean
  entityGlyph: string
  entityLabel: string
  dist: { width: string; color: string; title: string }[]
}

interface LivePanelProps {
  startDate: Date
  endDate: Date
  onToggleUser: (userId: string) => void
  selectedIds?: string[]
}

/**
 * Colonne « En direct » : roster de la période (temps écran, actions,
 * répartition par page sur la période) avec le statut temps réel (présence)
 * en overlay. Cohérent avec la période sélectionnée.
 */
export function LivePanel({ startDate, endDate, onToggleUser, selectedIds = [] }: LivePanelProps) {
  const presence = usePagePresenceContext()
  const online = useMemo(() => presence?.allUsers ?? [], [presence?.allUsers])
  const { data: stats } = useTeamWeeklyStats(startDate, endDate)

  const rows = useMemo<LiveRow[]>(() => {
    const onlineById = new Map(online.map((u) => [u.userId, u]))
    const statById = new Map((stats ?? []).map((s) => [s.user_id, s]))
    const ids = new Set<string>([...statById.keys(), ...onlineById.keys()])

    const liveStatus = (id: string): LiveStatus => {
      const u = onlineById.get(id)
      if (!u) return "offline"
      return u.isIdle ? "idle" : "active"
    }

    return Array.from(ids)
      .map((id): LiveRow => {
        const u = onlineById.get(id)
        const s = statById.get(id)
        const status = liveStatus(id)
        const name = u?.name || [s?.firstname, s?.lastname].filter(Boolean).join(" ") || s?.code_gestionnaire || "—"
        return {
          userId: id,
          name,
          initials: initialsOf(name),
          color: u?.color ?? s?.color ?? null,
          status,
          statusText: STATUS_TAG[status],
          screen: fmtDur(s?.total_screen_time_ms ?? 0),
          actions: s?.total_actions ?? 0,
          currentPage: u?.currentPage ?? null,
          hasEntity: Boolean(u?.activeInterventionId || u?.activeArtisanId),
          entityGlyph: u?.activeArtisanId ? "◈" : "◳",
          entityLabel: u?.activeArtisanId ? "Fiche artisan" : "Intervention",
          dist: periodDistribution(s?.daily_breakdown),
        }
      })
      .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || b.actions - a.actions)
  }, [online, stats])

  const onlineActive = online.filter((u) => !u.isIdle).length

  return (
    <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
        <span className="flex items-center gap-2 text-sm font-extrabold">
          <span className="h-2 w-2 animate-pulse rounded-full" style={{ background: "hsl(var(--success-hsl))" }} />
          En direct
        </span>
        <span className="text-[11px] font-medium text-muted-foreground">
          {onlineActive} en ligne · {rows.length} actif{rows.length !== 1 ? "s" : ""} sur la période
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3">
        {rows.length === 0 && (
          <p className="py-10 text-center text-sm italic text-muted-foreground">
            Aucune activité sur la période.
          </p>
        )}
        {rows.map((u) => {
          const dot = statusColor(u.status)
          const avatarColor = u.color || "hsl(var(--primary))"
          const isSelected = selectedIds.includes(u.userId)
          return (
            <button
              key={u.userId}
              type="button"
              onClick={() => onToggleUser(u.userId)}
              className={cn(
                "flex flex-col gap-2.5 rounded-xl border p-3 text-left transition-colors hover:bg-muted/50",
                isSelected ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "border-border"
              )}
            >
              <div className="flex items-center gap-3">
                <div className="relative shrink-0">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-full text-[13px] font-extrabold text-white"
                    style={{ background: avatarColor, boxShadow: `0 0 0 2.5px ${dot}, 0 0 0 4.5px hsl(var(--card))` }}
                  >
                    {u.initials}
                  </div>
                  <span
                    className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card"
                    style={{ background: dot }}
                  />
                </div>
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[13.5px] font-bold">{u.name}</span>
                    <span
                      className="shrink-0 rounded-full px-1.5 py-px text-[9.5px] font-extrabold uppercase tracking-wide"
                      style={{ background: statusTint(u.status), color: dot }}
                    >
                      {u.statusText}
                    </span>
                  </div>
                  <span className="mt-0.5 text-[11px] font-medium text-muted-foreground">
                    {u.actions} action{u.actions !== 1 ? "s" : ""} sur la période
                  </span>
                </div>
                <div className="flex shrink-0 flex-col items-end">
                  <span className="text-[15px] font-extrabold leading-none tabular-nums">{u.screen}</span>
                  <span className="mt-1 text-[9px] font-bold uppercase tracking-wide text-muted-foreground">écran</span>
                </div>
              </div>

              {(u.status !== "offline" || u.dist.length > 0) && (
                <div className="flex items-center gap-2">
                  {u.status !== "offline" && (
                    <span
                      className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-bold"
                      style={{ background: pageTint(u.currentPage), color: pageColor(u.currentPage) }}
                    >
                      <span className="h-1.5 w-1.5 rounded-sm" style={{ background: pageColor(u.currentPage) }} />
                      {pageLabel(u.currentPage)}
                    </span>
                  )}
                  {u.hasEntity && (
                    <span
                      className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-bold"
                      style={{ background: "hsl(var(--chart-1) / 0.12)", color: "hsl(var(--chart-1))", borderColor: "hsl(var(--chart-1) / 0.25)" }}
                    >
                      {u.entityGlyph} {u.entityLabel}
                    </span>
                  )}
                </div>
              )}

              {u.dist.length > 0 && (
                <div className="flex h-1.5 overflow-hidden rounded-full bg-muted/60">
                  {u.dist.map((d, i) => (
                    <div key={i} title={d.title} style={{ width: d.width, background: d.color }} />
                  ))}
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
