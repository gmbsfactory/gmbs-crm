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
  currentPage: string | null
  activeInterventionId: string | null
}

/** Small async gap allows Supabase internal cleanup from React Strict Mode double-mount */
const SETUP_DELAY_MS = 50

/** Stale threshold: presence older than this is considered abandoned */
const STALE_MS = 5 * 60 * 1000 // 5 minutes

/** Heartbeat interval: re-track to refresh joinedAt and keep presence alive */
const HEARTBEAT_MS = 2 * 60 * 1000 // 2 minutes (well under STALE_MS)

/** Reconnection delay after channel error */
const RECONNECT_DELAY_MS = 5000 // 5 seconds

/** Single global channel name — shared across all pages */
const CHANNEL_NAME = 'presence:pages'

/**
 * Manages a single global Supabase Presence channel for real-time viewer tracking
 * across all pages. Unlike the previous per-page approach, the channel stays alive
 * when navigating between pages — only a lightweight track() call updates the
 * current page, resulting in near-instant presence updates on navigation.
 *
 * Architecture:
 * - ONE channel `presence:pages` shared by all page instances
 * - Each user tracks their `currentPage` in the payload
 * - `handleSync` filters viewers by the current page
 * - Page navigation = track() update, not unsubscribe/resubscribe
 *
 * @param pageName - Name of the page being viewed. Pass null for non-presence pages.
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

  // ─── Page & intervention tracking refs ────────────────────────────────────────
  const pageNameRef = useRef<string | null>(pageName)
  const activeInterventionIdRef = useRef<string | null>(null)
  const joinedAtRef = useRef<string>(new Date().toISOString())

  // ─── Referential stability for viewers (prevents re-renders on heartbeat) ────
  const prevViewersKeyRef = useRef('')

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
      currentPage: pageNameRef.current,
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

  // ─── handleSync: reads from refs, filters by current page ─────────────────
  const handleSync = useCallback(() => {
    const channel = channelRef.current
    const userId = currentUserIdRef.current
    const currentPage = pageNameRef.current
    if (!channel || !userId) return

    // If not on a presence-enabled page, show empty
    if (!currentPage) {
      if (prevViewersKeyRef.current !== '') {
        prevViewersKeyRef.current = ''
        setViewers([])
      }
      return
    }

    const state = channel.presenceState<PagePresencePayload>()
    const now = Date.now()

    // Flatten all presence metas, exclude self, filter by current page
    const allMetas = Object.values(state).flat()
    const others = allMetas.filter(
      (p) => p.userId !== userId && p.currentPage === currentPage
    )

    // Dedup by userId (same user in multiple tabs shows once)
    const unique = new Map(others.map((u) => [u.userId, u]))

    // Filter out stale entries and sort by joinedAt ascending for stable render order
    const sorted: PagePresenceUser[] = Array.from(unique.values())
      .filter((u) => now - new Date(u.joinedAt).getTime() < STALE_MS)
      .sort((a, b) => a.joinedAt.localeCompare(b.joinedAt))
      .map((u) => ({
        userId: u.userId,
        name: u.name,
        color: u.color,
        avatarUrl: u.avatarUrl,
        joinedAt: u.joinedAt,
        activeInterventionId: u.activeInterventionId,
      }))

    // Only update state when data actually changed — prevents flash on heartbeat syncs
    const viewersKey = sorted
      .map((v) => `${v.userId}:${v.activeInterventionId ?? ''}`)
      .join('|')
    if (viewersKey !== prevViewersKeyRef.current) {
      prevViewersKeyRef.current = viewersKey
      setViewers(sorted)
    }
  }, []) // Stable — reads from refs

  // ─── Re-track when pageName changes (near-instant, no channel re-creation) ──
  useEffect(() => {
    pageNameRef.current = pageName
    // Re-track with new page + trigger sync to filter viewers by new page
    doTrack()
    // Also re-run handleSync to immediately filter existing presence data
    handleSync()
  }, [pageName, doTrack, handleSync])

  // ─── Track mounted state for async callbacks ───────────────────────────────
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  // ─── Single global Presence channel lifecycle (tied to userId only) ────────
  useEffect(() => {
    if (!currentUserId) {
      setViewers([])
      return
    }

    let cancelled = false
    let heartbeatTimer: ReturnType<typeof setInterval> | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null

    const subscribe = async () => {
      // Wait for any previous channel cleanup to complete
      await new Promise((resolve) => setTimeout(resolve, SETUP_DELAY_MS))
      if (cancelled || !mountedRef.current) return

      const channel = supabase.channel(CHANNEL_NAME)
      channelRef.current = channel

      // Reset joinedAt on new subscription
      joinedAtRef.current = new Date().toISOString()

      console.log(`[PagePresence] Subscribing to ${CHANNEL_NAME}`)

      channel
        .on('presence', { event: 'sync' }, handleSync)
        .on('presence', { event: 'join' }, () => handleSync())
        .on('presence', { event: 'leave' }, () => handleSync())
        .subscribe(async (status: string) => {
          if (cancelled || !mountedRef.current) return

          console.log(`[PagePresence] Channel status: ${status}`)

          if (status === 'SUBSCRIBED') {
            const payload = buildPayload()
            if (!payload) return

            try {
              await channel.track(payload)
              console.log(`[PagePresence] Tracking on page: ${payload.currentPage}`)
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
            console.warn(`[PagePresence] Channel error: ${status}, reconnecting...`)

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
      console.log(`[PagePresence] Cleaning up ${CHANNEL_NAME}`)
      // Stop heartbeat and reconnection timers
      if (heartbeatTimer) clearInterval(heartbeatTimer)
      if (reconnectTimer) clearTimeout(reconnectTimer)
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
    currentUserId, // Primitive string — channel lives as long as user is authed
    handleSync,    // Stable — no deps
    buildPayload,  // Stable — no deps
  ])

  return { viewers, updateActiveIntervention }
}
