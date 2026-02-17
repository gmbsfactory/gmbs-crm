"use client"

import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { GestionnaireBadge } from "@/components/ui/gestionnaire-badge"
import { useTeamWeeklyStats, type TeamMemberWeeklyStat } from "@/hooks/useTeamWeeklyStats"
import { Skeleton } from "@/components/ui/skeleton"
import { CalendarDays } from "lucide-react"

function formatScreenTime(ms: number): string {
  const hours = Math.floor(ms / 3600000)
  const minutes = Math.floor((ms % 3600000) / 60000)
  if (hours > 0) return `${hours}h ${minutes.toString().padStart(2, "0")}min`
  return `${minutes}min`
}

function getStartOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  // Monday = start of week
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

export function WeeklyStatsTable() {
  const [startOfWeek, endOfWeek] = useMemo(() => {
    const start = getStartOfWeek(new Date())
    const end = new Date(start)
    end.setDate(end.getDate() + 6)
    return [start, end] as const
  }, [])

  const { data: weeklyStats, isLoading } = useTeamWeeklyStats(startOfWeek, endOfWeek)

  // Sort by total screen time DESC
  const sorted = useMemo(() => {
    if (!weeklyStats?.length) return []
    return [...weeklyStats].sort((a, b) => b.total_screen_time_ms - a.total_screen_time_ms)
  }, [weeklyStats])

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
                <th className="px-5 py-2 font-medium">Gestionnaire</th>
                <th className="px-3 py-2 font-medium text-right">Jours actifs</th>
                <th className="px-3 py-2 font-medium text-right">Temps total</th>
                <th className="px-3 py-2 font-medium text-right">Moy./jour</th>
                <th className="px-3 py-2 font-medium text-right">Creees</th>
                <th className="px-3 py-2 font-medium text-right">Terminees</th>
                <th className="px-3 py-2 font-medium text-right">Devis</th>
                <th className="px-5 py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((member) => {
                const firstName = member.firstname ?? ""
                const lastName = member.lastname ?? ""
                const displayName = [firstName, lastName].filter(Boolean).join(" ") || "?"

                return (
                  <tr key={member.user_id} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                    <td className="px-5 py-3">
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
                    <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">{formatScreenTime(member.avg_daily_screen_time_ms)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {member.interventions_created > 0 ? (
                        <span className="font-semibold text-blue-600 dark:text-blue-400">{member.interventions_created}</span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {member.interventions_completed > 0 ? (
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">{member.interventions_completed}</span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {member.devis_sent > 0 ? (
                        <span className="font-semibold text-violet-600 dark:text-violet-400">{member.devis_sent}</span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">{member.total_actions}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
