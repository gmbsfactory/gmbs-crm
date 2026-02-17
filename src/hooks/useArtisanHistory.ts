"use client"

import { useInfiniteQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase-client"

export interface ArtisanHistoryItem {
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

type ArtisanHistoryPage = {
  items: ArtisanHistoryItem[]
  nextOffset: number
}

type UseArtisanHistoryOptions = {
  limit?: number
  enabled?: boolean
}

export function useArtisanHistory(
  artisanId: string | null | undefined,
  options: UseArtisanHistoryOptions = {}
) {
  const limit = options.limit ?? 50

  return useInfiniteQuery({
    queryKey: ["artisan-history", artisanId, limit] as const,
    initialPageParam: 0 as number,
    enabled: Boolean(artisanId) && options.enabled !== false,
    queryFn: async ({ pageParam }): Promise<ArtisanHistoryPage> => {
      if (!artisanId) {
        return { items: [], nextOffset: 0 }
      }

      const { data, error } = await supabase.rpc("get_artisan_history", {
        p_artisan_id: artisanId,
        p_limit: limit,
        p_offset: pageParam as number,
      })

      if (error) {
        throw error
      }

      const items = (data ?? []) as ArtisanHistoryItem[]
      return { items, nextOffset: (pageParam as number) + items.length }
    },
    getNextPageParam: (lastPage: ArtisanHistoryPage) =>
      lastPage.items.length < limit ? undefined : lastPage.nextOffset,
  })
}
