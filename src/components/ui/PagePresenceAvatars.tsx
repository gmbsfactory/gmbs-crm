'use client'

import React from 'react'
import { GestionnaireBadge } from '@/components/ui/gestionnaire-badge'
import { AvatarGroup, AvatarGroupTooltip } from '@/components/ui/avatar-group'
import { cn } from '@/lib/utils'
import type { PagePresenceUser } from '@/types/presence'

const MAX_VISIBLE = 5

interface PagePresenceAvatarsProps {
  viewers: PagePresenceUser[]
  className?: string
}

/**
 * Displays stacked avatar circles for users currently on the same page.
 * Shows up to MAX_VISIBLE avatars with hover tooltips; excess viewers collapse into "+N".
 * Renders nothing when viewers is empty — zero visual impact when alone.
 */
export function PagePresenceAvatars({ viewers, className }: PagePresenceAvatarsProps) {
  if (viewers.length === 0) return null

  const visible = viewers.slice(0, MAX_VISIBLE)
  const overflow = viewers.length - MAX_VISIBLE

  // Build children array explicitly — AvatarGroup expects ReactElement[]
  const children: React.ReactElement[] = visible.map((viewer) => (
    <div key={viewer.userId}>
      <GestionnaireBadge
        prenom={viewer.name.split(' ')[0]}
        name={viewer.name.split(' ').slice(1).join(' ')}
        color={viewer.color}
        avatarUrl={viewer.avatarUrl}
        size="xs"
        showBorder
        className="ring-2 ring-background"
      />
      <AvatarGroupTooltip side="bottom">
        {viewer.name}
      </AvatarGroupTooltip>
    </div>
  ))

  if (overflow > 0) {
    children.push(
      <div key="overflow">
        <div
          className="h-6 w-6 rounded-full bg-muted border border-border flex items-center justify-center ring-2 ring-background"
          style={{ minWidth: 24, minHeight: 24 }}
        >
          <span className="text-[0.6rem] font-semibold text-muted-foreground">
            +{overflow}
          </span>
        </div>
        <AvatarGroupTooltip side="bottom">
          {viewers
            .slice(MAX_VISIBLE)
            .map((v) => v.name)
            .join(', ')}
        </AvatarGroupTooltip>
      </div>
    )
  }

  return (
    <div
      className={cn('flex items-center', className)}
      aria-label={`${viewers.length} utilisateur${viewers.length > 1 ? 's' : ''} sur cette page`}
    >
      <AvatarGroup variant="motion" invertOverlap>
        {children}
      </AvatarGroup>
    </div>
  )
}
