'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase-client'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import type { PagePresenceUser } from '@/types/presence'

/** Payload shape tracked via channel.track() for page-level presence */
interface PagePresencePayload {
  userId: string
  name: string
  color: string | null
  avatarUrl: string | null
  joinedAt: string
  activeInterventionId: string | null
}

/** Maximum number of concurrent page Presence channels allowed across all hook instances */
const MAX_CONCURRENT_PAGE_PRESENCE = 5

/** Module-level counter tracking active page Presence channels */
let activePagePresenceChannels = 0

/** Small async gap allows Supabase internal cleanup from React Strict Mode double-mount */
const SETUP_DELAY_MS = 50

/** Stale threshold: presence older than this is considered abandoned */
const STALE_MS = 5 * 60 * 1000 // 5 minutes

/** Heartbeat interval: re-track to refresh joinedAt and keep presence alive */
const HEARTBEAT_MS = 2 * 60 * 1000 // 2 minutes (well under STALE_MS)

/** Reconnection delay after channel error */
const RECONNECT_DELAY_MS = 5000 // 5 seconds

/**
 * Manages a Supabase Presence channel for real-time viewer tracking on a page.
 *
 * Architecture: each tab subscribes independently to 'presence:page-{pageName}'.
 * Completely separate from the intervention-level presence channels.
 *
 * Graceful degradation: if subscribe fails, returns empty viewers — page unaffected.
 *
 * @param pageName - Name of the page being viewed (e.g. 'interventions', 'artisans'). Pass null to disable.
 */
export function usePagePresence(
  pageName: string | null
): {
  viewers: PagePresenceUser[]
  updateActiveIntervention: (id: string | null) => void
} {
  const { data: currentUser } = useCurrentUser()
  const [viewers, setViewers] = useState<PagePresenceUser[]>([])
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

  // ─── Active intervention ref ────────────────────────────────────────────────
  const activeInterventionIdRef = useRef<string | null>(null)
  const joinedAtRef = useRef<string>(new Date().toISOString())

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

  // ─── Build payload from refs ──────────────────────────────────────────────────
  const buildPayload = useCallback((): PagePresencePayload | null => {
    const userData = currentUserDataRef.current
    const userId = currentUserIdRef.current
    if (!userId) return null

    return {
      userId,
      name:
        userData.surnom ||
        `${userData.prenom ?? ''} ${userData.nom ?? ''}`.trim() ||
        'Utilisateur',
      color: userData.color ?? null,
      avatarUrl: userData.avatar_url ?? null,
      joinedAt: joinedAtRef.current,
      activeInterventionId: activeInterventionIdRef.current,
    }
  }, [])

  // ─── doTrack: sends current payload to channel ──────────────────────────────
  const doTrack = useCallback(() => {
    const channel = channelRef.current
    if (!channel) return
    const payload = buildPayload()
    if (!payload) return
    channel.track(payload).catch((err: unknown) => {
      console.warn('[PagePresence] track() failed:', err)
    })
  }, [buildPayload])

  // ─── Public API: updateActiveIntervention ───────────────────────────────────
  const updateActiveIntervention = useCallback((id: string | null) => {
    activeInterventionIdRef.current = id
    doTrack()
  }, [doTrack])

  // ─── handleSync: reads from refs, zero deps ────────────────────────────────
  const handleSync = useCallback(() => {
    const channel = channelRef.current
    const userId = currentUserIdRef.current
    if (!channel || !userId) return

    const state = channel.presenceState<PagePresencePayload>()
    const now = Date.now()

    // Flatten all presence metas, exclude self
    const allMetas = Object.values(state).flat()
    const others = allMetas.filter((p) => p.userId !== userId)

    // Dedup by userId (same user in multiple tabs shows once)
    const unique = new Map(others.map((u) => [u.userId, u]))

    // Filter out stale entries and sort by joinedAt ascending for stable render order
    const sorted = Array.from(unique.values())
      .filter((u) => now - new Date(u.joinedAt).getTime() < STALE_MS)
      .sort((a, b) => a.joinedAt.localeCompare(b.joinedAt))

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
    if (!pageName || !currentUserId) {
      setViewers([])
      return
    }

    // Guard: reject if we've hit the concurrent channel limit
    if (activePagePresenceChannels >= MAX_CONCURRENT_PAGE_PRESENCE) {
      console.warn(
        `[PagePresence] Concurrent channel limit reached (${MAX_CONCURRENT_PAGE_PRESENCE}). ` +
        `Skipping subscription for page ${pageName}.`
      )
      setViewers([])
      return
    }

    // Reserve a slot immediately (decremented in cleanup)
    activePagePresenceChannels++

    let cancelled = false
    let heartbeatTimer: ReturnType<typeof setInterval> | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null

    const channelName = `presence:page-${pageName}`

    const subscribe = async () => {
      // Wait for any previous channel cleanup to complete
      await new Promise((resolve) => setTimeout(resolve, SETUP_DELAY_MS))
      if (cancelled || !mountedRef.current) return

      const channel = supabase.channel(channelName)
      channelRef.current = channel

      // Reset tracking on new subscription
      activeInterventionIdRef.current = null
      joinedAtRef.current = new Date().toISOString()

      channel
        .on('presence', { event: 'sync' }, handleSync)
        .on('presence', { event: 'join' }, () => handleSync())
        .on('presence', { event: 'leave' }, () => handleSync())
        .subscribe(async (status: string) => {
          if (cancelled || !mountedRef.current) return

          if (status === 'SUBSCRIBED') {
            const payload = buildPayload()
            if (!payload) return

            try {
              await channel.track(payload)
            } catch (error) {
              console.warn('[PagePresence] track() failed:', error)
            }

            // Start heartbeat: re-track every HEARTBEAT_MS to refresh joinedAt
            if (heartbeatTimer) clearInterval(heartbeatTimer)
            heartbeatTimer = setInterval(() => {
              if (cancelled || !mountedRef.current || !channelRef.current) {
                if (heartbeatTimer) clearInterval(heartbeatTimer)
                return
              }
              // Refresh joinedAt so the stale filter doesn't evict us
              joinedAtRef.current = new Date().toISOString()
              const freshPayload = buildPayload()
              if (freshPayload) {
                channelRef.current.track(freshPayload).catch(() => {})
              }
            }, HEARTBEAT_MS)
          } else if (
            status === 'CHANNEL_ERROR' ||
            status === 'TIMED_OUT'
          ) {
            console.warn(`[PagePresence] Channel ${channelName} error: ${status}, reconnecting...`)

            // Stop heartbeat
            if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null }

            // Cleanup broken channel
            const brokenCh = channelRef.current
            channelRef.current = null
            if (brokenCh) {
              brokenCh.untrack().catch(() => {})
              supabase.removeChannel(brokenCh)
            }

            // Schedule reconnection
            if (!reconnectTimer && !cancelled) {
              reconnectTimer = setTimeout(() => {
                reconnectTimer = null
                if (!cancelled && mountedRef.current) {
                  subscribe()
                }
              }, RECONNECT_DELAY_MS)
            }
          }
        })
    }

    subscribe()

    return () => {
      cancelled = true
      // Stop heartbeat and reconnection timers
      if (heartbeatTimer) clearInterval(heartbeatTimer)
      if (reconnectTimer) clearTimeout(reconnectTimer)
      // Release the concurrent channel slot
      activePagePresenceChannels = Math.max(0, activePagePresenceChannels - 1)
      // Null ref FIRST to prevent re-entry
      const ch = channelRef.current
      channelRef.current = null
      if (ch) {
        ch.untrack().catch(() => {})
        supabase.removeChannel(ch)
      }
      setViewers([])
    }
  }, [
    pageName,
    currentUserId,  // Primitive string — stable across useCurrentUser refetches
    handleSync,     // Stable — no deps
    buildPayload,   // Stable — no deps
  ])

  return { viewers, updateActiveIntervention }
}
