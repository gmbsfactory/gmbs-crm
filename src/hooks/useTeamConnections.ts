"use client"

import { useQuery } from "@tanstack/react-query"
import { monitoringApi } from "@/lib/api/monitoring"
import type { TeamConnection } from "@/types/monitoring"

/**
 * Journal des connexions/déconnexions et temps de présence par jour, pour
 * tous les gestionnaires (ou un sous-ensemble) sur la période. Dérivé de
 * user_page_sessions. Réservé au Monitoring DEV.
 */
export function useTeamConnections(
  startDate: Date,
  endDate: Date,
  userIds?: string[] | null,
  enabled = true
) {
  const startStr = startDate.toISOString().split("T")[0]
  const endStr = endDate.toISOString().split("T")[0]

  return useQuery<TeamConnection[]>({
    queryKey: ["team-connections", startStr, endStr, userIds ?? null],
    queryFn: () => monitoringApi.getTeamConnections(startDate, endDate, userIds),
    enabled,
    staleTime: 2 * 60_000,
  })
}
