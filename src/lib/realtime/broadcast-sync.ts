/**
 * Synchronisation du cache TanStack Query entre onglets via BroadcastChannel API
 * Permet de synchroniser les mises à jour Realtime entre plusieurs onglets ouverts
 */

import type { QueryClient } from '@tanstack/react-query'
import type { QueryKey } from '@tanstack/react-query'

const BROADCAST_CHANNEL_NAME = 'interventions-cache-sync'

export interface CacheSyncMessage {
  type: 'cache-update' | 'invalidation' | 'realtime-event'
  queryKey: QueryKey
  data?: unknown
  eventType?: 'INSERT' | 'UPDATE' | 'DELETE'
  interventionId?: string
  timestamp: number
}

/**
 * Crée et configure un BroadcastChannel pour synchroniser le cache entre onglets
 * 
 * @param queryClient - Instance QueryClient de TanStack Query
 * @returns Objet avec méthodes de broadcast ou null si BroadcastChannel non disponible
 */
export function createBroadcastSync(queryClient: QueryClient) {
  // Vérifier que BroadcastChannel est disponible (pas disponible en SSR)
  if (typeof window === 'undefined' || !window.BroadcastChannel) {
    console.warn('[BroadcastSync] BroadcastChannel non disponible, synchronisation multi-onglets désactivée')
    return null
  }

  const channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME)

  // Écouter les messages des autres onglets
  channel.onmessage = (event: MessageEvent<CacheSyncMessage>) => {
    const { type, queryKey, data, eventType, interventionId, timestamp } = event.data

    // Ignorer les messages émis par cet onglet (éviter les boucles)
    if (timestamp === window.__lastBroadcastTimestamp) {
      return
    }

    switch (type) {
      case 'cache-update':
        // Mettre à jour le cache directement sans refetch
        if (data) {
          queryClient.setQueryData(queryKey, data)
        }
        break

      case 'invalidation':
        // Invalider les queries correspondantes
        queryClient.invalidateQueries({ queryKey })
        break

      case 'realtime-event':
        // Un autre onglet a reçu un événement Realtime
        // On peut choisir de synchroniser ou d'invalider
        // Pour éviter les doublons, on invalide simplement
        queryClient.invalidateQueries({ queryKey })
        break
    }
  }

  return {
    /**
     * Broadcast une mise à jour de cache aux autres onglets
     */
    broadcastCacheUpdate(queryKey: QueryKey, data: unknown) {
      const message: CacheSyncMessage = {
        type: 'cache-update',
        queryKey,
        data,
        timestamp: Date.now(),
      }
      window.__lastBroadcastTimestamp = message.timestamp
      channel.postMessage(message)
    },

    /**
     * Broadcast une invalidation aux autres onglets
     */
    broadcastInvalidation(queryKey: QueryKey) {
      const message: CacheSyncMessage = {
        type: 'invalidation',
        queryKey,
        timestamp: Date.now(),
      }
      window.__lastBroadcastTimestamp = message.timestamp
      channel.postMessage(message)
    },

    /**
     * Broadcast un événement Realtime reçu
     */
    broadcastRealtimeEvent(
      queryKey: QueryKey,
      eventType: 'INSERT' | 'UPDATE' | 'DELETE',
      interventionId: string
    ) {
      const message: CacheSyncMessage = {
        type: 'realtime-event',
        queryKey,
        eventType,
        interventionId,
        timestamp: Date.now(),
      }
      window.__lastBroadcastTimestamp = message.timestamp
      channel.postMessage(message)
    },

    /**
     * Fermer le channel
     */
    close() {
      channel.close()
    },
  }
}

// Extension du type Window pour stocker le dernier timestamp
declare global {
  interface Window {
    __lastBroadcastTimestamp?: number
  }
}

