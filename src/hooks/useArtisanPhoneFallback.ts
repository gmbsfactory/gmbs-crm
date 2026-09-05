"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { interventionKeys } from "@/lib/react-query/queryKeys"

/**
 * Replis gestionnaire « au téléphone » d'une affectation artisan (spec §4.3).
 *
 * Deux gestes, deux routes, un même besoin : une partie du réseau n'a pas de
 * smartphone, et le gestionnaire doit pouvoir enregistrer ce que l'artisan lui
 * dit de vive voix. Sans eux, une intervention confiée à un artisan hors
 * application reste bloquée avant le démarrage de chantier — c'est le constat 7
 * de la recette, où les routes existaient mais qu'aucun écran n'appelait.
 *
 * Les deux écritures sont horodatées et tracées au journal, avec
 * `source = 'crm'` et l'identité du gestionnaire.
 */

export type PriceByPhoneResponse = "accepted" | "refused"

export interface PriceByPhoneInput {
  artisanId: string
  response: PriceByPhoneResponse
  /** Montant que le gestionnaire a sous les yeux — verrou optimiste (§4.2). */
  amountSeen: number
  reason?: string | null
}

export interface StartByPhoneInput {
  artisanId: string
  /** Date déclarée par l'artisan ; absente, c'est l'instant de la saisie. */
  startedAt?: string | null
}

/** Messages d'erreur métier, en français, à partir du code renvoyé par l'API. */
const MESSAGES: Record<string, string> = {
  status_not_allowed: "Le statut de l'intervention ne permet pas ce geste.",
  price_changed: "Le coût SST a changé depuis l'affichage — rechargez avant d'enregistrer.",
  price_unavailable: "Aucun coût SST n'est posé pour cet artisan.",
  price_already_answered: "Une réponse a déjà été enregistrée pour cet artisan.",
  price_not_accepted: "L'artisan n'a pas encore accepté le prix.",
}

async function readError(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string }
    const code = body?.error
    if (!code) return fallback
    return MESSAGES[code] ?? code
  } catch {
    return fallback
  }
}

async function patch(url: string, body: unknown, fallback: string): Promise<unknown> {
  const response = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error(await readError(response, fallback))
  return response.json()
}

/**
 * Invalidations communes aux deux gestes : le panneau « Rapport » (les sept
 * états), les listes (badges « Démarré · n champs manquants ») et le détail.
 */
function useInvalidateAssignment(interventionId: string) {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: interventionKeys.portalReport(interventionId) }),
      queryClient.invalidateQueries({ queryKey: interventionKeys.lists() }),
      queryClient.invalidateQueries({ queryKey: interventionKeys.lightLists() }),
      queryClient.invalidateQueries({ queryKey: interventionKeys.detail(interventionId) }),
    ])
}

/** PATCH /api/interventions/{id}/artisans/{artisanId}/price */
export function usePriceByPhoneMutation(interventionId: string) {
  const invalidate = useInvalidateAssignment(interventionId)
  return useMutation({
    mutationFn: (input: PriceByPhoneInput) =>
      patch(
        `/api/interventions/${interventionId}/artisans/${input.artisanId}/price`,
        {
          response: input.response,
          amount_seen: input.amountSeen,
          ...(input.reason ? { reason: input.reason } : {}),
        },
        "Impossible d'enregistrer la réponse au prix",
      ),
    onSuccess: () => invalidate(),
  })
}

/** PATCH /api/interventions/{id}/artisans/{artisanId}/start */
export function useStartByPhoneMutation(interventionId: string) {
  const invalidate = useInvalidateAssignment(interventionId)
  return useMutation({
    mutationFn: (input: StartByPhoneInput) =>
      patch(
        `/api/interventions/${interventionId}/artisans/${input.artisanId}/start`,
        input.startedAt ? { started_at: input.startedAt } : {},
        "Impossible d'enregistrer le démarrage du chantier",
      ),
    onSuccess: () => invalidate(),
  })
}
