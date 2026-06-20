'use client'

import { useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase-client'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { DEFAULT_IDLE_TIMEOUT_MS } from '@/hooks/useIdleDetector'
import {
  computeSessionEndMs,
  computeDurationMs,
  isStaleGap,
  type SessionEndReason,
} from '@/lib/monitoring/session-timing'

/** Flush interval: refresh the current session every 60 seconds */
const FLUSH_INTERVAL_MS = 60_000

/**
 * Tracks page visit sessions in the `user_page_sessions` table.
 * Runs at layout level — logs start/end of each session and the time spent.
 *
 * Screen time is credited as REAL active time only:
 * - When the user goes idle (or the window loses focus), the session is closed
 *   and credited only up to the last real activity — the trailing idle window
 *   and any OS sleep are NOT counted.
 * - A periodic flush self-heals after a clock jump (wake from sleep) by closing
 *   the session at the last activity instead of "now".
 * - Only the focused window accrues time, so multiple visible windows (dual
 *   monitor) don't double-count.
 * - The currently open intervention (`?i=<id>`) is recorded on the session so
 *   time can be attributed to a real intervention, not just the list page.
 *
 * @param pageName        Current page name (e.g. 'interventions', 'dashboard')
 * @param isIdle          Whether the user is currently idle
 * @param getLastActiveAt Stable getter for the last real-activity epoch (ms)
 * @param interventionId  Id of the intervention currently open (modal), or null
 */
export function useActivityTracker(
  pageName: string | null,
  isIdle = false,
  getLastActiveAt: () => number = () => Date.now(),
  interventionId: string | null = null,
): void {
  const { data: currentUser } = useCurrentUser()
  const currentUserId = currentUser?.id ?? null

  // ─── Incoming-props refs (synced each render) ────────────────────────────────
  const currentUserIdRef = useRef<string | null>(null)
  const isIdleRef = useRef(isIdle)
  const getLastActiveAtRef = useRef(getLastActiveAt)
  currentUserIdRef.current = currentUserId
  getLastActiveAtRef.current = getLastActiveAt

  // ─── Desired-state refs (page / intervention currently requested) ────────────
  const pageNameRef = useRef<string | null>(pageName)
  const interventionIdRef = useRef<string | null>(interventionId)

  // ─── Current-session refs ────────────────────────────────────────────────────
  const currentSessionIdRef = useRef<string | null>(null)
  const sessionStartRef = useRef<number>(0)

  // ─── Misc refs ───────────────────────────────────────────────────────────────
  const flushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const accessTokenRef = useRef<string | null>(null)
  const mountedRef = useRef(true)
  const hasFocusRef = useRef<boolean>(
    typeof document === 'undefined' ? true : document.hasFocus()
  )

  const lastActiveMs = useCallback(() => {
    const fn = getLastActiveAtRef.current
    return typeof fn === 'function' ? fn() : Date.now()
  }, [])

  /** Session runs only when: user present, on a page, not idle, window focused. */
  const shouldTrack = useCallback(
    () => !isIdleRef.current && hasFocusRef.current,
    []
  )

  // ─── DB ops ──────────────────────────────────────────────────────────────────
  const startSession = useCallback(
    async (page: string, intervention: string | null) => {
      const userId = currentUserIdRef.current
      if (!userId || !page) return

      const startMs = Date.now()
      try {
        const { data, error } = await (supabase as any)
          .from('user_page_sessions')
          .insert({
            user_id: userId,
            page_name: page,
            started_at: new Date(startMs).toISOString(),
            intervention_id: intervention,
          })
          .select('id')
          .single()

        if (!error && data) {
          currentSessionIdRef.current = data.id
          sessionStartRef.current = startMs
        }
      } catch (err) {
        console.warn('[ActivityTracker] Failed to start session:', err)
      }
    },
    []
  )

  const endSession = useCallback(
    async (reason: SessionEndReason) => {
      const sessionId = currentSessionIdRef.current
      if (!sessionId) return

      const endMs = computeSessionEndMs({
        reason,
        nowMs: Date.now(),
        lastActiveMs: lastActiveMs(),
        idleTimeoutMs: DEFAULT_IDLE_TIMEOUT_MS,
      })
      const durationMs = computeDurationMs(sessionStartRef.current, endMs)

      // Clear ref first to prevent re-entry / double-end.
      currentSessionIdRef.current = null

      try {
        await (supabase as any)
          .from('user_page_sessions')
          .update({
            ended_at: new Date(endMs).toISOString(),
            duration_ms: durationMs,
          })
          .eq('id', sessionId)
      } catch (err) {
        console.warn('[ActivityTracker] Failed to end session:', err)
      }
    },
    [lastActiveMs]
  )

  const stopFlushTimer = useCallback(() => {
    if (flushTimerRef.current) {
      clearInterval(flushTimerRef.current)
      flushTimerRef.current = null
    }
  }, [])

  const flushSession = useCallback(async () => {
    const sessionId = currentSessionIdRef.current
    if (!sessionId) return

    const nowMs = Date.now()
    const la = lastActiveMs()

    // Auto-heal: a clock jump (wake from sleep) or a window left idle past the
    // threshold → close at the last activity and stop crediting.
    if (isStaleGap({ nowMs, lastActiveMs: la, idleTimeoutMs: DEFAULT_IDLE_TIMEOUT_MS })) {
      await endSession('stale')
      stopFlushTimer()
      return
    }

    const endMs = computeSessionEndMs({
      reason: 'flush',
      nowMs,
      lastActiveMs: la,
      idleTimeoutMs: DEFAULT_IDLE_TIMEOUT_MS,
    })
    const durationMs = computeDurationMs(sessionStartRef.current, endMs)

    try {
      await (supabase as any)
        .from('user_page_sessions')
        .update({
          ended_at: new Date(endMs).toISOString(),
          duration_ms: durationMs,
        })
        .eq('id', sessionId)
    } catch {
      // Silent — non-critical periodic flush
    }
  }, [endSession, lastActiveMs, stopFlushTimer])

  const startFlushTimer = useCallback(() => {
    if (flushTimerRef.current) clearInterval(flushTimerRef.current)
    flushTimerRef.current = setInterval(flushSession, FLUSH_INTERVAL_MS)
  }, [flushSession])

  // ─── Pause / resume ──────────────────────────────────────────────────────────
  const pause = useCallback(
    (reason: SessionEndReason) => {
      if (!currentSessionIdRef.current) return
      stopFlushTimer()
      void endSession(reason)
    },
    [endSession, stopFlushTimer]
  )

  const resume = useCallback(() => {
    if (currentSessionIdRef.current) return
    const page = pageNameRef.current
    if (!currentUserIdRef.current || !page || !shouldTrack()) return
    void startSession(page, interventionIdRef.current).then(() => {
      if (mountedRef.current && shouldTrack()) startFlushTimer()
    })
  }, [shouldTrack, startSession, startFlushTimer])

  // ─── Effect: mounted flag ────────────────────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  // ─── Effect: idle changes → pause / resume ───────────────────────────────────
  useEffect(() => {
    const wasIdle = isIdleRef.current
    isIdleRef.current = isIdle
    if (!currentUserId || !pageNameRef.current) return

    if (isIdle && !wasIdle) pause('idle')
    else if (!isIdle && wasIdle) resume()
  }, [isIdle, currentUserId, pause, resume])

  // ─── Effect: window focus / blur → resume / pause (dual-monitor de-dup) ──────
  useEffect(() => {
    const onFocus = () => {
      if (hasFocusRef.current) return
      hasFocusRef.current = true
      if (currentUserIdRef.current && pageNameRef.current) resume()
    }
    const onBlur = () => {
      if (!hasFocusRef.current) return
      hasFocusRef.current = false
      pause('blur')
    }
    window.addEventListener('focus', onFocus)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('blur', onBlur)
    }
  }, [resume, pause])

  // ─── Effect: page or intervention change → split session ─────────────────────
  useEffect(() => {
    const prevPage = pageNameRef.current
    const prevIntervention = interventionIdRef.current
    pageNameRef.current = pageName
    interventionIdRef.current = interventionId

    if (!currentUserId) return
    if (prevPage === pageName && prevIntervention === interventionId) return

    // Active transition: end the current session, then start a fresh one.
    void endSession('page').then(() => {
      if (pageName && mountedRef.current && shouldTrack()) {
        void startSession(pageName, interventionId).then(() => {
          if (mountedRef.current && shouldTrack()) startFlushTimer()
        })
      } else {
        stopFlushTimer()
      }
    })
  }, [
    pageName,
    interventionId,
    currentUserId,
    endSession,
    startSession,
    startFlushTimer,
    stopFlushTimer,
    shouldTrack,
  ])

  // ─── Effect: initial session + flush (tied to userId) ────────────────────────
  useEffect(() => {
    if (!currentUserId || !pageNameRef.current) return

    if (shouldTrack()) {
      void startSession(pageNameRef.current, interventionIdRef.current)
      startFlushTimer()
    }

    return () => {
      stopFlushTimer()
      void endSession('unload')
    }
    // Only re-run when the user changes — page/intervention handled above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId])

  // ─── Effect: keep access token fresh for beforeunload (sync access required) ─
  useEffect(() => {
    if (!currentUserId) return
    const refreshToken = async () => {
      const { data } = await supabase.auth.getSession()
      accessTokenRef.current = data?.session?.access_token ?? null
    }
    refreshToken()
    const tokenTimer = setInterval(refreshToken, 60_000)
    return () => clearInterval(tokenTimer)
  }, [currentUserId])

  // ─── Effect: tab close / beforeunload — best-effort session end ──────────────
  useEffect(() => {
    const handleBeforeUnload = () => {
      const sessionId = currentSessionIdRef.current
      const accessToken = accessTokenRef.current
      if (!sessionId || !accessToken) return

      const endMs = computeSessionEndMs({
        reason: 'unload',
        nowMs: Date.now(),
        lastActiveMs: lastActiveMs(),
        idleTimeoutMs: DEFAULT_IDLE_TIMEOUT_MS,
      })
      const durationMs = computeDurationMs(sessionStartRef.current, endMs)
      const payload = JSON.stringify({
        ended_at: new Date(endMs).toISOString(),
        duration_ms: durationMs,
      })

      // Use fetch with keepalive for reliable delivery on tab close
      try {
        fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/user_page_sessions?id=eq.${sessionId}`,
          {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
              Authorization: `Bearer ${accessToken}`,
              Prefer: 'return=minimal',
            },
            body: payload,
            keepalive: true,
          }
        )
      } catch {
        // Best effort — tab is closing
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [lastActiveMs])
}
