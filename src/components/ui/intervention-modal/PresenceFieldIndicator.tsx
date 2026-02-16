'use client'

import React from 'react'
import { GestionnaireBadge } from '@/components/ui/gestionnaire-badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useFieldLock } from '@/contexts/FieldPresenceContext'
import { cn } from '@/lib/utils'

interface PresenceFieldIndicatorProps {
  fieldName: string
  children: React.ReactNode
  className?: string
}

/**
 * Wraps a form field to show a visual lock indicator when another user
 * is editing it. When locked:
 * - Colored ring (user's color) around the field
 * - Mini avatar badge at top-right
 * - Tooltip with locker's name
 * - Children receive pointer-events:none via CSS (soft lock)
 *
 * When NOT locked: renders children as-is with zero overhead.
 */
export function PresenceFieldIndicator({
  fieldName,
  children,
  className,
}: PresenceFieldIndicatorProps) {
  const { isLocked, locker } = useFieldLock(fieldName)

  if (!isLocked || !locker) {
    return <>{children}</>
  }

  return (
    <div className={cn('relative', className)}>
      <div
        className="rounded-md ring-2 ring-offset-1 pointer-events-none opacity-80"
        style={
          {
            '--tw-ring-color': locker.color || '#6b7280',
          } as React.CSSProperties
        }
      >
        {children}
      </div>
      <div className="absolute -top-2 -right-2 z-10 pointer-events-auto">
        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <GestionnaireBadge
                prenom={locker.name.split(' ')[0]}
                name={locker.name.split(' ').slice(1).join(' ')}
                color={locker.color}
                avatarUrl={locker.avatarUrl}
                size="xs"
                showBorder
                className="ring-2 ring-background shadow-sm"
              />
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            {locker.name} modifie ce champ
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
}
