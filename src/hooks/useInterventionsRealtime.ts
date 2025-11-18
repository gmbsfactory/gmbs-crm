/**
 * Hook React pour gérer la synchronisation Realtime des interventions
 * S'abonne aux événements Supabase Realtime et synchronise le cache TanStack Query
 */

import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { createInterventionsChannel } from '@/lib/realtime/realtime-client'
import { syncCacheWithRealtimeEvent, initializeCacheSync } from '@/lib/realtime/cache-sync'
import type { Intervention } from '@/lib/api/v2/common/types'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { useCurrentUser } from '@/hooks/useCurrentUser'

/**
 * Hook pour activer la synchronisation Realtime des interventions
 * 
 * @example
 * ```tsx
 * function InterventionsPage() {
 *   useInterventionsRealtime()
 *   // ... reste du composant
 * }
 * ```
 */
export function useInterventionsRealtime() {
  const queryClient = useQueryClient()
  const channelRef = useRef<RealtimeChannel | null>(null)
  const { data: currentUser } = useCurrentUser()
  const currentUserId = currentUser?.id ?? null

  useEffect(() => {
    console.log('[Realtime] Initialisation de la synchronisation Realtime')
    
    // Initialiser la synchronisation BroadcastChannel
    initializeCacheSync(queryClient)

    // Créer et configurer le channel Realtime
    const channel = createInterventionsChannel(async (payload) => {
      console.log('[Realtime] Événement reçu:', payload.eventType, payload.new?.id || payload.old?.id)
      await syncCacheWithRealtimeEvent(queryClient, payload, currentUserId)
    })

    channelRef.current = channel
    // Le channel gère déjà la souscription et les logs dans createInterventionsChannel

    // Nettoyage lors du démontage
    return () => {
      console.log('[Realtime] Nettoyage du channel')
      if (channelRef.current) {
        channelRef.current.unsubscribe()
        channelRef.current = null
      }
    }
  }, [queryClient, currentUserId])

  return null
}

