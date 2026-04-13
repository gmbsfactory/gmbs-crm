// ===== HOOK POUR LES ABSENCES ARTISANS =====
// Charge les absences en cours pour une liste d'artisan IDs

import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/api/common/client"

/**
 * Retourne un Set d'artisan IDs actuellement absents parmi les IDs fournis.
 * Utilise React Query pour le cache et la dedup.
 */
export function useArtisanAbsences(artisanIds: string[]): Set<string> {
  // Tri pour stabiliser la query key
  const sortedIds = useMemo(() => [...artisanIds].sort(), [artisanIds])

  const { data } = useQuery({
    queryKey: ["artisan-absences", sortedIds],
    queryFn: async () => {
      if (sortedIds.length === 0) return [] as string[]

      const nowIso = new Date().toISOString()
      const { data, error } = await supabase
        .from("artisan_absences")
        .select("artisan_id")
        .in("artisan_id", sortedIds)
        .lte("start_date", nowIso)
        .gte("end_date", nowIso)

      if (error) {
        console.warn("[useArtisanAbsences] Erreur:", error)
        return [] as string[]
      }

      return (data ?? []).map((row: { artisan_id: string }) => row.artisan_id).filter(Boolean)
    },
    enabled: sortedIds.length > 0,
    staleTime: 2 * 60 * 1000, // 2 minutes
  })

  return useMemo(() => new Set(data ?? []), [data])
}
