"use client"

import { useState, useEffect } from 'react'
import type { RealtimeStats } from '@/hooks/useCrmRealtime'
import type { RealtimeDebugInfo } from '@/lib/realtime/realtime-client'

interface RealtimeStatsResult {
  stats: RealtimeStats | null
  debugInfo: RealtimeDebugInfo | null
}

const POLL_INTERVAL = 1000

/**
 * Polls window.__REALTIME_STATS and window.__REALTIME_DEBUG_INFO every second.
 * Used by the developer dashboard to display live realtime connection data
 * without modifying the core realtime infrastructure.
 */
export function useRealtimeStats(): RealtimeStatsResult {
  const [stats, setStats] = useState<RealtimeStats | null>(null)
  const [debugInfo, setDebugInfo] = useState<RealtimeDebugInfo | null>(null)

  useEffect(() => {
    function poll() {
      const win = window as any
      if (win.__REALTIME_STATS) {
        setStats({ ...win.__REALTIME_STATS })
      }
      if (win.__REALTIME_DEBUG_INFO) {
        setDebugInfo({ ...win.__REALTIME_DEBUG_INFO })
      }
    }

    // Initial read
    poll()

    const interval = setInterval(poll, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [])

  return { stats, debugInfo }
}
