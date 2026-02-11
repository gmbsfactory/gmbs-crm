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
 * 
 * @param onEvent - Handler appelé lors de la réception d'un événement (peut être async)
 * @returns Channel Realtime configuré
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
        // ⚠️ IMPORTANT: Pas de filtre is_active ici pour détecter les soft deletes
        // On écoute tous les événements UPDATE pour détecter les changements de is_active
      },
      (payload) => {
        const newIntervention = payload.new && 'id' in payload.new ? payload.new : null
        const oldIntervention = payload.old && 'id' in payload.old ? payload.old : null
        try {
          onEvent(payload)
        } catch (error) {
          console.error('[Realtime] ❌ Erreur lors du traitement de l\'événement:', error)
        }
      }
    )

  // Souscrire au channel et gérer le statut
  channel.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
    } else if (status === 'CHANNEL_ERROR') {
      // Log en warning car le fallback vers polling est géré par le hook
      // Les détails de l'erreur seront capturés par le gestionnaire 'error' ci-dessous
      console.warn('[Realtime] ⚠️ Erreur de channel Realtime', {
        status,
        channel: CHANNEL_NAME,
        table: 'interventions',
        hint: 'Vérifiez que Realtime est activé dans Supabase et que la table est dans la publication supabase_realtime. Le système basculera automatiquement vers le polling.'
      })
    } else if (status === 'TIMED_OUT') {
      console.warn('[Realtime] ⚠️ Timeout de souscription')
    } else if (status === 'CLOSED') {
      console.warn('[Realtime] ⚠️ Channel fermé')
    }
  })

  // Gestion des erreurs de connexion
  channel.on('error' as any, {}, (error: any) => {
    console.error('[Realtime] Erreur de connexion:', {
      error,
      message: error?.message || 'Erreur inconnue',
      channel: CHANNEL_NAME
    })
    // Le basculement vers polling sera géré par le hook
  })

  // Gestion de la déconnexion
  channel.on('disconnect' as any, {}, () => {
    console.warn('[Realtime] Déconnexion détectée')
    // Le basculement vers polling sera géré par le hook
  })

  return channel
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

