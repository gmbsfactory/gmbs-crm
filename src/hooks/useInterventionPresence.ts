'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase-client'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import type { PresenceUser, PresencePayload } from '@/types/presence'

/**
 * Manages a Supabase Presence channel for real-time viewer tracking
 * on an intervention modal.
 *
 * Architecture: each tab subscribes independently to 'presence:intervention-{id}'.
 * Completely separate from the crm-sync channel and leader election.
 * Connection cost: 1 WebSocket per open modal per user (~5-10 max).
 *
 * Graceful degradation: if subscribe fails, returns empty viewers — modal unaffected.
 *
 * @param interventionId - ID of the intervention being viewed. Pass null to disable.
 */
export function useInterventionPresence(
  interventionId: string | null
): { viewers: PresenceUser[] } {
  const { data: currentUser } = useCurrentUser()
  const [viewers, setViewers] = useState<PresenceUser[]>([])
  const channelRef = useRef<RealtimeChannel | null>(null)

  const handleSync = useCallback(() => {
    const channel = channelRef.current
    if (!channel || !currentUser?.id) return

    const state = channel.presenceState<PresencePayload>()

    // Flatten all presence metas, exclude self
    const allMetas = Object.values(state).flat()
    const others = allMetas.filter((p) => p.userId !== currentUser.id)

    // Dedup by userId (same user in multiple tabs shows once)
    const unique = new Map(others.map((u) => [u.userId, u]))

    // Sort by joinedAt ascending for stable render order
    const sorted = Array.from(unique.values()).sort((a, b) =>
      a.joinedAt.localeCompare(b.joinedAt)
    )

    setViewers(sorted)
  }, [currentUser?.id])

  useEffect(() => {
    if (!interventionId || !currentUser?.id) {
      setViewers([])
      return
    }

    const channelName = `presence:intervention-${interventionId}`
    const channel = supabase.channel(channelName)
    channelRef.current = channel

    channel
      .on('presence', { event: 'sync' }, handleSync)
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          try {
            await channel.track({
              userId: currentUser.id,
              name:
                currentUser.surnom ||
                `${currentUser.prenom ?? ''} ${currentUser.nom ?? ''}`.trim() ||
                'Utilisateur',
              color: currentUser.color ?? null,
              avatarUrl: currentUser.avatar_url ?? null,
              joinedAt: new Date().toISOString(),
            } satisfies PresencePayload)
          } catch (error) {
            console.warn('[Presence] track() failed:', error)
          }
        } else if (
          status === 'CHANNEL_ERROR' ||
          status === 'TIMED_OUT' ||
          status === 'CLOSED'
        ) {
          console.warn(`[Presence] Channel ${channelName} status: ${status}`)
        }
      })

    return () => {
      // Null ref FIRST to prevent re-entry (matches useCrmRealtime pattern)
      const ch = channelRef.current
      channelRef.current = null
      if (ch) {
        ch.untrack().catch(() => {})
        supabase.removeChannel(ch)
      }
      setViewers([])
    }
  }, [
    interventionId,
    currentUser?.id,
    currentUser?.surnom,
    currentUser?.prenom,
    currentUser?.nom,
    currentUser?.color,
    currentUser?.avatar_url,
    handleSync,
  ])

  return { viewers }
}
