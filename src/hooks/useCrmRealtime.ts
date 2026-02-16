/**
 * Hook React pour gérer la synchronisation Realtime du CRM
 *
 * Intègre leader election (Web Locks API) : un seul onglet par navigateur
 * maintient la connexion WebSocket Supabase et relaie les événements
 * aux autres onglets via BroadcastChannel.
 *
 * Architecture :
 * - Leader : souscrit au channel Supabase → traite les événements → relaie aux followers
 * - Follower : reçoit les événements via relay → traite le cache localement
 * - Fallback (sans Web Locks) : chaque onglet souscrit indépendamment
 *
 * Basculement automatique vers polling si Realtime indisponible + reconnexion automatique.
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase-client'
import { createRealtimeChannel, removeRealtimeChannel } from '@/lib/realtime/realtime-client'
import type { RealtimeEventHandlers } from '@/lib/realtime/realtime-client'
import { initializeCacheSync } from '@/lib/realtime/cache-sync'
import { routeRealtimeEvent } from '@/lib/realtime/event-router/router'
import type { SyncContext } from '@/lib/realtime/event-router/types'
import { LeaderElection } from '@/lib/realtime/leader-election'
import { createRealtimeRelay } from '@/lib/realtime/realtime-relay'
import type { RealtimeRelay } from '@/lib/realtime/realtime-relay'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { interventionKeys, artisanKeys } from '@/lib/react-query/queryKeys'
import { getRealtimeDebugInfo } from '@/lib/realtime/realtime-client'

/**
 * Global Realtime stats for debugging (accessible via window.__REALTIME_STATS)
 */
export interface RealtimeStats {
  connectionStatus: ConnectionStatus
  leaderStatus: 'leader' | 'follower' | 'acquiring'
  eventsReceived: { interventions: number; artisans: number; junctions: number }
  lastEventTime: number | null
  lastEventType: string | null
  errorCount: number
  lastError: string | null
  lastErrorTime: number | null
  relayActive: boolean
  reconnectAttempts: number
  uptime: number // milliseconds since hook mounted
}

export type ConnectionStatus = 'realtime' | 'polling' | 'connecting'

const POLLING_INTERVAL = 15000 // 15 secondes (suffisant pour un CRM)
const MAX_RECONNECT_ATTEMPTS = 10
const BASE_RECONNECT_INTERVAL = 5000 // 5s
const MAX_RECONNECT_INTERVAL = 300000 // 5 minutes

/**
 * Whether leader election is active (static — doesn't change during app lifecycle).
 * When active: 1 WebSocket per browser. When not: 1 WebSocket per tab (fallback).
 */
const LEADER_ELECTION_ACTIVE = LeaderElection.isSupported()

/**
 * Hook pour activer la synchronisation Realtime du CRM.
 *
 * With leader election (Web Locks supported):
 *   - 1 WebSocket per browser × 30 users = 30 connections (15% of Free plan)
 *   - Leader relays events to followers via BroadcastChannel (free, local-only)
 *
 * Without leader election (fallback):
 *   - 1 WebSocket per tab (current behavior)
 *
 * @example
 * ```tsx
 * function CrmPage() {
 *   const { connectionStatus } = useCrmRealtime()
 *   // ... reste du composant
 * }
 * ```
 */
export function useCrmRealtime() {
  const queryClient = useQueryClient()
  const channelRef = useRef<RealtimeChannel | null>(null)
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const leaderRef = useRef<LeaderElection | null>(null)
  const relayRef = useRef<RealtimeRelay | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting')
  const { data: currentUser } = useCurrentUser()
  const currentUserId = currentUser?.id ?? null

  // ─── Global stats for debugging ─────────────────────────────────────────────
  const mountTimeRef = useRef<number>(Date.now())
  const statsRef = useRef<RealtimeStats>({
    connectionStatus: 'connecting',
    leaderStatus: 'acquiring',
    eventsReceived: { interventions: 0, artisans: 0, junctions: 0 },
    lastEventTime: null,
    lastEventType: null,
    errorCount: 0,
    lastError: null,
    lastErrorTime: null,
    relayActive: false,
    reconnectAttempts: 0,
    uptime: 0,
  })

  /**
   * Update global stats and expose via window object
   */
  const updateStats = useCallback((updates: Partial<RealtimeStats>) => {
    statsRef.current = {
      ...statsRef.current,
      ...updates,
      uptime: Date.now() - mountTimeRef.current,
    }
    if (typeof window !== 'undefined') {
      ;(window as any).__REALTIME_STATS = statsRef.current
    }
  }, [])

  // ─── Handlers for Supabase channel (leader only) ────────────────────────

  /**
   * Build the 3 event handlers for the multiplexed Supabase channel.
   * Each handler: route through event-router pipeline + relay to followers.
   * skipBroadcast = true when leader election is active (relay replaces broadcast).
   */
  const buildHandlers = useCallback((): RealtimeEventHandlers => {
    const leaderCtx: SyncContext = {
      queryClient,
      currentUserId,
      options: { skipBroadcast: LEADER_ELECTION_ACTIVE },
    }
    return {
      onInterventionEvent: async (payload) => {
        statsRef.current.eventsReceived.interventions++
        updateStats({
          lastEventTime: Date.now(),
          lastEventType: `interventions:${payload.eventType}`,
          eventsReceived: { ...statsRef.current.eventsReceived },
        })
        await routeRealtimeEvent('interventions', payload, leaderCtx)
        relayRef.current?.relayPayload('interventions', payload)
      },
      onArtisanEvent: async (payload) => {
        statsRef.current.eventsReceived.artisans++
        updateStats({
          lastEventTime: Date.now(),
          lastEventType: `artisans:${payload.eventType}`,
          eventsReceived: { ...statsRef.current.eventsReceived },
        })
        await routeRealtimeEvent('artisans', payload, leaderCtx)
        relayRef.current?.relayPayload('artisans', payload)
      },
      onJunctionEvent: async (payload) => {
        statsRef.current.eventsReceived.junctions++
        updateStats({
          lastEventTime: Date.now(),
          lastEventType: `junctions:${payload.eventType}`,
          eventsReceived: { ...statsRef.current.eventsReceived },
        })
        await routeRealtimeEvent('intervention_artisans', payload, leaderCtx)
        relayRef.current?.relayPayload('intervention_artisans', payload)
      },
    }
  }, [queryClient, currentUserId, updateStats])

  // ─── Polling fallback (used by both leader and follower) ────────────────

  const startPolling = useCallback(() => {
    if (pollingIntervalRef.current) return // Already running
    setConnectionStatus('polling')
    pollingIntervalRef.current = setInterval(() => {
      queryClient.invalidateQueries({
        queryKey: interventionKeys.invalidateLists(),
        refetchType: 'active',
      })
      queryClient.invalidateQueries({
        queryKey: interventionKeys.invalidateLightLists(),
        refetchType: 'active',
      })
      queryClient.invalidateQueries({
        queryKey: artisanKeys.invalidateLists(),
        refetchType: 'active',
      })
    }, POLLING_INTERVAL)
  }, [queryClient])

  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
    }
  }, [])

  // ─── Reconnect logic (leader only) ─────────────────────────────────────

  const attemptReconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) return // Already scheduled

    const attemptNum = statsRef.current.reconnectAttempts + 1

    if (attemptNum > MAX_RECONNECT_ATTEMPTS) {
      console.warn('[Realtime] Max reconnection attempts reached, staying in polling')
      updateStats({ lastError: 'Max reconnect attempts reached' })
      return // Rester en polling
    }

    // Backoff exponentiel : 5s, 10s, 20s, 40s, 80s, 160s, 300s, 300s...
    const delay = Math.min(
      BASE_RECONNECT_INTERVAL * Math.pow(2, attemptNum - 1),
      MAX_RECONNECT_INTERVAL
    )

    updateStats({
      reconnectAttempts: attemptNum,
      lastError: `Reconnection scheduled (attempt #${attemptNum})`,
      lastErrorTime: Date.now(),
    })
    console.log(
      `[Realtime] Reconnection attempt #${attemptNum} in ${delay / 1000}s...`
    )

    reconnectTimeoutRef.current = setTimeout(async () => {
      reconnectTimeoutRef.current = null

      // Rafraîchir la session avant de reconnecter
      try {
        await supabase.auth.refreshSession()
      } catch {
        // Ignorer l'erreur, tenter la reconnexion quand même
      }

      stopPolling()

      // Clean up old channel
      if (channelRef.current) {
        removeRealtimeChannel(channelRef.current)
        channelRef.current = null
      }

      const channel = createRealtimeChannel(buildHandlers())
      channelRef.current = channel

      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Realtime] Reconnection successful (crm-sync)')
          statsRef.current.reconnectAttempts = 0 // Reset le compteur après succès
          updateStats({
            connectionStatus: 'realtime',
            reconnectAttempts: 0,
            lastError: null,
          })
          stopPolling()
          setConnectionStatus('realtime')
          relayRef.current?.relayStatus('realtime')
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          const errorMsg = `Reconnection failed (${status})`
          console.warn(`[Realtime] ${errorMsg}, falling back to polling`)
          updateStats({
            errorCount: statsRef.current.errorCount + 1,
            lastError: errorMsg,
            lastErrorTime: Date.now(),
          })
          // Null BEFORE remove to prevent infinite recursion
          const ch = channelRef.current
          channelRef.current = null
          if (ch) removeRealtimeChannel(ch)
          startPolling()
          relayRef.current?.relayStatus('polling')
          attemptReconnect()
        }
      })
    }, delay)
  }, [buildHandlers, startPolling, stopPolling, updateStats])

  // ─── Subscribe / Unsubscribe (leader only) ─────────────────────────────

  /**
   * Subscribe to the Supabase Realtime channel.
   * Called when this tab is promoted to leader.
   */
  const subscribeToRealtime = useCallback(() => {
    if (channelRef.current) return // Already subscribed

    console.log('[Realtime] Subscribing to Supabase channel crm-sync', {
      supabaseUrl: typeof window !== 'undefined' ? (window as any).__SUPABASE_URL : 'unknown',
      timestamp: new Date().toISOString(),
    })
    updateStats({ connectionStatus: 'connecting' })

    const channel = createRealtimeChannel(buildHandlers())
    channelRef.current = channel

    channel.subscribe((status) => {
      console.log(`[Realtime] Channel status: ${status}`)

      if (status === 'SUBSCRIBED') {
        console.log('[Realtime] ✅ Channel crm-sync subscribed successfully')
        console.log('[Realtime] Debug info:', getRealtimeDebugInfo())
        updateStats({
          connectionStatus: 'realtime',
          lastError: null,
        })
        stopPolling()
        setConnectionStatus('realtime')
        relayRef.current?.relayStatus('realtime')

        // Invalidate all active queries to catch events missed during leader transition
        queryClient.invalidateQueries({
          queryKey: interventionKeys.invalidateLists(),
          refetchType: 'active',
        })
        queryClient.invalidateQueries({
          queryKey: interventionKeys.invalidateLightLists(),
          refetchType: 'active',
        })
        queryClient.invalidateQueries({
          queryKey: artisanKeys.invalidateLists(),
          refetchType: 'active',
        })
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        const errorMsg = `Connection issue (${status})`
        console.warn(`[Realtime] ❌ ${errorMsg}, switching to polling`)
        updateStats({
          errorCount: statsRef.current.errorCount + 1,
          lastError: errorMsg,
          lastErrorTime: Date.now(),
        })
        const ch = channelRef.current
        channelRef.current = null
        if (ch) removeRealtimeChannel(ch)
        startPolling()
        relayRef.current?.relayStatus('polling')
        attemptReconnect()
      }
    })
  }, [buildHandlers, queryClient, startPolling, stopPolling, attemptReconnect, updateStats])

  /**
   * Unsubscribe from Supabase Realtime and clean up all timers.
   * Called when this tab is demoted or on cleanup.
   */
  const unsubscribeFromRealtime = useCallback(() => {
    stopPolling()
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    const ch = channelRef.current
    channelRef.current = null
    if (ch) removeRealtimeChannel(ch)
  }, [stopPolling])

  // ─── TOKEN_REFRESHED listener ─────────────────────────────────────────
  // Si le token est rafraîchi et qu'on n'a pas de channel actif (leader), retenter la connexion
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: string) => {
      if (event === 'TOKEN_REFRESHED' && leaderRef.current?.isLeader && channelRef.current === null) {
        // Token rafraîchi et pas de channel actif → tenter de reconnecter
        statsRef.current.reconnectAttempts = 0 // Reset le compteur
        attemptReconnect()
      }
    })
    return () => subscription.unsubscribe()
  }, [attemptReconnect])

  // ─── Main effect ───────────────────────────────────────────────────────

  useEffect(() => {
    console.log(
      '[Realtime] Initializing CRM Realtime sync',
      LEADER_ELECTION_ACTIVE ? '(leader election active)' : '(no leader election)'
    )

    // Initialize BroadcastSync for cache invalidation (existing mechanism)
    initializeCacheSync(queryClient)

    // Create the relay channel for leader→follower event forwarding
    const followerCtx: SyncContext = {
      queryClient,
      currentUserId,
      options: { skipBroadcast: true },
    }
    const relay = createRealtimeRelay({
      onInterventionPayload: (payload) =>
        routeRealtimeEvent('interventions', payload, followerCtx),
      onArtisanPayload: (payload) =>
        routeRealtimeEvent('artisans', payload, followerCtx),
      onJunctionPayload: (payload) =>
        routeRealtimeEvent('intervention_artisans', payload, followerCtx),
      onLeaderStatus: (status) => {
        // Follower mirrors the leader's connection status
        if (leaderRef.current?.isLeader) return // Leader ignores its own relayed status

        setConnectionStatus(status as ConnectionStatus)

        // When leader switches to polling, follower starts own polling for data freshness.
        // When leader reconnects, follower stops polling (events come via relay).
        if (status === 'polling') {
          startPolling()
        } else if (status === 'realtime') {
          stopPolling()
          setConnectionStatus('realtime')
        }
      },
    })
    relayRef.current = relay

    // Start leader election
    const leader = new LeaderElection()
    leaderRef.current = leader

    leader.start({
      onPromoted: () => {
        // Guard against stale callbacks from a previous effect run
        if (leaderRef.current !== leader) return

        console.log('[Realtime] 👑 This tab is now the leader — subscribing to Supabase')
        updateStats({ leaderStatus: 'leader' })
        stopPolling() // Stop follower polling if it was active
        subscribeToRealtime()
      },
      onDemoted: () => {
        if (leaderRef.current !== leader) return

        console.log('[Realtime] 👥 This tab is no longer the leader — unsubscribing')
        updateStats({ leaderStatus: 'follower' })
        unsubscribeFromRealtime()
        setConnectionStatus('connecting')
      },
    })

    // Cleanup on unmount or dependency change
    return () => {
      leader.stop()
      leaderRef.current = null
      unsubscribeFromRealtime()
      relay?.close()
      relayRef.current = null
    }
  }, [
    queryClient,
    currentUserId,
    buildHandlers,
    subscribeToRealtime,
    unsubscribeFromRealtime,
    startPolling,
    stopPolling,
  ])

  return { connectionStatus }
}
