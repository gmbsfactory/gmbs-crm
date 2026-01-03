import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { interventionsApiV2, type Intervention, type InterventionCost, type InterventionPayment } from "@/lib/api/v2"
import { useInterventionModal } from "@/hooks/useInterventionModal"
import { interventionKeys } from "@/lib/react-query/queryKeys"
import { getRemoteEditIndicatorManager } from "@/lib/realtime/remote-edit-indicator"
import { getSyncQueue } from "@/lib/realtime/sync-queue"
import { isNetworkError } from "@/lib/realtime/realtime-client"

/**
 * Hook pour gérer les mutations d'interventions avec invalidation automatique
 * Utilise TanStack Query pour gérer les mutations et invalider les queries affectées
 */
export function useInterventionsMutations() {
  const queryClient = useQueryClient()
  const { open: openInterventionModal } = useInterventionModal()
  const syncQueue = getSyncQueue()
  const invalidateLists = () => {
    // Debug: Compter les queries qui seront invalidées
    const listQueries = queryClient.getQueryCache().findAll({ 
      queryKey: interventionKeys.invalidateLists() 
    })
    const lightQueries = queryClient.getQueryCache().findAll({ 
      queryKey: interventionKeys.invalidateLightLists() 
    })
    
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[useInterventionsMutations] Invalidating ${listQueries.length} list queries and ${lightQueries.length} light queries`)
    }
    
    queryClient.invalidateQueries({ 
      queryKey: interventionKeys.invalidateLists(),
      refetchType: 'active' // Invalider seulement les queries actives (montées)
    })
    queryClient.invalidateQueries({ 
      queryKey: interventionKeys.invalidateLightLists(),
      refetchType: 'active'
    })
  }

  // Mutation pour créer une intervention
  const createMutation = useMutation({
    mutationFn: async (data: {
      agence_id?: string
      client_id?: string
      assigned_user_id?: string
      statut_id?: string
      metier_id?: string
      date: string
      date_prevue?: string
      contexte_intervention?: string
      consigne_intervention?: string
      consigne_second_artisan?: string
      adresse?: string
      code_postal?: string
      ville?: string
      latitude?: number
      longitude?: number
      numero_sst?: string
      pourcentage_sst?: number
    }) => {
      return await interventionsApiV2.create(data)
    },
    onSuccess: (data) => {
      toast.success(`Intervention (${data.id_inter || data.id}) créée avec succès`, {
        description: new Date().toLocaleString(),
        action: {
          label: "Voir",
          onClick: () => openInterventionModal(data.id),
        },
      })
      // Enregistrer la modification locale pour éviter d'afficher un badge
      if (data?.id) {
        const indicatorManager = getRemoteEditIndicatorManager()
        indicatorManager.recordLocalModification(data.id, data.updated_at || null)
      }

      // Invalider toutes les listes d'interventions pour recharger les données
      invalidateLists()
      // Invalider aussi les résumés
      queryClient.invalidateQueries({ queryKey: interventionKeys.summaries() })
    },
    onError: (error, variables) => {
      // En cas d'erreur réseau, mettre en file d'attente pour synchronisation différée
      if (isNetworkError(error)) {
        syncQueue.enqueue({
          interventionId: '', // Pour une création, on n'a pas encore d'ID
          type: 'create',
          data: variables as Partial<Intervention>,
        })
        console.warn('[useInterventionsMutations] Erreur réseau lors de la création, mise en file d\'attente')
      }
    },
  })

  // Mutation pour mettre à jour une intervention
  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string
      data: {
        id_inter?: string | null
        reference_agence?: string | null
        agence_id?: string
        client_id?: string
        assigned_user_id?: string
        statut_id?: string
        metier_id?: string
        date?: string
        date_termine?: string
        date_prevue?: string
        contexte_intervention?: string
        consigne_intervention?: string
        consigne_second_artisan?: string
        commentaire_agent?: string
        adresse?: string
        code_postal?: string
        ville?: string
        latitude?: number
        longitude?: number
        numero_sst?: string
        pourcentage_sst?: number
        is_vacant?: boolean
        key_code?: string | null
        floor?: string | null
        apartment_number?: string | null
        vacant_housing_instructions?: string | null
        owner_id?: string | null
        tenant_id?: string | null
        is_active?: boolean
        sous_statut_text?: string | null
        sous_statut_text_color?: string | null
        sous_statut_bg_color?: string | null
        metier_second_artisan_id?: string | null
        // Note: Les coûts du 2ème artisan sont gérés via intervention_costs avec artisan_order = 2
      }
    }) => {
      return await interventionsApiV2.update(id, data)
    },
    // Mise à jour optimiste du cache pour un affichage instantané
    onMutate: async (variables) => {
      // Annuler les requêtes en cours pour éviter les conflits
      await queryClient.cancelQueries({ queryKey: interventionKeys.lists() })
      await queryClient.cancelQueries({ queryKey: interventionKeys.lightLists() })

      // Préparer les données optimistes à appliquer
      const optimisticData: Record<string, unknown> = {}
      
      // Mapper les champs de la mutation vers les champs utilisés dans le cache
      if (variables.data.sous_statut_text !== undefined) {
        optimisticData.understatement = variables.data.sous_statut_text
        optimisticData.sous_statut_text = variables.data.sous_statut_text
      }
      if (variables.data.sous_statut_text_color !== undefined) {
        optimisticData.sousStatutTextColor = variables.data.sous_statut_text_color
        optimisticData.sous_statut_text_color = variables.data.sous_statut_text_color
      }
      if (variables.data.sous_statut_bg_color !== undefined) {
        optimisticData.sousStatutBgColor = variables.data.sous_statut_bg_color
        optimisticData.sous_statut_bg_color = variables.data.sous_statut_bg_color
      }

      // Copier les autres champs de la mutation
      Object.entries(variables.data).forEach(([key, value]) => {
        if (value !== undefined) {
          optimisticData[key] = value
        }
      })

      // Fonction pour mettre à jour les listes d'interventions dans le cache
      const updateLists = (oldData: any) => {
        if (!oldData?.data || !Array.isArray(oldData.data)) {
          return oldData
        }

        const updatedData = oldData.data.map((intervention: any) =>
          intervention.id === variables.id ? { ...intervention, ...optimisticData } : intervention
        )

        return {
          ...oldData,
          data: updatedData,
        }
      }

      // Appliquer la mise à jour optimiste sur toutes les listes
      queryClient.setQueriesData({ queryKey: interventionKeys.lists() }, updateLists)
      queryClient.setQueriesData({ queryKey: interventionKeys.lightLists() }, updateLists)

      // Mettre à jour aussi le détail si présent dans le cache
      queryClient.setQueryData(
        interventionKeys.detail(variables.id),
        (oldData: any) => {
          if (!oldData) return oldData
          return { ...oldData, ...optimisticData }
        }
      )

      console.log(`[useInterventionsMutations] 🚀 Mise à jour optimiste appliquée pour ${variables.id}`, optimisticData)
    },
    onSuccess: (data, variables) => {
      const statusLabel = (data as any).status?.label || "modifiée"
      toast.success(`Intervention (${data.id_inter || variables.id}) ${statusLabel} avec succès`, {
        description: new Date().toLocaleString(),
        action: {
          label: "Voir",
          onClick: () => openInterventionModal(variables.id),
        },
      })
      // Enregistrer la modification locale pour éviter d'afficher un badge
      const indicatorManager = getRemoteEditIndicatorManager()
      indicatorManager.recordLocalModification(variables.id, data?.updated_at || null)

      // Invalider toutes les listes d'interventions
      invalidateLists()
      // Invalider aussi le détail de cette intervention spécifique
      queryClient.invalidateQueries({ queryKey: interventionKeys.detail(variables.id) })
      // Invalider les résumés
      queryClient.invalidateQueries({ queryKey: interventionKeys.summaries() })
    },
    onError: (error, variables) => {
      // En cas d'erreur réseau, mettre en file d'attente pour synchronisation différée
      if (isNetworkError(error)) {
        syncQueue.enqueue({
          interventionId: variables.id,
          type: 'update',
          data: variables.data as Partial<Intervention>,
        })
        console.warn(`[useInterventionsMutations] Erreur réseau lors de la mise à jour de ${variables.id}, mise en file d'attente`)
      }
      // En cas d'erreur, invalider pour restaurer les données correctes du serveur
      invalidateLists()
      queryClient.invalidateQueries({ queryKey: interventionKeys.detail(variables.id) })
    },
  })

  // Mutation pour supprimer une intervention (soft delete)
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await interventionsApiV2.delete(id)
    },
    onSuccess: (data, id) => {
      // Enregistrer la modification locale pour éviter d'afficher un badge
      const indicatorManager = getRemoteEditIndicatorManager()
      indicatorManager.recordLocalModification(id, data?.data?.updated_at || null)

      // Invalider toutes les listes d'interventions
      invalidateLists()
      // Invalider les résumés
      queryClient.invalidateQueries({ queryKey: interventionKeys.summaries() })
    },
    onError: (error, id) => {
      // En cas d'erreur réseau, mettre en file d'attente pour synchronisation différée
      if (isNetworkError(error)) {
        syncQueue.enqueue({
          interventionId: id,
          type: 'delete',
          data: {},
        })
        console.warn(`[useInterventionsMutations] Erreur réseau lors de la suppression de ${id}, mise en file d'attente`)
      }
    },
  })

  // Mutation pour assigner un artisan
  const assignArtisanMutation = useMutation({
    mutationFn: async ({
      interventionId,
      artisanId,
      role = "primary" as const,
    }: {
      interventionId: string
      artisanId: string
      role?: "primary" | "secondary"
    }) => {
      return await interventionsApiV2.assignArtisan(interventionId, artisanId, role)
    },
    onSuccess: (data, variables) => {
      // Invalider les listes et le détail de l'intervention
      invalidateLists()
      queryClient.invalidateQueries({ queryKey: interventionKeys.detail(variables.interventionId) })
    },
  })

  // Mutation pour ajouter un coût
  const addCostMutation = useMutation({
    mutationFn: async ({
      interventionId,
      data,
    }: {
      interventionId: string
      data: {
        cost_type: "sst" | "materiel" | "intervention" | "marge"
        label?: string
        amount: number
        currency?: string
        metadata?: any
      }
    }) => {
      return await interventionsApiV2.addCost(interventionId, data)
    },
    onSuccess: (data, variables) => {
      // Invalider le détail de l'intervention (les coûts sont dans le détail)
      queryClient.invalidateQueries({ queryKey: interventionKeys.detail(variables.interventionId) })
    },
  })

  // Mutation pour ajouter un paiement
  const addPaymentMutation = useMutation({
    mutationFn: async ({
      interventionId,
      data,
    }: {
      interventionId: string
      data: {
        payment_type: string
        amount: number
        currency?: string
        is_received?: boolean
        payment_date?: string
        reference?: string
      }
    }) => {
      return await interventionsApiV2.addPayment(interventionId, data)
    },
    onSuccess: (data, variables) => {
      // Invalider le détail de l'intervention (les paiements sont dans le détail)
      queryClient.invalidateQueries({ queryKey: interventionKeys.detail(variables.interventionId) })
    },
  })

  return {
    create: createMutation,
    update: updateMutation,
    delete: deleteMutation,
    assignArtisan: assignArtisanMutation,
    addCost: addCostMutation,
    addPayment: addPaymentMutation,
  }
}




