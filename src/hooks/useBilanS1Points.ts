"use client"

import { useEffect } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase-client"
import { bilanS1Keys } from "@/lib/react-query/queryKeys"
import type { BilanPoint } from "@/types/bilan-s1"

/**
 * Points à traiter en réunion (écran 3 de /bilan-s1).
 *
 * TEMPS RÉEL : abonnement Postgres Changes sur bilan_point_replies (INSERT)
 * et bilan_points (UPDATE de statut) — les réponses et décisions des
 * participants autorisés apparaissent en live pendant la réunion, sans F5.
 * Le poll de 60 s reste en filet de sécurité si le canal décroche.
 */
export function useBilanS1Points(enabled: boolean) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!enabled) return

    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: bilanS1Keys.points() })
    }
    const channel = supabase
      .channel("bilan-s1-points")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "bilan_point_replies" }, invalidate)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "bilan_points" }, invalidate)
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [enabled, queryClient])

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

/** Envoie une réponse (texte libre ou décision) ; le point passe en « Répondu ». */
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
