"use client"

import { useCallback, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { comptaApi, type ArtisanPaymentRow } from "@/lib/api/comptaApi"
import { comptabiliteKeys } from "@/lib/react-query/queryKeys"
import type { PaymentStatus } from "@/lib/interventions/payment-status"

/**
 * Statuts de paiement des artisans pour la page Comptabilité (lot L6).
 *
 * Une requête par **page** d'interventions, pas une par ligne : la page en
 * affiche cent, et cent requêtes de plus à chaque changement de page seraient
 * payées par tout le monde pour une colonne.
 *
 * L'enregistrement passe par la route Next `PATCH …/artisans/{artisanId}/payment`
 * (permission `write_interventions` vérifiée côté serveur), jamais par un
 * `UPDATE` direct : `authenticated` a un `UPDATE USING(true)` sur
 * `intervention_artisans`, la garde ne peut donc pas venir de la base.
 */
export function useArtisanPaymentsQuery(interventionIds: string[], enabled: boolean = true) {
  const queryClient = useQueryClient()
  const [enCours, setEnCours] = useState<string | null>(null)

  const { data, isLoading, refetch } = useQuery({
    queryKey: comptabiliteKeys.paymentsByInterventions(interventionIds),
    enabled: enabled && interventionIds.length > 0,
    queryFn: () => comptaApi.getArtisanPayments(interventionIds),
    staleTime: 30_000,
  })

  const paiements = data ?? new Map<string, ArtisanPaymentRow[]>()

  const enregistrer = useCallback(
    async (
      interventionId: string,
      artisanId: string,
      payload: { payment_status: PaymentStatus; paid_at?: string | null },
    ): Promise<boolean> => {
      setEnCours(`${interventionId}:${artisanId}`)
      try {
        const result = await comptaApi.setArtisanPayment(interventionId, artisanId, payload)
        if (!result.ok) {
          toast.error(result.error ?? "Enregistrement du paiement impossible")
          return false
        }
        toast.success("Paiement mis à jour")
        // Ciblé : seule la clé des paiements bouge, la liste d'interventions
        // et les checks compta n'ont aucune raison d'être rechargés.
        await queryClient.invalidateQueries({ queryKey: comptabiliteKeys.payments() })
        await refetch()
        return true
      } catch (error) {
        console.error("[useArtisanPaymentsQuery] Enregistrement échoué :", error)
        toast.error("Enregistrement du paiement impossible")
        return false
      } finally {
        setEnCours(null)
      }
    },
    [queryClient, refetch],
  )

  return { paiements, isLoading, enCours, enregistrer }
}
