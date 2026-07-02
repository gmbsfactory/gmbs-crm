"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { bilanS1Keys } from "@/lib/react-query/queryKeys"
import type { BilanPoint } from "@/types/bilan-s1"

/**
 * Points à traiter en réunion (écran 3). Poll 60 s : les réponses des autres
 * participants apparaissent sans F5 pendant la réunion.
 */
export function useBilanS1Points(enabled: boolean) {
  return useQuery<BilanPoint[]>({
    queryKey: bilanS1Keys.points(),
    queryFn: async () => {
      const res = await fetch("/api/bilan-s1/points", { cache: "no-store" })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(body?.error || `HTTP ${res.status}`)
      }
      const payload = (await res.json()) as { points: BilanPoint[] }
      return payload.points
    },
    enabled,
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    retry: 1,
  })
}

/** Envoie une réponse à un point ; le point passe en « Répondu ». */
export function useReplyToBilanPoint() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ pointId, body }: { pointId: string; body: string }) => {
      const res = await fetch(`/api/bilan-s1/points/${pointId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      })
      const payload = (await res.json().catch(() => null)) as { error?: string } | null
      if (!res.ok) throw new Error(payload?.error || `HTTP ${res.status}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bilanS1Keys.points() })
    },
  })
}
