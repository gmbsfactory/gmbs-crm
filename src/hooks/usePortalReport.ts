"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { interventionKeys } from "@/lib/react-query/queryKeys"

/**
 * Rapport d'intervention envoyé par l'artisan depuis le portail
 * (contrat : docs/architecture/portail-demo-contrat-api.md, §3).
 */
export type PortalReportStatus = "submitted" | "approved" | "rejected"

export interface PortalReport {
  id: string
  status: PortalReportStatus
  version: number
  travaux_realises: string | null
  duree_minutes: number | null
  materiel_utilise: string | null
  reste_a_faire: boolean | null
  reste_a_faire_detail: string | null
  anomalies: string | null
  client_present: boolean | null
  submitted_at: string | null
  review_comment: string | null
  reviewed_at: string | null
  attachment_ids: string[] | null
}

export interface PortalReportPhoto {
  id: string
  url: string
  filename: string | null
  created_at?: string | null
  metadata?: {
    source?: string
    phase?: "avant" | "apres" | string
    comment?: string | null
  } | null
}

export interface PortalReportArtisan {
  id: string
  nom: string | null
  prenom: string | null
}

export interface PortalReportResponse {
  report: PortalReport | null
  photos: PortalReportPhoto[]
  artisan: PortalReportArtisan | null
}

export interface PortalReportReviewInput {
  decision: "approved" | "rejected"
  comment?: string
}

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string }
    return body?.error || fallback
  } catch {
    return fallback
  }
}

/** GET /api/interventions/{id}/portal-report */
export async function fetchPortalReport(interventionId: string): Promise<PortalReportResponse> {
  const response = await fetch(`/api/interventions/${interventionId}/portal-report`, {
    cache: "no-store",
  })
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Impossible de charger le rapport de l'artisan"))
  }
  const data = (await response.json()) as Partial<PortalReportResponse>
  return {
    report: data.report ?? null,
    photos: Array.isArray(data.photos) ? data.photos : [],
    artisan: data.artisan ?? null,
  }
}

/** POST /api/interventions/{id}/portal-report/review */
export async function reviewPortalReport(
  interventionId: string,
  input: PortalReportReviewInput,
): Promise<PortalReport> {
  const response = await fetch(`/api/interventions/${interventionId}/portal-report/review`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Impossible d'enregistrer la décision"))
  }
  const data = (await response.json()) as { report: PortalReport }
  return data.report
}

/**
 * Charge le rapport portail d'une intervention.
 * Désactivé tant que l'intervention n'a pas d'id.
 */
export function usePortalReportQuery(interventionId: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: interventionKeys.portalReport(interventionId ?? ""),
    queryFn: () => fetchPortalReport(interventionId as string),
    enabled: Boolean(interventionId) && enabled,
    staleTime: 30 * 1000,
  })
}

/**
 * Valide ou refuse le rapport. Après succès : invalide le rapport, les listes
 * d'interventions (le badge « À vérifier » dépend de has_portal_report) et le détail.
 * Ne change pas le statut de l'intervention.
 */
export function usePortalReportReviewMutation(interventionId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: PortalReportReviewInput) => reviewPortalReport(interventionId, input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: interventionKeys.portalReport(interventionId) }),
        queryClient.invalidateQueries({ queryKey: interventionKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: interventionKeys.lightLists() }),
        queryClient.invalidateQueries({ queryKey: interventionKeys.detail(interventionId) }),
      ])
    },
  })
}
