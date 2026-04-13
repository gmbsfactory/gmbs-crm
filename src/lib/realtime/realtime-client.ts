/**
 * Client Realtime multiplexé pour le CRM
 * Configure et gère un channel Supabase Realtime unique écoutant 4 tables :
 * - interventions (filtre is_active=eq.true)
 * - artisans (filtre is_active=eq.true)
 * - intervention_artisans (table de jonction, pas de filtre)
 * - intervention_reminders (pas de filtre, traité par RemindersContext)
 *
 * Un seul channel = un seul WebSocket = une seule connexion Supabase.
 */

import { supabase } from '@/lib/supabase-client'
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import type { Intervention, Artisan } from '@/lib/api/common/types'
import type { InterventionReminder } from '@/lib/api'

const CHANNEL_NAME = 'crm-sync'

/**
 * Debug info exported for browser console inspection
 */
export interface RealtimeDebugInfo {
  channelName: string
  subscriptionTime: number | null
  subscriptionPayload: {
    tables: string[]
    filters: Record<string, string>
    events: string[]
  }
  lastError: string | null
  errorCount: number
  subscriptionAttempts: number
}

let debugInfo: RealtimeDebugInfo = {
  channelName: CHANNEL_NAME,
  subscriptionTime: null,
  subscriptionPayload: {
    tables: ['interventions', 'artisans', 'intervention_artisans', 'intervention_reminders'],
    filters: {
      interventions: 'is_active=eq.true',
      artisans: 'is_active=eq.true',
      intervention_artisans: 'none',
      intervention_reminders: 'none',
    },
    events: ['INSERT', 'UPDATE', 'DELETE'],
  },
  lastError: null,
  errorCount: 0,
  subscriptionAttempts: 0,
}

/**
 * Export debug info for browser console access
 */
export function getRealtimeDebugInfo(): RealtimeDebugInfo {
  return debugInfo
}

/**
 * Update debug info (internal)
 */
function updateDebugInfo(updates: Partial<RealtimeDebugInfo>) {
  debugInfo = { ...debugInfo, ...updates }
  // Make it available globally for DevTools
  if (typeof window !== 'undefined') {
    ;(window as any).__REALTIME_DEBUG_INFO = debugInfo
  }
}

/**
 * Ligne de la table de jonction intervention_artisans
 */
export interface InterventionArtisanRow {
  id: string
  intervention_id: string
  artisan_id: string
  role: 'primary' | 'secondary' | null
  is_primary: boolean
  assigned_at: string
  created_at: string
}

/**
 * Handlers pour chaque table écoutée par le channel multiplexé
 */
export interface RealtimeEventHandlers {
  onInterventionEvent: (payload: RealtimePostgresChangesPayload<Intervention>) => void | Promise<void>
  onArtisanEvent: (payload: RealtimePostgresChangesPayload<Artisan>) => void | Promise<void>
  onJunctionEvent: (payload: RealtimePostgresChangesPayload<InterventionArtisanRow>) => void | Promise<void>
  onReminderEvent: (payload: RealtimePostgresChangesPayload<InterventionReminder>) => void | Promise<void>
}

/**
 * Crée un channel Supabase Realtime multiplexé écoutant 3 tables sur une seule connexion.
 * Ne souscrit PAS au channel — l'appelant (hook) gère le cycle de vie de la souscription.
 *
 * @param handlers - Handlers pour chaque table (interventions, artisans, intervention_artisans)
 * @returns Channel Realtime configuré (non souscrit)
 */
export function createRealtimeChannel(handlers: RealtimeEventHandlers): RealtimeChannel {
  updateDebugInfo({ subscriptionAttempts: debugInfo.subscriptionAttempts + 1 })
  console.log(
    `[Realtime] Creating channel "${CHANNEL_NAME}" (attempt #${debugInfo.subscriptionAttempts})`,
    {
      supabaseUrl: (window as any).__SUPABASE_URL || 'unknown',
      timestamp: new Date().toISOString(),
    }
  )

  const channel = supabase
    .channel(CHANNEL_NAME)
    // --- Interventions (filtre soft-delete : -50% trafic) ---
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'interventions',
        filter: 'is_active=eq.true',
      },
      (payload: any) => {
        const newRecord = payload.new && 'id' in payload.new ? payload.new : null
        const oldRecord = payload.old && 'id' in payload.old ? payload.old : null
        console.log('[Realtime] interventions:', payload.eventType, newRecord?.id || oldRecord?.id)
        try {
          handlers.onInterventionEvent(payload)
        } catch (error) {
          console.error('[Realtime] Erreur traitement intervention:', error)
        }
      }
    )
    // --- Artisans (filtre soft-delete) ---
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'artisans',
        filter: 'is_active=eq.true',
      },
      (payload: any) => {
        const newRecord = payload.new && 'id' in payload.new ? payload.new : null
        const oldRecord = payload.old && 'id' in payload.old ? payload.old : null
        console.log('[Realtime] artisans:', payload.eventType, newRecord?.id || oldRecord?.id)
        try {
          handlers.onArtisanEvent(payload)
        } catch (error) {
          console.error('[Realtime] Erreur traitement artisan:', error)
        }
      }
    )
    // --- Intervention↔Artisan junction (pas de filtre, petite table) ---
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'intervention_artisans',
      },
      (payload: any) => {
        const newRecord = payload.new && 'id' in payload.new ? payload.new : null
        const oldRecord = payload.old && 'id' in payload.old ? payload.old : null
        console.log('[Realtime] intervention_artisans:', payload.eventType, newRecord?.intervention_id || oldRecord?.intervention_id)
        try {
          handlers.onJunctionEvent(payload)
        } catch (error) {
          console.error('[Realtime] Erreur traitement junction:', error)
        }
      }
    )
    // --- Intervention reminders (pas de filtre, traité par RemindersContext) ---
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'intervention_reminders',
      },
      (payload: any) => {
        const newRecord = payload.new && 'id' in payload.new ? payload.new : null
        const oldRecord = payload.old && 'id' in payload.old ? payload.old : null
        console.log('[Realtime] intervention_reminders:', payload.eventType, newRecord?.intervention_id || oldRecord?.intervention_id)
        try {
          handlers.onReminderEvent(payload)
        } catch (error) {
          console.error('[Realtime] Erreur traitement reminder:', error)
        }
      }
    )

  return channel
}

/**
 * Supprime proprement un channel Realtime via le client Supabase.
 * Préférer à channel.unsubscribe() qui ne nettoie pas les références internes.
 */
export function removeRealtimeChannel(channel: RealtimeChannel): void {
  supabase.removeChannel(channel)
}

/**
 * @deprecated Utiliser createRealtimeChannel() avec les 3 handlers.
 * Conservé pour la compatibilité avec les tests existants.
 */
export function createInterventionsChannel(
  onEvent: (payload: RealtimePostgresChangesPayload<Intervention>) => void | Promise<void>
): RealtimeChannel {
  return createRealtimeChannel({
    onInterventionEvent: onEvent,
    onArtisanEvent: () => {},
    onJunctionEvent: () => {},
    onReminderEvent: () => {},
  })
}

/**
 * @deprecated Utiliser removeRealtimeChannel().
 */
export const removeInterventionsChannel = removeRealtimeChannel

/**
 * Vérifie si une erreur est une erreur réseau
 */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof Error) {
    return (
      error.message.includes('network') ||
      error.message.includes('NetworkError') ||
      error.message.includes('Failed to fetch') ||
      error.message.includes('timeout')
    )
  }
  return false
}
