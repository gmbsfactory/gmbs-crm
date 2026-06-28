"use client"

import { useInfiniteQuery } from "@tanstack/react-query"
import { monitoringApi } from "@/lib/api/monitoring"
import type { ActivityEntityType } from "@/types/monitoring"

const PAGE_SIZE = 100

export interface UseGlobalActivityFeedArgs {
  startDate: Date
  endDate: Date
  userIds?: string[] | null
  actionTypes?: string[] | null
  entityTypes?: ActivityEntityType[] | null
  enabled?: boolean
}

/**
 * Flux global des actions du CRM (interventions + artisans) sur une période,
 * avec filtres et pagination « charger plus ». Réservé au Monitoring DEV.
 */
export function useGlobalActivityFeed(args: UseGlobalActivityFeedArgs) {
  const { startDate, endDate, userIds, actionTypes, entityTypes, enabled = true } = args

  const startIso = startDate.toISOString()
  const endIso = endDate.toISOString()

  return useInfiniteQuery({
    queryKey: [
      "global-activity-feed",
      startIso,
      endIso,
      userIds ?? null,
      actionTypes ?? null,
      entityTypes ?? null,
    ],
    queryFn: ({ pageParam }: { pageParam: number }) =>
      monitoringApi.getGlobalActivityFeed({
        startDate,
        endDate,
        userIds,
        actionTypes,
        entityTypes,
        limit: PAGE_SIZE,
        offset: pageParam,
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((n, p) => n + p.items.length, 0)
      return loaded < lastPage.total ? loaded : undefined
    },
    enabled,
    staleTime: 60_000,
  })
}
