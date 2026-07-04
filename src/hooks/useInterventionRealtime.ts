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
   * Éditions locales non sauvegardées. Quand `true` ET qu'un vrai changement de champ
   * distant arrive, on NE réinitialise PAS le formulaire (sinon les modifications en cours
   * sont perdues) : on expose `pendingUpdate` pour laisser l'utilisateur recharger.
   */
  hasUnsavedChanges: boolean
}

export interface UseInterventionRealtimeResult {
  /** Un vrai changement de champ distant existe mais n'a pas été appliqué (form dirty). */
  pendingUpdate: boolean
  /** Applique la dernière version serveur au formulaire (écrase les éditions locales). */
  applyPendingUpdate: () => void
}

/** État-formulaire dérivé du serveur : ce que le form afficherait après un reset. */
interface ServerFormState {
  formData: any
  primaryArtisan: any
  secondaryArtisan: any
  primaryArtisanId: string | null
  secondaryArtisanId: string | null
}

function buildServerFormState(source: InterventionWithRelations): ServerFormState {
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

  const formData = createEditFormData(
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

  return {
    formData,
    primaryArtisan: freshPrimaryArtisan,
    secondaryArtisan: freshSecondaryArtisan,
    primaryArtisanId: freshPrimaryArtisan?.id ?? null,
    secondaryArtisanId: freshSecondaryArtisan?.id ?? null,
  }
}

/** Signature stable du contenu réellement affiché par le formulaire (hors métadonnées). */
function signatureOf(state: ServerFormState): string {
  return JSON.stringify({
    formData: state.formData,
    primaryArtisanId: state.primaryArtisanId,
    secondaryArtisanId: state.secondaryArtisanId,
  })
}

/**
 * Synchronise le formulaire quand les **données réellement affichées** changent côté serveur.
 *
 * La détection se fait sur le CONTENU (signature de l'état-formulaire dérivé), pas sur
 * `updated_at`. Un bump d'`updated_at` sans changement de champ — typiquement un commentaire
 * ajouté par un autre utilisateur (trigger 00082) — produit une signature identique et
 * n'entraîne donc AUCUN reset ni bannière.
 *
 * - Contenu identique : no-op (le fil de commentaires se rafraîchit via sa propre query).
 * - Contenu différent + form vierge : reset immédiat (sync collaborative transparente).
 * - Contenu différent + form dirty : on n'écrase pas ; `pendingUpdate = true` → bannière.
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
  const lastAppliedSignatureRef = useRef(signatureOf(buildServerFormState(intervention)))
  const [pendingUpdate, setPendingUpdate] = useState(false)

  const applyServerState = useCallback(
    (state: ServerFormState) => {
      setFormData(() => state.formData)
      setSelectedArtisanId(state.primaryArtisanId)
      setSelectedSecondArtisanId(state.secondaryArtisanId)
      setAssignedPrimaryArtisan(dbArtisanToNearbyArtisan(state.primaryArtisan))
      setAssignedSecondaryArtisan(dbArtisanToNearbyArtisan(state.secondaryArtisan))
      lastAppliedSignatureRef.current = signatureOf(state)
    },
    [setFormData, setSelectedArtisanId, setSelectedSecondArtisanId, setAssignedPrimaryArtisan, setAssignedSecondaryArtisan]
  )

  // Dernier état serveur connu, pour que `applyPendingUpdate` (clic différé) applique
  // toujours la version la plus récente et non une snapshot périmée.
  const latestServerStateRef = useRef<ServerFormState | null>(null)

  const applyPendingUpdate = useCallback(() => {
    if (latestServerStateRef.current) applyServerState(latestServerStateRef.current)
    setPendingUpdate(false)
  }, [applyServerState])

  useEffect(() => {
    const nextState = buildServerFormState(intervention)
    latestServerStateRef.current = nextState
    const nextSignature = signatureOf(nextState)

    // Rien de significatif n'a changé (ex : commentaire ajouté → seul updated_at a bougé).
    if (nextSignature === lastAppliedSignatureRef.current) return

    // Vrai changement de champ distant, mais le form est en cours d'édition : on ne l'écrase pas.
    if (hasUnsavedChanges) {
      setPendingUpdate(true)
      return
    }

    applyServerState(nextState)
    setPendingUpdate(false)
    console.debug("[useInterventionRealtime] formData reset from server content change")
  }, [intervention, hasUnsavedChanges, applyServerState])

  return { pendingUpdate, applyPendingUpdate }
}
