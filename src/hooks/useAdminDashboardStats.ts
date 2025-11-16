"use client"

import { useQuery } from "@tanstack/react-query"
import { interventionsApi } from "@/lib/api/v2"
import type { AdminDashboardStats, DashboardPeriodParams, PeriodType } from "@/lib/api/v2"

/**
 * Hook pour récupérer les statistiques du dashboard administrateur
 * 
 * @param params - Paramètres de période (periodType, referenceDate, startDate, endDate)
 * @param options - Options supplémentaires (enabled, etc.)
 * 
 * @example
 * const { data: stats, isLoading, error } = useAdminDashboardStats({
 *   periodType: 'month',
 *   referenceDate: '2024-01-15'
 * })
 */
export function useAdminDashboardStats(
  params: DashboardPeriodParams | null,
  options?: { enabled?: boolean }
) {
  return useQuery<AdminDashboardStats>({
    queryKey: params 
      ? ["admin", "dashboard", "stats", params.periodType, params.referenceDate || params.startDate || "current"]
      : ["admin", "dashboard", "stats", "disabled"],
    queryFn: async () => {
      if (!params) throw new Error("Params are required")
      return await interventionsApi.getAdminDashboardStats(params)
    },
    enabled: params !== null && (options?.enabled !== false),
    staleTime: 30 * 1000, // 30 secondes - les stats peuvent être mises à jour fréquemment
    gcTime: 5 * 60 * 1000, // 5 minutes en cache
  })
}


