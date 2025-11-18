import { useCallback, useEffect, useMemo } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { interventionsApiV2, type GetAllParams } from "@/lib/supabase-api-v2"
import type { InterventionView } from "@/types/intervention-view"
import { interventionKeys } from "@/lib/react-query/queryKeys"

type ServerFilters = Pick<
  GetAllParams,
  "statut" | "agence" | "artisan" | "metier" | "user" | "startDate" | "endDate" | "search"
>

export interface UseInterventionsQueryOptions {
  viewId?: string
  autoLoad?: boolean
  limit?: number
  fields?: string[]
  serverFilters?: ServerFilters
  page?: number
  /**
   * Utiliser l'endpoint léger pour le warm-up (données minimales)
   * Par défaut: false (utilise l'endpoint complet)
   */
  useLight?: boolean
  /**
   * Désactiver la requête (pour contrôle manuel)
   */
  enabled?: boolean
}

export interface UseInterventionsQueryReturn {
  interventions: InterventionView[]
  loading: boolean
  error: string | null
  totalCount: number
  currentPage: number
  totalPages: number
  refresh: () => Promise<void>
  goToPage: (page: number) => void
  nextPage: () => void
  previousPage: () => void
  updateInterventionOptimistic: (id: string, updates: Partial<InterventionView>) => void
}

const DEFAULT_LIMIT = 100

export function useInterventionsQuery(
  options: UseInterventionsQueryOptions = {}
): UseInterventionsQueryReturn {
  const queryClient = useQueryClient()
  const {
    viewId,
    autoLoad = true,
    limit = DEFAULT_LIMIT,
    fields,
    serverFilters,
    page = 1,
    useLight = false,
    enabled: enabledOption,
  } = options

  // Normaliser les filtres (supprimer uniquement les valeurs undefined, garder null pour user)
  const normalizedFilters = useMemo(() => {
    if (!serverFilters) return {}

    const result: Partial<ServerFilters> = {}
    const entries = Object.entries(serverFilters) as Array<
      [keyof ServerFilters, ServerFilters[keyof ServerFilters]]
    >

    for (const [key, value] of entries) {
      // Pour le champ 'user', null est une valeur valide (filtre "sans assignation" pour la vue Market)
      if (key === 'user' && value === null) {
        ;(result as any)[key] = value
      } else if (value !== undefined && value !== null) {
        ;(result as any)[key] = value
      }
    }

    return result as ServerFilters
  }, [serverFilters])

  // Normaliser les champs
  const normalizedFields = useMemo(() => {
    if (!fields || fields.length === 0) return undefined
    const unique = Array.from(
      new Set(
        fields
          .map((field) => field?.trim())
          .filter((field): field is string => Boolean(field)),
      ),
    )
    return unique.length > 0 ? unique : undefined
  }, [fields])

  // Calculer l'offset depuis la page courante
  const offset = useMemo(() => {
    return (page - 1) * limit
  }, [page, limit])

  // Construire les paramètres de requête
  const requestParams = useMemo(() => {
    const params: GetAllParams = {
      limit: Math.max(1, limit),
      offset,
    }

    if (normalizedFields) {
      params.fields = normalizedFields
    }

    Object.entries(normalizedFilters).forEach(([key, value]) => {
      if (value !== undefined) {
        const target = params as Record<string, unknown>
        target[key] = value
      }
    })

    return params
  }, [limit, offset, normalizedFields, normalizedFilters])

  // Déterminer si la requête doit être activée
  const enabled = enabledOption !== undefined ? enabledOption : autoLoad

  // Utiliser l'endpoint approprié (light ou complet)
  const queryFn = useCallback(async () => {
    if (useLight) {
      return await interventionsApiV2.getAllLight(requestParams)
    }
    return await interventionsApiV2.getAll(requestParams)
  }, [requestParams, useLight])

  // Clé de requête avec viewId pour permettre l'invalidation par vue
  const queryKey = useMemo(() => {
    const baseKey = useLight
      ? interventionKeys.lightList(requestParams)
      : interventionKeys.list(requestParams)
    
    // Ajouter viewId à la clé si fourni pour permettre l'invalidation ciblée
    return viewId ? [...baseKey, viewId] : baseKey
  }, [requestParams, useLight, viewId])

  // Construire la clé pour les données light (pour placeholder)
  const lightQueryKey = useMemo(() => {
    if (useLight) return null // Pas besoin si on utilise déjà light
    const baseKey = interventionKeys.lightList(requestParams)
    return viewId ? [...baseKey, viewId] : baseKey
  }, [requestParams, useLight, viewId])

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
    // Utiliser les données light préchargées comme placeholder si disponibles
    // Cela permet d'afficher instantanément les données préchargées pendant le chargement des données complètes
    placeholderData: (previousData) => {
      // Si on utilise l'endpoint complet (useLight: false),
      // chercher les données light préchargées comme placeholder
      if (!useLight && lightQueryKey) {
        const lightData = queryClient.getQueryData(lightQueryKey)
        if (lightData) {
          // Les données light sont disponibles, les utiliser comme placeholder
          return lightData as any
        }
      }
      // Sinon, utiliser les données précédentes si disponibles (pour la pagination)
      return previousData
    },
  })

  // Extraire les données de la réponse
  // IMPORTANT: Toujours créer un nouveau tableau pour forcer la détection de changement par React
  // En production, React Query peut réutiliser la même référence même si les données changent
  const interventions = useMemo(() => {
    const result = data?.data ?? []
    // Créer un nouveau tableau pour forcer la détection de changement
    const newArray = [...result]
    const firstId = newArray[0]?.id ?? 'none'
    const lastId = newArray[newArray.length - 1]?.id ?? 'none'
    console.log(`[useInterventionsQuery] interventions mis à jour - length: ${newArray.length}, page: ${page}, offset: ${offset}, firstId: ${firstId}, lastId: ${lastId}`)
    return newArray
  }, [data?.data, page, offset, queryKey])
  const totalCount = useMemo(() => data?.total ?? 0, [data?.total])

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
    console.warn("[useInterventionsQuery] goToPage doit être géré par le composant parent via le paramètre page")
  }, [])

  const nextPage = useCallback(() => {
    console.warn("[useInterventionsQuery] nextPage doit être géré par le composant parent via le paramètre page")
  }, [])

  const previousPage = useCallback(() => {
    console.warn("[useInterventionsQuery] previousPage doit être géré par le composant parent via le paramètre page")
  }, [])

  // Préchargement automatique de la page suivante et précédente
  useEffect(() => {
    if (!enabled || !data) return

    // Précharger la page suivante si elle existe
    if (page < totalPages) {
      const nextPageNum = page + 1
      const nextOffset = (nextPageNum - 1) * limit
      
      const nextPageParams: GetAllParams = {
        ...requestParams,
        offset: nextOffset,
      }

      const nextPageQueryKey = useLight
        ? interventionKeys.lightList(nextPageParams)
        : interventionKeys.list(nextPageParams)
      
      const fullNextPageQueryKey = viewId ? [...nextPageQueryKey, viewId] : nextPageQueryKey

      // Précharger en arrière-plan (fire-and-forget)
      queryClient.prefetchQuery({
        queryKey: fullNextPageQueryKey,
        queryFn: async () => {
          if (useLight) {
            return await interventionsApiV2.getAllLight(nextPageParams)
          }
          return await interventionsApiV2.getAll(nextPageParams)
        },
        staleTime: 30 * 1000, // 30 secondes
      }).catch((err) => {
        // Ignorer les erreurs de préchargement silencieusement
        console.debug(`[useInterventionsQuery] Préchargement page ${nextPageNum} échoué:`, err)
      })
    }

    // Précharger la page précédente si on est sur la page 2 ou plus
    if (page > 1) {
      const prevPageNum = page - 1
      const prevOffset = (prevPageNum - 1) * limit
      
      const prevPageParams: GetAllParams = {
        ...requestParams,
        offset: prevOffset,
      }

      const prevPageQueryKey = useLight
        ? interventionKeys.lightList(prevPageParams)
        : interventionKeys.list(prevPageParams)
      
      const fullPrevPageQueryKey = viewId ? [...prevPageQueryKey, viewId] : prevPageQueryKey

      // Précharger en arrière-plan (fire-and-forget)
      queryClient.prefetchQuery({
        queryKey: fullPrevPageQueryKey,
        queryFn: async () => {
          if (useLight) {
            return await interventionsApiV2.getAllLight(prevPageParams)
          }
          return await interventionsApiV2.getAll(prevPageParams)
        },
        staleTime: 30 * 1000, // 30 secondes
      }).catch((err) => {
        // Ignorer les erreurs de préchargement silencieusement
        console.debug(`[useInterventionsQuery] Préchargement page ${prevPageNum} échoué:`, err)
      })
    }
  }, [page, totalPages, limit, requestParams, useLight, viewId, enabled, data, queryClient])

  // Mise à jour optimiste : met à jour le cache TanStack Query directement
  const updateInterventionOptimistic = useCallback(
    (id: string, updates: Partial<InterventionView>) => {
      if (!id || !updates) return

      // Mettre à jour toutes les queries de listes qui contiennent cette intervention
      queryClient.setQueriesData(
        { queryKey: interventionKeys.invalidateLists() },
        (oldData: any) => {
          if (!oldData?.data || !Array.isArray(oldData.data)) {
            return oldData
          }

          const updatedData = oldData.data.map((intervention: InterventionView) =>
            intervention.id === id ? { ...intervention, ...updates } : intervention
          )

          return {
            ...oldData,
            data: updatedData,
          }
        }
      )

      // Mettre à jour aussi la query de détail si elle existe
      queryClient.setQueryData(
        interventionKeys.detail(id),
        (oldData: any) => {
          if (!oldData) return oldData
          return { ...oldData, ...updates }
        }
      )
    },
    [queryClient],
  )

  return {
    interventions,
    loading: isLoading,
    error: queryError ? (queryError instanceof Error ? queryError.message : String(queryError)) : null,
    totalCount,
    currentPage: page,
    totalPages,
    refresh,
    goToPage,
    nextPage,
    previousPage,
    updateInterventionOptimistic,
  }
}

