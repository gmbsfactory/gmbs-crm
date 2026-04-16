"use client"

import { useCallback, useMemo, useRef } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { useInterventionModal } from "@/hooks/useInterventionModal"
import { useModal } from "@/hooks/useModal"
import { useCurrentUser } from "@/hooks/useCurrentUser"
import { interventionKeys } from "@/lib/react-query/queryKeys"
import { interventionsApi } from "@/lib/api/interventionsApi"
import type { InterventionWithStatus, PaginatedResponse } from "@/lib/api/common/types"
import type { InterventionStatusValue } from "@/types/interventions"
import type { ContextMenuViewType } from "@/types/context-menu"
import { getUserDisplayName } from "@/utils/user-display-name"

/** Cache shape for intervention detail query (interventionKeys.detail) */
type InterventionDetailCache = InterventionWithStatus | undefined
/** Cache shape for intervention list queries (interventionKeys.lists / lightLists) */
type InterventionListCache = PaginatedResponse<InterventionWithStatus> & { count?: number }
/** Detail/list item may include relation payloads from API (owner, tenants, intervention_artisans, etc.) */
type InterventionWithRelations = InterventionWithStatus & {
  owner?: unknown
  tenants?: unknown
  intervention_artisans?: unknown
  intervention_costs?: Array<{ cost_type?: string; amount?: number }>
  intervention_payments?: Array<{ payment_type?: string; amount?: number; is_received?: boolean; payment_date?: string | null }>
  numero_sst?: string | null
  pourcentage_sst?: number | null
}

// Client-side wrapper: calls the API route instead of importing server-only transitionStatus
async function transitionStatusViaApi(
  interventionId: string,
  payload: { status: InterventionStatusValue; dueAt?: Date | string | null; artisanId?: string | null }
) {
  const response = await fetch(`/api/interventions/${interventionId}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Erreur lors du changement de statut' }))
    throw new Error(error.message || 'Erreur lors du changement de statut')
  }
  return response.json()
}

// Type pour le callback d'animation
export type AssignToMeAnimationCallback = (
  interventionId: string,
  onAnimationComplete: () => void
) => void

export function useInterventionContextMenu(
  interventionId: string,
  viewType?: ContextMenuViewType,
  idInter?: string,
  onAssignToMeWithAnimation?: AssignToMeAnimationCallback
) {
  const queryClient = useQueryClient()
  
  // Utiliser le hook centralisé useCurrentUser au lieu d'un fetch direct
  const { data: currentUserData } = useCurrentUser()
  const currentUserInfo = useMemo(() => {
    if (!currentUserData) return null
    return {
      id: currentUserData.id,
      name: getUserDisplayName(currentUserData),
      code: currentUserData.code_gestionnaire ?? null,
      color: currentUserData.color ?? null,
    }
  }, [currentUserData])
  // const { toast } = useToast() // Removed legacy toast
  const { open: openInterventionModal } = useInterventionModal()
  const modal = useModal()
  const cancelListQueries = useCallback(async () => {
    await queryClient.cancelQueries({ queryKey: interventionKeys.invalidateLists() })
    await queryClient.cancelQueries({ queryKey: interventionKeys.invalidateLightLists() })
  }, [queryClient])
  const invalidateLists = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: interventionKeys.invalidateLists() })
    queryClient.invalidateQueries({ queryKey: interventionKeys.invalidateLightLists() })
    queryClient.invalidateQueries({ queryKey: interventionKeys.invalidateFilterCounts() })
  }, [queryClient])

  // Fonction pour ouvrir le modal avec les données pré-remplies (devis supp)
  const duplicateDevisSupp = useCallback(async () => {

    // Récupérer les données de l'intervention depuis le cache ou les charger
    let interventionData = queryClient.getQueryData(interventionKeys.detail(interventionId)) as InterventionDetailCache

    // Si les données ne sont pas en cache, essayer de les charger depuis les listes
    if (!interventionData) {
      // Chercher dans les listes d'interventions en cache
      const listsQueries = queryClient.getQueriesData({ queryKey: interventionKeys.lists() })
      for (const [, queryData] of listsQueries) {
        const data = queryData as InterventionListCache | undefined
        if (data?.data && Array.isArray(data.data)) {
          const found = data.data.find((item) => item.id === interventionId)
          if (found) {
            interventionData = found
            break
          }
        }
      }
    }

    if (!interventionData) {
      console.warn("[useInterventionContextMenu] Données non disponibles")
      toast.error("Erreur", {
        description: "Impossible de récupérer les données de l'intervention. Veuillez ouvrir l'intervention d'abord.",
      })
      return
    }

    // Mapper les données vers le format attendu par le formulaire
    // Les données peuvent être dans différents formats selon la source (cache, API, etc.)
    const data = interventionData as InterventionWithRelations
    const owner = Array.isArray(data.owner) ? data.owner[0] : data.owner
    const tenant = Array.isArray(data.tenants) ? data.tenants[0] : data.tenants
    type ArtisanRow = { is_primary?: boolean; artisan_id?: string; artisans?: unknown }
    const artisans: ArtisanRow[] = Array.isArray(data.intervention_artisans)
      ? (data.intervention_artisans as ArtisanRow[])
      : data.intervention_artisans
        ? [data.intervention_artisans as ArtisanRow]
        : []
    // Récupérer l'artisan principal (comme dans InterventionEditForm)
    const primaryArtisan = (artisans.find((ia) => ia.is_primary)?.artisans || artisans[0]?.artisans) as Record<string, unknown> | undefined
    const primaryArtisanId = artisans.find((ia) => ia.is_primary)?.artisan_id || artisans[0]?.artisan_id || null

    const defaultValues = {
      agence_id: interventionData.agence_id || "",
      reference_agence: interventionData.reference_agence || "",
      assigned_user_id: interventionData.assigned_user_id || "",
      metier_id: interventionData.metier_id || "",
      adresse: interventionData.adresse || "",
      code_postal: interventionData.code_postal || "",
      ville: interventionData.ville || "",
      latitude: interventionData.latitude || 48.8566,
      longitude: interventionData.longitude || 2.3522,
      datePrevue: interventionData.date_prevue
        ? (typeof interventionData.date_prevue === 'string' && interventionData.date_prevue.includes('T'))
          ? interventionData.date_prevue.split('T')[0]
          : interventionData.date_prevue
        : "",
      // Propriétaire - Champ fusionné nom-prénom
      nomPrenomFacturation: owner?.plain_nom_facturation || 
        `${owner?.owner_lastname || ''} ${owner?.owner_firstname || ''}`.trim() || "",
      telephoneProprietaire: owner?.telephone || "",
      emailProprietaire: owner?.email || "",
      // Client/Tenant - Champ fusionné nom-prénom
      nomPrenomClient: tenant?.plain_nom_client || 
        `${tenant?.lastname || ''} ${tenant?.firstname || ''}`.trim() || "",
      telephoneClient: tenant?.telephone || "",
      emailClient: tenant?.email || "",
      // Artisan principal - utiliser le nom complet comme dans InterventionEditForm
      artisan: primaryArtisan
        ? `${String(primaryArtisan.prenom ?? '')} ${String(primaryArtisan.nom ?? '')}`.trim()
        : "",
      artisanTelephone: String(primaryArtisan?.telephone ?? "") || "",
      artisanEmail: String(primaryArtisan?.email ?? "") || "",
      // Coûts — remis à zéro pour un devis supplémentaire (nouveau chiffrage)
      coutIntervention: "",
      coutSST: "",
      coutMateriel: "",
      numero_sst: data.numero_sst || "",
      pourcentage_sst: data.pourcentage_sst ?? undefined,
      // Acomptes — remis à zéro pour un devis supplémentaire
      accompteSST: "",
      accompteSSTRecu: false,
      dateAccompteSSTRecu: "",
      accompteClient: "",
      accompteClientRecu: false,
      dateAccompteClientRecu: "",
      commentairesIntervention: `devis supp avec l'ancien ID ${interventionData.id_inter || interventionId}`,
      // Consigne second artisan
      consigneSecondArtisan: interventionData.consigne_second_artisan || "",
      // ID de l'artisan pour l'assignation après création
      artisanId: primaryArtisanId || "",
    }

    // Ouvrir le modal "new-intervention" avec le contexte

    try {
      modal.open("new", {
        content: "new-intervention",
        context: {
          duplicateFrom: interventionId,
          defaultValues,
        },
      })
    } catch (error) {
      console.error("[useInterventionContextMenu] Erreur lors de l'ouverture du modal:", error)
      toast.error("Erreur", {
        description: "Impossible d'ouvrir le formulaire de création.",
      })
    }
  }, [interventionId, queryClient, modal])

  // Ref pour stocker les données de la liste avant suppression (pour rollback)
  const previousListsDataRef = useRef<Map<string, unknown>>(new Map())

  // Mutation pour assigner l'intervention à l'utilisateur connecté ("Je gère")
  const assignToMeMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/interventions/${interventionId}/assign`, {
        method: "POST",
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Erreur lors de l'assignation")
      }
      return await response.json()
    },
    onMutate: async () => {
      // Annuler les requêtes en cours pour éviter les conflits
      await queryClient.cancelQueries({ queryKey: interventionKeys.detail(interventionId) })
      await cancelListQueries()

      // Snapshot de la valeur précédente pour rollback en cas d'erreur
      const previousIntervention = queryClient.getQueryData(interventionKeys.detail(interventionId))

      // Sauvegarder les données des listes avant modification pour rollback
      previousListsDataRef.current.clear()
      const listsQueries = queryClient.getQueriesData({ queryKey: interventionKeys.lists() })
      listsQueries.forEach(([key, data]) => {
        previousListsDataRef.current.set(JSON.stringify(key), data)
      })
      const lightListsQueries = queryClient.getQueriesData({ queryKey: interventionKeys.lightLists() })
      lightListsQueries.forEach(([key, data]) => {
        previousListsDataRef.current.set(JSON.stringify(key), data)
      })

      // Mise à jour optimiste : RETIRER l'intervention de la vue Market
      // et METTRE À JOUR ses propriétés dans les autres vues
      if (currentUserInfo) {
        // Pour les listes complètes
        queryClient.setQueriesData(
          { queryKey: interventionKeys.lists() },
          (oldData: InterventionListCache | undefined) => {
            if (!oldData?.data || !Array.isArray(oldData.data)) {
              return oldData
            }
            
            // Vérifier si c'est une vue Market (filtre user === null)
            // On détecte ça par la présence d'interventions sans assigned_user_id
            const isMarketView = oldData.data.some((i) =>
              i.id === interventionId && !i.assigned_user_id
            )
            
            if (isMarketView) {
              // Vue Market : RETIRER l'intervention car elle a maintenant un propriétaire
              const filteredData = oldData.data.filter(
                (intervention) => intervention.id !== interventionId
              )
              return { 
                ...oldData, 
                data: filteredData,
                // Mettre à jour le count si présent
                count: typeof oldData.count === 'number' ? Math.max(0, oldData.count - 1) : oldData.count
              }
            } else {
              // Autres vues : METTRE À JOUR les propriétés de l'intervention
              const updatedData = oldData.data.map((intervention) =>
                intervention.id === interventionId
                  ? {
                    ...intervention,
                    assigned_user_id: currentUserInfo!.id,
                    assignedUserCode: currentUserInfo!.code,
                    assignedUserName: currentUserInfo!.name,
                    assignedUserColor: currentUserInfo!.color,
                    attribueA: currentUserInfo!.code,
                  }
                  : intervention
              )
              return { ...oldData, data: updatedData }
            }
          }
        )

        // Pour les listes légères
        queryClient.setQueriesData(
          { queryKey: interventionKeys.lightLists() },
          (oldData: InterventionListCache | undefined) => {
            if (!oldData?.data || !Array.isArray(oldData.data)) {
              return oldData
            }
            
            const isMarketView = oldData.data.some((i) =>
              i.id === interventionId && !i.assigned_user_id
            )
            
            if (isMarketView) {
              const filteredData = oldData.data.filter(
                (intervention) => intervention.id !== interventionId
              )
              return { 
                ...oldData, 
                data: filteredData,
                count: typeof oldData.count === 'number' ? Math.max(0, oldData.count - 1) : oldData.count
              }
            } else {
              const updatedData = oldData.data.map((intervention) =>
                intervention.id === interventionId
                  ? {
                    ...intervention,
                    assigned_user_id: currentUserInfo!.id,
                    assignedUserCode: currentUserInfo!.code,
                    assignedUserName: currentUserInfo!.name,
                    assignedUserColor: currentUserInfo!.color,
                    attribueA: currentUserInfo!.code,
                  }
                  : intervention
              )
              return { ...oldData, data: updatedData }
            }
          }
        )
      }

      return { previousIntervention, currentUserInfo }
    },
    onError: (error: Error, _variables, context) => {
      // Rollback en cas d'erreur - restaurer les données des listes
      if (context?.previousIntervention) {
        queryClient.setQueryData(interventionKeys.detail(interventionId), context.previousIntervention)
      }
      
      // Restaurer les données des listes depuis la sauvegarde
      previousListsDataRef.current.forEach((data, keyStr) => {
        const key = JSON.parse(keyStr)
        queryClient.setQueryData(key, data)
      })
      
      invalidateLists()
      queryClient.invalidateQueries({ queryKey: interventionKeys.detail(interventionId) })

      toast.error("Erreur d'assignation", {
        description: error.message || "Une erreur est survenue lors de l'assignation.",
      })
    },
    onSuccess: (data) => {
      // Invalider les queries en arrière-plan pour récupérer les données complètes du serveur
      // La mise à jour optimiste dans onMutate assure une mise à jour immédiate de l'UI
      invalidateLists()
      queryClient.invalidateQueries({ queryKey: interventionKeys.detail(interventionId) })
      // Les summaries seront invalidés après l'animation (si animation active)
      // Sinon on les invalide maintenant
      queryClient.invalidateQueries({ queryKey: interventionKeys.summaries() })

      toast.success(`Intervention (${idInter || (data as Record<string, unknown>).id_inter || interventionId}) assignée à moi avec succès`, {
        description: new Date().toLocaleString(),
        action: {
          label: "Voir",
          onClick: () => openInterventionModal(interventionId),
        },
      })
    },
  })

  // Fonction wrapper pour déclencher l'animation avant la mutation
  const assignToMeWithAnimation = useCallback(() => {
    if (onAssignToMeWithAnimation) {
      // Déclencher l'animation, puis exécuter la mutation quand elle est terminée
      onAssignToMeWithAnimation(interventionId, () => {
        assignToMeMutation.mutate()
      })
    } else {
      // Pas d'animation, exécuter directement
      assignToMeMutation.mutate()
    }
  }, [interventionId, onAssignToMeWithAnimation, assignToMeMutation])

  // Shared optimistic transition logic (DRY for DEVIS_ENVOYE / ACCEPTE / future statuses)
  type TransitionTarget = { code: InterventionStatusValue; label: string; color: string }

  const applyOptimisticTransition = useCallback(async (target: TransitionTarget) => {
    await queryClient.cancelQueries({ queryKey: interventionKeys.detail(interventionId) })
    await cancelListQueries()

    const previousIntervention = queryClient.getQueryData(interventionKeys.detail(interventionId))

    queryClient.setQueryData(interventionKeys.detail(interventionId), (old: InterventionDetailCache) => {
      if (!old) return old
      return { ...old, status: target.code, statusValue: target.code }
    })

    const optimisticStatus = { code: target.code, label: target.label, color: target.color }
    const updateList = (oldData: InterventionListCache | undefined) => {
      if (!oldData?.data || !Array.isArray(oldData.data)) return oldData
      const updatedData = oldData.data.map((intervention) =>
        intervention.id === interventionId
          ? { ...intervention, statusValue: target.code, status: optimisticStatus, statut: target.code }
          : intervention,
      )
      return { ...oldData, data: updatedData }
    }
    queryClient.setQueriesData({ queryKey: interventionKeys.lists() }, updateList)
    queryClient.setQueriesData({ queryKey: interventionKeys.lightLists() }, updateList)

    return { previousIntervention }
  }, [queryClient, interventionId, cancelListQueries])

  const onTransitionError = useCallback((error: Error, context: { previousIntervention?: unknown } | undefined) => {
    if (context?.previousIntervention) {
      queryClient.setQueryData(interventionKeys.detail(interventionId), context.previousIntervention)
    }
    invalidateLists()
    queryClient.invalidateQueries({ queryKey: interventionKeys.detail(interventionId) })
    toast.error("Erreur de transition", {
      description: error.message || "Une erreur est survenue lors du changement de statut.",
    })
  }, [queryClient, interventionId, invalidateLists])

  const onTransitionSuccess = useCallback((data: unknown, label: string) => {
    invalidateLists()
    queryClient.invalidateQueries({ queryKey: interventionKeys.detail(interventionId) })
    queryClient.invalidateQueries({ queryKey: interventionKeys.summaries() })
    toast.success(`Intervention (${idInter || (data as Record<string, unknown>).id_inter || interventionId}) modifiée vers ${label} avec succès`, {
      description: new Date().toLocaleString(),
      action: { label: "Voir", onClick: () => openInterventionModal(interventionId) },
    })
  }, [queryClient, interventionId, idInter, invalidateLists, openInterventionModal])

  const DEVIS_ENVOYE_TARGET: TransitionTarget = { code: "DEVIS_ENVOYE", label: "Devis Envoyé", color: "#8B5CF6" }
  const ACCEPTE_TARGET: TransitionTarget = { code: "ACCEPTE", label: "Accepté", color: "#10B981" }

  const transitionToDevisEnvoyeMutation = useMutation({
    mutationFn: () => transitionStatusViaApi(interventionId, { status: "DEVIS_ENVOYE" }),
    onMutate: () => applyOptimisticTransition(DEVIS_ENVOYE_TARGET),
    onError: (error: Error, _v, ctx) => onTransitionError(error, ctx),
    onSuccess: (data) => onTransitionSuccess(data, DEVIS_ENVOYE_TARGET.label),
  })

  const transitionToAccepteMutation = useMutation({
    mutationFn: () => transitionStatusViaApi(interventionId, { status: "ACCEPTE" }),
    onMutate: () => applyOptimisticTransition(ACCEPTE_TARGET),
    onError: (error: Error, _v, ctx) => onTransitionError(error, ctx),
    onSuccess: (data) => onTransitionSuccess(data, ACCEPTE_TARGET.label),
  })

  // Mutation pour supprimer une intervention
  const deleteInterventionMutation = useMutation({
    mutationFn: async () => {
      return await interventionsApi.delete(interventionId)
    },
    onSuccess: () => {
      // Invalider toutes les listes d'interventions
      invalidateLists()
      // Invalider les résumés
      queryClient.invalidateQueries({ queryKey: interventionKeys.summaries() })
      // Invalider le détail de l'intervention supprimée
      queryClient.invalidateQueries({ queryKey: interventionKeys.detail(interventionId) })

      toast.success("Intervention supprimée avec succès")
    },
    onError: (error: Error) => {
      toast.error("Erreur lors de la suppression de l'intervention", {
        description: error.message || "Une erreur est survenue lors de la suppression.",
      })
    },
  })

  return {
    duplicateDevisSupp,
    assignToMe: assignToMeWithAnimation, // Utilise l'animation si disponible
    assignToMeDirect: assignToMeMutation.mutate, // Version sans animation
    transitionToDevisEnvoye: transitionToDevisEnvoyeMutation.mutate,
    transitionToAccepte: transitionToAccepteMutation.mutate,
    deleteIntervention: deleteInterventionMutation.mutate,
    isLoading: {
      duplicate: false, // Plus de mutation, donc toujours false
      assign: assignToMeMutation.isPending,
      transitionDevisEnvoye: transitionToDevisEnvoyeMutation.isPending,
      transitionAccepte: transitionToAccepteMutation.isPending,
      delete: deleteInterventionMutation.isPending,
    },
    viewType,
    interventionId, // Exposé pour l'animation
  }
}
