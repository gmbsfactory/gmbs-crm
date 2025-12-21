"use client"

import { useInfiniteQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase-client"

export interface InterventionHistoryItem {
  id: string
  action_type: string
  action_label: string | null
  actor_display: string | null
  actor_code: string | null
  actor_color: string | null
  occurred_at: string
  old_values: Record<string, unknown> | null
  new_values: Record<string, unknown> | null
  changed_fields: string[] | null
  related_entity_type: string | null
  related_entity_id: string | null
  source: string | null
  metadata: Record<string, unknown> | null
}

type InterventionHistoryPage = {
  items: InterventionHistoryItem[]
  nextOffset: number
}

type UseInterventionHistoryOptions = {
  limit?: number
  enabled?: boolean
}

export function useInterventionHistory(
  interventionId: string | null | undefined,
  options: UseInterventionHistoryOptions = {}
) {
  const limit = options.limit ?? 50

  return useInfiniteQuery({
    queryKey: ["intervention-history", interventionId, limit] as const,
    initialPageParam: 0 as number,
    enabled: Boolean(interventionId) && options.enabled !== false,
    queryFn: async ({ pageParam }): Promise<InterventionHistoryPage> => {
      if (!interventionId) {
        return { items: [], nextOffset: 0 }
      }

      const { data, error } = await supabase.rpc("get_intervention_history", {
        p_intervention_id: interventionId,
        p_limit: limit,
        p_offset: pageParam as number,
      })

      if (error) {
        throw error
      }

      const items = (data ?? []) as InterventionHistoryItem[]
      return { items, nextOffset: (pageParam as number) + items.length }
    },
    getNextPageParam: (lastPage: InterventionHistoryPage) =>
      lastPage.items.length < limit ? undefined : lastPage.nextOffset,
  })
}
