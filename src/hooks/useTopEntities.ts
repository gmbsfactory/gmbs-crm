"use client"

import { useQuery } from "@tanstack/react-query"
import { monitoringApi } from "@/lib/api/monitoring"
import type { TopEntity } from "@/types/monitoring"

/** Entités (interventions/artisans) les plus actives sur la période. Réservé au Monitoring DEV. */
export function useTopEntities(
  startDate: Date,
  endDate: Date,
  limit = 10,
  userIds?: string[] | null,
  enabled = true
) {
  const s = startDate.toISOString()
  const e = endDate.toISOString()
  return useQuery<TopEntity[]>({
    queryKey: ["top-entities", s, e, limit, userIds ?? null],
    queryFn: () => monitoringApi.getTopEntities(startDate, endDate, limit, userIds),
    enabled,
    staleTime: 2 * 60_000,
  })
}
