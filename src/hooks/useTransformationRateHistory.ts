"use client"

import { useQuery } from "@tanstack/react-query"
import { interventionsApi, type KPIHistoryParams, type TransformationRateHistoryResponse } from "@/lib/api/v2"

export function useTransformationRateHistory(
  params: KPIHistoryParams | null,
  options?: { enabled?: boolean }
) {
  return useQuery<TransformationRateHistoryResponse>({
    queryKey: params
      ? [
          "admin",
          "transformation-rate",
          "history",
          params.periodType,
          params.startDate ?? null,
          params.endDate ?? null,
          JSON.stringify(params.agenceIds?.sort() ?? null),
          JSON.stringify(params.gestionnaireIds?.sort() ?? null),
          JSON.stringify(params.metierIds?.sort() ?? null),
          params.includeProjection ?? true,
        ]
      : ["admin", "transformation-rate", "history", "disabled"],
    queryFn: async () => {
      if (!params) throw new Error("Params are required")
      return await interventionsApi.getTransformationRateHistory(params)
    },
    enabled: params !== null && (options?.enabled !== false),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  })
}

