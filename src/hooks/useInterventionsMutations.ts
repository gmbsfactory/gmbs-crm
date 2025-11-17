import { useMutation, useQueryClient } from "@tanstack/react-query"
import { interventionsApiV2 } from "@/lib/supabase-api-v2"
import { interventionKeys } from "@/lib/react-query/queryKeys"
import type { Intervention, InterventionCost, InterventionPayment } from "@/lib/supabase-api-v2"

/**
 * Hook pour gérer les mutations d'interventions avec invalidation automatique
 * Utilise TanStack Query pour gérer les mutations et invalider les queries affectées
 */
export function useInterventionsMutations() {
  const queryClient = useQueryClient()

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
    onSuccess: () => {
      // Invalider toutes les listes d'interventions pour recharger les données
      queryClient.invalidateQueries({ queryKey: interventionKeys.invalidateLists() })
      // Invalider aussi les résumés
      queryClient.invalidateQueries({ queryKey: interventionKeys.summaries() })
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
        is_active?: boolean
      }
    }) => {
      return await interventionsApiV2.update(id, data)
    },
    onSuccess: (data, variables) => {
      // Invalider toutes les listes d'interventions
      queryClient.invalidateQueries({ queryKey: interventionKeys.invalidateLists() })
      // Invalider aussi le détail de cette intervention spécifique
      queryClient.invalidateQueries({ queryKey: interventionKeys.detail(variables.id) })
      // Invalider les résumés
      queryClient.invalidateQueries({ queryKey: interventionKeys.summaries() })
    },
  })

  // Mutation pour supprimer une intervention (soft delete)
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await interventionsApiV2.delete(id)
    },
    onSuccess: () => {
      // Invalider toutes les listes d'interventions
      queryClient.invalidateQueries({ queryKey: interventionKeys.invalidateLists() })
      // Invalider les résumés
      queryClient.invalidateQueries({ queryKey: interventionKeys.summaries() })
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
      queryClient.invalidateQueries({ queryKey: interventionKeys.invalidateLists() })
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




