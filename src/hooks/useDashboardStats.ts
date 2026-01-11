"use client"

import { useQuery } from "@tanstack/react-query"
import { interventionsApi } from "@/lib/api/v2"
import type { InterventionStatsByStatus, MarginStats, WeeklyStats, MonthlyStats, YearlyStats, StatsPeriod } from "@/lib/api/v2"
import { dashboardKeys, type DashboardStatsParams, type DashboardMarginParams, type DashboardPeriodStatsParams } from "@/lib/react-query/queryKeys"
import { useCurrentUser } from "@/hooks/useCurrentUser"

/**
 * Hook pour récupérer les statistiques d'interventions par statut pour un utilisateur et une période
 * 
 * @param params - Paramètres (userId, startDate, endDate)
 * @param options - Options supplémentaires (enabled, etc.)
 * 
 * @example
 * const { data: stats, isLoading, error } = useDashboardStatsQuery({
 *   userId: "123",
 *   startDate: "2024-01-01",
 *   endDate: "2024-01-31"
 * })
 */
export function useDashboardStatsQuery(
  params: DashboardStatsParams | null,
  options?: { enabled?: boolean }
) {
  return useQuery<InterventionStatsByStatus>({
    queryKey: params ? dashboardKeys.statsByUser(params) : ["dashboard", "stats", "disabled"],
    queryFn: async () => {
      if (!params) throw new Error("Params are required")
      return await interventionsApi.getStatsByUser(
        params.userId,
        params.startDate,
        params.endDate
      )
    },
    enabled: params !== null && (options?.enabled !== false),
    staleTime: 30 * 1000, // 30 secondes - les stats peuvent être mises à jour fréquemment
    gcTime: 5 * 60 * 1000, // 5 minutes en cache
  })
}

/**
 * Hook pour récupérer les statistiques de marge pour un utilisateur et une période
 * 
 * @param params - Paramètres (userId, startDate, endDate)
 * @param options - Options supplémentaires (enabled, etc.)
 * 
 * @example
 * const { data: marginStats, isLoading, error } = useDashboardMarginQuery({
 *   userId: "123",
 *   startDate: "2024-01-01",
 *   endDate: "2024-01-31"
 * })
 */
export function useDashboardMarginQuery(
  params: DashboardMarginParams | null,
  options?: { enabled?: boolean }
) {
  return useQuery<MarginStats>({
    queryKey: params ? dashboardKeys.marginByUser(params) : ["dashboard", "margin", "disabled"],
    queryFn: async () => {
      if (!params) throw new Error("Params are required")
      return await interventionsApi.getMarginStatsByUser(
        params.userId,
        params.startDate,
        params.endDate
      )
    },
    enabled: params !== null && (options?.enabled !== false),
    staleTime: 30 * 1000, // 30 secondes
    gcTime: 5 * 60 * 1000, // 5 minutes en cache
  })
}

/**
 * Hook pour récupérer les statistiques par période (semaine/mois/année) pour un utilisateur
 * 
 * @param params - Paramètres (userId, period, startDate?)
 * @param options - Options supplémentaires (enabled, etc.)
 * 
 * @example
 * const { data: periodStats, isLoading, error } = useDashboardPeriodStatsQuery({
 *   userId: "123",
 *   period: "week",
 *   startDate: "2024-01-01"
 * })
 */
export function useDashboardPeriodStatsQuery(
  params: DashboardPeriodStatsParams | null,
  options?: { enabled?: boolean }
) {
  return useQuery<WeeklyStats | MonthlyStats | YearlyStats>({
    queryKey: params ? dashboardKeys.periodStatsByUser(params) : ["dashboard", "period", "disabled"],
    queryFn: async () => {
      if (!params) throw new Error("Params are required")
      return await interventionsApi.getPeriodStatsByUser(
        params.userId,
        params.period,
        params.startDate
      )
    },
    enabled: params !== null && (options?.enabled !== false),
    staleTime: 30 * 1000, // 30 secondes
    gcTime: 5 * 60 * 1000, // 5 minutes en cache
  })
}

/**
 * Hook helper pour utiliser les stats avec l'utilisateur courant automatiquement
 * 
 * @param period - Période (startDate, endDate)
 * @param userId - ID utilisateur optionnel (utilise currentUser par défaut)
 */
export function useDashboardStats(
  period: { startDate?: string; endDate?: string } | null | undefined,
  userId?: string | null
) {
  const { data: currentUser } = useCurrentUser()
  const effectiveUserId = userId ?? currentUser?.id ?? null

  const params: DashboardStatsParams | null = effectiveUserId
    ? {
      userId: effectiveUserId,
      startDate: period?.startDate,
      endDate: period?.endDate,
    }
    : null

  return useDashboardStatsQuery(params)
}

/**
 * Hook helper pour utiliser les stats de marge avec l'utilisateur courant automatiquement
 * 
 * @param period - Période (startDate, endDate)
 * @param userId - ID utilisateur optionnel (utilise currentUser par défaut)
 */
export function useDashboardMargin(
  period: { startDate: string; endDate: string } | null | undefined,
  userId?: string | null
) {
  const { data: currentUser } = useCurrentUser()
  const effectiveUserId = userId ?? currentUser?.id ?? null

  const params: DashboardMarginParams | null = effectiveUserId && period?.startDate && period?.endDate
    ? {
      userId: effectiveUserId,
      startDate: period.startDate,
      endDate: period.endDate,
    }
    : null

  return useDashboardMarginQuery(params)
}

/**
 * Hook helper pour utiliser les stats par période avec l'utilisateur courant automatiquement
 * 
 * @param period - Type de période et dates
 * @param userId - ID utilisateur optionnel (utilise currentUser par défaut)
 */
export function useDashboardPeriodStats(
  period: { period: StatsPeriod; startDate?: string } | null | undefined,
  userId?: string | null
) {
  const { data: currentUser } = useCurrentUser()
  const effectiveUserId = userId ?? currentUser?.id ?? null

  // Si period est undefined, utiliser "week" par défaut
  const effectivePeriod = period?.period ?? "week"

  const params: DashboardPeriodStatsParams | null = effectiveUserId
    ? {
      userId: effectiveUserId,
      period: effectivePeriod,
      startDate: period?.startDate,
    }
    : null

  return useDashboardPeriodStatsQuery(params)
}

/**
 * Hook pour récupérer les interventions récentes par statut pour un utilisateur (pour les tooltips)
 * 
 * @param params - Paramètres (userId, statusLabel, limit, startDate, endDate)
 * @param options - Options supplémentaires
 */
export function useRecentInterventionsByStatus(
  params: {
    userId: string | null;
    statusLabel: string | null;
    limit?: number;
    startDate?: string;
    endDate?: string
  } | null,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: params && params.userId && params.statusLabel
      ? dashboardKeys.recentInterventionsByStatus({
        userId: params.userId,
        statusLabel: params.statusLabel,
        limit: params.limit,
        startDate: params.startDate,
        endDate: params.endDate
      })
      : ["dashboard", "recent-interventions", "disabled"],
    queryFn: async () => {
      if (!params || !params.userId || !params.statusLabel) throw new Error("Params are required")
      return await interventionsApi.getRecentInterventionsByStatusAndUser(
        params.userId,
        params.statusLabel,
        params.limit,
        params.startDate,
        params.endDate
      )
    },
    enabled: params !== null && params.userId !== null && params.statusLabel !== null && (options?.enabled !== false),
    staleTime: 2 * 60 * 1000, // 2 minutes en cache comme dans l'implémentation originale
    gcTime: 5 * 60 * 1000, // 5 minutes
  })
}










