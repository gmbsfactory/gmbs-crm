"use client"

import { useMemo, useState } from "react"
import { Monitor, Users, ShieldAlert, PlusCircle, CheckCircle2, Send, MapPin } from "lucide-react"
import { usePagePresenceContext } from "@/contexts/PagePresenceContext"
import { usePermissions } from "@/hooks/usePermissions"
import { useCrmRealtime } from "@/hooks/useCrmRealtime"
import { useTeamDailyOverview } from "@/hooks/useTeamDailyOverview"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { PagePresenceUser } from "@/types/presence"

import { RealtimeStatusDot } from "./_components/RealtimeStatusDot"
import { OnlineUsersBar } from "./_components/OnlineUsersBar"
import { StatBadgeGroup } from "./_components/StatBadgeGroup"
import { PagePresenceGrid } from "./_components/PagePresenceGrid"
import { WeeklyStatsTable } from "./_components/WeeklyStatsTable"
import { UserActivitySheet } from "./_components/UserActivitySheet"

/** Group users by their current page */
function groupByPage(users: PagePresenceUser[]): Record<string, PagePresenceUser[]> {
  const groups: Record<string, PagePresenceUser[]> = {}
  for (const user of users) {
    const page = user.currentPage ?? "_other"
    if (!groups[page]) groups[page] = []
    groups[page].push(user)
  }
  return groups
}

export default function MonitoringPage() {
  const presence = usePagePresenceContext()
  const { isAdmin, isLoading: isLoadingPerms } = usePermissions()
  const { connectionStatus } = useCrmRealtime()
  const { data: teamOverview } = useTeamDailyOverview()

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)

  const allUsers = useMemo(() => presence?.allUsers ?? [], [presence?.allUsers])
  const grouped = useMemo(() => groupByPage(allUsers), [allUsers])

  // Users who connected today but are no longer online
  const offlineUsers = useMemo(() => {
    if (!teamOverview?.length) return []
    const onlineIds = new Set(allUsers.map((u) => u.userId))
    return teamOverview
      .filter((m) => !onlineIds.has(m.user_id) && m.first_seen_at)
      .map((m): PagePresenceUser => ({
        userId: m.user_id,
        name: [m.firstname, m.lastname].filter(Boolean).join(" ") || "Utilisateur",
        color: m.color,
        avatarUrl: m.avatar_url,
        joinedAt: m.first_seen_at!,
        currentPage: null,
        activeInterventionId: null,
        activeArtisanId: null,
      }))
  }, [teamOverview, allUsers])

  const selectedUser = useMemo(
    () =>
      allUsers.find((u) => u.userId === selectedUserId)
      ?? offlineUsers.find((u) => u.userId === selectedUserId)
      ?? null,
    [allUsers, offlineUsers, selectedUserId]
  )

  const selectedIsOnline = useMemo(
    () => allUsers.some((u) => u.userId === selectedUserId),
    [allUsers, selectedUserId]
  )

  // Aggregate totals from team overview
  const totals = useMemo(() => {
    if (!teamOverview?.length) return { created: 0, completed: 0, devis: 0 }
    return teamOverview.reduce(
      (acc, m) => ({
        created: acc.created + m.interventions_created,
        completed: acc.completed + m.interventions_completed,
        devis: acc.devis + m.devis_sent,
      }),
      { created: 0, completed: 0, devis: 0 }
    )
  }, [teamOverview])

  // Gate: loading
  if (isLoadingPerms) {
    return (
      <div className="flex flex-col gap-6 p-6 max-w-7xl mx-auto">
        <Skeleton className="h-10 w-72" />
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-48 rounded-xl" />
      </div>
    )
  }

  // Gate: admin only
  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
        <ShieldAlert className="h-12 w-12 opacity-40" />
        <p className="text-sm">Page accessible uniquement aux administrateurs.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5 p-6 max-w-7xl mx-auto">
      {/* ─── Header ────────────────────────────────────────────────────────────── */}
      <Tabs defaultValue="today" className="w-full">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <Monitor className="h-4.5 w-4.5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-tight">Suivi en direct</h1>
              <p className="text-xs text-muted-foreground">Vue temps reel de l&apos;equipe</p>
            </div>
            <RealtimeStatusDot status={connectionStatus} />
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
              </span>
              <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                {allUsers.length} en ligne
              </span>
            </div>
            <TabsList>
              <TabsTrigger value="today">Aujourd&apos;hui</TabsTrigger>
              <TabsTrigger value="week">Cette semaine</TabsTrigger>
            </TabsList>
          </div>
        </div>

        <TabsContent value="today" className="mt-4 space-y-5">
          {/* ─── Section 1: Online users as badges ─────────────────────────────── */}
          <Card>
            <CardHeader className="pb-2 pt-4 px-5">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  Gestionnaires connectes
                </CardTitle>
                <span className="text-xs text-muted-foreground">
                  {allUsers.length} en ligne{offlineUsers.length > 0 ? ` · ${offlineUsers.length} deconnecte${offlineUsers.length !== 1 ? "s" : ""}` : ""}
                </span>
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-4 pt-0">
              <OnlineUsersBar users={allUsers} offlineUsers={offlineUsers} onSelectUser={setSelectedUserId} />
            </CardContent>
          </Card>

          {/* ─── Section 2: Stats cards — Creees / Devis / Terminees ──────────── */}
          <div className="grid gap-4 sm:grid-cols-3">
            {/* Interventions creees */}
            <Card className="border-l-4 border-l-blue-500">
              <CardHeader className="pb-1 pt-4 px-5">
                <CardTitle className="flex items-center justify-between text-sm font-medium">
                  <span className="flex items-center gap-2">
                    <PlusCircle className="h-4 w-4 text-blue-500" />
                    Creees
                  </span>
                  <span className="text-xl font-bold text-blue-600 dark:text-blue-400">
                    {totals.created}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-4 pt-0">
                <StatBadgeGroup
                  members={teamOverview ?? []}
                  statKey="interventions_created"
                  emptyLabel="Aucune creation aujourd'hui"
                />
              </CardContent>
            </Card>

            {/* Devis envoyes */}
            <Card className="border-l-4 border-l-violet-500">
              <CardHeader className="pb-1 pt-4 px-5">
                <CardTitle className="flex items-center justify-between text-sm font-medium">
                  <span className="flex items-center gap-2">
                    <Send className="h-4 w-4 text-violet-500" />
                    Devis envoyes
                  </span>
                  <span className="text-xl font-bold text-violet-600 dark:text-violet-400">
                    {totals.devis}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-4 pt-0">
                <StatBadgeGroup
                  members={teamOverview ?? []}
                  statKey="devis_sent"
                  emptyLabel="Aucun devis aujourd'hui"
                />
              </CardContent>
            </Card>

            {/* Interventions terminees */}
            <Card className="border-l-4 border-l-emerald-500">
              <CardHeader className="pb-1 pt-4 px-5">
                <CardTitle className="flex items-center justify-between text-sm font-medium">
                  <span className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    Terminees
                  </span>
                  <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                    {totals.completed}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-4 pt-0">
                <StatBadgeGroup
                  members={teamOverview ?? []}
                  statKey="interventions_completed"
                  emptyLabel="Aucune terminee aujourd'hui"
                />
              </CardContent>
            </Card>
          </div>

          {/* ─── Section 3: Page presence grid ─────────────────────────────────── */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Presence par page</h2>
            </div>
            <PagePresenceGrid grouped={grouped} onSelectUser={setSelectedUserId} />
          </div>
        </TabsContent>

        <TabsContent value="week" className="mt-4">
          <WeeklyStatsTable />
        </TabsContent>
      </Tabs>

      {/* ─── Sheet detail ──────────────────────────────────────────────────────── */}
      <UserActivitySheet
        user={selectedUser}
        isOnline={selectedIsOnline}
        onClose={() => setSelectedUserId(null)}
      />
    </div>
  )
}
