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
 * ---
 * KEY DESIGN DECISIONS (Feb 2025):
 *
 * 1. STABLE EFFECT DEPS — The effect depends ONLY on (interventionId, currentUserId).
 *    All other user fields (surnom, prenom, nom, color, avatar_url) are stored in refs
 *    and read at track()-time. This prevents effect churn when useCurrentUser refetches
 *    (window focus, staleTime expiry, reconnect), which was the root cause of
 *    CLOSED → TIMED_OUT errors.
 *
 * 2. CHANNEL NAME COLLISION — Supabase JS client reuses channel objects by name.
 *    When removeChannel() is called, the internal cleanup is async. If a new
 *    supabase.channel(sameName) is called before cleanup completes, it returns
 *    the old (closing) channel → immediate CLOSED status. Fixed by:
 *    - Eliminating unnecessary effect re-runs (stable deps)
 *    - Adding an async gap before re-subscribe for the rare case where deps change
 *
 * 3. PRESENCE vs POSTGRES_CHANGES — Presence requires all participants on the SAME
 *    channel name ('presence:intervention-{id}'). Unlike postgres_changes (server push),
 *    Presence is a bidirectional protocol more sensitive to channel lifecycle issues.
 *
 * @param interventionId - ID of the intervention being viewed. Pass null to disable.
 */
export function useInterventionPresence(
  interventionId: string | null
): { viewers: PresenceUser[] } {
  const { data: currentUser } = useCurrentUser()
  const [viewers, setViewers] = useState<PresenceUser[]>([])
  const channelRef = useRef<RealtimeChannel | null>(null)
  const mountedRef = useRef(true)

  // ─── Stable refs for user data (avoids effect dependency churn) ─────────────
  const currentUserIdRef = useRef<string | null>(null)
  const currentUserDataRef = useRef<{
    surnom?: string | null
    prenom?: string | null
    nom?: string | null
    color?: string | null
    avatar_url?: string | null
  }>({})

  // Keep refs in sync on every render — no effect dependency needed
  currentUserIdRef.current = currentUser?.id ?? null
  currentUserDataRef.current = {
    surnom: currentUser?.surnom,
    prenom: currentUser?.prenom,
    nom: currentUser?.nom,
    color: currentUser?.color,
    avatar_url: currentUser?.avatar_url,
  }

  // ─── Stable current user ID (primitive string, referentially stable) ────────
  const currentUserId = currentUser?.id ?? null

  // ─── handleSync: reads from refs, zero deps ────────────────────────────────
  const handleSync = useCallback(() => {
    const channel = channelRef.current
    const userId = currentUserIdRef.current
    if (!channel || !userId) return

    const state = channel.presenceState<PresencePayload>()

    // Flatten all presence metas, exclude self
    const allMetas = Object.values(state).flat()
    const others = allMetas.filter((p) => p.userId !== userId)

    // Dedup by userId (same user in multiple tabs shows once)
    const unique = new Map(others.map((u) => [u.userId, u]))

    // Sort by joinedAt ascending for stable render order
    const sorted = Array.from(unique.values()).sort((a, b) =>
      a.joinedAt.localeCompare(b.joinedAt)
    )

    setViewers(sorted)
  }, []) // Stable — reads from refs

  // ─── Track mounted state for async callbacks ───────────────────────────────
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  // ─── Main Presence channel lifecycle ───────────────────────────────────────
  useEffect(() => {
    if (!interventionId || !currentUserId) {
      setViewers([])
      return
    }

    // Small async gap allows Supabase internal cleanup from React Strict Mode
    // double-mount or fast dependency changes. Without this, supabase.channel()
    // may return a stale, closing channel object → immediate CLOSED status.
    let cancelled = false
    const SETUP_DELAY_MS = 50

    const channelName = `presence:intervention-${interventionId}`

    const setup = async () => {
      // Wait for any previous channel cleanup to complete
      await new Promise((resolve) => setTimeout(resolve, SETUP_DELAY_MS))
      if (cancelled || !mountedRef.current) return

      const channel = supabase.channel(channelName)
      channelRef.current = channel

      console.log(`[Presence] Subscribing to ${channelName}`)

      channel
        .on('presence', { event: 'sync' }, handleSync)
        .on('presence', { event: 'join' }, ({ key, newPresences }) => {
          console.log(`[Presence] User joined:`, key, newPresences.length, 'presence(s)')
          handleSync()
        })
        .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
          console.log(`[Presence] User left:`, key, leftPresences.length, 'presence(s)')
          handleSync()
        })
        .subscribe(async (status) => {
          if (cancelled || !mountedRef.current) return

          console.log(`[Presence] Channel ${channelName} status: ${status}`)

          if (status === 'SUBSCRIBED') {
            // Read user data from ref at track()-time (always fresh, never stale)
            const userData = currentUserDataRef.current
            const userId = currentUserIdRef.current
            if (!userId) return

            try {
              const payload: PresencePayload = {
                userId,
                name:
                  userData.surnom ||
                  `${userData.prenom ?? ''} ${userData.nom ?? ''}`.trim() ||
                  'Utilisateur',
                color: userData.color ?? null,
                avatarUrl: userData.avatar_url ?? null,
                joinedAt: new Date().toISOString(),
              }
              console.log(`[Presence] Tracking user: ${payload.name}`)
              await channel.track(payload)
              console.log(`[Presence] Track successful for ${channelName}`)
            } catch (error) {
              console.warn('[Presence] track() failed:', error)
            }
          } else if (
            status === 'CHANNEL_ERROR' ||
            status === 'TIMED_OUT'
          ) {
            console.warn(`[Presence] Channel ${channelName} failed: ${status}`)
          }
        })
    }

    setup()

    return () => {
      cancelled = true
      console.log(`[Presence] Cleaning up ${channelName}`)
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
    currentUserId, // Primitive string — stable across useCurrentUser refetches
    handleSync,    // Stable — no deps
  ])

  return { viewers }
}
