"use client"

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { GestionnaireBadge } from "@/components/ui/gestionnaire-badge"
import { Skeleton } from "@/components/ui/skeleton"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Clock, PlusCircle, CheckCircle2, Send } from "lucide-react"
import type { PagePresenceUser } from "@/types/presence"
import { useUserDailyActivity } from "@/hooks/useUserDailyActivity"
import { ActivityTimeline } from "./ActivityTimeline"
import { ScreenTimeChart } from "./ScreenTimeChart"

interface UserActivitySheetProps {
  user: PagePresenceUser | null
  isOnline?: boolean
  onClose: () => void
}

function formatDuration(ms: number): string {
  const hours = Math.floor(ms / 3600000)
  const minutes = Math.floor((ms % 3600000) / 60000)
  if (hours > 0) return `${hours}h ${minutes.toString().padStart(2, "0")}min`
  return `${minutes}min`
}

function formatTime(isoDate: string): string {
  return new Date(isoDate).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function UserActivitySheet({ user, isOnline = true, onClose }: UserActivitySheetProps) {
  const { data: dailyActivity, isLoading } = useUserDailyActivity(user?.userId ?? null)

  const nameParts = user?.name.split(" ") ?? []
  const firstName = nameParts[0] ?? ""
  const lastName = nameParts.slice(1).join(" ") ?? ""

  return (
    <Sheet open={user !== null} onOpenChange={(open) => { if (!open) onClose() }}>
      <SheetContent side="right" className="flex flex-col p-0 sm:max-w-[640px] md:max-w-[680px] overflow-hidden">
        {user && (
          <>
            {/* ── Header (fixed) ── */}
            <SheetHeader className="px-5 pt-5 pb-3 shrink-0">
              <div className="flex items-center justify-between gap-4">
                {/* Left: avatar + identity */}
                <div className="flex items-center gap-3 min-w-0">
                  <GestionnaireBadge
                    prenom={firstName}
                    name={lastName}
                    color={user.color}
                    avatarUrl={user.avatarUrl}
                    size="lg"
                    showBorder
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <SheetTitle className="text-base font-semibold truncate">
                        {user.name}
                      </SheetTitle>
                      {isOnline ? (
                        <Badge className="text-[10px] px-1.5 py-0 h-4 bg-emerald-500/15 text-emerald-700 border-emerald-500/25 hover:bg-emerald-500/15 shrink-0">
                          En ligne
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-gray-500/15 text-gray-600 border-gray-500/25 hover:bg-gray-500/15 shrink-0">
                          Hors ligne
                        </Badge>
                      )}
                    </div>
                    {dailyActivity?.first_seen_at && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Connexion : {formatTime(dailyActivity.first_seen_at)}
                        {!isOnline && dailyActivity.last_seen_at && (
                          <span className="ml-1 text-gray-500">
                            · Deconnexion {formatTime(dailyActivity.last_seen_at)}
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                </div>

                {/* Right: screen time card */}
                {dailyActivity && !isLoading && (
                  <div className="flex flex-col items-center gap-0.5 rounded-xl border bg-muted/30 px-4 py-2 shrink-0">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-lg font-bold leading-tight">
                      {formatDuration(dailyActivity.total_screen_time_ms)}
                    </span>
                    <span className="text-[9px] text-muted-foreground">Temps ecran</span>
                  </div>
                )}
              </div>
            </SheetHeader>

            {/* ── Body (scrollable) ── */}
            <ScrollArea className="flex-1 min-h-0">
              <div className="space-y-4 px-5 pb-5">
                {isLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-12 rounded-lg" />
                    <Skeleton className="h-24 rounded-lg" />
                    <Skeleton className="h-40 rounded-lg" />
                  </div>
                ) : !dailyActivity ? (
                  <p className="text-xs text-muted-foreground italic py-4">
                    Aucune donnee d&apos;activite disponible.
                  </p>
                ) : (
                  <>
                    {/* KPIs — 3 compact pills */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="flex items-center gap-2 rounded-lg bg-blue-500/10 px-3 py-2">
                        <PlusCircle className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                        <span className="text-sm font-bold text-blue-700 dark:text-blue-400">{dailyActivity.interventions_created}</span>
                        <span className="text-[10px] text-muted-foreground">creees</span>
                      </div>
                      <div className="flex items-center gap-2 rounded-lg bg-violet-500/10 px-3 py-2">
                        <Send className="h-3.5 w-3.5 text-violet-500 shrink-0" />
                        <span className="text-sm font-bold text-violet-700 dark:text-violet-400">{dailyActivity.devis_sent}</span>
                        <span className="text-[10px] text-muted-foreground">devis</span>
                      </div>
                      <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                        <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">{dailyActivity.interventions_completed}</span>
                        <span className="text-[10px] text-muted-foreground">terminees</span>
                      </div>
                    </div>

                    {/* Screen Time Chart */}
                    {dailyActivity.pages?.length > 0 && (
                      <div>
                        <h4 className="text-xs font-medium text-muted-foreground mb-2">
                          Temps d&apos;ecran
                        </h4>
                        <ScreenTimeChart
                          pages={dailyActivity.pages}
                          sessions={dailyActivity.sessions ?? []}
                          firstSeenAt={dailyActivity.first_seen_at}
                          lastSeenAt={dailyActivity.last_seen_at}
                        />
                      </div>
                    )}

                    {/* Actions du jour */}
                    <div>
                      <h4 className="text-xs font-medium text-muted-foreground mb-2">
                        Actions du jour
                        {(dailyActivity.recent_actions?.length ?? 0) > 0 && (
                          <span className="ml-1 font-normal">
                            ({dailyActivity.recent_actions.length})
                          </span>
                        )}
                      </h4>
                      <ActivityTimeline actions={dailyActivity.recent_actions ?? []} />
                    </div>
                  </>
                )}
              </div>
            </ScrollArea>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
