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

export type ConnectionStatus = 'realtime' | 'polling' | 'connecting'

const POLLING_INTERVAL = 15000 // 15 secondes (suffisant pour un CRM)
const RECONNECT_INTERVAL = 30000 // 30 secondes

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
        await routeRealtimeEvent('interventions', payload, leaderCtx)
        relayRef.current?.relayPayload('interventions', payload)
      },
      onArtisanEvent: async (payload) => {
        await routeRealtimeEvent('artisans', payload, leaderCtx)
        relayRef.current?.relayPayload('artisans', payload)
      },
      onJunctionEvent: async (payload) => {
        await routeRealtimeEvent('intervention_artisans', payload, leaderCtx)
        relayRef.current?.relayPayload('intervention_artisans', payload)
      },
    }
  }, [queryClient, currentUserId])

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

    console.log('[Realtime] Reconnection attempt in 30s...')

    reconnectTimeoutRef.current = setTimeout(() => {
      reconnectTimeoutRef.current = null
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
          stopPolling()
          setConnectionStatus('realtime')
          relayRef.current?.relayStatus('realtime')
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          console.warn('[Realtime] Reconnection failed, falling back to polling')
          // Null BEFORE remove to prevent infinite recursion
          const ch = channelRef.current
          channelRef.current = null
          if (ch) removeRealtimeChannel(ch)
          startPolling()
          relayRef.current?.relayStatus('polling')
          attemptReconnect()
        }
      })
    }, RECONNECT_INTERVAL)
  }, [buildHandlers, startPolling, stopPolling])

  // ─── Subscribe / Unsubscribe (leader only) ─────────────────────────────

  /**
   * Subscribe to the Supabase Realtime channel.
   * Called when this tab is promoted to leader.
   */
  const subscribeToRealtime = useCallback(() => {
    if (channelRef.current) return // Already subscribed

    console.log('[Realtime] Subscribing to Supabase channel crm-sync')
    const channel = createRealtimeChannel(buildHandlers())
    channelRef.current = channel

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('[Realtime] Channel crm-sync subscribed successfully')
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
        console.warn(`[Realtime] Connection issue (${status}), switching to polling`)
        const ch = channelRef.current
        channelRef.current = null
        if (ch) removeRealtimeChannel(ch)
        startPolling()
        relayRef.current?.relayStatus('polling')
        attemptReconnect()
      }
    })
  }, [buildHandlers, queryClient, startPolling, stopPolling, attemptReconnect])

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

        console.log('[Realtime] This tab is now the leader — subscribing to Supabase')
        stopPolling() // Stop follower polling if it was active
        subscribeToRealtime()
      },
      onDemoted: () => {
        if (leaderRef.current !== leader) return

        console.log('[Realtime] This tab is no longer the leader — unsubscribing')
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
