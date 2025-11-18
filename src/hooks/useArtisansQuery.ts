import { useCallback, useMemo } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { artisansApiV2, type Artisan } from "@/lib/supabase-api-v2"
import { artisanKeys, type ArtisanGetAllParams } from "@/lib/react-query/queryKeys"

export interface UseArtisansQueryOptions {
  viewId?: string
  autoLoad?: boolean
  limit?: number
  serverFilters?: {
    gestionnaire?: string
    statut?: string
    statuts?: string[]
    metier?: string
    metiers?: string[]
    search?: string
  }
  page?: number
  /**
   * Désactiver la requête (pour contrôle manuel)
   */
  enabled?: boolean
}

export interface UseArtisansQueryReturn {
  artisans: Artisan[]
  loading: boolean
  error: string | null
  totalCount: number
  currentPage: number
  totalPages: number
  refresh: () => Promise<void>
  goToPage: (page: number) => void
  nextPage: () => void
  previousPage: () => void
  updateArtisanOptimistic: (id: string, updates: Partial<Artisan>) => void
}

const DEFAULT_LIMIT = 100

export function useArtisansQuery(
  options: UseArtisansQueryOptions = {}
): UseArtisansQueryReturn {
  const queryClient = useQueryClient()
  const {
    viewId,
    autoLoad = true,
    limit = DEFAULT_LIMIT,
    serverFilters,
    page = 1,
    enabled: enabledOption,
  } = options

  // Normaliser les filtres (supprimer les valeurs undefined/null)
  const normalizedFilters = useMemo(() => {
    if (!serverFilters) return {}

    const result: Partial<ArtisanGetAllParams> = {}

    if (serverFilters.gestionnaire) {
      result.gestionnaire = serverFilters.gestionnaire
    }
    if (serverFilters.statut) {
      result.statut = serverFilters.statut
    }
    if (serverFilters.statuts && serverFilters.statuts.length > 0) {
      result.statuts = serverFilters.statuts
    }
    if (serverFilters.metier) {
      result.metier = serverFilters.metier
    }
    if (serverFilters.metiers && serverFilters.metiers.length > 0) {
      result.metiers = serverFilters.metiers
    }
    if (serverFilters.search && serverFilters.search.trim()) {
      result.search = serverFilters.search.trim()
    }

    return result
  }, [serverFilters])

  // Calculer l'offset depuis la page courante
  const offset = useMemo(() => {
    return (page - 1) * limit
  }, [page, limit])

  // Construire les paramètres de requête
  const requestParams = useMemo(() => {
    const params: ArtisanGetAllParams = {
      limit: Math.max(1, limit),
      offset,
    }

    Object.entries(normalizedFilters).forEach(([key, value]) => {
      if (value !== undefined) {
        const target = params as Record<string, unknown>
        target[key] = value
      }
    })

    return params
  }, [limit, offset, normalizedFilters])

  // Déterminer si la requête doit être activée
  const enabled = enabledOption !== undefined ? enabledOption : autoLoad

  // Fonction de requête
  const queryFn = useCallback(async () => {
    return await artisansApiV2.getAll(requestParams)
  }, [requestParams])

  // Clé de requête avec viewId pour permettre l'invalidation par vue
  const queryKey = useMemo(() => {
    const baseKey = artisanKeys.list(requestParams)
    
    // Ajouter viewId à la clé si fourni pour permettre l'invalidation ciblée
    return viewId ? [...baseKey, viewId] : baseKey
  }, [requestParams, viewId])

  // Requête TanStack Query
  const {
    data,
    isLoading,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey,
    queryFn,
    enabled,
    // Stale time spécifique : 30s pour revalidation silencieuse
    staleTime: 30 * 1000,
    // Garder les données précédentes pendant le chargement (pagination fluide)
    placeholderData: (previousData) => previousData,
  })

  // Extraire les données de la réponse
  const artisans = useMemo(() => data?.data ?? [], [data?.data])
  const totalCount = useMemo(() => data?.pagination?.total ?? 0, [data?.pagination?.total])

  // Calculer le nombre total de pages
  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(totalCount / limit))
  }, [totalCount, limit])

  // Fonction de refresh
  const refresh = useCallback(async () => {
    await refetch()
  }, [refetch])

  // Navigation de pagination (sera gérée par le composant parent via le paramètre page)
  const goToPage = useCallback((newPage: number) => {
    // Cette fonction sera gérée par le composant parent qui contrôle le paramètre page
    console.warn("[useArtisansQuery] goToPage doit être géré par le composant parent via le paramètre page")
  }, [])

  const nextPage = useCallback(() => {
    console.warn("[useArtisansQuery] nextPage doit être géré par le composant parent via le paramètre page")
  }, [])

  const previousPage = useCallback(() => {
    console.warn("[useArtisansQuery] previousPage doit être géré par le composant parent via le paramètre page")
  }, [])

  // Mise à jour optimiste : met à jour le cache TanStack Query directement
  const updateArtisanOptimistic = useCallback(
    (id: string, updates: Partial<Artisan>) => {
      if (!id || !updates) return

      // Mettre à jour toutes les queries de listes qui contiennent cet artisan
      queryClient.setQueriesData(
        { queryKey: artisanKeys.invalidateLists() },
        (oldData: any) => {
          if (!oldData?.data || !Array.isArray(oldData.data)) {
            return oldData
          }

          const updatedData = oldData.data.map((artisan: Artisan) =>
            artisan.id === id ? { ...artisan, ...updates } : artisan
          )

          return {
            ...oldData,
            data: updatedData,
          }
        }
      )

      // Mettre à jour aussi la query de détail si elle existe
      queryClient.setQueryData(
        artisanKeys.detail(id),
        (oldData: any) => {
          if (!oldData) return oldData
          return { ...oldData, ...updates }
        }
      )
    },
    [queryClient],
  )

  return {
    artisans,
    loading: isLoading,
    error: queryError ? (queryError instanceof Error ? queryError.message : String(queryError)) : null,
    totalCount,
    currentPage: page,
    totalPages,
    refresh,
    goToPage,
    nextPage,
    previousPage,
    updateArtisanOptimistic,
  }
}





