'use client'

import { useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase-client'
import { useCurrentUser } from '@/hooks/useCurrentUser'

/** Flush interval: update the current session every 30 seconds */
const FLUSH_INTERVAL_MS = 30_000

/**
 * Tracks page visit sessions in user_page_sessions table.
 * Runs at layout level — detects page changes and logs start/end of each session.
 *
 * @param pageName - Current page name (e.g., 'interventions', 'dashboard')
 */
export function useActivityTracker(pageName: string | null): void {
  const { data: currentUser } = useCurrentUser()
  const currentUserId = currentUser?.id ?? null

  // Refs for stable effect (pattern from usePagePresence)
  const pageNameRef = useRef<string | null>(pageName)
  const currentUserIdRef = useRef<string | null>(null)
  const currentSessionIdRef = useRef<string | null>(null)
  const sessionStartRef = useRef<number>(0)
  const flushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const accessTokenRef = useRef<string | null>(null)
  const mountedRef = useRef(true)

  // Keep userId ref in sync on every render
  currentUserIdRef.current = currentUserId

  // Start a new session
  const startSession = useCallback(async (page: string) => {
    const userId = currentUserIdRef.current
    if (!userId || !page) return

    try {
      const { data, error } = await (supabase as any)
        .from('user_page_sessions')
        .insert({
          user_id: userId,
          page_name: page,
          started_at: new Date().toISOString(),
        })
        .select('id')
        .single()

      if (!error && data) {
        currentSessionIdRef.current = data.id
        sessionStartRef.current = Date.now()
      }
    } catch (err) {
      console.warn('[ActivityTracker] Failed to start session:', err)
    }
  }, [])

  // End the current session
  const endSession = useCallback(async () => {
    const sessionId = currentSessionIdRef.current
    if (!sessionId) return

    const durationMs = Date.now() - sessionStartRef.current
    currentSessionIdRef.current = null

    try {
      await (supabase as any)
        .from('user_page_sessions')
        .update({
          ended_at: new Date().toISOString(),
          duration_ms: durationMs,
        })
        .eq('id', sessionId)
    } catch (err) {
      console.warn('[ActivityTracker] Failed to end session:', err)
    }
  }, [])

  // Flush: update current session duration without ending it
  const flushSession = useCallback(async () => {
    const sessionId = currentSessionIdRef.current
    if (!sessionId) return

    const durationMs = Date.now() - sessionStartRef.current

    try {
      await (supabase as any)
        .from('user_page_sessions')
        .update({
          ended_at: new Date().toISOString(),
          duration_ms: durationMs,
        })
        .eq('id', sessionId)
    } catch {
      // Silent — non-critical periodic flush
    }
  }, [])

  // Handle page change: end old session, start new one
  useEffect(() => {
    const prevPage = pageNameRef.current
    pageNameRef.current = pageName

    if (!currentUserId) return

    if (prevPage !== pageName) {
      endSession().then(() => {
        if (pageName && mountedRef.current) {
          startSession(pageName)
        }
      })
    }
  }, [pageName, currentUserId, endSession, startSession])

  // Initial session + periodic flush timer (tied to userId)
  useEffect(() => {
    if (!currentUserId || !pageName) return

    // Start initial session
    startSession(pageName)

    // Setup periodic flush
    flushTimerRef.current = setInterval(flushSession, FLUSH_INTERVAL_MS)

    return () => {
      if (flushTimerRef.current) {
        clearInterval(flushTimerRef.current)
        flushTimerRef.current = null
      }
      // End session on cleanup
      endSession()
    }
    // Only re-run when user changes — pageName changes handled by the effect above
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId])

  // Keep access token ref fresh for beforeunload (sync access required)
  useEffect(() => {
    if (!currentUserId) return
    const refreshToken = async () => {
      const { data } = await supabase.auth.getSession()
      accessTokenRef.current = data?.session?.access_token ?? null
    }
    refreshToken()
    // Refresh token periodically to keep it valid
    const tokenTimer = setInterval(refreshToken, 60_000)
    return () => clearInterval(tokenTimer)
  }, [currentUserId])

  // Tab close / beforeunload — best-effort session end via fetch keepalive
  useEffect(() => {
    const handleBeforeUnload = () => {
      const sessionId = currentSessionIdRef.current
      const accessToken = accessTokenRef.current
      if (!sessionId || !accessToken) return

      const durationMs = Date.now() - sessionStartRef.current
      const payload = JSON.stringify({
        ended_at: new Date().toISOString(),
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
  }, [])

  // Track mounted state for async callbacks
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])
}
