"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { createEditFormData } from "@/lib/interventions/form-types"
import { dbArtisanToNearbyArtisan } from "@/lib/interventions/form-utils"
import type { Intervention } from "@/lib/api/common/types"

type InterventionWithRelations = Intervention & {
  intervention_artisans?: any[]
  intervention_costs?: any[]
  intervention_payments?: any[]
}

interface UseInterventionRealtimeParams {
  intervention: InterventionWithRelations
  setFormData: (fn: (prev: any) => any) => void
  setSelectedArtisanId: (id: string | null) => void
  setSelectedSecondArtisanId: (id: string | null) => void
  setAssignedPrimaryArtisan: (data: any) => void
  setAssignedSecondaryArtisan: (data: any) => void
  /**
   * Éditions locales non sauvegardées. Quand `true`, on NE réinitialise PAS le
   * formulaire automatiquement (sinon les modifications en cours sont perdues) :
   * on expose `pendingUpdate` pour laisser l'utilisateur recharger quand il veut.
   */
  hasUnsavedChanges: boolean
}

export interface UseInterventionRealtimeResult {
  /** Une version serveur plus récente existe mais n'a pas été appliquée (form dirty). */
  pendingUpdate: boolean
  /** Applique la dernière version serveur au formulaire (écrase les éditions locales). */
  applyPendingUpdate: () => void
}

/**
 * Synchronise le formulaire quand `updated_at` change (modification distante via Realtime,
 * ou bump déclenché par une écriture enfant — commentaire, coût, paiement, statut).
 *
 * - Form vierge (non dirty) : réinitialise immédiatement depuis les nouvelles données.
 * - Form dirty : ne touche à rien, signale `pendingUpdate = true`. L'utilisateur applique
 *   manuellement via `applyPendingUpdate()`. Le fil de commentaires (query séparée) n'est
 *   pas concerné et continue de se rafraîchir en temps réel.
 */
export function useInterventionRealtime({
  intervention,
  setFormData,
  setSelectedArtisanId,
  setSelectedSecondArtisanId,
  setAssignedPrimaryArtisan,
  setAssignedSecondaryArtisan,
  hasUnsavedChanges,
}: UseInterventionRealtimeParams): UseInterventionRealtimeResult {
  const lastSyncedUpdatedAtRef = useRef(intervention.updated_at)
  const [pendingUpdate, setPendingUpdate] = useState(false)

  // Toujours pointer vers la dernière version serveur reçue, pour que
  // `applyPendingUpdate` (déclenché plus tard par un clic) ne travaille pas sur
  // une snapshot périmée.
  const latestInterventionRef = useRef(intervention)
  latestInterventionRef.current = intervention

  const resetFormFromIntervention = useCallback(
    (source: InterventionWithRelations) => {
      const freshCosts = source.intervention_costs || []
      const freshPayments = source.intervention_payments || []
      const freshArtisans = source.intervention_artisans || []
      const freshPrimaryArtisan = freshArtisans.find((a: any) => a.is_primary)?.artisans
      const freshSecondaryArtisan = freshArtisans.find((a: any) => !a.is_primary)?.artisans
      const freshSstCost = freshCosts.find((c: any) => c.cost_type === 'sst' && (c.artisan_order === 1 || c.artisan_order === undefined || c.artisan_order === null))
      const freshMaterielCost = freshCosts.find((c: any) => c.cost_type === 'materiel' && (c.artisan_order === 1 || c.artisan_order === undefined || c.artisan_order === null))
      const freshInterventionCost = freshCosts.find((c: any) => c.cost_type === 'intervention')
      const freshSstCostSecondArtisan = freshCosts.find((c: any) => c.cost_type === 'sst' && c.artisan_order === 2)
      const freshMaterielCostSecondArtisan = freshCosts.find((c: any) => c.cost_type === 'materiel' && c.artisan_order === 2)
      const freshSstPayment = freshPayments.find((p: any) => p.payment_type === 'acompte_sst')
      const freshClientPayment = freshPayments.find((p: any) => p.payment_type === 'acompte_client')

      const newFormData = createEditFormData(
        source,
        freshPrimaryArtisan,
        freshSecondaryArtisan,
        {
          sstCost: freshSstCost,
          materielCost: freshMaterielCost,
          interventionCost: freshInterventionCost,
          sstCostSecondArtisan: freshSstCostSecondArtisan,
          materielCostSecondArtisan: freshMaterielCostSecondArtisan,
        },
        { sstPayment: freshSstPayment, clientPayment: freshClientPayment }
      )
      setFormData(() => newFormData)

      setSelectedArtisanId(freshPrimaryArtisan?.id ?? null)
      setSelectedSecondArtisanId(freshSecondaryArtisan?.id ?? null)
      setAssignedPrimaryArtisan(dbArtisanToNearbyArtisan(freshPrimaryArtisan))
      setAssignedSecondaryArtisan(dbArtisanToNearbyArtisan(freshSecondaryArtisan))

      lastSyncedUpdatedAtRef.current = source.updated_at
    },
    [setFormData, setSelectedArtisanId, setSelectedSecondArtisanId, setAssignedPrimaryArtisan, setAssignedSecondaryArtisan]
  )

  const applyPendingUpdate = useCallback(() => {
    resetFormFromIntervention(latestInterventionRef.current)
    setPendingUpdate(false)
  }, [resetFormFromIntervention])

  useEffect(() => {
    if (lastSyncedUpdatedAtRef.current === intervention.updated_at) return

    // Form dirty : ne pas écraser les éditions en cours. On signale qu'une version
    // plus récente est disponible ; l'utilisateur décide quand recharger.
    if (hasUnsavedChanges) {
      setPendingUpdate(true)
      return
    }

    resetFormFromIntervention(intervention)
    setPendingUpdate(false)
    console.debug("[useInterventionRealtime] formData reset from updated_at change", intervention.updated_at)
  }, [intervention, hasUnsavedChanges, resetFormFromIntervention])

  return { pendingUpdate, applyPendingUpdate }
}
