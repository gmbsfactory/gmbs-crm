import { useMemo } from "react"
import { useQueries, useQueryClient } from "@tanstack/react-query"
import { interventionKeys, dashboardKeys } from "@/lib/react-query/queryKeys"
import { safeErrorMessage } from "@/lib/api/v2/common/error-handler"
import type { InterventionViewDefinition } from "@/types/intervention-views"
import { interventionsApi, type InterventionQueryParams } from "@/lib/api/v2"
import { getTierQueryOptions } from "@/config/freshness-tiers"

// T3 Freshness: background polling 30s for view counters
const T3_OPTIONS = getTierQueryOptions('T3')

// Alias pour compatibilité
type GetAllParams = InterventionQueryParams

// Vues qui nécessitent un utilisateur connecté pour fonctionner correctement
const USER_SCOPED_VIEW_IDS = new Set([
  "mes-demandes",
  "ma-liste-en-cours",
  "mes-visites-technique",
  "ma-liste-accepte",
  "ma-liste-att-acompte",
  "mes-interventions-a-check",
])

export interface UseInterventionViewCountsOptions {
  views: InterventionViewDefinition[]
  convertFiltersToApiParams: (filters: any[]) => Partial<GetAllParams>
  enabled?: boolean
  currentUserId?: string
}

export interface UseInterventionViewCountsReturn {
  counts: Record<string, number>
  isLoading: boolean
  error: Error | null
}

/**
 * Hook pour charger les compteurs de toutes les vues d'interventions
 * Utilise TanStack Query pour permettre l'invalidation automatique lors des mises à jour temps réel
 */
export function useInterventionViewCounts({
  views,
  convertFiltersToApiParams,
  enabled = true,
  currentUserId,
}: UseInterventionViewCountsOptions): UseInterventionViewCountsReturn {
  const queryClient = useQueryClient()

  // Créer les queries pour chaque vue
  const queries = useQueries({
    queries: views.map((view) => {
      // Cas spécial pour "mes-interventions-a-check" : utiliser les stats du dashboard
      if (view.id === "mes-interventions-a-check") {
        const viewEnabled = enabled && Boolean(currentUserId)
        return {
          queryKey: dashboardKeys.statsByUser({ userId: currentUserId || "", startDate: undefined, endDate: undefined }),
          queryFn: async ({ signal }) => {
            try {
              if (!currentUserId) {
                console.warn(`[useInterventionViewCounts] Vue check ignorée car currentUserId n'est pas disponible`)
                return { viewId: view.id, count: 0 }
              }

              const stats = await interventionsApi.getStatsByUser(currentUserId, undefined, undefined, signal)
              return { viewId: view.id, count: stats.interventions_a_checker || 0 }
            } catch (error) {
              // Ne pas logger les annulations (unmount, changement de tab, etc.)
              if (error instanceof Error && error.name === 'AbortError') {
                return { viewId: view.id, count: 0 }
              }
              console.error(`[useInterventionViewCounts] Erreur lors du comptage check pour la vue ${view.id}:`, error)
              return { viewId: view.id, count: 0 }
            }
          },
          enabled: viewEnabled,
          ...T3_OPTIONS,
        }
      }

      // Logique normale pour les autres vues
      const apiParams = convertFiltersToApiParams(view.filters)

      // Désactiver les vues utilisateur si currentUserId n'est pas disponible
      const isUserScopedView = USER_SCOPED_VIEW_IDS.has(view.id)
      const viewEnabled = enabled && Boolean(view.id) && (!isUserScopedView || Boolean(currentUserId))

      return {
        queryKey: interventionKeys.summary(apiParams as GetAllParams),
        queryFn: async ({ signal }) => {
          try {
            // Valider les paramètres avant d'appeler l'API
            if (!apiParams || typeof apiParams !== 'object') {
              console.warn(`[useInterventionViewCounts] Paramètres invalides pour la vue ${view.id}:`, apiParams)
              return { viewId: view.id, count: 0 }
            }

            // Pour les vues utilisateur, vérifier que currentUserId est disponible dans les paramètres
            if (isUserScopedView && !currentUserId) {
              console.warn(`[useInterventionViewCounts] Vue utilisateur ${view.id} ignorée car currentUserId n'est pas disponible`)
              return { viewId: view.id, count: 0 }
            }

            const count = await interventionsApi.getTotalCountWithFilters(apiParams, signal)
            return { viewId: view.id, count }
          } catch (error) {
            // Ne pas logger les annulations
            if (error instanceof Error && error.name === 'AbortError') {
              return { viewId: view.id, count: 0 }
            }

            // Améliorer le logging des erreurs pour mieux diagnostiquer
            const errorMessage = error instanceof Error
              ? error.message
              : typeof error === 'object' && error !== null
                ? JSON.stringify(error, Object.getOwnPropertyNames(error))
                : String(error)

            const errorDetails = error instanceof Error
              ? {
                message: safeErrorMessage(error, "le comptage des vues"),
                name: error.name,
                stack: error.stack,
              }
              : error

            console.error(
              `[useInterventionViewCounts] Erreur lors du comptage pour la vue ${view.id}:`,
              {
                errorMessage,
                errorDetails,
                apiParams,
                filters: view.filters,
                isUserScopedView,
                currentUserId,
              }
            )
            return { viewId: view.id, count: 0 }
          }
        },
        enabled: viewEnabled,
        ...T3_OPTIONS,
      }
    }),
  })

  // Combiner les résultats en un objet Record<string, number>
  const counts = useMemo(() => {
    const result: Record<string, number> = {}
    queries.forEach((query) => {
      if (query.data) {
        result[query.data.viewId] = query.data.count
      }
    })
    return result
  }, [queries])

  // Déterminer l'état de chargement global
  const isLoading = useMemo(() => {
    return queries.some((query) => query.isLoading)
  }, [queries])

  // Déterminer s'il y a des erreurs
  const error = useMemo(() => {
    const firstError = queries.find((query) => query.error)
    return firstError?.error as Error | null
  }, [queries])

  return {
    counts,
    isLoading,
    error,
  }
}


