"use client"

import { useQuery } from "@tanstack/react-query"
import { useMemo, useRef } from "react"
import { interventionsApi } from "@/lib/api/v2"
import type { AdminDashboardStats, DashboardPeriodParams, PeriodType } from "@/lib/api/v2"
import { useDailySparklineCache } from "./useDailySparklineCache"

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
  // Utiliser le cache daily pour les sparklines
  const dailyCache = useDailySparklineCache()
  
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
        params.agenceId ?? null,
        params.gestionnaireId ?? null,
        params.metierId ?? null,
      ]
      : params
        ? [
          "admin",
          "dashboard",
          "stats",
          params.periodType,
          "current",
          params.agenceId ?? null,
          params.gestionnaireId ?? null,
          params.metierId ?? null,
        ]
        : ["admin", "dashboard", "stats", "disabled"],
    queryFn: async () => {
      if (!params || !calculatedDates) throw new Error("Params are required")
      
      // Vérifier le cache daily pour les sparklines avant de faire l'appel API
      const cachedSparklines = dailyCache.get(calculatedDates.start, calculatedDates.end)
      
      // Récupérer les données complètes depuis l'API
      const stats = await interventionsApi.getAdminDashboardStats(params)
      
      // Toujours mettre en cache les nouvelles données (écrase l'ancien si nécessaire)
      // Le cache gère automatiquement la limite de 3 mois
      if (stats.sparklines && stats.sparklines.length > 0) {
        dailyCache.set(calculatedDates.start, calculatedDates.end, stats.sparklines)
      }
      
      // Si on avait des données en cache et qu'elles sont identiques, on peut les utiliser
      // Sinon, on utilise les données fraîches de l'API (déjà mises en cache ci-dessus)
      return stats
    },
    enabled: params !== null && (options?.enabled !== false),
    staleTime: 30 * 1000, // 30 secondes - les stats peuvent être mises à jour fréquemment
    gcTime: 5 * 60 * 1000, // 5 minutes en cache
  })
}


