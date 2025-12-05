/**
 * Hook React pour gérer la synchronisation Realtime des interventions
 * S'abonne aux événements Supabase Realtime et synchronise le cache TanStack Query
 * T082-T083: Basculement automatique vers polling si Realtime indisponible et reconnexion automatique
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { createInterventionsChannel } from '@/lib/realtime/realtime-client'
import { syncCacheWithRealtimeEvent, initializeCacheSync } from '@/lib/realtime/cache-sync'
import type { Intervention } from '@/lib/api/v2/common/types'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { interventionKeys } from '@/lib/react-query/queryKeys'

export type ConnectionStatus = 'realtime' | 'polling' | 'connecting'

const POLLING_INTERVAL = 15000 // 🚀 OPTIMISATION: 15 secondes au lieu de 5 (suffisant pour un CRM)
const RECONNECT_INTERVAL = 30000 // 30 secondes

/**
 * Hook pour activer la synchronisation Realtime des interventions
 * 
 * @example
 * ```tsx
 * function InterventionsPage() {
 *   const { connectionStatus } = useInterventionsRealtime()
 *   // ... reste du composant
 * }
 * ```
 */
export function useInterventionsRealtime() {
  const queryClient = useQueryClient()
  const channelRef = useRef<RealtimeChannel | null>(null)
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting')
  const { data: currentUser } = useCurrentUser()
  const currentUserId = currentUser?.id ?? null

  // T082: Polling de fallback lorsque Realtime est indisponible
  const startPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      return // Déjà en cours
    }

    console.log('[Realtime] Démarrage du polling de fallback (5s)')
    setConnectionStatus('polling')

    pollingIntervalRef.current = setInterval(() => {
      console.log('[Realtime] Polling: invalidation des queries actives')
      // Invalider uniquement les listes (complètes + light) pour limiter le trafic
      queryClient.invalidateQueries({
        queryKey: interventionKeys.invalidateLists(),
        refetchType: 'active',
      })
      queryClient.invalidateQueries({
        queryKey: interventionKeys.invalidateLightLists(),
        refetchType: 'active',
      })
    }, POLLING_INTERVAL)
  }, [queryClient])

  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
      console.log('[Realtime] Arrêt du polling de fallback')
    }
  }, [])

  // T083: Tentative de reconnexion automatique à Realtime toutes les 30s
  const attemptReconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      return // Déjà programmée
    }

    console.log('[Realtime] Tentative de reconnexion dans 30s...')
    setConnectionStatus('connecting')

    reconnectTimeoutRef.current = setTimeout(() => {
      reconnectTimeoutRef.current = null
      
      // Essayer de créer un nouveau channel
      if (channelRef.current) {
        channelRef.current.unsubscribe()
        channelRef.current = null
      }

      const channel = createInterventionsChannel(async (payload) => {
        const newIntervention = payload.new && 'id' in payload.new ? payload.new : null
        const oldIntervention = payload.old && 'id' in payload.old ? payload.old : null
        console.log('[Realtime] Événement reçu:', payload.eventType, newIntervention?.id || oldIntervention?.id)
        await syncCacheWithRealtimeEvent(queryClient, payload, currentUserId)
      })

      channelRef.current = channel

      // Vérifier le statut de souscription après un court délai
      setTimeout(() => {
        if (channelRef.current) {
          channelRef.current.subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              console.log('[Realtime] ✅ Reconnexion réussie, arrêt du polling')
              stopPolling()
              setConnectionStatus('realtime')
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
              console.warn('[Realtime] ⚠️ Échec de reconnexion, maintien du polling')
              startPolling()
              // Réessayer dans 30s
              attemptReconnect()
            }
          })
        }
      }, 1000)
    }, RECONNECT_INTERVAL)
  }, [queryClient, currentUserId, startPolling, stopPolling])

  useEffect(() => {
    console.log('[Realtime] Initialisation de la synchronisation Realtime')
    
    // Initialiser la synchronisation BroadcastChannel
    initializeCacheSync(queryClient)

    // Créer et configurer le channel Realtime
    const channel = createInterventionsChannel(async (payload) => {
      const newIntervention = payload.new && 'id' in payload.new ? payload.new : null
      const oldIntervention = payload.old && 'id' in payload.old ? payload.old : null
      console.log('[Realtime] Événement reçu:', payload.eventType, newIntervention?.id || oldIntervention?.id)
      await syncCacheWithRealtimeEvent(queryClient, payload, currentUserId)
    })

    channelRef.current = channel

    // Surveiller le statut de connexion
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('[Realtime] ✅ Channel souscrit avec succès')
        stopPolling()
        setConnectionStatus('realtime')
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        console.warn(`[Realtime] ⚠️ Problème de connexion (${status}), basculement vers polling`)
        startPolling()
        attemptReconnect()
      }
    })

    // Gestion des erreurs de connexion
    channel.on('error' as any, {}, (error: any) => {
      console.error('[Realtime] Erreur de connexion:', error)
      startPolling()
      attemptReconnect()
    })

    // Gestion de la déconnexion
    channel.on('disconnect' as any, {}, () => {
      console.warn('[Realtime] Déconnexion détectée, basculement vers polling')
      startPolling()
      attemptReconnect()
    })

    // Nettoyage lors du démontage
    return () => {
      console.log('[Realtime] Nettoyage du channel')
      stopPolling()
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = null
      }
      if (channelRef.current) {
        channelRef.current.unsubscribe()
        channelRef.current = null
      }
    }
  }, [queryClient, currentUserId, startPolling, stopPolling, attemptReconnect])

  return { connectionStatus }
}
