'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase-client'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import type { PresenceUser, PresencePayload, FieldLockMap } from '@/types/presence'

/** Stale lock threshold: locks older than this are ignored (user walked away) */
const STALE_LOCK_MS = 5 * 60 * 1000 // 5 minutes

/** Throttle interval for channel.track() calls during rapid focus/blur */
const TRACK_THROTTLE_MS = 1000

/** Maximum number of concurrent Presence channels allowed across all hook instances */
const MAX_CONCURRENT_PRESENCE = 3

/** Shared counter from useInterventionPresence — enforces a GLOBAL cap across both hooks */
import {
  activePresenceChannels,
  incrementPresenceChannels,
  decrementPresenceChannels,
} from './useInterventionPresence'

/**
 * Manages a Supabase Presence channel for real-time viewer tracking
 * on an artisan modal, including field-level soft locking
 * and exclusive editor lock.
 *
 * Architecture: identical to useInterventionPresence but uses
 * 'presence:artisan-{id}' channels. Each tab subscribes independently.
 *
 * @param artisanId - ID of the artisan being viewed. Pass null to disable.
 */
export function useArtisanPresence(
  artisanId: string | null
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
  const joinedAtRef = useRef<string>(new Date().toISOString())

  // ─── Editor lock ref ─────────────────────────────────────────────────────────
  const isEditingRef = useRef<boolean>(false)
  const hasResolvedEditingRef = useRef<boolean>(false)

  // Keep refs in sync on every render
  currentUserIdRef.current = currentUser?.id ?? null
  currentUserDataRef.current = {
    surnom: currentUser?.surnom,
    prenom: currentUser?.prenom,
    nom: currentUser?.nom,
    color: currentUser?.color,
    avatar_url: currentUser?.avatar_url,
  }

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

  // ─── Throttled track: ALL track() calls go through this to respect rate limits ─
  const lastTrackTimeRef = useRef<number>(0)

  const doTrack = useCallback(() => {
    const channel = channelRef.current
    if (!channel) return
    const payload = buildPayload()
    if (!payload) return
    lastTrackTimeRef.current = Date.now()
    channel.track(payload).catch((err: unknown) => {
      console.warn('[ArtisanPresence] field track() failed:', err)
    })
  }, [buildPayload])

  const scheduleTrack = useCallback((flush?: boolean) => {
    if (throttleTimerRef.current) {
      clearTimeout(throttleTimerRef.current)
      throttleTimerRef.current = null
    }
    if (flush) {
      const elapsed = Date.now() - lastTrackTimeRef.current
      if (elapsed >= TRACK_THROTTLE_MS) {
        doTrack()
      } else {
        throttleTimerRef.current = setTimeout(doTrack, TRACK_THROTTLE_MS - elapsed)
      }
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
    scheduleTrack(true)
  }, [scheduleTrack])

  // ─── Referential stability helpers ──────────────────────────────────────────
  const prevViewersKeyRef = useRef('')
  const prevEditorKeyRef = useRef('')
  const prevLocksKeyRef = useRef('')

  // ─── handleSync ───────────────────────────────────────────────────────────────
  const handleSync = useCallback(() => {
    const channel = channelRef.current
    const userId = currentUserIdRef.current
    if (!channel || !userId) return

    const state = channel.presenceState<PresencePayload>()
    const now = Date.now()
    const allMetas = Object.values(state).flat()

    // ─── Determine active editor ──────────────────────────────────────────────
    const editors = allMetas
      .filter((p) => p.isEditing)
      .sort((a, b) => a.joinedAt.localeCompare(b.joinedAt))
    const currentEditor = editors[0] ?? null

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

    const editorKey = editorUser ? `${editorUser.userId}:${editorUser.isEditing}` : ''
    if (editorKey !== prevEditorKeyRef.current) {
      prevEditorKeyRef.current = editorKey
      setActiveEditor(editorUser)
    }

    // ─── Auto-promotion: only the OLDEST viewer promotes to avoid race ────────
    if (!currentEditor && hasResolvedEditingRef.current && !isEditingRef.current) {
      const candidates = allMetas
        .filter((p) => !p.isEditing)
        .sort((a, b) => a.joinedAt.localeCompare(b.joinedAt))
      const oldest = candidates[0]

      if (oldest?.userId === userId) {
        isEditingRef.current = true
        console.log('[ArtisanPresence] Promoted to editor (oldest viewer, previous editor left)')
        scheduleTrack()
      }
    }

    // ─── Viewers: exclude self ──────────────────────────────────────────────────
    const others = allMetas.filter((p) => p.userId !== userId)
    const unique = new Map(others.map((u) => [u.userId, u]))

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
  }, [buildPayload, scheduleTrack])

  // ─── Track mounted state ─────────────────────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  // ─── Main Presence channel lifecycle ─────────────────────────────────────────
  useEffect(() => {
    if (!artisanId || !currentUserId) {
      setViewers([])
      setActiveEditor(null)
      setFieldLockMap({})
      return
    }

    if (activePresenceChannels >= MAX_CONCURRENT_PRESENCE) {
      console.warn(
        `[ArtisanPresence] Concurrent channel limit reached (${MAX_CONCURRENT_PRESENCE}). ` +
        `Skipping subscription for artisan ${artisanId}.`
      )
      setViewers([])
      setActiveEditor(null)
      setFieldLockMap({})
      return
    }

    incrementPresenceChannels()

    let cancelled = false
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    const SETUP_DELAY_MS = 50
    const RECONNECT_DELAY_MS = 5000

    const channelName = `presence:artisan-${artisanId}`

    const subscribe = async () => {
      await new Promise((resolve) => setTimeout(resolve, SETUP_DELAY_MS))
      if (cancelled || !mountedRef.current) return

      const channel = supabase.channel(channelName)
      channelRef.current = channel

      activeFieldRef.current = null
      fieldLockedAtRef.current = null
      joinedAtRef.current = new Date().toISOString()
      isEditingRef.current = false
      hasResolvedEditingRef.current = false

      console.log(`[ArtisanPresence] Subscribing to ${channelName}`)

      channel
        .on('presence', { event: 'sync' }, handleSync)
        .on('presence', { event: 'join' }, ({ key, newPresences }: { key: string; newPresences: unknown[] }) => {
          console.log(`[ArtisanPresence] User joined:`, key, newPresences.length, 'presence(s)')
          handleSync()
        })
        .on('presence', { event: 'leave' }, ({ key, leftPresences }: { key: string; leftPresences: unknown[] }) => {
          console.log(`[ArtisanPresence] User left:`, key, leftPresences.length, 'presence(s)')
          handleSync()
        })
        .subscribe(async (status: string) => {
          if (cancelled || !mountedRef.current) return

          console.log(`[ArtisanPresence] Channel ${channelName} status: ${status}`)

          if (status === 'SUBSCRIBED') {
            const state = channel.presenceState() as Record<string, PresencePayload[]>
            const allMetas: PresencePayload[] = Object.values(state).flat()
            const existingEditor = allMetas.find((p) => p.isEditing)

            if (existingEditor) {
              isEditingRef.current = false
              console.log(`[ArtisanPresence] Opening read-only (editor: ${existingEditor.name})`)
            } else {
              isEditingRef.current = true
              console.log(`[ArtisanPresence] Opening as editor`)
            }
            hasResolvedEditingRef.current = true

            const payload = buildPayload()
            if (!payload) return

            try {
              console.log(`[ArtisanPresence] Tracking user: ${payload.name} (editing: ${payload.isEditing})`)
              await channel.track(payload)
              console.log(`[ArtisanPresence] Track successful for ${channelName}`)
            } catch (error) {
              console.warn('[ArtisanPresence] track() failed:', error)
            }
          } else if (
            status === 'CHANNEL_ERROR' ||
            status === 'TIMED_OUT'
          ) {
            console.warn(`[ArtisanPresence] Channel ${channelName} error: ${status}, reconnecting...`)

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
      console.log(`[ArtisanPresence] Cleaning up ${channelName}`)
      decrementPresenceChannels()
      // Cancel any pending reconnection or throttled track
      if (reconnectTimer) clearTimeout(reconnectTimer)
      if (throttleTimerRef.current) {
        clearTimeout(throttleTimerRef.current)
        throttleTimerRef.current = null
      }
      const ch = channelRef.current
      channelRef.current = null
      if (ch) {
        ch.untrack().catch(() => {})
        supabase.removeChannel(ch)
      }
      isEditingRef.current = false
      hasResolvedEditingRef.current = false
      setViewers([])
      setActiveEditor(null)
      setFieldLockMap({})
    }
  }, [
    artisanId,
    currentUserId,
    handleSync,
    buildPayload,
  ])

  return { viewers, activeEditor, fieldLockMap, trackField, clearField }
}
