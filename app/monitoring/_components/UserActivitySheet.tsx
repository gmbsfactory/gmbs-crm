"use client"

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { GestionnaireBadge } from "@/components/ui/gestionnaire-badge"
import { Skeleton } from "@/components/ui/skeleton"
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

interface MiniKPIProps {
  icon: React.ElementType
  label: string
  value: string
  accent?: string
}

function MiniKPI({ icon: Icon, label, value, accent }: MiniKPIProps) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-lg bg-muted/50 p-3">
      <Icon className={`h-4 w-4 ${accent ?? "text-muted-foreground"}`} />
      <span className="text-lg font-bold leading-tight">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  )
}

export function UserActivitySheet({ user, isOnline = true, onClose }: UserActivitySheetProps) {
  const { data: dailyActivity, isLoading } = useUserDailyActivity(user?.userId ?? null)

  const nameParts = user?.name.split(" ") ?? []
  const firstName = nameParts[0] ?? ""
  const lastName = nameParts.slice(1).join(" ") ?? ""

  return (
    <Sheet open={user !== null} onOpenChange={(open) => { if (!open) onClose() }}>
      <SheetContent side="right" className="flex flex-col overflow-y-auto p-0 sm:max-w-[640px] md:max-w-[680px]">
        {user && (
          <>
            {/* Header */}
            <SheetHeader className="p-6 pb-4">
              <div className="flex items-start justify-between gap-4">
                {/* Left: badge + info */}
                <div className="flex items-center gap-4 min-w-0">
                  <GestionnaireBadge
                    prenom={firstName}
                    name={lastName}
                    color={user.color}
                    avatarUrl={user.avatarUrl}
                    size="lg"
                    showBorder
                  />
                  <div className="flex-1 min-w-0">
                    <SheetTitle className="text-lg font-semibold truncate">
                      {user.name}
                    </SheetTitle>
                    <div className="flex items-center gap-2 mt-1">
                      {isOnline ? (
                        <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/25 hover:bg-emerald-500/15">
                          En ligne
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-gray-500/15 text-gray-600 border-gray-500/25 hover:bg-gray-500/15">
                          Hors ligne
                        </Badge>
                      )}
                    </div>
                    {dailyActivity?.first_seen_at && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Premiere connexion : {formatTime(dailyActivity.first_seen_at)}
                        {!isOnline && dailyActivity.last_seen_at && (
                          <span className="ml-1 text-gray-500">
                            (deconnexion a {formatTime(dailyActivity.last_seen_at)})
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                </div>

                {/* Right: screen time card */}
                {dailyActivity && !isLoading && (
                  <div className="flex flex-col items-center gap-1 rounded-xl border bg-muted/40 px-4 py-3 shrink-0">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xl font-bold leading-tight">
                      {formatDuration(dailyActivity.total_screen_time_ms)}
                    </span>
                    <span className="text-[10px] text-muted-foreground">Temps ecran</span>
                  </div>
                )}
              </div>
            </SheetHeader>

            <div className="flex-1 space-y-5 px-6 pb-6">
              {isLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-28 rounded-lg" />
                  <Skeleton className="h-40 rounded-lg" />
                  <Skeleton className="h-60 rounded-lg" />
                </div>
              ) : !dailyActivity ? (
                <p className="text-sm text-muted-foreground italic py-4">
                  Aucune donnee d&apos;activite disponible.
                </p>
              ) : (
                <>
                  {/* Section 1 : Resume du jour — Creees, Devis, Terminees */}
                  <Card>
                    <CardHeader className="pb-3 pt-4 px-4">
                      <CardTitle className="text-sm font-medium">Resume du jour</CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 pt-0">
                      <div className="grid grid-cols-3 gap-3">
                        <MiniKPI
                          icon={PlusCircle}
                          label="Creees"
                          value={String(dailyActivity.interventions_created)}
                          accent="text-blue-500"
                        />
                        <MiniKPI
                          icon={Send}
                          label="Devis"
                          value={String(dailyActivity.devis_sent)}
                          accent="text-violet-500"
                        />
                        <MiniKPI
                          icon={CheckCircle2}
                          label="Terminees"
                          value={String(dailyActivity.interventions_completed)}
                          accent="text-emerald-500"
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Section 2 : Temps d'ecran par page */}
                  {dailyActivity.pages?.length > 0 && (
                    <Card>
                      <CardHeader className="pb-3 pt-4 px-4">
                        <CardTitle className="text-sm font-medium">
                          Temps d&apos;ecran par page
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="px-4 pb-4 pt-0">
                        <ScreenTimeChart pages={dailyActivity.pages} />
                      </CardContent>
                    </Card>
                  )}

                  {/* Section 3 : Dernieres actions */}
                  {dailyActivity.recent_actions?.length > 0 && (
                    <Card>
                      <CardHeader className="pb-3 pt-4 px-4">
                        <CardTitle className="text-sm font-medium">
                          Dernieres actions
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="px-2 pb-4 pt-0">
                        <ActivityTimeline actions={dailyActivity.recent_actions} />
                      </CardContent>
                    </Card>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
