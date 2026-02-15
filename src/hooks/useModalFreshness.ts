/**
 * useModalFreshness — Active le polling T2 pour les données enfant d'une intervention
 * uniquement quand le modal est ouvert et l'onglet est visible.
 *
 * C'est le cœur du Layer 4 (Freshness Tiers). Au lieu de brancher du Realtime sur
 * les commentaires, coûts et documents (ce qui gaspillerait des connexions WebSocket),
 * on poll à 5s UNIQUEMENT quand l'utilisateur regarde le modal.
 *
 * Quand le modal se ferme, polling = false → TanStack Query arrête le refetch.
 * Quand l'onglet perd le focus, polling = false (refetchIntervalInBackground: false).
 *
 * @example
 * ```tsx
 * function InterventionModal({ interventionId, isOpen }) {
 *   const { pollingInterval, isPolling } = useModalFreshness(isOpen)
 *
 *   const { data: comments } = useQuery({
 *     queryKey: commentKeys.byEntityPaginated('intervention', interventionId, 50),
 *     queryFn: () => commentsApi.getByEntity('intervention', interventionId, { limit: 50 }),
 *     refetchInterval: pollingInterval,
 *     enabled: isOpen,
 *   })
 * }
 * ```
 */

import { useMemo } from 'react'
import { getTierConfig } from '@/config/freshness-tiers'
import type { FreshnessTier } from '@/config/freshness-tiers'

interface UseModalFreshnessOptions {
  /** Tier à utiliser (défaut: T2) */
  tier?: FreshnessTier
  /** Forcer le polling même quand isActive est false (pour cas spéciaux) */
  forcePolling?: boolean
}

interface UseModalFreshnessReturn {
  /** Intervalle de polling en ms, ou false quand désactivé */
  pollingInterval: number | false
  /** true si le polling est actif */
  isPolling: boolean
  /** Options TanStack Query prêtes à être spread dans useQuery */
  queryOptions: {
    staleTime: number
    gcTime: number
    refetchInterval: number | false
    refetchIntervalInBackground: false
  }
}

/**
 * Active le polling T2 conditionnel : poll uniquement quand `isActive` est true.
 *
 * @param isActive - Le modal/composant parent est-il ouvert et visible ?
 * @param options - Configuration optionnelle (tier, forcePolling)
 */
export function useModalFreshness(
  isActive: boolean,
  options: UseModalFreshnessOptions = {}
): UseModalFreshnessReturn {
  const { tier = 'T2', forcePolling = false } = options

  return useMemo(() => {
    const config = getTierConfig(tier)
    const shouldPoll = (isActive || forcePolling) && config.pollingInterval !== false
    const pollingInterval = shouldPoll ? config.pollingInterval : false

    return {
      pollingInterval,
      isPolling: shouldPoll,
      queryOptions: {
        staleTime: config.staleTime,
        gcTime: config.gcTime,
        refetchInterval: pollingInterval,
        refetchIntervalInBackground: false as const,
      },
    }
  }, [isActive, tier, forcePolling])
}
