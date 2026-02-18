'use client'

import React from 'react'
import { GestionnaireBadge } from '@/components/ui/gestionnaire-badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { PagePresenceUser } from '@/types/presence'

interface InterventionPresenceIndicatorProps {
  interventionId: string
  viewers: PagePresenceUser[]
}

/**
 * Compact presence indicator for TableView action columns.
 * Shows a tiny avatar (or avatar + count) for users currently viewing a specific intervention.
 * Renders nothing when no viewers are active on this intervention.
 */
export function InterventionPresenceIndicator({
  interventionId,
  viewers,
}: InterventionPresenceIndicatorProps) {
  const activeViewers = viewers.filter(
    (v) => v.activeInterventionId === interventionId
  )

  if (activeViewers.length === 0) return null

  const first = activeViewers[0]
  const remaining = activeViewers.length - 1
  const tooltipNames = activeViewers.map((v) => v.name).join(', ')

  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-0.5">
            <GestionnaireBadge
              prenom={first.name.split(' ')[0]}
              name={first.name.split(' ').slice(1).join(' ')}
              color={first.color}
              avatarUrl={first.avatarUrl}
              size="xs"
              showBorder
              className="h-5 w-5"
            />
            {remaining > 0 && (
              <span className="text-[0.6rem] font-semibold text-muted-foreground leading-none">
                +{remaining}
              </span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top">
          {tooltipNames}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
