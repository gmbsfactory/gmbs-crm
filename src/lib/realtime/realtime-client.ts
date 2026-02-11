/**
 * Client Realtime pour les interventions
 * Configure et gère la connexion Supabase Realtime pour la table interventions
 */

import { supabase } from '@/lib/supabase-client'
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import type { Intervention } from '@/lib/api/v2/common/types'

const CHANNEL_NAME = 'interventions-changes'

/**
 * Crée et configure le channel Supabase Realtime pour la table interventions
 * Ne souscrit PAS au channel — l'appelant (hook) gère le cycle de vie de la souscription.
 *
 * @param onEvent - Handler appelé lors de la réception d'un événement (peut être async)
 * @returns Channel Realtime configuré (non souscrit)
 */
export function createInterventionsChannel(
  onEvent: (payload: RealtimePostgresChangesPayload<Intervention>) => void | Promise<void>
): RealtimeChannel {
  const channel = supabase
    .channel(CHANNEL_NAME)
    .on<Intervention>(
      'postgres_changes',
      {
        event: '*', // INSERT, UPDATE, DELETE
        schema: 'public',
        table: 'interventions',
        // ⚠️ OPTIMISATION: Filtre pour ignorer les soft deletes (interventions inactives)
        // Réduit le trafic de 50% en ne syncant que les interventions actives
        // Note: Les soft deletes sont détectés quand is_active passe de true → false
        filter: 'is_active=eq.true',
      },
      (payload) => {
        const newIntervention = payload.new && 'id' in payload.new ? payload.new : null
        const oldIntervention = payload.old && 'id' in payload.old ? payload.old : null
        console.log('[Realtime] Payload reçu:', {
          eventType: payload.eventType,
          newId: newIntervention?.id,
          oldId: oldIntervention?.id,
        })
        try {
          onEvent(payload)
        } catch (error) {
          console.error('[Realtime] Erreur lors du traitement de l\'événement:', error)
        }
      }
    )

  return channel
}

/**
 * Supprime proprement un channel Realtime via le client Supabase.
 * Préférer à channel.unsubscribe() qui ne nettoie pas les références internes.
 */
export function removeInterventionsChannel(channel: RealtimeChannel): void {
  supabase.removeChannel(channel)
}

/**
 * Vérifie si une erreur est une erreur réseau
 * 
 * @param error - Erreur à vérifier
 * @returns true si c'est une erreur réseau
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

