"use client"

import { useQuery } from "@tanstack/react-query"
import { interventionsApi, type RevenueHistoryParams, type RevenueHistoryResponse } from "@/lib/api/v2"

export function useRevenueHistory(
  params: RevenueHistoryParams | null,
  options?: { enabled?: boolean }
) {
  return useQuery<RevenueHistoryResponse>({
    queryKey: params
      ? [
          "admin",
          "revenue",
          "history",
          params.periodType,
          params.startDate ?? null,
          params.endDate ?? null,
          JSON.stringify(params.agenceIds?.sort() ?? null),
          JSON.stringify(params.gestionnaireIds?.sort() ?? null),
          JSON.stringify(params.metierIds?.sort() ?? null),
          params.includeProjection ?? true,
        ]
      : ["admin", "revenue", "history", "disabled"],
    queryFn: async () => {
      if (!params) throw new Error("Params are required")
      return await interventionsApi.getRevenueHistory(params)
    },
    enabled: params !== null && (options?.enabled !== false),
    staleTime: 30 * 1000, // 30 secondes
    gcTime: 5 * 60 * 1000, // 5 minutes en cache
  })
}

