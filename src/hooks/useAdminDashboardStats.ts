"use client"

import { useQuery } from "@tanstack/react-query"
import { useMemo } from "react"
import { interventionsApi } from "@/lib/api"
import type { AdminDashboardStats, DashboardPeriodParams, PeriodType } from "@/lib/api"

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
  // Calculer les dates pour les inclure dans la queryKey
  // Cela garantit que la clé de cache change quand la période change
  const calculatedDates = useMemo(() => {
    if (!params) return null

    const { periodType, referenceDate, startDate, endDate } = params

    // Si les dates sont fournies explicitement, les utiliser
    if (startDate && endDate) {
      return { start: startDate, end: endDate }
    }

    // Sinon, calculer les dates basées sur periodType et referenceDate
    const refDate = referenceDate ? new Date(referenceDate) : new Date()
    return interventionsApi.calculatePeriodDates(periodType, refDate)
  }, [params])

  return useQuery<AdminDashboardStats>({
    queryKey: params && calculatedDates
      ? [
        "admin",
        "dashboard",
        "stats",
        params.periodType,
        calculatedDates.start,
        calculatedDates.end,
        JSON.stringify(params.agenceIds?.sort() ?? null),
        JSON.stringify(params.gestionnaireIds?.sort() ?? null),
        JSON.stringify(params.metierIds?.sort() ?? null),
      ]
      : params
        ? [
          "admin",
          "dashboard",
          "stats",
          params.periodType,
          "current",
          JSON.stringify(params.agenceIds?.sort() ?? null),
          JSON.stringify(params.gestionnaireIds?.sort() ?? null),
          JSON.stringify(params.metierIds?.sort() ?? null),
        ]
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


