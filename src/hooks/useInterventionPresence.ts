'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase-client'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import type { PresenceUser, PresencePayload, FieldLockMap } from '@/types/presence'

/** Stale lock threshold: locks older than this are ignored (user walked away) */
const STALE_LOCK_MS = 5 * 60 * 1000 // 5 minutes

/** Throttle interval for channel.track() calls during rapid focus/blur */
const TRACK_THROTTLE_MS = 300

/** Maximum number of concurrent Presence channels allowed across all hook instances */
const MAX_CONCURRENT_PRESENCE = 3

/** Module-level counter tracking active Presence channels */
let activePresenceChannels = 0

/**
 * Manages a Supabase Presence channel for real-time viewer tracking
 * on an intervention modal, including field-level soft locking
 * and exclusive editor lock.
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
 * 4. FIELD-LEVEL TRACKING (Feb 2025) — Extends the presence payload with activeField
 *    and fieldLockedAt. trackField/clearField use a ref-based trailing throttle to
 *    batch rapid focus/blur events. handleSync builds a fieldLockMap excluding stale
 *    locks (>5 min) and the current user's own fields.
 *
 * 5. EXCLUSIVE EDITOR LOCK (Feb 2025) — First user to open the modal becomes the
 *    editor (isEditing: true). Subsequent users open in read-only mode.
 *    When the editor leaves, the oldest viewer is promoted to editor automatically.
 *    The `activeEditor` return value lets the modal show a read-only banner.
 *
 * @param interventionId - ID of the intervention being viewed. Pass null to disable.
 */
export function useInterventionPresence(
  interventionId: string | null
): {
  viewers: PresenceUser[]
  activeEditor: PresenceUser | null
  fieldLockMap: FieldLockMap
  trackField: (fieldName: string) => void
  clearField: () => void
} {
  const { data: currentUser } = useCurrentUser()
  const [viewers, setViewers] = useState<PresenceUser[]>([])
  const [activeEditor, setActiveEditor] = useState<PresenceUser | null>(null)
  const [fieldLockMap, setFieldLockMap] = useState<FieldLockMap>({})
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

  // ─── Field tracking refs ─────────────────────────────────────────────────────
  const activeFieldRef = useRef<string | null>(null)
  const fieldLockedAtRef = useRef<string | null>(null)
  const throttleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** Stored joinedAt to reuse in subsequent track() calls */
  const joinedAtRef = useRef<string>(new Date().toISOString())

  // ─── Editor lock ref ─────────────────────────────────────────────────────────
  /** Whether this user is the active editor. Stored as ref for stable buildPayload. */
  const isEditingRef = useRef<boolean>(false)
  /** Whether the initial sync has determined our editing status */
  const hasResolvedEditingRef = useRef<boolean>(false)

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
  const buildPayload = useCallback((): PresencePayload | null => {
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
      activeField: activeFieldRef.current,
      fieldLockedAt: fieldLockedAtRef.current,
      isEditing: isEditingRef.current,
    }
  }, [])

  // ─── Throttled track: batches rapid focus/blur into a single track() call ────
  const doTrack = useCallback(() => {
    const channel = channelRef.current
    if (!channel) return
    const payload = buildPayload()
    if (!payload) return
    channel.track(payload).catch((err: unknown) => {
      console.warn('[Presence] field track() failed:', err)
    })
  }, [buildPayload])

  const scheduleTrack = useCallback((flush?: boolean) => {
    if (throttleTimerRef.current) {
      clearTimeout(throttleTimerRef.current)
      throttleTimerRef.current = null
    }
    if (flush) {
      doTrack()
    } else {
      throttleTimerRef.current = setTimeout(doTrack, TRACK_THROTTLE_MS)
    }
  }, [doTrack])

  // ─── Public API: trackField / clearField ─────────────────────────────────────
  const trackField = useCallback((fieldName: string) => {
    activeFieldRef.current = fieldName
    fieldLockedAtRef.current = new Date().toISOString()
    scheduleTrack()
  }, [scheduleTrack])

  const clearField = useCallback(() => {
    activeFieldRef.current = null
    fieldLockedAtRef.current = null
    scheduleTrack(true) // flush immediately so lock releases fast
  }, [scheduleTrack])

  // ─── Referential stability helpers ──────────────────────────────────────────
  // Avoids re-renders on every Supabase Presence heartbeat (~30s) when data is unchanged.
  const prevViewersKeyRef = useRef('')
  const prevEditorKeyRef = useRef('')
  const prevLocksKeyRef = useRef('')

  // ─── handleSync: reads from refs, zero deps ────────────────────────────────
  const handleSync = useCallback(() => {
    const channel = channelRef.current
    const userId = currentUserIdRef.current
    if (!channel || !userId) return

    const state = channel.presenceState<PresencePayload>()
    const now = Date.now()

    // Flatten all presence metas
    const allMetas = Object.values(state).flat()

    // ─── Determine active editor (across ALL users, including self) ──────────
    // Find the user with isEditing: true. If multiple (race condition), pick oldest joinedAt.
    const editors = allMetas
      .filter((p) => p.isEditing)
      .sort((a, b) => a.joinedAt.localeCompare(b.joinedAt))
    const currentEditor = editors[0] ?? null

    // Map to PresenceUser shape for the activeEditor return
    const editorUser: PresenceUser | null = currentEditor
      ? {
          userId: currentEditor.userId,
          name: currentEditor.name,
          color: currentEditor.color,
          avatarUrl: currentEditor.avatarUrl,
          joinedAt: currentEditor.joinedAt,
          activeField: currentEditor.activeField,
          fieldLockedAt: currentEditor.fieldLockedAt,
          isEditing: true,
        }
      : null

    // Only update activeEditor state if it actually changed
    const editorKey = editorUser ? `${editorUser.userId}:${editorUser.isEditing}` : ''
    if (editorKey !== prevEditorKeyRef.current) {
      prevEditorKeyRef.current = editorKey
      setActiveEditor(editorUser)
    }

    // ─── Auto-promotion: if no editor exists and we haven't claimed yet ──────
    if (!currentEditor && hasResolvedEditingRef.current) {
      // No editor — promote ourselves
      if (!isEditingRef.current) {
        isEditingRef.current = true
        console.log('[Presence] Promoted to editor (previous editor left)')
        // Re-track with isEditing: true
        const payload = buildPayload()
        if (payload) {
          channel.track(payload).catch((err: unknown) => {
            console.warn('[Presence] promotion track() failed:', err)
          })
        }
      }
    }

    // ─── Viewers: exclude self ───────────────────────────────────────────────
    const others = allMetas.filter((p) => p.userId !== userId)

    // Dedup by userId (same user in multiple tabs shows once)
    const unique = new Map(others.map((u) => [u.userId, u]))

    // Sort by joinedAt ascending for stable render order
    const sorted: PresenceUser[] = Array.from(unique.values())
      .sort((a, b) => a.joinedAt.localeCompare(b.joinedAt))
      .map((u) => ({
        userId: u.userId,
        name: u.name,
        color: u.color,
        avatarUrl: u.avatarUrl,
        joinedAt: u.joinedAt,
        activeField: u.activeField,
        fieldLockedAt: u.fieldLockedAt,
        isEditing: u.isEditing,
      }))

    // Build field lock map (skip stale locks)
    const locks: FieldLockMap = {}
    for (const user of unique.values()) {
      if (user.activeField && user.fieldLockedAt) {
        const lockedAt = new Date(user.fieldLockedAt).getTime()
        if (now - lockedAt < STALE_LOCK_MS) {
          locks[user.activeField] = {
            userId: user.userId,
            name: user.name,
            color: user.color,
            avatarUrl: user.avatarUrl,
            joinedAt: user.joinedAt,
            activeField: user.activeField,
            fieldLockedAt: user.fieldLockedAt,
            isEditing: user.isEditing,
          }
        }
      }
    }

    // Only update state when data actually changed — prevents flash on heartbeat syncs
    const viewersKey = sorted.map((v) => `${v.userId}:${v.activeField ?? ''}:${v.isEditing}`).join('|')
    if (viewersKey !== prevViewersKeyRef.current) {
      prevViewersKeyRef.current = viewersKey
      setViewers(sorted)
    }

    const locksKey = Object.entries(locks).map(([k, v]) => `${k}:${v.userId}`).join('|')
    if (locksKey !== prevLocksKeyRef.current) {
      prevLocksKeyRef.current = locksKey
      setFieldLockMap(locks)
    }
  }, [buildPayload]) // buildPayload is stable (no deps)

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
      setActiveEditor(null)
      setFieldLockMap({})
      return
    }

    // Guard: reject if we've hit the concurrent channel limit
    if (activePresenceChannels >= MAX_CONCURRENT_PRESENCE) {
      console.warn(
        `[Presence] Concurrent channel limit reached (${MAX_CONCURRENT_PRESENCE}). ` +
        `Skipping subscription for intervention ${interventionId}.`
      )
      setViewers([])
      setActiveEditor(null)
      setFieldLockMap({})
      return
    }

    // Reserve a slot immediately (decremented in cleanup)
    activePresenceChannels++

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

      // Reset field tracking on new subscription
      activeFieldRef.current = null
      fieldLockedAtRef.current = null
      joinedAtRef.current = new Date().toISOString()
      // Reset editing state — will be resolved on first sync
      isEditingRef.current = false
      hasResolvedEditingRef.current = false

      console.log(`[Presence] Subscribing to ${channelName}`)

      channel
        .on('presence', { event: 'sync' }, handleSync)
        .on('presence', { event: 'join' }, ({ key, newPresences }: { key: string; newPresences: unknown[] }) => {
          console.log(`[Presence] User joined:`, key, newPresences.length, 'presence(s)')
          handleSync()
        })
        .on('presence', { event: 'leave' }, ({ key, leftPresences }: { key: string; leftPresences: unknown[] }) => {
          console.log(`[Presence] User left:`, key, leftPresences.length, 'presence(s)')
          handleSync()
        })
        .subscribe(async (status: string) => {
          if (cancelled || !mountedRef.current) return

          console.log(`[Presence] Channel ${channelName} status: ${status}`)

          if (status === 'SUBSCRIBED') {
            // Determine initial editing status: check if anyone is already editing
            const state = channel.presenceState() as Record<string, PresencePayload[]>
            const allMetas: PresencePayload[] = Object.values(state).flat()
            const existingEditor = allMetas.find((p) => p.isEditing)

            if (existingEditor) {
              // Someone is already editing — we open in read-only
              isEditingRef.current = false
              console.log(`[Presence] Opening read-only (editor: ${existingEditor.name})`)
            } else {
              // No editor — we become the editor
              isEditingRef.current = true
              console.log(`[Presence] Opening as editor`)
            }
            hasResolvedEditingRef.current = true

            const payload = buildPayload()
            if (!payload) return

            try {
              console.log(`[Presence] Tracking user: ${payload.name} (editing: ${payload.isEditing})`)
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
      // Release the concurrent channel slot
      activePresenceChannels = Math.max(0, activePresenceChannels - 1)
      // Cancel any pending throttled track
      if (throttleTimerRef.current) {
        clearTimeout(throttleTimerRef.current)
        throttleTimerRef.current = null
      }
      // Null ref FIRST to prevent re-entry (matches useCrmRealtime pattern)
      const ch = channelRef.current
      channelRef.current = null
      if (ch) {
        ch.untrack().catch(() => {})
        supabase.removeChannel(ch)
      }
      // Reset editing state
      isEditingRef.current = false
      hasResolvedEditingRef.current = false
      setViewers([])
      setActiveEditor(null)
      setFieldLockMap({})
    }
  }, [
    interventionId,
    currentUserId, // Primitive string — stable across useCurrentUser refetches
    handleSync,    // Stable — reads from refs + buildPayload (stable)
    buildPayload,  // Stable — no deps
  ])

  return { viewers, activeEditor, fieldLockMap, trackField, clearField }
}
