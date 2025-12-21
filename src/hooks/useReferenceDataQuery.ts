/**
 * Hook TanStack Query pour les données de référence
 * Remplace progressivement useReferenceData pour bénéficier de l'invalidation et du cache partagé
 */

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { referenceApi, type ReferenceData } from "@/lib/reference-api"
import { referenceKeys } from "@/lib/react-query/queryKeys"
import { useCallback } from "react"

interface UseReferenceDataQueryReturn {
  data: ReferenceData | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  getInterventionStatusLabel: (id: string) => string
  getAgencyLabel: (id: string) => string
  getUserCode: (id: string) => string
}

/**
 * Hook pour charger les données de référence via TanStack Query
 * Bénéficie du cache partagé et de l'invalidation automatique
 * 
 * @example
 * ```tsx
 * const { data, loading, refresh } = useReferenceDataQuery()
 * ```
 */
export function useReferenceDataQuery(): UseReferenceDataQueryReturn {
  const queryClient = useQueryClient()

  const {
    data,
    isLoading,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: referenceKeys.allData(),
    queryFn: () => referenceApi.getAll(),
    staleTime: 5 * 60 * 1000, // 5 minutes - les données de référence changent rarement
    gcTime: 15 * 60 * 1000, // 15 minutes - garder en cache plus longtemps
    refetchOnWindowFocus: false, // Ne pas refetch automatiquement
    refetchOnMount: false, // Utiliser le cache si disponible
  })

  const refresh = useCallback(async () => {
    await refetch()
  }, [refetch])

  // Fonctions utilitaires
  const getInterventionStatusLabel = useCallback(
    (id: string): string => {
      if (!data) return id
      const status = data.interventionStatuses.find((s) => s.id === id)
      return status?.label || id
    },
    [data]
  )

  const getAgencyLabel = useCallback(
    (id: string): string => {
      if (!data) return id
      const agency = data.agencies.find((a) => a.id === id)
      return agency?.label || id
    },
    [data]
  )

  const getUserCode = useCallback(
    (id: string): string => {
      if (!data) return id
      const user = data.users.find((u) => u.id === id)
      return user?.code_gestionnaire || id
    },
    [data]
  )

  return {
    data: data || null,
    loading: isLoading,
    error: queryError ? (queryError instanceof Error ? queryError.message : String(queryError)) : null,
    refresh,
    getInterventionStatusLabel,
    getAgencyLabel,
    getUserCode,
  }
}

/**
 * Hook pour invalider les données de référence
 * Utile après un import massif ou une modification des données de référence
 * 
 * @example
 * ```tsx
 * const invalidateReferences = useInvalidateReferences()
 * // Après un import
 * await invalidateReferences()
 * ```
 */
export function useInvalidateReferences() {
  const queryClient = useQueryClient()

  return useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: referenceKeys.invalidateAll() })
  }, [queryClient])
}
