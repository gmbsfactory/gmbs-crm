"use client"

import { useCallback, useMemo, useRef } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { useInterventionModal } from "@/hooks/useInterventionModal"
import { useModal } from "@/hooks/useModal"
import { useCurrentUser } from "@/hooks/useCurrentUser"
import { interventionKeys } from "@/lib/react-query/queryKeys"
import { interventionsApi } from "@/lib/api/v2/interventionsApi"
import type { InterventionStatusValue } from "@/types/interventions"
import type { ContextMenuViewType } from "@/types/context-menu"

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
    const first = currentUserData.firstname ?? currentUserData.prenom ?? ""
    const last = currentUserData.lastname ?? currentUserData.nom ?? ""
    const displayName = [first, last].filter(Boolean).join(" ").trim() || currentUserData.username || currentUserData.email || "Vous"
    return {
      id: currentUserData.id,
      name: displayName,
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
  }, [queryClient])

  // Fonction pour ouvrir le modal avec les données pré-remplies (devis supp)
  const duplicateDevisSupp = useCallback(async () => {

    // Récupérer les données de l'intervention depuis le cache ou les charger
    let interventionData = queryClient.getQueryData(interventionKeys.detail(interventionId)) as InterventionCacheItem | undefined

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

    // Mapper les données vers le format attendu par LegacyInterventionForm
    // Exclure: id_inter, contexte_intervention, consigne_intervention
    // Les données peuvent être dans différents formats selon la source (cache, API, etc.)
    const owner = Array.isArray(interventionData.owner) ? interventionData.owner[0] : interventionData.owner
    const tenant = Array.isArray(interventionData.tenants) ? interventionData.tenants[0] : interventionData.tenants
    const artisans = Array.isArray(interventionData.intervention_artisans)
      ? interventionData.intervention_artisans
      : interventionData.intervention_artisans || []
    const costs = Array.isArray(interventionData.intervention_costs)
      ? interventionData.intervention_costs
      : interventionData.intervention_costs || []
    const payments = Array.isArray(interventionData.intervention_payments)
      ? interventionData.intervention_payments
      : interventionData.intervention_payments || []

    // Récupérer l'artisan principal (comme dans InterventionEditForm)
    const primaryArtisan = artisans.find((ia) => ia.is_primary)?.artisans || artisans[0]?.artisans
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
        ? `${primaryArtisan.prenom || ''} ${primaryArtisan.nom || ''}`.trim()
        : "",
      artisanTelephone: primaryArtisan?.telephone || "",
      artisanEmail: primaryArtisan?.email || "",
      // Coûts
      coutIntervention: costs.find((c) => c.cost_type === "intervention")?.amount?.toString() || "",
      coutSST: costs.find((c) => c.cost_type === "sst")?.amount?.toString() || "",
      coutMateriel: costs.find((c) => c.cost_type === "materiel")?.amount?.toString() || "",
      numero_sst: interventionData.numero_sst || "",
      pourcentage_sst: interventionData.pourcentage_sst || undefined,
      // Acomptes
      accompteSST: payments.find((p) => p.payment_type === "acompte_sst")?.amount?.toString() || "",
      accompteSSTRecu: payments.find((p) => p.payment_type === "acompte_sst")?.is_received || false,
      dateAccompteSSTRecu: (() => {
        const d = payments.find((p) => p.payment_type === "acompte_sst")?.payment_date
        if (!d) return ""
        return typeof d === 'string' && d.includes('T') ? d.split('T')[0] : d
      })(),
      accompteClient: payments.find((p) => p.payment_type === "acompte_client")?.amount?.toString() || "",
      accompteClientRecu: payments.find((p) => p.payment_type === "acompte_client")?.is_received || false,
      dateAccompteClientRecu: (() => {
        const d = payments.find((p) => p.payment_type === "acompte_client")?.payment_date
        if (!d) return ""
        return typeof d === 'string' && d.includes('T') ? d.split('T')[0] : d
      })(),
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

  // Mutation pour transition vers "Devis envoyé"
  const transitionToDevisEnvoyeMutation = useMutation({
    mutationFn: async () => {
      return await transitionStatusViaApi(interventionId, {
        status: "DEVIS_ENVOYE",
      })
    },
    onMutate: async () => {
      // Annuler les requêtes en cours pour éviter les conflits
      await queryClient.cancelQueries({ queryKey: interventionKeys.detail(interventionId) })
      await cancelListQueries()

      // Snapshot de la valeur précédente pour rollback en cas d'erreur
      const previousIntervention = queryClient.getQueryData(interventionKeys.detail(interventionId))

      // Mise à jour optimiste du détail
      queryClient.setQueryData(interventionKeys.detail(interventionId), (old: InterventionCacheItem | undefined) => {
        if (!old) return old
        return {
          ...old,
          status: "DEVIS_ENVOYE",
          statusValue: "DEVIS_ENVOYE",
        }
      })

      // Mise à jour optimiste immédiate dans toutes les listes (complètes et légères)
      // Utiliser les préfixes séparément pour matcher toutes les queries
      // Mettre à jour l'objet status complet avec le label formaté pour l'affichage
      const devisEnvoyeStatus = {
        code: "DEVIS_ENVOYE",
        label: "Devis Envoyé", // Correspond exactement au label en BDD (seed_essential.sql ligne 115)
        color: "#8B5CF6", // Couleur depuis la BDD (seed_essential.sql ligne 115) et status-colors.ts
      }
      queryClient.setQueriesData(
        { queryKey: interventionKeys.lists() },
        (oldData: InterventionListCache | undefined) => {
          if (!oldData?.data || !Array.isArray(oldData.data)) {
            return oldData
          }
          const updatedData = oldData.data.map((intervention) =>
            intervention.id === interventionId
              ? {
                ...intervention,
                statusValue: "DEVIS_ENVOYE",
                status: devisEnvoyeStatus,
                statut: "DEVIS_ENVOYE", // Pour compatibilité
              }
              : intervention
          )
          return { ...oldData, data: updatedData }
        }
      )
      queryClient.setQueriesData(
        { queryKey: interventionKeys.lightLists() },
        (oldData: InterventionListCache | undefined) => {
          if (!oldData?.data || !Array.isArray(oldData.data)) {
            return oldData
          }
          const updatedData = oldData.data.map((intervention) =>
            intervention.id === interventionId
              ? {
                ...intervention,
                statusValue: "DEVIS_ENVOYE",
                status: devisEnvoyeStatus,
                statut: "DEVIS_ENVOYE", // Pour compatibilité
              }
              : intervention
          )
          return { ...oldData, data: updatedData }
        }
      )

      return { previousIntervention }
    },
    onError: (error: Error, _variables, context) => {
      // Rollback en cas d'erreur
      if (context?.previousIntervention) {
        queryClient.setQueryData(interventionKeys.detail(interventionId), context.previousIntervention)
      }
      invalidateLists()
      queryClient.invalidateQueries({ queryKey: interventionKeys.detail(interventionId) })

      toast.error("Erreur de transition", {
        description: error.message || "Une erreur est survenue lors du changement de statut.",
      })
    },
    onSuccess: (data) => {
      // Invalider les queries en arrière-plan pour récupérer les données complètes du serveur
      // La mise à jour optimiste dans onMutate assure une mise à jour immédiate de l'UI
      invalidateLists()
      queryClient.invalidateQueries({ queryKey: interventionKeys.detail(interventionId) })
      queryClient.invalidateQueries({ queryKey: interventionKeys.summaries() })

      toast.success(`Intervention (${idInter || (data as Record<string, unknown>).id_inter || interventionId}) modifiée vers Devis Envoyé avec succès`, {
        description: new Date().toLocaleString(),
        action: {
          label: "Voir",
          onClick: () => openInterventionModal(interventionId),
        },
      })
    },
  })

  // Mutation pour transition vers "Accepté"
  const transitionToAccepteMutation = useMutation({
    mutationFn: async () => {
      return await transitionStatusViaApi(interventionId, {
        status: "ACCEPTE",
      })
    },
    onMutate: async () => {
      // Annuler les requêtes en cours pour éviter les conflits
      await queryClient.cancelQueries({ queryKey: interventionKeys.detail(interventionId) })
      await cancelListQueries()

      // Snapshot de la valeur précédente pour rollback en cas d'erreur
      const previousIntervention = queryClient.getQueryData(interventionKeys.detail(interventionId))

      // Mise à jour optimiste du détail
      queryClient.setQueryData(interventionKeys.detail(interventionId), (old: InterventionCacheItem | undefined) => {
        if (!old) return old
        return {
          ...old,
          status: "ACCEPTE",
          statusValue: "ACCEPTE",
        }
      })

      // Mise à jour optimiste immédiate dans toutes les listes (complètes et légères)
      // Utiliser les préfixes séparément pour matcher toutes les queries
      // Mettre à jour l'objet status complet avec le label formaté pour l'affichage
      const accepteStatus = {
        code: "ACCEPTE",
        label: "Accepté",
        color: "#10B981", // Couleur depuis INTERVENTION_STATUS.ACCEPTE
      }
      queryClient.setQueriesData(
        { queryKey: interventionKeys.lists() },
        (oldData: InterventionListCache | undefined) => {
          if (!oldData?.data || !Array.isArray(oldData.data)) {
            return oldData
          }
          const updatedData = oldData.data.map((intervention) =>
            intervention.id === interventionId
              ? {
                ...intervention,
                statusValue: "ACCEPTE",
                status: accepteStatus,
                statut: "ACCEPTE", // Pour compatibilité
              }
              : intervention
          )
          return { ...oldData, data: updatedData }
        }
      )
      queryClient.setQueriesData(
        { queryKey: interventionKeys.lightLists() },
        (oldData: InterventionListCache | undefined) => {
          if (!oldData?.data || !Array.isArray(oldData.data)) {
            return oldData
          }
          const updatedData = oldData.data.map((intervention) =>
            intervention.id === interventionId
              ? {
                ...intervention,
                statusValue: "ACCEPTE",
                status: accepteStatus,
                statut: "ACCEPTE", // Pour compatibilité
              }
              : intervention
          )
          return { ...oldData, data: updatedData }
        }
      )

      return { previousIntervention }
    },
    onError: (error: Error, _variables, context) => {
      // Rollback en cas d'erreur
      if (context?.previousIntervention) {
        queryClient.setQueryData(interventionKeys.detail(interventionId), context.previousIntervention)
      }
      invalidateLists()
      queryClient.invalidateQueries({ queryKey: interventionKeys.detail(interventionId) })

      toast.error("Erreur de transition", {
        description: error.message || "Une erreur est survenue lors du changement de statut.",
      })
    },
    onSuccess: (data) => {
      // Invalider les queries en arrière-plan pour récupérer les données complètes du serveur
      // La mise à jour optimiste dans onMutate assure une mise à jour immédiate de l'UI
      invalidateLists()
      queryClient.invalidateQueries({ queryKey: interventionKeys.detail(interventionId) })
      queryClient.invalidateQueries({ queryKey: interventionKeys.summaries() })

      toast.success(`Intervention (${idInter || (data as Record<string, unknown>).id_inter || interventionId}) modifiée vers Accepté avec succès`, {
        description: new Date().toLocaleString(),
        action: {
          label: "Voir",
          onClick: () => openInterventionModal(interventionId),
        },
      })
    },
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
