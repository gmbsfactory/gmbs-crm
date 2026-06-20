"use client"

import { useQuery } from "@tanstack/react-query"
import { monitoringApi } from "@/lib/api/monitoring"
import type { HeatmapBucket, HeatmapCell } from "@/types/monitoring"

/** Heatmap des actions par gestionnaire × bucket (heure/jour). Réservé au Monitoring DEV. */
export function useActivityHeatmap(
  startDate: Date,
  endDate: Date,
  bucket: HeatmapBucket,
  userIds?: string[] | null,
  enabled = true
) {
  const s = startDate.toISOString()
  const e = endDate.toISOString()
  return useQuery<HeatmapCell[]>({
    queryKey: ["activity-heatmap", s, e, bucket, userIds ?? null],
    queryFn: () => monitoringApi.getActivityHeatmap(startDate, endDate, bucket, userIds),
    enabled,
    staleTime: 2 * 60_000,
  })
}
