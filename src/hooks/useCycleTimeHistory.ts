"use client"

import { useQuery } from "@tanstack/react-query"
import { interventionsApi, type KPIHistoryParams, type CycleTimeHistoryResponse } from "@/lib/api/v2"

export function useCycleTimeHistory(
  params: KPIHistoryParams | null,
  options?: { enabled?: boolean }
) {
  return useQuery<CycleTimeHistoryResponse>({
    queryKey: params
      ? [
          "admin",
          "cycle-time",
          "history",
          params.periodType,
          params.startDate ?? null,
          params.endDate ?? null,
          params.agenceId ?? null,
          params.gestionnaireId ?? null,
          params.metierId ?? null,
          params.includeProjection ?? true,
        ]
      : ["admin", "cycle-time", "history", "disabled"],
    queryFn: async () => {
      if (!params) throw new Error("Params are required")
      return await interventionsApi.getCycleTimeHistory(params)
    },
    enabled: params !== null && (options?.enabled !== false),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  })
}

