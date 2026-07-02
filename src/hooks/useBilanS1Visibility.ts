"use client"

import { useQuery } from "@tanstack/react-query"
import { bilanS1Keys } from "@/lib/react-query/queryKeys"
import type { PageVisibilityConfig } from "@/lib/bilan-s1/visibility-core"

export type BilanS1Visibility = {
  canView: boolean
  isDev: boolean
  /** Configuration complète — renvoyée uniquement aux devs. */
  config?: PageVisibilityConfig
}

/**
 * Visibilité de la page Bilan S1 pour l'utilisateur courant.
 * Consommé par la sidebar (affichage de l'entrée), le gate de la page et le
 * panneau de visibilité. Repollé toutes les 60 s : une ouverture (ou une
 * expiration) se propage d'elle-même sans F5.
 */
export function useBilanS1Visibility() {
  return useQuery<BilanS1Visibility>({
    queryKey: bilanS1Keys.visibility(),
    queryFn: async () => {
      const res = await fetch("/api/bilan-s1/visibility", { cache: "no-store" })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return (await res.json()) as BilanS1Visibility
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    retry: false,
  })
}
