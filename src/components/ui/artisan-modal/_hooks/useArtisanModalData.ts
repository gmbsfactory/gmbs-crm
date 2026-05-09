"use client"

import { useQuery } from "@tanstack/react-query"
import { artisansApi, interventionsApi } from "@/lib/api"
import { artisanKeys, interventionKeys } from "@/lib/react-query/queryKeys"

export function useArtisanModalData(artisanId: string) {
  const {
    data: artisan,
    isLoading,
    error,
    refetch: refetchArtisan,
  } = useQuery({
    queryKey: artisanKeys.detail(artisanId),
    enabled: Boolean(artisanId),
    queryFn: () => artisansApi.getById(artisanId),
  })

  const { data: interventionsResponse } = useQuery({
    queryKey: interventionKeys.byArtisan(artisanId),
    enabled: Boolean(artisanId),
    queryFn: () => interventionsApi.getByArtisan(artisanId, { limit: 5000 }),
  })

  const artisanInterventions = interventionsResponse?.data ?? []

  return {
    artisan,
    isLoading,
    error,
    refetchArtisan,
    artisanInterventions,
  }
}
