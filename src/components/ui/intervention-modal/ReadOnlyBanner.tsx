'use client'

import { Lock } from 'lucide-react'
import { GestionnaireBadge } from '@/components/ui/gestionnaire-badge'
import type { PresenceUser } from '@/types/presence'

interface ReadOnlyBannerProps {
  editor: PresenceUser
}

/**
 * Banner shown at the top of the intervention modal when another user
 * is currently editing. Displays the editor's avatar and name.
 */
export function ReadOnlyBanner({ editor }: ReadOnlyBannerProps) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-sm">
      <Lock className="h-3.5 w-3.5 shrink-0" />
      <GestionnaireBadge
        prenom={editor.name.split(' ')[0]}
        name={editor.name.split(' ').slice(1).join(' ')}
        color={editor.color}
        avatarUrl={editor.avatarUrl}
        size="xs"
      />
      <span className="truncate">
        <strong>{editor.name}</strong> modifie cette intervention
      </span>
    </div>
  )
}
