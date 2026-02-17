"use client"

import { useMemo, useState, Fragment } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { GestionnaireBadge } from "@/components/ui/gestionnaire-badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useTeamWeeklyStats, type TeamMemberWeeklyStat, type DailyBreakdown, type DayPageStat } from "@/hooks/useTeamWeeklyStats"
import { Skeleton } from "@/components/ui/skeleton"
import { CalendarDays, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

const PAGE_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  interventions: "Interventions",
  artisans: "Artisans",
  comptabilite: "Comptabilite",
  monitoring: "Suivi",
  settings: "Parametres",
}

const PAGE_COLORS: Record<string, string> = {
  dashboard: "bg-sky-500",
  interventions: "bg-orange-500",
  artisans: "bg-violet-500",
  comptabilite: "bg-emerald-500",
  monitoring: "bg-indigo-500",
  settings: "bg-slate-400",
}

function formatScreenTime(ms: number): string {
  const hours = Math.floor(ms / 3600000)
  const minutes = Math.floor((ms % 3600000) / 60000)
  if (hours > 0) return `${hours}h ${minutes.toString().padStart(2, "0")}min`
  return `${minutes}min`
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
}

function formatDayLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00")
  return d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })
}

function getStartOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function StatCell({ value, color }: { value: number; color: string }) {
  if (value > 0) {
    return <span className={cn("font-semibold", color)}>{value}</span>
  }
  return <span className="text-muted-foreground">0</span>
}

function PageBreakdownTooltip({ pages }: { pages: DayPageStat[] }) {
  if (!pages.length) return <p className="text-xs text-muted-foreground italic">Aucune donnee</p>

  const total = pages.reduce((s, p) => s + p.duration_ms, 0)

  return (
    <div className="space-y-2 min-w-[180px]">
      <p className="text-xs font-semibold mb-1.5">Repartition par page</p>
      {pages.map((p) => {
        const pct = total > 0 ? Math.round((p.duration_ms / total) * 100) : 0
        const label = PAGE_LABELS[p.page] ?? p.page
        const barColor = PAGE_COLORS[p.page] ?? "bg-gray-400"

        return (
          <div key={p.page} className="space-y-0.5">
            <div className="flex items-center justify-between text-[11px]">
              <span>{label}</span>
              <span className="text-muted-foreground">{formatScreenTime(p.duration_ms)} ({pct}%)</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div className={cn("h-full rounded-full", barColor)} style={{ width: `${pct}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function WeeklyStatsTable() {
  const [startOfWeek, endOfWeek] = useMemo(() => {
    const start = getStartOfWeek(new Date())
    const end = new Date(start)
    end.setDate(end.getDate() + 6)
    return [start, end] as const
  }, [])

  const { data: weeklyStats, isLoading } = useTeamWeeklyStats(startOfWeek, endOfWeek)

  const sorted = useMemo(() => {
    if (!weeklyStats?.length) return []
    return [...weeklyStats].sort((a, b) => b.total_screen_time_ms - a.total_screen_time_ms)
  }, [weeklyStats])

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const toggleExpand = (userId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <CalendarDays className="h-4 w-4" />
            Statistiques hebdomadaires
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-lg" />
          ))}
        </CardContent>
      </Card>
    )
  }

  if (!sorted.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <CalendarDays className="h-4 w-4" />
            Statistiques hebdomadaires
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground italic py-4">
            Aucune donnee pour cette semaine.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <TooltipProvider delayDuration={300}>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <CalendarDays className="h-4 w-4" />
            Statistiques hebdomadaires
            <span className="text-xs font-normal text-muted-foreground ml-2">
              {startOfWeek.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
              {" — "}
              {endOfWeek.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-5 py-2 font-medium w-8" />
                  <th className="px-2 py-2 font-medium">Gestionnaire</th>
                  <th className="px-3 py-2 font-medium text-right">Jours</th>
                  <th className="px-3 py-2 font-medium text-right">Temps total</th>
                  <th className="px-3 py-2 font-medium text-right">Moy./jour</th>
                  <th className="px-3 py-2 font-medium text-right">Creees</th>
                  <th className="px-3 py-2 font-medium text-right">Devis</th>
                  <th className="px-3 py-2 font-medium text-right">Terminees</th>
                  <th className="px-5 py-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((member) => {
                  const firstName = member.firstname ?? ""
                  const lastName = member.lastname ?? ""
                  const displayName = [firstName, lastName].filter(Boolean).join(" ") || "?"
                  const isExpanded = expandedIds.has(member.user_id)
                  const days = member.daily_breakdown ?? []

                  // Aggregate page stats for avg tooltip
                  const allPages: Record<string, number> = {}
                  for (const day of days) {
                    for (const p of day.pages) {
                      allPages[p.page] = (allPages[p.page] ?? 0) + p.duration_ms
                    }
                  }
                  const aggregatedPages: DayPageStat[] = Object.entries(allPages)
                    .map(([page, duration_ms]) => ({ page, duration_ms }))
                    .sort((a, b) => b.duration_ms - a.duration_ms)

                  return (
                    <Fragment key={member.user_id}>
                      {/* ─── Summary row (totals) ─── */}
                      <tr
                        className={cn(
                          "border-b hover:bg-muted/50 transition-colors cursor-pointer select-none",
                          isExpanded && "bg-muted/30 border-b-0"
                        )}
                        onClick={() => toggleExpand(member.user_id)}
                      >
                        <td className="pl-5 pr-1 py-3">
                          <ChevronRight className={cn(
                            "h-3.5 w-3.5 text-muted-foreground transition-transform",
                            isExpanded && "rotate-90"
                          )} />
                        </td>
                        <td className="px-2 py-3">
                          <div className="flex items-center gap-2.5">
                            <GestionnaireBadge
                              prenom={firstName}
                              name={lastName}
                              color={member.color}
                              avatarUrl={member.avatar_url}
                              size="xs"
                              showBorder
                            />
                            <span className="font-medium">{displayName}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">{member.days_active}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{formatScreenTime(member.total_screen_time_ms)}</td>
                        <td className="px-3 py-3 text-right tabular-nums">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-muted-foreground cursor-help border-b border-dotted border-muted-foreground/40">
                                {formatScreenTime(member.avg_daily_screen_time_ms)}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="p-3">
                              <PageBreakdownTooltip pages={aggregatedPages} />
                            </TooltipContent>
                          </Tooltip>
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">
                          <StatCell value={member.interventions_created} color="text-blue-600 dark:text-blue-400" />
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">
                          <StatCell value={member.devis_sent} color="text-violet-600 dark:text-violet-400" />
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">
                          <StatCell value={member.interventions_completed} color="text-emerald-600 dark:text-emerald-400" />
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums">{member.total_actions}</td>
                      </tr>

                      {/* ─── Expanded daily rows ─── */}
                      {isExpanded && days.map((day, idx) => (
                        <tr
                          key={day.date}
                          className={cn(
                            "bg-muted/20 text-xs transition-colors hover:bg-muted/40",
                            idx === days.length - 1 ? "border-b" : ""
                          )}
                        >
                          <td />
                          <td className="px-2 py-2.5 pl-12">
                            <span className="text-muted-foreground capitalize">
                              {formatDayLabel(day.date)}
                            </span>
                            <span className="text-muted-foreground/60 ml-1.5">
                              ({formatTime(day.first_seen_at)})
                            </span>
                          </td>
                          <td />
                          <td className="px-3 py-2.5 text-right tabular-nums">{formatScreenTime(day.screen_time_ms)}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="text-muted-foreground cursor-help border-b border-dotted border-muted-foreground/30">
                                  detail
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="bottom" className="p-3">
                                <PageBreakdownTooltip pages={day.pages} />
                              </TooltipContent>
                            </Tooltip>
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums">
                            <StatCell value={day.created} color="text-blue-600 dark:text-blue-400" />
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums">
                            <StatCell value={day.devis} color="text-violet-600 dark:text-violet-400" />
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums">
                            <StatCell value={day.completed} color="text-emerald-600 dark:text-emerald-400" />
                          </td>
                          <td className="px-5 py-2.5 text-right tabular-nums text-muted-foreground">{day.actions}</td>
                        </tr>
                      ))}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  )
}
