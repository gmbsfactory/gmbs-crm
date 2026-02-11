/**
 * Diffusion des changements Realtime via BroadcastChannel
 * Gere le singleton BroadcastSync et le debounce des compteurs
 */

import type { QueryClient } from '@tanstack/react-query'
import { interventionKeys } from '@/lib/react-query/queryKeys'
import { debounce } from '@/utils/debounce'
import { createBroadcastSync } from '@/lib/realtime/broadcast-sync'

// Instance singleton de BroadcastSync
let broadcastSync: ReturnType<typeof createBroadcastSync> | null = null

/**
 * Retourne l'instance singleton BroadcastSync (ou null si non initialisee)
 */
export function getBroadcastSync(): ReturnType<typeof createBroadcastSync> | null {
  return broadcastSync
}

/**
 * Initialise la synchronisation BroadcastChannel
 *
 * @param queryClient - Instance QueryClient de TanStack Query
 */
export function initializeCacheSync(queryClient: QueryClient) {
  if (!broadcastSync) {
    broadcastSync = createBroadcastSync(queryClient)
  }
  return broadcastSync
}

/**
 * Debounce pour rafraichir les compteurs
 * Regroupe les mises a jour multiples en un seul appel API
 */
export const debouncedRefreshCounts = debounce(async (queryClient: QueryClient) => {
  // Invalider tous les resumes pour forcer le recalcul via API
  queryClient.invalidateQueries({
    queryKey: interventionKeys.summaries(),
    refetchType: 'active', // Refetch pour recalculer via API
  })
}, 500)
