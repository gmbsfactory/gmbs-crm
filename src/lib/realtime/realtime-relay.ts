/**
 * Realtime Relay — BroadcastChannel for leader→follower event forwarding
 *
 * The leader tab relays full Supabase Realtime payloads to follower tabs
 * via the browser's BroadcastChannel API (free, local-only, no Supabase connection).
 *
 * Followers process relayed payloads through the same cache-sync pipeline,
 * getting identical optimistic updates, conflict detection, and indicators.
 *
 * Separate from broadcast-sync.ts (which handles cache invalidation).
 * This channel carries full payloads for rich processing on follower tabs.
 *
 * BroadcastChannel spec: messages are delivered to all connected instances
 * EXCEPT the sender. No self-filtering needed.
 */

import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import type { Intervention, Artisan } from '@/lib/api/v2/common/types'
import type { InterventionArtisanRow } from './realtime-client'

const RELAY_CHANNEL_NAME = 'crm-realtime-relay'

// ─── Message Types ──────────────────────────────────────────────────────────

export type RelayTable = 'interventions' | 'artisans' | 'intervention_artisans'

/** Connection status — mirrors the hook's ConnectionStatus without creating circular imports */
type RelayConnectionStatus = 'realtime' | 'polling' | 'connecting'

// Supabase requires T extends { [key: string]: any }; Record<string, any> satisfies that and accepts any row type at call sites
interface PayloadMessage {
  type: 'payload'
  table: RelayTable
  payload: RealtimePostgresChangesPayload<Record<string, any>>
  timestamp: number
}

interface StatusMessage {
  type: 'status'
  connectionStatus: RelayConnectionStatus
  timestamp: number
}

type RelayMessage = PayloadMessage | StatusMessage

// ─── Public Interface ───────────────────────────────────────────────────────

export interface RelayHandlers {
  onInterventionPayload: (payload: RealtimePostgresChangesPayload<Intervention>) => void
  onArtisanPayload: (payload: RealtimePostgresChangesPayload<Artisan>) => void
  onJunctionPayload: (payload: RealtimePostgresChangesPayload<InterventionArtisanRow>) => void
  onLeaderStatus: (status: RelayConnectionStatus) => void
}

export interface RealtimeRelay {
  /** Leader sends a full Realtime payload to all follower tabs */
  relayPayload: (table: RelayTable, payload: RealtimePostgresChangesPayload<Record<string, any>>) => void
  /** Leader broadcasts its connection status to followers */
  relayStatus: (status: RelayConnectionStatus) => void
  /** Close the relay channel (cleanup) */
  close: () => void
}

/**
 * Create a Realtime relay using BroadcastChannel.
 *
 * - Leader calls relayPayload() / relayStatus() to broadcast events.
 * - Followers' handlers fire when leader sends messages.
 * - Returns null if BroadcastChannel is unavailable (SSR).
 *
 * @param handlers - Callbacks for incoming relay messages (used by followers)
 */
export function createRealtimeRelay(handlers: RelayHandlers): RealtimeRelay | null {
  if (typeof window === 'undefined' || !window.BroadcastChannel) {
    console.warn('[RealtimeRelay] BroadcastChannel not available — relay disabled')
    return null
  }

  const channel = new BroadcastChannel(RELAY_CHANNEL_NAME)

  // Listen for messages from other tabs
  // Per BroadcastChannel spec: own messages are NOT received by the same instance
  channel.onmessage = (event: MessageEvent<RelayMessage>) => {
    const msg = event.data
    if (!msg || !msg.type) return

    try {
      if (msg.type === 'payload') {
        switch (msg.table) {
          case 'interventions':
            handlers.onInterventionPayload(
              msg.payload as RealtimePostgresChangesPayload<Intervention>
            )
            break
          case 'artisans':
            handlers.onArtisanPayload(
              msg.payload as RealtimePostgresChangesPayload<Artisan>
            )
            break
          case 'intervention_artisans':
            handlers.onJunctionPayload(
              msg.payload as RealtimePostgresChangesPayload<InterventionArtisanRow>
            )
            break
        }
      } else if (msg.type === 'status') {
        handlers.onLeaderStatus(msg.connectionStatus)
      }
    } catch (error) {
      console.error('[RealtimeRelay] Error processing relayed message:', error)
    }
  }

  return {
    relayPayload(table: RelayTable, payload: RealtimePostgresChangesPayload<Record<string, any>>) {
      const msg: PayloadMessage = {
        type: 'payload',
        table,
        payload,
        timestamp: Date.now(),
      }
      channel.postMessage(msg)
    },

    relayStatus(status: RelayConnectionStatus) {
      const msg: StatusMessage = {
        type: 'status',
        connectionStatus: status,
        timestamp: Date.now(),
      }
      channel.postMessage(msg)
    },

    close() {
      channel.close()
    },
  }
}
