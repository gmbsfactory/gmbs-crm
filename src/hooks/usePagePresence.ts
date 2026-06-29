'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase-client'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import type { CrmPresenceState, PagePresenceUser } from '@/types/presence'

/** Payload shape tracked via channel.track() for page-level presence */
interface PagePresencePayload {
  userId: string
  name: string
  color: string | null
  avatarUrl: string | null
  joinedAt: string
  currentPage: string | null
  activeInterventionId: string | null
  activeInterventionLabel: string | null
  activeArtisanId: string | null
  activeArtisanLabel: string | null
  presenceState?: CrmPresenceState
  lastActiveAt?: string | null
  idleSinceAt?: string | null
  isIdle: boolean
}

/** Small async gap allows Supabase internal cleanup from React Strict Mode double-mount */
const SETUP_DELAY_MS = 50

/** Stale threshold: presence older than this is considered abandoned */
const STALE_MS = 5 * 60 * 1000 // 5 minutes

/** Heartbeat interval: re-track to refresh joinedAt and keep presence alive */
const HEARTBEAT_MS = 2 * 60 * 1000 // 2 minutes (well under STALE_MS)

/** Gate verbose presence logging behind an env flag (warnings always emit) */
const PRESENCE_DEBUG = process.env.NEXT_PUBLIC_DEBUG_PRESENCE === 'true'
const debugLog = (...args: unknown[]) => {
  if (PRESENCE_DEBUG) console.log(...args)
}

/** Reconnection delay after channel error */
const RECONNECT_DELAY_MS = 5000 // 5 seconds

/** Throttle interval for track() calls to avoid ClientPresenceRateLimitReached */
const TRACK_THROTTLE_MS = 500

/**
 * When the tab comes back to the foreground after being hidden at least this long,
 * the Realtime socket was very likely dropped silently (browser throttles/freezes
 * timers while backgrounded or asleep, so the socket heartbeat stops and the server
 * closes the connection). A silent drop never emits CHANNEL_ERROR/TIMED_OUT, so the
 * channel would otherwise stay a "zombie" — subscribed in name only — until a manual
 * reload. Past this threshold we force a clean re-subscribe; shorter hides just refresh
 * presence (no flicker). Measured with wall-clock time so it survives timer freezing.
 */
const WAKE_RESUBSCRIBE_MS = 30_000

/** Debounce coincident wake signals (e.g. visibilitychange + online firing together). */
const WAKE_COOLDOWN_MS = 3_000

/** Single global channel name — shared across all pages */
const CHANNEL_NAME = 'presence:pages'

const PRESENCE_RANK: Record<CrmPresenceState, number> = { active: 0, idle: 1, offline: 2 }
function stateOfPayload(payload: Pick<PagePresencePayload, 'presenceState' | 'isIdle'>): CrmPresenceState {
  return payload.presenceState ?? (payload.isIdle ? 'idle' : 'active')
}

function dedupePresenceMetas(metas: PagePresencePayload[]): Map<string, PagePresencePayload> {
  const unique = new Map<string, PagePresencePayload>()
  for (const meta of metas) {
    const existing = unique.get(meta.userId)
    if (!existing) {
      unique.set(meta.userId, meta)
      continue
    }
    const nextRank = PRESENCE_RANK[stateOfPayload(meta)]
    const currentRank = PRESENCE_RANK[stateOfPayload(existing)]
    if (nextRank < currentRank) {
      unique.set(meta.userId, meta)
    } else if (nextRank === currentRank && meta.joinedAt > existing.joinedAt) {
      unique.set(meta.userId, meta)
    }
  }
  return unique
}

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
  pageName: string | null,
  isIdle = false,
  presenceState: CrmPresenceState = isIdle ? 'idle' : 'active',
  lastActiveAt: string | null = null,
  idleSinceAt: string | null = null
): {
  viewers: PagePresenceUser[]
  allUsers: PagePresenceUser[]
  updateActiveIntervention: (id: string | null, label?: string | null) => void
  updateActiveArtisan: (id: string | null, label?: string | null) => void
} {
  const { data: currentUser } = useCurrentUser()
  const [viewers, setViewers] = useState<PagePresenceUser[]>([])
  const [allUsers, setAllUsers] = useState<PagePresenceUser[]>([])
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

  // ─── Page & entity tracking refs ──────────────────────────────────────────────
  const pageNameRef = useRef<string | null>(pageName)
  const activeInterventionIdRef = useRef<string | null>(null)
  const activeInterventionLabelRef = useRef<string | null>(null)
  const activeArtisanIdRef = useRef<string | null>(null)
  const activeArtisanLabelRef = useRef<string | null>(null)
  const joinedAtRef = useRef<string>(new Date().toISOString())
  const isIdleRef = useRef<boolean>(isIdle)
  const presenceStateRef = useRef<CrmPresenceState>(presenceState)
  const lastActiveAtRef = useRef<string | null>(lastActiveAt)
  const idleSinceAtRef = useRef<string | null>(idleSinceAt)

  // ─── Throttle ref for track() calls ──────────────────────────────────────────
  const trackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ─── Referential stability for viewers (prevents re-renders on heartbeat) ────
  const prevViewersKeyRef = useRef('')
  const prevAllUsersKeyRef = useRef('')

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
      activeInterventionLabel: activeInterventionLabelRef.current,
      activeArtisanId: activeArtisanIdRef.current,
      activeArtisanLabel: activeArtisanLabelRef.current,
      presenceState: presenceStateRef.current,
      lastActiveAt: lastActiveAtRef.current,
      idleSinceAt: idleSinceAtRef.current,
      isIdle: isIdleRef.current,
    }
  }, [])

  // ─── doTrack: throttled — sends current payload to channel ─────────────────
  const doTrack = useCallback(() => {
    if (trackTimerRef.current) return // Already scheduled
    trackTimerRef.current = setTimeout(() => {
      trackTimerRef.current = null
      const channel = channelRef.current
      if (!channel) return
      const payload = buildPayload()
      if (!payload) return
      channel.track(payload).catch((err: unknown) => {
        console.warn('[PagePresence] track() failed:', err)
      })
    }, TRACK_THROTTLE_MS)
  }, [buildPayload])

  // ─── Public API: updateActiveIntervention / updateActiveArtisan ──────────────
  const updateActiveIntervention = useCallback((id: string | null, label: string | null = null) => {
    activeInterventionIdRef.current = id
    activeInterventionLabelRef.current = label
    doTrack()
  }, [doTrack])

  const updateActiveArtisan = useCallback((id: string | null, label: string | null = null) => {
    activeArtisanIdRef.current = id
    activeArtisanLabelRef.current = label
    doTrack()
  }, [doTrack])

  // ─── handleSync: reads from refs, filters by current page ─────────────────
  const handleSync = useCallback(() => {
    const channel = channelRef.current
    const userId = currentUserIdRef.current
    const currentPage = pageNameRef.current
    if (!channel || !userId) return

    const state = channel.presenceState<PagePresencePayload>()
    const now = Date.now()

    // Flatten all presence metas
    const allMetas = Object.values(state).flat()

    // ─── allUsers: ALL connected users (including self), all pages ────────────
    const allUnique = dedupePresenceMetas(allMetas)
    const allSorted: PagePresenceUser[] = Array.from(allUnique.values())
      .filter((u) => now - new Date(u.joinedAt).getTime() < STALE_MS)
      .sort((a, b) => a.joinedAt.localeCompare(b.joinedAt))
      .map((u) => {
        const state = stateOfPayload(u)
        return {
          userId: u.userId,
          name: u.name,
          color: u.color,
          avatarUrl: u.avatarUrl,
          joinedAt: u.joinedAt,
          currentPage: u.currentPage,
          activeInterventionId: u.activeInterventionId,
          activeInterventionLabel: u.activeInterventionLabel ?? null,
          activeArtisanId: u.activeArtisanId ?? null,
          activeArtisanLabel: u.activeArtisanLabel ?? null,
          presenceState: state,
          lastActiveAt: u.lastActiveAt ?? null,
          idleSinceAt: u.idleSinceAt ?? null,
          isIdle: state !== 'active',
        }
      })

    const allUsersKey = allSorted
      .map((v) => `${v.userId}:${v.currentPage ?? ''}:${v.activeInterventionId ?? ''}:${v.activeInterventionLabel ?? ''}:${v.activeArtisanId ?? ''}:${v.activeArtisanLabel ?? ''}:${v.presenceState ?? ''}:${v.lastActiveAt ?? ''}:${v.idleSinceAt ?? ''}`)
      .join('|')
    if (allUsersKey !== prevAllUsersKeyRef.current) {
      prevAllUsersKeyRef.current = allUsersKey
      setAllUsers(allSorted)
    }

    // ─── viewers: same-page users excluding self ──────────────────────────────
    if (!currentPage) {
      if (prevViewersKeyRef.current !== '') {
        prevViewersKeyRef.current = ''
        setViewers([])
      }
      return
    }

    const others = allMetas.filter(
      (p) => p.userId !== userId && p.currentPage === currentPage
    )

    // Dedup by userId (same user in multiple tabs shows once)
    const unique = dedupePresenceMetas(others)

    // Filter out stale entries and sort by joinedAt ascending for stable render order
    const sorted: PagePresenceUser[] = Array.from(unique.values())
      .filter((u) => now - new Date(u.joinedAt).getTime() < STALE_MS)
      .sort((a, b) => a.joinedAt.localeCompare(b.joinedAt))
      .map((u) => {
        const state = stateOfPayload(u)
        return {
          userId: u.userId,
          name: u.name,
          color: u.color,
          avatarUrl: u.avatarUrl,
          joinedAt: u.joinedAt,
          currentPage: u.currentPage,
          activeInterventionId: u.activeInterventionId,
          activeInterventionLabel: u.activeInterventionLabel ?? null,
          activeArtisanId: u.activeArtisanId ?? null,
          activeArtisanLabel: u.activeArtisanLabel ?? null,
          presenceState: state,
          lastActiveAt: u.lastActiveAt ?? null,
          idleSinceAt: u.idleSinceAt ?? null,
          isIdle: state !== 'active',
        }
      })

    // Only update state when data actually changed — prevents flash on heartbeat syncs
    const viewersKey = sorted
      .map((v) => `${v.userId}:${v.activeInterventionId ?? ''}:${v.activeArtisanId ?? ''}:${v.presenceState ?? ''}:${v.lastActiveAt ?? ''}:${v.idleSinceAt ?? ''}`)
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

  // ─── Re-track immediately when idle state changes ─────────────────────────
  useEffect(() => {
    isIdleRef.current = isIdle
    presenceStateRef.current = presenceState
    lastActiveAtRef.current = lastActiveAt
    idleSinceAtRef.current = idleSinceAt
    doTrack()
  }, [isIdle, presenceState, lastActiveAt, idleSinceAt, doTrack])

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
      setAllUsers([])
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

      debugLog(`[PagePresence] Subscribing to ${CHANNEL_NAME}`)

      // Only listen to 'sync' — Supabase fires it after every join/leave,
      // so separate join/leave handlers would double-trigger handleSync.
      channel
        .on('presence', { event: 'sync' }, handleSync)
        .subscribe(async (status: string) => {
          if (cancelled || !mountedRef.current) return

          debugLog(`[PagePresence] Channel status: ${status}`)

          if (status === 'SUBSCRIBED') {
            const payload = buildPayload()
            if (!payload) return

            try {
              await channel.track(payload)
              debugLog(`[PagePresence] Tracking on page: ${payload.currentPage}`)
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

    // ─── Wake guard: recover the presence channel after background/sleep ──────
    // The channel only self-heals on an explicit CHANNEL_ERROR/TIMED_OUT, which a
    // silent socket drop (backgrounded tab / sleeping machine) never emits. Without
    // this, presence stays stale until a manual reload. We watch for the tab waking
    // up and re-subscribe a fresh channel when the prior one is likely dead.
    let hiddenAt: number | null = null
    let lastWakeResubscribeAt = 0

    const resubscribe = (reason: string) => {
      if (cancelled || !mountedRef.current) return
      const now = Date.now()
      if (now - lastWakeResubscribeAt < WAKE_COOLDOWN_MS) return // ignore coincident signals
      lastWakeResubscribeAt = now
      debugLog(`[PagePresence] Wake re-subscribe (${reason})`)
      // Tear down the (possibly zombie) channel + its timers, then subscribe fresh.
      // Only this channel is touched — the shared socket / crm-sync channel is untouched
      // (and subscribing a fresh channel revives the socket if it was dropped).
      if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null }
      if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null }
      const ch = channelRef.current
      channelRef.current = null
      if (ch) {
        ch.untrack().catch(() => {})
        supabase.removeChannel(ch)
      }
      subscribe()
    }

    const handleVisibility = () => {
      if (cancelled || !mountedRef.current) return
      if (document.hidden) {
        hiddenAt = Date.now()
        return
      }
      const hiddenMs = hiddenAt != null ? Date.now() - hiddenAt : 0
      hiddenAt = null
      if (!channelRef.current || hiddenMs >= WAKE_RESUBSCRIBE_MS) {
        resubscribe('visible-after-long-hide')
      } else {
        // Brief switch — the channel is still healthy: just refresh joinedAt + presence.
        joinedAtRef.current = new Date().toISOString()
        doTrack()
      }
    }

    const handleOnline = () => {
      // Network regained → the WebSocket was almost certainly closed → re-subscribe.
      resubscribe('network-online')
    }

    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('online', handleOnline)

    return () => {
      cancelled = true
      debugLog(`[PagePresence] Cleaning up ${CHANNEL_NAME}`)
      // Remove wake listeners
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('online', handleOnline)
      // Stop heartbeat, reconnection and throttle timers
      if (heartbeatTimer) clearInterval(heartbeatTimer)
      if (reconnectTimer) clearTimeout(reconnectTimer)
      if (trackTimerRef.current) { clearTimeout(trackTimerRef.current); trackTimerRef.current = null }
      // Null ref FIRST to prevent re-entry
      const ch = channelRef.current
      channelRef.current = null
      if (ch) {
        ch.untrack().catch(() => {})
        supabase.removeChannel(ch)
      }
      setViewers([])
      setAllUsers([])
    }
  }, [
    currentUserId, // Primitive string — channel lives as long as user is authed
    handleSync,    // Stable — no deps
    buildPayload,  // Stable — no deps
    doTrack,       // Stable — used by the wake guard's brief-switch refresh
  ])

  return { viewers, allUsers, updateActiveIntervention, updateActiveArtisan }
}
