"use client"

import { useEffect, useRef } from "react"
import { createEditFormData } from "@/lib/interventions/form-types"
import { dbArtisanToNearbyArtisan } from "@/lib/interventions/form-utils"
import type { Intervention } from "@/lib/api/common/types"

interface UseInterventionRealtimeParams {
  intervention: Intervention & { intervention_artisans?: any[]; intervention_costs?: any[]; intervention_payments?: any[] }
  setFormData: (fn: (prev: any) => any) => void
  setSelectedArtisanId: (id: string | null) => void
  setSelectedSecondArtisanId: (id: string | null) => void
  setAssignedPrimaryArtisan: (data: any) => void
  setAssignedSecondaryArtisan: (data: any) => void
}

/**
 * Synchronise le formulaire quand updated_at change (modification distante via Realtime).
 * Réinitialise entièrement le formData + artisans sélectionnés depuis les nouvelles données.
 */
export function useInterventionRealtime({
  intervention,
  setFormData,
  setSelectedArtisanId,
  setSelectedSecondArtisanId,
  setAssignedPrimaryArtisan,
  setAssignedSecondaryArtisan,
}: UseInterventionRealtimeParams) {
  const lastSyncedUpdatedAtRef = useRef(intervention.updated_at)

  useEffect(() => {
    if (lastSyncedUpdatedAtRef.current === intervention.updated_at) return

    lastSyncedUpdatedAtRef.current = intervention.updated_at

    const freshCosts = intervention.intervention_costs || []
    const freshPayments = intervention.intervention_payments || []
    const freshArtisans = intervention.intervention_artisans || []
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
      intervention,
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

    console.debug("[useInterventionRealtime] formData reset from updated_at change", intervention.updated_at)
  }, [intervention, setFormData, setSelectedArtisanId, setSelectedSecondArtisanId, setAssignedPrimaryArtisan, setAssignedSecondaryArtisan])
}
