/**
 * useDashboardFreshness — Options TanStack Query pré-configurées pour le tier T3.
 *
 * Données qui changent régulièrement mais dont la latence de 30s est acceptable :
 * dashboard stats, summaries, counters.
 *
 * Le polling T3 :
 * - S'arrête quand l'onglet perd le focus (refetchIntervalInBackground: false)
 * - Reprend automatiquement au retour sur l'onglet (+ refetchOnWindowFocus: true)
 * - S'adapte aux appareils faibles (60s au lieu de 30s)
 *
 * @example
 * ```tsx
 * function DashboardStats() {
 *   const { queryOptions } = useDashboardFreshness()
 *
 *   const { data } = useQuery({
 *     queryKey: dashboardKeys.statsByUser(params),
 *     queryFn: () => fetchStats(params),
 *     ...queryOptions,
 *   })
 * }
 * ```
 */

import { useMemo } from 'react'
import { getTierConfig } from '@/config/freshness-tiers'

interface UseDashboardFreshnessReturn {
  /** Options TanStack Query prêtes à être spread dans useQuery */
  queryOptions: {
    staleTime: number
    gcTime: number
    refetchInterval: number | false
    refetchIntervalInBackground: false
    refetchOnWindowFocus: true
  }
  /** Intervalle de polling actif */
  pollingInterval: number | false
}

export function useDashboardFreshness(): UseDashboardFreshnessReturn {
  return useMemo(() => {
    const config = getTierConfig('T3')

    return {
      pollingInterval: config.pollingInterval,
      queryOptions: {
        staleTime: config.staleTime,
        gcTime: config.gcTime,
        refetchInterval: config.pollingInterval,
        refetchIntervalInBackground: false as const,
        refetchOnWindowFocus: true as const,
      },
    }
  }, [])
}
