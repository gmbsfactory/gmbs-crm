"use client"

import { useQuery } from "@tanstack/react-query"
import { analyticsApi } from "@/lib/api/v2"
import { analyticsKeys } from "@/lib/react-query/queryKeys"

export type { AnalyticsData } from "@/lib/api/v2/analyticsApi"

export function useAnalyticsData() {
  return useQuery({
    queryKey: analyticsKeys.dashboard(),
    queryFn: () => analyticsApi.getDashboardData(),
    staleTime: 5 * 60 * 1000,
  })
}
