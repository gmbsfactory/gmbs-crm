"use client"

import { useMemo } from "react"
import { endOfDay, startOfDay } from "date-fns"
import { cn } from "@/lib/utils"
import { useTeamConnections } from "@/hooks/useTeamConnections"
import { useGlobalActivityFeed } from "@/hooks/useGlobalActivityFeed"
import { catColor, categoryOf, pageColor, pageLabel } from "@/lib/monitoring/activity-categories"
import { DevActivityFeed } from "./DevActivityFeed"

const AXIS_START_H = 6
const AXIS_END_H = 22
const SPAN_MIN = (AXIS_END_H - AXIS_START_H) * 60
const AXIS_LABELS = [8, 10, 12, 14, 16, 18, 20]

function minutesOf(iso: string): number {
  const d = new Date(iso)
  return d.getHours() * 60 + d.getMinutes()
}
function pct(min: number): number {
  return Math.max(0, Math.min(100, ((min - AXIS_START_H * 60) / SPAN_MIN) * 100))
}
function fmtTime(iso: string | null): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
}
function fmtDur(ms: number): string {
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  return h > 0 ? `${h}h${m.toString().padStart(2, "0")}` : `${m}min`
}
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

interface TimelineViewProps {
  startDate: Date
  endDate: Date
  userIds: string[]
  onToggleUser: (userId: string) => void
  selectedIds?: string[]
}

/** Vue Timeline : gantt « Journée des sessions » + flux compact. */
export function TimelineView({ startDate, endDate, userIds, onToggleUser, selectedIds = [] }: TimelineViewProps) {
  const scoped = userIds.length ? userIds : null
  const singleDay = endDate.getTime() - startDate.getTime() <= 36 * 3_600_000
  const dayRef = singleDay ? startDate : new Date()
  const dayStart = startOfDay(dayRef)
  const dayEnd = endOfDay(dayRef)
  const isToday = startOfDay(new Date()).getTime() === dayStart.getTime()

  const { data: connections } = useTeamConnections(dayStart, dayEnd, scoped)
  const feed = useGlobalActivityFeed({ startDate: dayStart, endDate: dayEnd, userIds: scoped })

  const ticksByUser = useMemo(() => {
    const map = new Map<string, { left: number; color: string; title: string }[]>()
    const rows = feed.data?.pages.flatMap((p) => p.items) ?? []
    for (const r of rows) {
      if (!r.actor?.user_id) continue
      const arr = map.get(r.actor.user_id) ?? []
      arr.push({ left: pct(minutesOf(r.occurred_at)), color: catColor(categoryOf(r.action_type)), title: fmtTime(r.occurred_at) })
      map.set(r.actor.user_id, arr)
    }
    return map
  }, [feed.data])

  const lanes = useMemo(() => {
    return (connections ?? []).map((c) => {
      const day = c.days[0]
      const name = [c.firstname, c.lastname].filter(Boolean).join(" ") || c.code_gestionnaire || "—"
      const segs = (day?.sessions ?? []).map((s) => {
        const left = pct(minutesOf(s.started_at))
        const right = pct(minutesOf(s.ended_at))
        return { left, width: Math.max(0.6, right - left), color: pageColor(s.page_name), title: `${pageLabel(s.page_name)} ${fmtTime(s.started_at)}–${fmtTime(s.ended_at)}` }
      })
      return {
        userId: c.user_id,
        name,
        initials: initialsOf(name),
        color: c.color || "hsl(var(--primary))",
        range: day ? `${fmtTime(day.first_seen_at)} → ${fmtTime(day.last_seen_at)}` : "—",
        screen: fmtDur(day?.total_screen_time_ms ?? 0),
        segs,
        ticks: ticksByUser.get(c.user_id) ?? [],
      }
    })
  }, [connections, ticksByUser])

  const nowLeft = pct(new Date().getHours() * 60 + new Date().getMinutes())

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex min-h-0 flex-[3] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
          <span className="text-sm font-extrabold">
            Journée des sessions
            <span className="ml-2 text-[11px] font-medium text-muted-foreground">
              barres = temps par page · traits = actions
            </span>
          </span>
          <span className="text-[11px] font-medium text-muted-foreground">
            {dayStart.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
          </span>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {lanes.length === 0 ? (
            <p className="py-10 text-center text-sm italic text-muted-foreground">
              Aucune session ce jour (la RPC get_team_connections doit être déployée).
            </p>
          ) : (
            <div className="flex flex-col gap-2.5">
              <div className="relative ml-[150px] h-3.5">
                {AXIS_LABELS.map((h) => (
                  <span
                    key={h}
                    className="absolute -translate-x-1/2 font-mono text-[10px] font-semibold text-muted-foreground"
                    style={{ left: `${pct(h * 60)}%` }}
                  >
                    {h}h
                  </span>
                ))}
              </div>
              {lanes.map((l) => (
                <div key={l.userId} className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => onToggleUser(l.userId)}
                    className={cn(
                      "flex w-[148px] shrink-0 items-center gap-2 rounded-md px-1.5 py-1 text-left hover:bg-muted/50",
                      selectedIds.includes(l.userId) && "bg-primary/10 ring-1 ring-primary/30"
                    )}
                  >
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold text-white"
                      style={{ background: l.color }}
                    >
                      {l.initials}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[12px] font-bold">{l.name}</span>
                      <span className="block truncate font-mono text-[10px] text-muted-foreground">
                        {l.range} · {l.screen}
                      </span>
                    </span>
                  </button>
                  <div className="relative h-8 flex-1 overflow-hidden rounded-lg bg-muted/40">
                    {l.segs.map((s, i) => (
                      <div
                        key={i}
                        title={s.title}
                        className="absolute bottom-1 top-1 rounded"
                        style={{ left: `${s.left}%`, width: `${s.width}%`, background: s.color }}
                      />
                    ))}
                    {l.ticks.map((t, i) => (
                      <div
                        key={`t${i}`}
                        title={t.title}
                        className="absolute bottom-0.5 top-0.5 w-0.5"
                        style={{ left: `${t.left}%`, background: t.color, opacity: 0.9 }}
                      />
                    ))}
                    {isToday && (
                      <div className="absolute bottom-0 top-0 w-0 border-l border-dashed" style={{ left: `${nowLeft}%`, borderColor: "hsl(var(--primary))" }} />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-[2]">
        <DevActivityFeed startDate={startDate} endDate={endDate} userIds={userIds} />
      </div>
    </div>
  )
}
