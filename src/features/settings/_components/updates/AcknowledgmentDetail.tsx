"use client"

import { GestionnaireBadge } from "@/components/ui/gestionnaire-badge"
import type { Gestionnaire } from "@/hooks/useGestionnaires"
import type { AppUpdateView } from "@/types/app-updates"
import { cn } from "@/lib/utils"

interface AcknowledgmentDetailProps {
  views: AppUpdateView[]
  gestionnaires: Gestionnaire[]
  gestionnairesMap: Map<string, Gestionnaire>
  audience: string[]
  targetUserIds: string[]
}

function isUserInAudience(
  g: Gestionnaire,
  audience: string[],
  targetUserIds: string[]
): boolean {
  if (targetUserIds.length > 0) {
    return targetUserIds.includes(g.id)
  }
  if (audience.includes("all")) return true
  return audience.some(role => {
    const userRoles = g.roles || (g.role ? [g.role] : [])
    return userRoles.some(r => r.toLowerCase() === role.toLowerCase())
  })
}

export function AcknowledgmentDetail({
  views,
  gestionnaires,
  gestionnairesMap,
  audience,
  targetUserIds,
}: AcknowledgmentDetailProps) {
  const viewMap = new Map(views.map(v => [v.user_id, v]))

  const targetUsers = gestionnaires.filter(g =>
    isUserInAudience(g, audience, targetUserIds)
  )

  const acknowledged = targetUsers.filter(g => {
    const view = viewMap.get(g.id)
    return view?.acknowledged_at
  })

  const pending = targetUsers.filter(g => {
    const view = viewMap.get(g.id)
    return !view?.acknowledged_at
  })

  return (
    <div className="space-y-3">
      {/* Acknowledged */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-1.5">
          Acquitté ({acknowledged.length})
        </p>
        {acknowledged.length === 0 ? (
          <p className="text-xs text-muted-foreground/60">Aucun acquittement</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {acknowledged.map(g => {
              const view = viewMap.get(g.id)
              const date = view?.acknowledged_at
                ? new Date(view.acknowledged_at).toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : ""
              return (
                <div
                  key={g.id}
                  className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-1"
                >
                  <GestionnaireBadge
                    firstname={g.firstname}
                    lastname={g.lastname}
                    color={g.color}
                    avatarUrl={g.avatar_url}
                    size="xs"
                    showBorder={false}
                  />
                  <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                    {g.firstname} {g.lastname?.[0]}.
                  </span>
                  <span className="text-[10px] text-muted-foreground">{date}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Pending */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-1.5">
          En attente ({pending.length})
        </p>
        {pending.length === 0 ? (
          <p className="text-xs text-muted-foreground/60">Tout le monde a acquitté</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {pending.map(g => (
              <div
                key={g.id}
                className={cn(
                  "flex items-center gap-1.5 rounded-full bg-muted px-2 py-1 opacity-60"
                )}
              >
                <GestionnaireBadge
                  firstname={g.firstname}
                  lastname={g.lastname}
                  color={g.color}
                  avatarUrl={g.avatar_url}
                  size="xs"
                  showBorder={false}
                />
                <span className="text-xs text-muted-foreground">
                  {g.firstname} {g.lastname?.[0]}.
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
