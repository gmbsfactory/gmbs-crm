"use client"

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { GestionnaireBadge } from "@/components/ui/gestionnaire-badge"
import type { TeamMemberOverview } from "@/hooks/useTeamDailyOverview"

interface StatBadgeGroupProps {
  members: TeamMemberOverview[]
  statKey: "interventions_created" | "interventions_completed" | "devis_sent"
  emptyLabel?: string
}

/**
 * Displays user badges with a stat count overlay.
 * Each badge shows a small counter chip (notification-style) for the stat value.
 * Only shows members where count > 0, sorted by count DESC.
 */
export function StatBadgeGroup({ members, statKey, emptyLabel = "Aucune activite" }: StatBadgeGroupProps) {
  const filtered = members
    .filter((m) => m[statKey] > 0)
    .sort((a, b) => b[statKey] - a[statKey])

  if (filtered.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic py-2">{emptyLabel}</p>
    )
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-wrap gap-3 py-1">
        {filtered.map((member) => {
          const firstName = member.firstname ?? ""
          const lastName = member.lastname ?? ""
          const displayName = [firstName, lastName].filter(Boolean).join(" ") || "?"
          const count = member[statKey]

          return (
            <Tooltip key={member.user_id}>
              <TooltipTrigger asChild>
                <div className="relative cursor-default">
                  <GestionnaireBadge
                    prenom={firstName}
                    name={lastName}
                    color={member.color}
                    avatarUrl={member.avatar_url}
                    size="md"
                    showBorder
                  />
                  <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground ring-2 ring-background px-1">
                    {count}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                <strong>{displayName}</strong> — {count}
              </TooltipContent>
            </Tooltip>
          )
        })}
      </div>
    </TooltipProvider>
  )
}
