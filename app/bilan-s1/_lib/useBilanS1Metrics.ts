"use client"

import { useQuery } from "@tanstack/react-query"
import { bilanS1Keys } from "@/lib/react-query/queryKeys"
import type { BilanMetrics } from "@/types/bilan-s1"

/**
 * Métriques live du bilan S1 (route dev-only /api/bilan-s1/metrics).
 * Poll toutes les 60 s — même cadence que le dashboard standalone de la
 * réunion ; le serveur mutualise derrière un cache court.
 */
export function useBilanS1Metrics(enabled: boolean) {
  return useQuery<BilanMetrics>({
    queryKey: bilanS1Keys.metrics(),
    queryFn: async () => {
      const res = await fetch("/api/bilan-s1/metrics", { cache: "no-store" })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(body?.error || `HTTP ${res.status}`)
      }
      return (await res.json()) as BilanMetrics
    },
    enabled,
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    retry: 1,
  })
}
