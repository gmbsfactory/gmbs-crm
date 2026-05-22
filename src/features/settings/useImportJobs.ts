"use client"

import { useEffect } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase-client"
import { importJobKeys } from "@/lib/react-query/queryKeys"
import type { ImportJobRow } from "@/lib/api/interventions/import-jobs"

/**
 * Historique des imports de l'utilisateur courant. Combine un fetch TanStack
 * Query (`GET /jobs`) avec un abonnement Realtime sur la table : tout
 * changement (nouveau job, progression, fin) invalide la liste pour la
 * rafraîchir. Permet de retrouver un import en cours après réouverture de
 * l'onglet (le worker, lui, a continué côté serveur).
 */
export function useImportJobs(opts: { enabled?: boolean; limit?: number } = {}) {
  const { enabled = true, limit = 20 } = opts
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: importJobKeys.list(),
    enabled,
    queryFn: async (): Promise<ImportJobRow[]> => {
      const res = await fetch(`/api/imports/interventions/jobs?limit=${limit}`)
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? `Erreur HTTP ${res.status}`)
      }
      const json = await res.json()
      return (json.jobs ?? []) as ImportJobRow[]
    },
  })

  useEffect(() => {
    if (!enabled) return
    const channel = supabase
      .channel('import-jobs-list-rt')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'intervention_import_jobs' },
        () => {
          queryClient.invalidateQueries({ queryKey: importJobKeys.list() })
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [enabled, queryClient])

  return query
}
