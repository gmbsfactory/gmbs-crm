"use client"

import { FileText } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { GestionnaireBadge } from "@/components/ui/gestionnaire-badge"
import { useInterventionModal } from "@/hooks/useInterventionModal"
import type { TeamMemberOverview, InterventionRef } from "@/hooks/useTeamDailyOverview"

const IDS_KEY_MAP = {
  interventions_created: "created_ids",
  interventions_completed: "completed_ids",
  devis_sent: "devis_ids",
} as const

interface StatBadgeGroupProps {
  members: TeamMemberOverview[]
  statKey: "interventions_created" | "interventions_completed" | "devis_sent"
  emptyLabel?: string
}

/**
 * Displays user badges with a stat count overlay.
 * Hovering shows the list of intervention IDs (clickable to open modal).
 */
export function StatBadgeGroup({ members, statKey, emptyLabel = "Aucune activite" }: StatBadgeGroupProps) {
  const interventionModal = useInterventionModal()

  const idsKey = IDS_KEY_MAP[statKey]

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
          const refs: InterventionRef[] = member[idsKey] ?? []

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
              <TooltipContent side="bottom" className="max-w-xs p-0">
                <div className="px-3 pt-2 pb-1.5">
                  <p className="text-xs font-semibold">{displayName}</p>
                </div>
                {refs.length > 0 && (
                  <div className="border-t px-1.5 py-1.5 space-y-0.5 max-h-48 overflow-y-auto">
                    {refs.map((ref) => (
                      <button
                        key={ref.id}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          interventionModal.open(ref.id)
                        }}
                        className="flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-[11px] text-left hover:bg-accent transition-colors"
                      >
                        <FileText className="h-3 w-3 shrink-0 text-muted-foreground" />
                        <span className="truncate font-medium">
                          {ref.numero ?? ref.id.slice(0, 8)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </TooltipContent>
            </Tooltip>
          )
        })}
      </div>
    </TooltipProvider>
  )
}
