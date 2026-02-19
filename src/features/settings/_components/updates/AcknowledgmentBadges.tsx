"use client"

import { GestionnaireBadge } from "@/components/ui/gestionnaire-badge"
import type { Gestionnaire } from "@/hooks/useGestionnaires"
import type { AppUpdateView } from "@/types/app-updates"

interface AcknowledgmentBadgesProps {
  views: AppUpdateView[]
  gestionnairesMap: Map<string, Gestionnaire>
  maxVisible?: number
}

export function AcknowledgmentBadges({
  views,
  gestionnairesMap,
  maxVisible = 6,
}: AcknowledgmentBadgesProps) {
  const acknowledged = views.filter(v => v.acknowledged_at)
  const visible = acknowledged.slice(0, maxVisible)
  const remaining = acknowledged.length - maxVisible

  if (acknowledged.length === 0) return null

  return (
    <div className="flex items-center">
      <div className="flex -space-x-1.5">
        {visible.map(v => {
          const g = gestionnairesMap.get(v.user_id)
          if (!g) return null
          return (
            <GestionnaireBadge
              key={v.user_id}
              firstname={g.firstname}
              lastname={g.lastname}
              color={g.color}
              avatarUrl={g.avatar_url}
              size="xs"
              showBorder={true}
              className="ring-1 ring-background"
            />
          )
        })}
      </div>
      {remaining > 0 && (
        <span className="ml-1 text-[10px] text-muted-foreground font-medium">
          +{remaining}
        </span>
      )}
    </div>
  )
}
