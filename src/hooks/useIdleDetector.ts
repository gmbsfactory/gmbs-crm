'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

/** Idle timeout: 5 minutes of inactivity */
const DEFAULT_IDLE_TIMEOUT_MS = 5 * 60 * 1000

/** Throttle activity events to avoid excessive re-renders */
const ACTIVITY_THROTTLE_MS = 1000

/**
 * Detects user inactivity by combining:
 * - Mouse, keyboard, click, scroll, touch events (throttled to 1s)
 * - Page Visibility API (hidden tab = idle)
 *
 * Returns `true` when the user is considered idle.
 */
export function useIdleDetector(timeoutMs = DEFAULT_IDLE_TIMEOUT_MS): boolean {
  const [isIdle, setIsIdle] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastActivityRef = useRef<number>(Date.now())
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

  const handleActivity = useCallback(() => {
    const now = Date.now()
    if (now - lastActivityRef.current < ACTIVITY_THROTTLE_MS) return
    lastActivityRef.current = now

    goActive()
    resetTimer()
  }, [goActive, resetTimer])

  const handleVisibilityChange = useCallback(() => {
    if (document.hidden) {
      // Tab hidden — go idle immediately
      if (timerRef.current) clearTimeout(timerRef.current)
      goIdle()
    } else {
      // Tab visible again — go active and restart timer
      goActive()
      resetTimer()
    }
  }, [goIdle, goActive, resetTimer])

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
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      for (const event of events) {
        window.removeEventListener(event, handleActivity)
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [handleActivity, handleVisibilityChange, resetTimer])

  return isIdle
}
