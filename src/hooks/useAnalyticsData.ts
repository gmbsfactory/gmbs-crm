"use client"

import { useQuery } from "@tanstack/react-query"
import { analyticsApi } from "@/lib/api"
import { analyticsKeys } from "@/lib/react-query/queryKeys"

export type { AnalyticsData } from "@/lib/api/analyticsApi"

export function useAnalyticsData() {
  return useQuery({
    queryKey: analyticsKeys.dashboard(),
    queryFn: () => analyticsApi.getDashboardData(),
    staleTime: 5 * 60 * 1000,
  })
}
