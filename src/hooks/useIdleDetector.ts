'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

/** Idle timeout: 5 minutes of inactivity */
export const DEFAULT_IDLE_TIMEOUT_MS = 5 * 60 * 1000

/** Throttle activity events to avoid excessive re-renders */
const ACTIVITY_THROTTLE_MS = 1000

export interface IdleDetectorState {
  /** `true` when the user is considered idle. */
  isIdle: boolean
  /**
   * Stable getter returning the epoch-ms timestamp of the last REAL user
   * activity (input event, or re-engagement via tab-visible / window-focus).
   * Used by the activity tracker to credit screen time only up to the moment
   * the user was actually active — never the trailing idle window nor sleep.
   */
  getLastActiveAt: () => number
}

/**
 * Detects user inactivity by combining:
 * - Mouse, keyboard, click, scroll, touch events (throttled to 1s)
 * - Page Visibility API (hidden tab = idle)
 * - Window focus (re-engagement = active again)
 *
 * Returns the idle flag plus a getter for the last-active timestamp.
 */
export function useIdleDetector(timeoutMs = DEFAULT_IDLE_TIMEOUT_MS): IdleDetectorState {
  const [isIdle, setIsIdle] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** Epoch ms of the last real activity — refreshed on every event (cheap, no render). */
  const lastActiveRef = useRef<number>(Date.now())
  /** Throttle gate for the (re-render-triggering) goActive/resetTimer work. */
  const lastThrottleRef = useRef<number>(0)
  const isIdleRef = useRef(false)

  const goIdle = useCallback(() => {
    if (!isIdleRef.current) {
      isIdleRef.current = true
      setIsIdle(true)
    }
  }, [])

  const goActive = useCallback(() => {
    if (isIdleRef.current) {
      isIdleRef.current = false
      setIsIdle(false)
    }
  }, [])

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(goIdle, timeoutMs)
  }, [timeoutMs, goIdle])

  /** Throttled handler for raw input events. */
  const handleActivity = useCallback(() => {
    const now = Date.now()
    // Always refresh the last-active timestamp (ref write — no re-render).
    lastActiveRef.current = now
    // Throttle the heavier goActive/resetTimer work.
    if (now - lastThrottleRef.current < ACTIVITY_THROTTLE_MS) return
    lastThrottleRef.current = now

    goActive()
    resetTimer()
  }, [goActive, resetTimer])

  /** Re-engagement (tab visible again / window focused) — counts as activity, not throttled. */
  const markReengaged = useCallback(() => {
    lastActiveRef.current = Date.now()
    lastThrottleRef.current = lastActiveRef.current
    goActive()
    resetTimer()
  }, [goActive, resetTimer])

  const handleVisibilityChange = useCallback(() => {
    if (document.hidden) {
      // Tab hidden — go idle immediately
      if (timerRef.current) clearTimeout(timerRef.current)
      goIdle()
    } else {
      // Tab visible again — treat as re-engagement
      markReengaged()
    }
  }, [goIdle, markReengaged])

  const getLastActiveAt = useCallback(() => lastActiveRef.current, [])

  useEffect(() => {
    const events: (keyof WindowEventMap)[] = [
      'mousemove',
      'keydown',
      'click',
      'scroll',
      'touchstart',
    ]

    // Start the initial idle timer
    resetTimer()

    for (const event of events) {
      window.addEventListener(event, handleActivity, { passive: true })
    }
    // Window focus = re-engagement. NB: blur is intentionally NOT idle here, so the
    // screensaver doesn't pop when briefly clicking another app; the activity tracker
    // handles focus-gating for screen time separately.
    window.addEventListener('focus', markReengaged)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      for (const event of events) {
        window.removeEventListener(event, handleActivity)
      }
      window.removeEventListener('focus', markReengaged)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [handleActivity, markReengaged, handleVisibilityChange, resetTimer])

  return { isIdle, getLastActiveAt }
}
