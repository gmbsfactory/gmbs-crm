"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { interventionKeys } from "@/lib/react-query/queryKeys"

/**
 * Rapport d'intervention envoyé par l'artisan depuis le portail
 * (contrat : docs/architecture/portail-demo-contrat-api.md, §3).
 */
export type PortalReportStatus = "submitted" | "approved" | "rejected" | "superseded"

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
  /** Copie de `intervention_artisans.work_started_at` à l'envoi (durée réelle). */
  started_at?: string | null
  superseded_at?: string | null
  superseded_by?: string | null
}

/** Un rapport de `reports[]` : le même objet, avec son artisan résolu. */
export interface PortalReportEntry extends PortalReport {
  artisan: PortalReportArtisan | null
  artisan_id: string | null
}

/** Réponse de l'artisan au prix proposé, telle que projetée par l'API. */
export interface PortalAssignmentPrice {
  response: "accepted" | "refused" | null
  responded_at: string | null
  accepted_amount: number | null
  source: "portal" | "crm" | null
  refused_reason: string | null
  /** Le coût SST courant diffère du montant gelé au moment du oui. */
  drift: boolean
}

export type PortalPaymentState = "not_applicable" | "awaiting_invoice" | "in_progress" | "paid"

/** État d'un artisan affecté : prix, démarrage du chantier, paiement. */
export interface PortalAssignment {
  artisan: PortalReportArtisan | null
  artisan_id: string | null
  is_primary: boolean
  cout_sst: number | null
  price: PortalAssignmentPrice
  work: { started_at: string | null; from: "portal" | "crm" | null }
  payment: { state: PortalPaymentState; paid_at: string | null }
  report_ids: string[]
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
  /** Sélection par défaut (`pickPortalReport`) — conservée pour rétro-compat. */
  report: PortalReport | null
  photos: PortalReportPhoto[]
  artisan: PortalReportArtisan | null
  /** Tous les rapports, tous artisans et toutes versions, déjà triés. */
  reports: PortalReportEntry[]
  /** Photos par version ; les orphelines sous la clé `_hors_rapport`. */
  photosByReport: Record<string, string[]>
  /** Un élément par artisan affecté (les sept états du panneau). */
  assignments: PortalAssignment[]
}

/**
 * Clé de `photosByReport` regroupant les photos rattachées à aucune version.
 * Ré-exportée depuis le module partagé avec la route API : une seule définition
 * pour les deux côtés du contrat.
 */
export { PHOTOS_HORS_RAPPORT } from "@/lib/interventions/portal-report-view"

export interface PortalReportReviewInput {
  decision: "approved" | "rejected"
  comment?: string
  /** Rapport visé : obligatoire dès qu'il y en a plusieurs. */
  reportId?: string
  /** Ramène une intervention INTER_TERMINEE en INTER_EN_COURS. */
  reopenIntervention?: boolean
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
    reports: Array.isArray(data.reports) ? data.reports : [],
    photosByReport: data.photosByReport ?? {},
    assignments: Array.isArray(data.assignments) ? data.assignments : [],
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
    body: JSON.stringify({
      decision: input.decision,
      ...(input.comment ? { comment: input.comment } : {}),
      ...(input.reportId ? { report_id: input.reportId } : {}),
      ...(input.reopenIntervention ? { reopen_intervention: true } : {}),
    }),
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
    // Temps reel : le canal portail-live invalide cette cle des qu'une photo
    // ou un rapport arrive, donc aucune fraicheur a conserver en cache.
    staleTime: 0,
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
