"use client"

import { useCallback } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { useInterventionModal } from "@/hooks/useInterventionModal"
import { useModal } from "@/hooks/useModal"
import { interventionKeys } from "@/lib/react-query/queryKeys"
import { transitionStatus } from "@/lib/api/interventions"
import { supabase } from "@/lib/supabase-client"
import type { InterventionStatusValue } from "@/types/interventions"
import type { ContextMenuViewType } from "@/types/context-menu"

export function useInterventionContextMenu(interventionId: string, viewType?: ContextMenuViewType, idInter?: string) {
  const queryClient = useQueryClient()
  // const { toast } = useToast() // Removed legacy toast
  const { open: openInterventionModal } = useInterventionModal()
  const modal = useModal()

  // Fonction pour ouvrir le modal avec les données pré-remplies (devis supp)
  const duplicateDevisSupp = useCallback(async () => {
    console.log("[useInterventionContextMenu] duplicateDevisSupp appelé pour interventionId:", interventionId)

    // Récupérer les données de l'intervention depuis le cache ou les charger
    let interventionData = queryClient.getQueryData(interventionKeys.detail(interventionId)) as any

    console.log("[useInterventionContextMenu] Données récupérées du cache:", interventionData ? "OK" : "NULL")

    // Si les données ne sont pas en cache, essayer de les charger depuis les listes
    if (!interventionData) {
      console.log("[useInterventionContextMenu] Tentative de récupération depuis les listes...")
      // Chercher dans les listes d'interventions en cache
      const listsQueries = queryClient.getQueriesData({ queryKey: interventionKeys.lists() })
      for (const [, queryData] of listsQueries) {
        const data = queryData as any
        if (data?.data && Array.isArray(data.data)) {
          const found = data.data.find((item: any) => item.id === interventionId)
          if (found) {
            interventionData = found
            console.log("[useInterventionContextMenu] Données trouvées dans les listes")
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
    const primaryArtisan = artisans.find((ia: any) => ia.is_primary)?.artisans || artisans[0]?.artisans
    const primaryArtisanId = artisans.find((ia: any) => ia.is_primary)?.artisan_id || artisans[0]?.artisan_id || null

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
      // Propriétaire
      nomProprietaire: owner?.owner_lastname || "",
      prenomProprietaire: owner?.owner_firstname || "",
      telephoneProprietaire: owner?.telephone || "",
      emailProprietaire: owner?.email || "",
      // Client/Tenant
      nomClient: tenant?.lastname || "",
      prenomClient: tenant?.firstname || "",
      telephoneClient: tenant?.telephone || "",
      emailClient: tenant?.email || "",
      // Artisan principal - utiliser le nom complet comme dans InterventionEditForm
      artisan: primaryArtisan
        ? `${primaryArtisan.prenom || ''} ${primaryArtisan.nom || ''}`.trim()
        : "",
      artisanTelephone: primaryArtisan?.telephone || "",
      artisanEmail: primaryArtisan?.email || "",
      // Coûts
      coutIntervention: costs.find((c: any) => c.cost_type === "intervention")?.amount?.toString() || "",
      coutSST: costs.find((c: any) => c.cost_type === "sst")?.amount?.toString() || "",
      coutMateriel: costs.find((c: any) => c.cost_type === "materiel")?.amount?.toString() || "",
      numero_sst: interventionData.numero_sst || "",
      pourcentage_sst: interventionData.pourcentage_sst || undefined,
      // Acomptes
      accompteSST: payments.find((p: any) => p.payment_type === "acompte_sst")?.amount?.toString() || "",
      accompteSSTRecu: payments.find((p: any) => p.payment_type === "acompte_sst")?.is_received || false,
      dateAccompteSSTRecu: payments.find((p: any) => p.payment_type === "acompte_sst")?.payment_date
        ? (typeof payments.find((p: any) => p.payment_type === "acompte_sst")?.payment_date === 'string' &&
          payments.find((p: any) => p.payment_type === "acompte_sst")?.payment_date.includes('T'))
          ? payments.find((p: any) => p.payment_type === "acompte_sst")?.payment_date.split('T')[0]
          : payments.find((p: any) => p.payment_type === "acompte_sst")?.payment_date
        : "",
      accompteClient: payments.find((p: any) => p.payment_type === "acompte_client")?.amount?.toString() || "",
      accompteClientRecu: payments.find((p: any) => p.payment_type === "acompte_client")?.is_received || false,
      dateAccompteClientRecu: payments.find((p: any) => p.payment_type === "acompte_client")?.payment_date
        ? (typeof payments.find((p: any) => p.payment_type === "acompte_client")?.payment_date === 'string' &&
          payments.find((p: any) => p.payment_type === "acompte_client")?.payment_date.includes('T'))
          ? payments.find((p: any) => p.payment_type === "acompte_client")?.payment_date.split('T')[0]
          : payments.find((p: any) => p.payment_type === "acompte_client")?.payment_date
        : "",
      commentairesIntervention: `devis supp avec l'ancien ID ${interventionData.id_inter || interventionId}`,
      // Consigne second artisan
      consigneSecondArtisan: interventionData.consigne_second_artisan || "",
      // ID de l'artisan pour l'assignation après création
      artisanId: primaryArtisanId || "",
    }

    // Ouvrir le modal "new-intervention" avec le contexte
    console.log("[useInterventionContextMenu] Ouverture du modal avec context:", {
      duplicateFrom: interventionId,
      hasDefaultValues: !!defaultValues,
    })

    try {
      modal.open("new", {
        content: "new-intervention",
        context: {
          duplicateFrom: interventionId,
          defaultValues,
        },
      })
      console.log("[useInterventionContextMenu] Modal ouvert avec succès")
    } catch (error) {
      console.error("[useInterventionContextMenu] Erreur lors de l'ouverture du modal:", error)
      toast.error("Erreur", {
        description: "Impossible d'ouvrir le formulaire de création.",
      })
    }
  }, [interventionId, queryClient, modal])

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
      await queryClient.cancelQueries({ queryKey: interventionKeys.invalidateLists() })

      // Snapshot de la valeur précédente pour rollback en cas d'erreur
      const previousIntervention = queryClient.getQueryData(interventionKeys.detail(interventionId))

      // Récupérer les informations de l'utilisateur connecté pour la mise à jour optimiste
      let currentUserInfo: { id: string; name: string; code: string | null; color: string | null } | null = null
      try {
        const { data: session } = await supabase.auth.getSession()
        const token = session?.session?.access_token
        if (token) {
          const userResponse = await fetch("/api/auth/me", {
            cache: "no-store",
            headers: { Authorization: `Bearer ${token}` },
          })
          if (userResponse.ok) {
            const payload = await userResponse.json()
            const user = payload?.user
            if (user) {
              const first = user.firstname ?? user.prenom ?? ""
              const last = user.lastname ?? user.nom ?? ""
              const displayName = [first, last].filter(Boolean).join(" ").trim() || user.username || user.email || "Vous"
              currentUserInfo = {
                id: user.id,
                name: displayName,
                code: user.code_gestionnaire ?? null,
                color: user.color ?? null,
              }
            }
          }
        }
      } catch (error) {
        console.warn("[useInterventionContextMenu] Impossible de récupérer l'utilisateur connecté", error)
      }

      // Mise à jour optimiste immédiate dans toutes les listes (complètes et légères)
      if (currentUserInfo) {
        queryClient.setQueriesData(
          { queryKey: interventionKeys.lists() },
          (oldData: any) => {
            if (!oldData?.data || !Array.isArray(oldData.data)) {
              return oldData
            }
            const updatedData = oldData.data.map((intervention: any) =>
              intervention.id === interventionId
                ? {
                  ...intervention,
                  assigned_user_id: currentUserInfo!.id,
                  assignedUserCode: currentUserInfo!.code,
                  assignedUserName: currentUserInfo!.name,
                  assignedUserColor: currentUserInfo!.color,
                  attribueA: currentUserInfo!.code, // Pour compatibilité
                }
                : intervention
            )
            return { ...oldData, data: updatedData }
          }
        )
        queryClient.setQueriesData(
          { queryKey: interventionKeys.lightLists() },
          (oldData: any) => {
            if (!oldData?.data || !Array.isArray(oldData.data)) {
              return oldData
            }
            const updatedData = oldData.data.map((intervention: any) =>
              intervention.id === interventionId
                ? {
                  ...intervention,
                  assigned_user_id: currentUserInfo!.id,
                  assignedUserCode: currentUserInfo!.code,
                  assignedUserName: currentUserInfo!.name,
                  assignedUserColor: currentUserInfo!.color,
                  attribueA: currentUserInfo!.code, // Pour compatibilité
                }
                : intervention
            )
            return { ...oldData, data: updatedData }
          }
        )
      }

      return { previousIntervention, currentUserInfo }
    },
    onError: (error: Error, _variables, context) => {
      // Rollback en cas d'erreur
      if (context?.previousIntervention) {
        queryClient.setQueryData(interventionKeys.detail(interventionId), context.previousIntervention)
      }
      queryClient.invalidateQueries({ queryKey: interventionKeys.invalidateLists() })
      queryClient.invalidateQueries({ queryKey: interventionKeys.detail(interventionId) })

      toast.error("Erreur d'assignation", {
        description: error.message || "Une erreur est survenue lors de l'assignation.",
      })
    },
    onSuccess: (data) => {
      // Invalider les queries en arrière-plan pour récupérer les données complètes du serveur
      // La mise à jour optimiste dans onMutate assure une mise à jour immédiate de l'UI
      queryClient.invalidateQueries({ queryKey: interventionKeys.invalidateLists() })
      queryClient.invalidateQueries({ queryKey: interventionKeys.detail(interventionId) })
      queryClient.invalidateQueries({ queryKey: interventionKeys.summaries() })

      toast.success(`Intervention (${idInter || (data as any).id_inter || interventionId}) assignée à moi avec succès`, {
        description: new Date().toLocaleString(),
        action: {
          label: "Voir",
          onClick: () => openInterventionModal(interventionId),
        },
      })
    },
  })

  // Mutation pour transition vers "Devis envoyé"
  const transitionToDevisEnvoyeMutation = useMutation({
    mutationFn: async () => {
      return await transitionStatus(interventionId, {
        status: "DEVIS_ENVOYE",
      })
    },
    onMutate: async () => {
      // Annuler les requêtes en cours pour éviter les conflits
      await queryClient.cancelQueries({ queryKey: interventionKeys.detail(interventionId) })
      await queryClient.cancelQueries({ queryKey: interventionKeys.invalidateLists() })

      // Snapshot de la valeur précédente pour rollback en cas d'erreur
      const previousIntervention = queryClient.getQueryData(interventionKeys.detail(interventionId))

      // Mise à jour optimiste du détail
      queryClient.setQueryData(interventionKeys.detail(interventionId), (old: any) => {
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
        (oldData: any) => {
          if (!oldData?.data || !Array.isArray(oldData.data)) {
            return oldData
          }
          const updatedData = oldData.data.map((intervention: any) =>
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
        (oldData: any) => {
          if (!oldData?.data || !Array.isArray(oldData.data)) {
            return oldData
          }
          const updatedData = oldData.data.map((intervention: any) =>
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
      queryClient.invalidateQueries({ queryKey: interventionKeys.invalidateLists() })
      queryClient.invalidateQueries({ queryKey: interventionKeys.detail(interventionId) })

      toast.error("Erreur de transition", {
        description: error.message || "Une erreur est survenue lors du changement de statut.",
      })
    },
    onSuccess: (data) => {
      // Invalider les queries en arrière-plan pour récupérer les données complètes du serveur
      // La mise à jour optimiste dans onMutate assure une mise à jour immédiate de l'UI
      queryClient.invalidateQueries({ queryKey: interventionKeys.invalidateLists() })
      queryClient.invalidateQueries({ queryKey: interventionKeys.detail(interventionId) })
      queryClient.invalidateQueries({ queryKey: interventionKeys.summaries() })

      toast.success(`Intervention (${idInter || (data as any).id_inter || interventionId}) modifiée vers Devis Envoyé avec succès`, {
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
      return await transitionStatus(interventionId, {
        status: "ACCEPTE",
      })
    },
    onMutate: async () => {
      // Annuler les requêtes en cours pour éviter les conflits
      await queryClient.cancelQueries({ queryKey: interventionKeys.detail(interventionId) })
      await queryClient.cancelQueries({ queryKey: interventionKeys.invalidateLists() })

      // Snapshot de la valeur précédente pour rollback en cas d'erreur
      const previousIntervention = queryClient.getQueryData(interventionKeys.detail(interventionId))

      // Mise à jour optimiste du détail
      queryClient.setQueryData(interventionKeys.detail(interventionId), (old: any) => {
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
        (oldData: any) => {
          if (!oldData?.data || !Array.isArray(oldData.data)) {
            return oldData
          }
          const updatedData = oldData.data.map((intervention: any) =>
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
        (oldData: any) => {
          if (!oldData?.data || !Array.isArray(oldData.data)) {
            return oldData
          }
          const updatedData = oldData.data.map((intervention: any) =>
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
      queryClient.invalidateQueries({ queryKey: interventionKeys.invalidateLists() })
      queryClient.invalidateQueries({ queryKey: interventionKeys.detail(interventionId) })

      toast.error("Erreur de transition", {
        description: error.message || "Une erreur est survenue lors du changement de statut.",
      })
    },
    onSuccess: (data) => {
      // Invalider les queries en arrière-plan pour récupérer les données complètes du serveur
      // La mise à jour optimiste dans onMutate assure une mise à jour immédiate de l'UI
      queryClient.invalidateQueries({ queryKey: interventionKeys.invalidateLists() })
      queryClient.invalidateQueries({ queryKey: interventionKeys.detail(interventionId) })
      queryClient.invalidateQueries({ queryKey: interventionKeys.summaries() })

      toast.success(`Intervention (${idInter || (data as any).id_inter || interventionId}) modifiée vers Accepté avec succès`, {
        description: new Date().toLocaleString(),
        action: {
          label: "Voir",
          onClick: () => openInterventionModal(interventionId),
        },
      })
    },
  })

  return {
    duplicateDevisSupp,
    assignToMe: assignToMeMutation.mutate,
    transitionToDevisEnvoye: transitionToDevisEnvoyeMutation.mutate,
    transitionToAccepte: transitionToAccepteMutation.mutate,
    isLoading: {
      duplicate: false, // Plus de mutation, donc toujours false
      assign: assignToMeMutation.isPending,
      transitionDevisEnvoye: transitionToDevisEnvoyeMutation.isPending,
      transitionAccepte: transitionToAccepteMutation.isPending,
    },
    viewType,
  }
}

