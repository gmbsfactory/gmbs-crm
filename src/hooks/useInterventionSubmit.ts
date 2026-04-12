"use client"

import { useCallback, useRef } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { useInterventionsMutations } from "@/hooks/useInterventionsMutations"
import { useInterventionModal } from "@/hooks/useInterventionModal"
import { commentsApi } from "@/lib/api/v2/commentsApi"
import { documentsApi } from "@/lib/api/v2/documentsApi"
import { interventionKeys } from "@/lib/react-query/queryKeys"
import { findOrCreateOwner, findOrCreateTenant } from "@/lib/interventions/owner-tenant-helpers"
import { runPostMutationTasks } from "@/lib/interventions/post-mutation-tasks"
import { extractErrorMessage } from "@/lib/toast-helpers"
import { getReasonTypeForTransition, type StatusReasonType } from "@/lib/comments/statusReason"
import type { UpdateInterventionData } from "@/lib/api/v2/common/types"

interface UseInterventionSubmitParams {
  interventionId: string
  formData: any
  currentUser: any
  selectedArtisanId: string | null
  selectedArtisanData: any
  selectedSecondArtisanId: string | null
  primaryArtisanId: string | null
  secondaryArtisanId: string | null
  canEditContext: boolean
  readOnly: boolean
  initialStatusCode: string
  showReferenceField: boolean

  // Validation flags
  requiresDefinitiveId: boolean
  requiresDatePrevue: boolean
  requiresArtisan: boolean
  requiresFacture: boolean
  requiresNomFacturation: boolean
  requiresAssignedUser: boolean
  requiresCouts: boolean
  requiresConsigneArtisan: boolean
  requiresClientInfo: boolean
  requiresAgence: boolean
  requiresMetier: boolean
  requiresDevis: boolean

  // Callbacks
  setIsSubmitting: (v: boolean) => void
  onSubmittingChange?: (v: boolean) => void
  onSuccess?: (data: any) => void
  clearDraft: () => void
  getInterventionStatusCode: (statusId?: string | null) => string
}

export function useInterventionSubmit({
  interventionId,
  formData,
  currentUser,
  selectedArtisanId,
  selectedArtisanData,
  selectedSecondArtisanId,
  primaryArtisanId,
  secondaryArtisanId,
  canEditContext,
  readOnly,
  initialStatusCode,
  showReferenceField,
  requiresDefinitiveId,
  requiresDatePrevue,
  requiresArtisan,
  requiresFacture,
  requiresNomFacturation,
  requiresAssignedUser,
  requiresCouts,
  requiresConsigneArtisan,
  requiresClientInfo,
  requiresAgence,
  requiresMetier,
  requiresDevis,
  setIsSubmitting,
  onSubmittingChange,
  onSuccess,
  clearDraft,
  getInterventionStatusCode,
}: UseInterventionSubmitParams) {
  const queryClient = useQueryClient()
  const { update: updateMutation } = useInterventionsMutations()
  const { open: openInterventionModal } = useInterventionModal()

  // Refs for tracking artisan changes
  const primaryArtisanIdRef = useRef<string | null>(primaryArtisanId)
  const secondaryArtisanIdRef = useRef<string | null>(secondaryArtisanId)

  // Keep refs in sync
  primaryArtisanIdRef.current = primaryArtisanId
  secondaryArtisanIdRef.current = secondaryArtisanId

  const executeSubmit = useCallback(async (options?: { reason?: string; reasonType?: StatusReasonType }) => {
    setIsSubmitting(true)
    onSubmittingChange?.(true)

    try {
      const referenceAgenceValue = formData.reference_agence?.trim() ?? ""
      const idInterValue = formData.id_inter?.trim() ?? ""

      // Trouver ou créer le propriétaire et le client
      let ownerId: string | null = null
      let tenantId: string | null = null

      try {
        ownerId = await findOrCreateOwner({
          nomPrenomFacturation: formData.nomPrenomFacturation,
          telephoneProprietaire: formData.telephoneProprietaire,
          emailProprietaire: formData.emailProprietaire,
        })
      } catch (error) {
        console.error("[useInterventionSubmit] Erreur lors de la gestion du propriétaire:", error)
        toast.error("Erreur lors de la sauvegarde du propriétaire")
      }

      // Ne créer/trouver le tenant que si le logement n'est pas vacant
      if (!formData.is_vacant) {
        try {
          tenantId = await findOrCreateTenant({
            nomPrenomClient: formData.nomPrenomClient,
            telephoneClient: formData.telephoneClient,
            emailClient: formData.emailClient,
          })
        } catch (error) {
          console.error("[useInterventionSubmit] Erreur lors de la gestion du client:", error)
          toast.error("Erreur lors de la sauvegarde du client")
        }
      } else {
        tenantId = null
      }

      const updateData: UpdateInterventionData = {
        statut_id: formData.statut_id || undefined,
        agence_id: formData.agence_id || undefined,
        reference_agence: referenceAgenceValue.length > 0 ? referenceAgenceValue : null,
        assigned_user_id: formData.assigned_user_id || undefined,
        metier_id: formData.metier_id || undefined,
        date: formData.date || undefined,
        date_prevue: formData.date_prevue || undefined,
        contexte_intervention: formData.contexte_intervention || undefined,
        consigne_intervention: formData.consigne_intervention || undefined,
        consigne_second_artisan: formData.consigne_second_artisan || undefined,
        commentaire_agent: formData.commentaire_agent || undefined,
        adresse: formData.adresse || undefined,
        code_postal: formData.code_postal || undefined,
        ville: formData.ville || undefined,
        adresse_complete: formData.adresse_complete || null,
        latitude: formData.latitude,
        longitude: formData.longitude,
        numero_sst: formData.numero_sst || undefined,
        pourcentage_sst: formData.pourcentage_sst ? parseFloat(formData.pourcentage_sst) : undefined,
        id_inter: idInterValue.length > 0 ? idInterValue : null,
        is_vacant: formData.is_vacant,
        key_code: formData.is_vacant ? (formData.key_code?.trim() || null) : null,
        floor: formData.is_vacant ? (formData.floor?.trim() || null) : null,
        apartment_number: formData.is_vacant ? (formData.apartment_number?.trim() || null) : null,
        vacant_housing_instructions: formData.is_vacant ? (formData.vacant_housing_instructions?.trim() || null) : null,
        owner_id: ownerId,
        tenant_id: tenantId,
        sous_statut_text: formData.sousStatutText?.trim() || null,
        sous_statut_text_color: formData.sousStatutTextColor || '#000000',
        sous_statut_bg_color: formData.sousStatutBgColor || 'transparent',
        metier_second_artisan_id: formData.metierSecondArtisanId || null,
      }

      if (!canEditContext) {
        delete updateData.contexte_intervention
      }

      Object.keys(updateData).forEach((key) => {
        if (updateData[key as keyof UpdateInterventionData] === undefined) {
          delete updateData[key as keyof UpdateInterventionData]
        }
      })

      // Fermer le modal immédiatement pour la fluidité UX
      clearDraft()
      onSuccess?.(null)
      setIsSubmitting(false)
      onSubmittingChange?.(false)

      const toastId = toast.loading("Enregistrement en cours...")

      try {
        await updateMutation.mutateAsync({
          id: interventionId,
          data: {
            id_inter: updateData.id_inter ?? null,
            reference_agence: updateData.reference_agence ?? null,
            agence_id: updateData.agence_id,
            assigned_user_id: updateData.assigned_user_id,
            statut_id: updateData.statut_id,
            metier_id: updateData.metier_id,
            date: updateData.date,
            date_prevue: updateData.date_prevue ?? undefined,
            contexte_intervention: updateData.contexte_intervention,
            consigne_intervention: updateData.consigne_intervention,
            consigne_second_artisan: updateData.consigne_second_artisan,
            commentaire_agent: updateData.commentaire_agent,
            adresse: updateData.adresse,
            code_postal: updateData.code_postal,
            ville: updateData.ville,
            adresse_complete: updateData.adresse_complete ?? null,
            latitude: updateData.latitude,
            longitude: updateData.longitude,
            numero_sst: updateData.numero_sst,
            pourcentage_sst: updateData.pourcentage_sst,
            is_vacant: updateData.is_vacant,
            key_code: updateData.key_code ?? null,
            floor: updateData.floor ?? null,
            apartment_number: updateData.apartment_number ?? null,
            vacant_housing_instructions: updateData.vacant_housing_instructions ?? null,
            owner_id: updateData.owner_id ?? null,
            tenant_id: updateData.tenant_id ?? null,
            sous_statut_text: updateData.sous_statut_text ?? null,
            sous_statut_text_color: updateData.sous_statut_text_color ?? '#000000',
            sous_statut_bg_color: updateData.sous_statut_bg_color ?? 'transparent',
            metier_second_artisan_id: updateData.metier_second_artisan_id ?? null,
          },
        })

        // Commentaire de raison de statut
        if (options?.reason && options.reasonType) {
          try {
            await commentsApi.create({
              entity_id: interventionId,
              entity_type: "intervention",
              content: options.reason,
              comment_type: "internal",
              is_internal: true,
              author_id: currentUser?.id ?? undefined,
              reason_type: options.reasonType,
            })
          } catch (commentError) {
            console.error("[useInterventionSubmit] Impossible d'ajouter le commentaire obligatoire", commentError)
          }
        }

        toast.success("Intervention modifiée avec succès", {
          id: toastId,
          action: {
            label: "Voir",
            onClick: () => openInterventionModal(interventionId),
          },
        })

        // Préparer les coûts pour le batch
        const coutSSTValue = parseFloat(formData.coutSST) || 0
        const coutMaterielValue = parseFloat(formData.coutMateriel) || 0
        const coutInterventionValue = parseFloat(formData.coutIntervention) || 0
        const coutSST2Value = parseFloat(formData.coutSSTSecondArtisan) || 0
        const coutMateriel2Value = parseFloat(formData.coutMaterielSecondArtisan) || 0

        const allCosts: Array<{ cost_type: 'sst' | 'materiel' | 'intervention' | 'marge'; amount: number; artisan_order?: 1 | 2 | null; label?: string | null }> = []

        if (coutSSTValue > 0) allCosts.push({ cost_type: "sst", label: "Coût SST", amount: coutSSTValue, artisan_order: 1 })
        if (coutMaterielValue > 0) allCosts.push({ cost_type: "materiel", label: "Coût Matériel", amount: coutMaterielValue, artisan_order: 1 })
        if (coutInterventionValue > 0) allCosts.push({ cost_type: "intervention", label: "Coût Intervention", amount: coutInterventionValue, artisan_order: null })

        if (selectedSecondArtisanId) {
          if (coutSST2Value > 0) allCosts.push({ cost_type: "sst", label: "Coût SST 2ème artisan", amount: coutSST2Value, artisan_order: 2 })
          if (coutMateriel2Value > 0) allCosts.push({ cost_type: "materiel", label: "Coût Matériel 2ème artisan", amount: coutMateriel2Value, artisan_order: 2 })
        }

        // Préparer les paiements
        const accompteSSTValue = parseFloat(formData.accompteSST) || 0
        const accompteClientValue = parseFloat(formData.accompteClient) || 0
        const payments: Array<{ payment_type: string; amount: number; currency?: string; is_received?: boolean; payment_date?: string | null }> = []

        if (accompteSSTValue > 0 || formData.accompteSSTRecu || formData.dateAccompteSSTRecu) {
          payments.push({ payment_type: 'acompte_sst', amount: accompteSSTValue, currency: 'EUR', is_received: formData.accompteSSTRecu || false, payment_date: formData.dateAccompteSSTRecu || null })
        }
        if (accompteClientValue > 0 || formData.accompteClientRecu || formData.dateAccompteClientRecu) {
          payments.push({ payment_type: 'acompte_client', amount: accompteClientValue, currency: 'EUR', is_received: formData.accompteClientRecu || false, payment_date: formData.dateAccompteClientRecu || null })
        }

        // Mettre à jour les refs de manière optimiste
        const currentPrimaryId = primaryArtisanIdRef.current
        const nextPrimaryId = selectedArtisanId ?? null
        const currentSecondaryId = secondaryArtisanIdRef.current
        const nextSecondaryId = selectedSecondArtisanId ?? null

        if (currentPrimaryId !== nextPrimaryId) primaryArtisanIdRef.current = nextPrimaryId
        if (currentSecondaryId !== nextSecondaryId) secondaryArtisanIdRef.current = nextSecondaryId

        // Mise à jour optimiste des coûts dans le cache detail
        if (allCosts.length > 0) {
          queryClient.setQueryData(
            interventionKeys.detail(interventionId),
            (old: any) => {
              if (!old) return old
              const updatedCosts = allCosts.map(c => ({
                ...((old.costs || old.intervention_costs || []).find(
                  (existing: any) => existing.cost_type === c.cost_type && (existing.artisan_order ?? null) === (c.artisan_order ?? null)
                ) || {}),
                cost_type: c.cost_type,
                amount: c.amount,
                label: c.label,
                artisan_order: c.artisan_order ?? null,
              }))
              const existingCosts = old.costs || old.intervention_costs || []
              const untouchedCosts = existingCosts.filter(
                (e: any) => !allCosts.some(c => c.cost_type === e.cost_type && (c.artisan_order ?? null) === (e.artisan_order ?? null))
              )
              const newCosts = [...updatedCosts, ...untouchedCosts]
              return {
                ...old,
                costs: newCosts,
                intervention_costs: newCosts,
                coutIntervention: allCosts.find(c => c.cost_type === 'intervention')?.amount ?? old.coutIntervention,
                coutSST: allCosts.filter(c => c.cost_type === 'sst').reduce((sum, c) => sum + c.amount, 0) || old.coutSST,
                coutMateriel: allCosts.filter(c => c.cost_type === 'materiel').reduce((sum, c) => sum + c.amount, 0) || old.coutMateriel,
              }
            }
          )
        }

        // Lancer coûts/paiements/artisans en arrière-plan (fire-and-forget)
        runPostMutationTasks({
          interventionId,
          artisans: {
            primary: { current: currentPrimaryId, next: nextPrimaryId },
            secondary: { current: currentSecondaryId, next: nextSecondaryId },
          },
          costs: allCosts.length > 0 ? allCosts : undefined,
          deleteSecondaryCosts: currentSecondaryId !== null && nextSecondaryId === null,
          payments: payments.length > 0 ? payments : undefined,
          queryClient,
          invalidateDashboard: allCosts.length > 0,
          invalidateComments: !!(options?.reason && options.reasonType),
        })
      } catch (apiError) {
        console.error("Erreur lors de la mise à jour:", apiError)
        const description = extractErrorMessage(apiError)
        toast.error("Erreur lors de la mise à jour de l'intervention", {
          id: toastId,
          duration: Infinity,
          description,
          action: {
            label: "Réessayer",
            onClick: () => openInterventionModal(interventionId),
          },
        })
      }

    } catch (error) {
      console.error("Erreur lors de la préparation:", error)
      const message = error instanceof Error ? error.message : "Erreur lors de la mise à jour de l'intervention"
      toast.error(message)
      setIsSubmitting(false)
      onSubmittingChange?.(false)
    }
  }, [
    interventionId, formData, currentUser, selectedArtisanId, selectedSecondArtisanId,
    canEditContext, setIsSubmitting, onSubmittingChange, onSuccess, clearDraft,
    updateMutation, openInterventionModal, queryClient,
  ])

  const handleSubmit = useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (readOnly) return

    const form = event.currentTarget
    if (!form.checkValidity()) {
      form.reportValidity()
      return
    }

    const idInterValue = formData.id_inter?.trim() ?? ""
    if (requiresDefinitiveId && (idInterValue.length === 0 || idInterValue.toLowerCase().includes("auto"))) {
      form.reportValidity()
      return
    }

    const datePrevueValue = formData.date_prevue?.trim() ?? ""
    if (requiresDatePrevue && datePrevueValue.length === 0) {
      form.reportValidity()
      return
    }

    if (requiresAgence && !formData.agence_id) {
      toast.error("L'agence est obligatoire pour ce statut")
      return
    }

    if (showReferenceField && !formData.reference_agence?.trim()) {
      toast.error("La référence agence est obligatoire pour cette agence")
      return
    }

    if (requiresMetier && !formData.metier_id) {
      toast.error("Le métier est obligatoire pour ce statut")
      return
    }

    if (requiresNomFacturation && !formData.nomPrenomFacturation?.trim()) {
      toast.error("Le nom/prénom de facturation (propriétaire) est obligatoire pour passer à Devis envoyé")
      return
    }

    if (requiresAssignedUser && !formData.assigned_user_id) {
      toast.error("L'intervention doit être assignée à un gestionnaire pour passer à Devis envoyé")
      return
    }

    if (requiresCouts) {
      const coutInterValue = parseFloat(formData.coutIntervention) || 0
      const coutSSTValue = parseFloat(formData.coutSST) || 0

      if (coutInterValue <= 0) {
        toast.error("Le coût d'intervention doit être renseigné pour passer en cours")
        return
      }
      if (coutSSTValue <= 0) {
        toast.error("Le coût SST doit être renseigné pour passer en cours")
        return
      }
    }

    if (requiresConsigneArtisan && !formData.consigne_intervention?.trim()) {
      toast.error("La consigne pour l'artisan doit être renseignée pour passer en cours")
      return
    }

    if (requiresClientInfo && !formData.is_vacant) {
      if (!formData.nomPrenomClient?.trim()) {
        toast.error("Le nom/prénom du client doit être renseigné pour passer en cours")
        return
      }
      if (!formData.telephoneClient?.trim()) {
        toast.error("Le téléphone du client doit être renseigné pour passer en cours")
        return
      }
    }

    if (requiresDevis) {
      try {
        const docs = await documentsApi.getAll({
          entity_id: interventionId,
          entity_type: "intervention",
          kind: "devis"
        })

        if (!docs.data || docs.data.length === 0) {
          toast.error("Un document devis est obligatoire pour ce statut")
          return
        }
      } catch (error) {
        console.error("Erreur lors de la vérification du devis:", error)
        toast.error("Erreur lors de la vérification des documents obligatoires")
        return
      }
    }

    const nextStatusCode = getInterventionStatusCode(formData.statut_id)
    const ARTISAN_REQUIRED_STATUSES = ["VISITE_TECHNIQUE", "INTER_EN_COURS", "INTER_TERMINEE"]

    if (ARTISAN_REQUIRED_STATUSES.includes(nextStatusCode) && (!selectedArtisanId || !selectedArtisanData)) {
      toast.error(`Un artisan est obligatoire pour passer au statut ${nextStatusCode}`)
      return
    }

    if (nextStatusCode === "INTER_TERMINEE") {
      try {
        const docs = await documentsApi.getAll({
          entity_id: interventionId,
          entity_type: "intervention",
          kind: "facturesGMBS"
        })

        if (!docs.data || docs.data.length === 0) {
          toast.error("La facture GMBS est obligatoire pour passer au statut terminé")
          return
        }
      } catch (error) {
        console.error("Erreur lors de la vérification des documents:", error)
        toast.error("Erreur lors de la vérification des documents obligatoires")
        return
      }
    }

    const reasonType = getReasonTypeForTransition(initialStatusCode, nextStatusCode)

    if (reasonType) {
      return { pendingReasonType: reasonType }
    }

    await executeSubmit()
    return null
  }, [
    readOnly, formData, interventionId, initialStatusCode, showReferenceField,
    selectedArtisanId, selectedArtisanData, executeSubmit, getInterventionStatusCode,
    requiresDefinitiveId, requiresDatePrevue, requiresAgence, requiresMetier,
    requiresNomFacturation, requiresAssignedUser, requiresCouts, requiresConsigneArtisan,
    requiresClientInfo, requiresDevis,
  ])

  return {
    executeSubmit,
    handleSubmit,
  }
}
