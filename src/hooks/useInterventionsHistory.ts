"use client"

import { useQuery } from "@tanstack/react-query"
import { interventionsApi, type KPIHistoryParams, type InterventionsHistoryResponse } from "@/lib/api/v2"

export function useInterventionsHistory(
  params: KPIHistoryParams | null,
  options?: { enabled?: boolean }
) {
  return useQuery<InterventionsHistoryResponse>({
    queryKey: params
      ? [
          "admin",
          "interventions",
          "history",
          params.periodType,
          params.startDate ?? null,
          params.endDate ?? null,
          JSON.stringify(params.agenceIds?.sort() ?? null),
          JSON.stringify(params.gestionnaireIds?.sort() ?? null),
          JSON.stringify(params.metierIds?.sort() ?? null),
          params.includeProjection ?? true,
        ]
      : ["admin", "interventions", "history", "disabled"],
    queryFn: async () => {
      if (!params) throw new Error("Params are required")
      return await interventionsApi.getInterventionsHistory(params)
    },
    enabled: params !== null && (options?.enabled !== false),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  })
}

