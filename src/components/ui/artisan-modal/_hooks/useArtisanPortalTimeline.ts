"use client"

import { useQuery } from "@tanstack/react-query"
import { artisanKeys } from "@/lib/react-query/queryKeys"
import type { ArtisanTimelineEvent } from "@/lib/artisans/portal-timeline"

/**
 * Journal des actions d'un artisan (`GET /api/artisans/{id}/timeline`, lot L6).
 *
 * La requête n'est lancée qu'à l'ouverture de la carte (`enabled`) : la frise
 * est une lecture de curiosité, pas une donnée de la fiche. La charger à chaque
 * ouverture de modal ajouterait deux requêtes par artisan consulté.
 */
export function useArtisanPortalTimeline(artisanId: string, enabled: boolean = true, limit: number = 50) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: artisanKeys.timeline(artisanId),
    enabled: Boolean(artisanId) && enabled,
    queryFn: async (): Promise<ArtisanTimelineEvent[]> => {
      const response = await fetch(`/api/artisans/${artisanId}/timeline?limit=${limit}`)
      const json = (await response.json().catch(() => null)) as
        | { events?: ArtisanTimelineEvent[]; error?: string }
        | null
      if (!response.ok) throw new Error(json?.error ?? "Journal indisponible")
      return json?.events ?? []
    },
  })

  return { events: data ?? [], isLoading, error: error as Error | null, refetch }
}
