import { useCallback, useEffect, useMemo, useRef } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { interventionsApi } from "@/lib/api/v2"
import { comptaApi, type FacturationEntriesResult } from "@/lib/api/compta"
import { comptabiliteKeys, type ComptabiliteQueryParams } from "@/lib/react-query/queryKeys"
import { getPreloadConfig } from "@/lib/device-capabilities"
import { supabase } from "@/lib/supabase-client"
import type { InterventionWithStatus } from "@/types/intervention"

type InterventionRecord = InterventionWithStatus & {
  intervention_artisans?: Array<{
    artisan_id?: string
    is_primary?: boolean
    role?: string | null
    artisans?: { prenom?: string | null; nom?: string | null } | null
  }>
}

export interface UseComptabiliteQueryOptions {
  dateRange: { start: string; end: string } | null
  enabled?: boolean
  page?: number
  itemsPerPage?: number
}

interface ComptabiliteData {
  interventions: InterventionRecord[]
  facturationDates: Map<string, string>
  checkedIds: Set<string>
  totalCount: number
}

/**
 * Récupère les entrées de facturation (IDs + dates) depuis les transitions.
 * Cette query est légère et séparée pour être réutilisée par le prefetch.
 */
export async function fetchFacturationEntries(
  dateRange: { start: string; end: string } | null
): Promise<FacturationEntriesResult> {
  return comptaApi.getAllFacturationEntries(dateRange)
}

/**
 * Charge les données complètes pour une page d'interventions comptabilité.
 * Prend les IDs déjà triés et paginés, puis charge en parallèle :
 * - les données complètes des interventions (getByIds)
 * - les checks compta pour ces IDs
 */
export async function fetchComptabilitePageData(
  pageIds: string[],
  dateMap: Map<string, string>,
  totalCount: number
): Promise<ComptabiliteData> {
  if (pageIds.length === 0) {
    return {
      interventions: [],
      facturationDates: dateMap,
      checkedIds: new Set(),
      totalCount,
    }
  }

  const [interventions, checkedIds] = await Promise.all([
    interventionsApi.getByIds(pageIds),
    comptaApi.getCheckedInterventions(pageIds),
  ])

  // Trier les interventions dans le même ordre que pageIds
  const idOrderMap = new Map(pageIds.map((id, index) => [id, index]))
  const sorted = [...interventions].sort(
    (a, b) => (idOrderMap.get(a.id) ?? 0) - (idOrderMap.get(b.id) ?? 0)
  )

  return {
    interventions: sorted as InterventionRecord[],
    facturationDates: dateMap,
    checkedIds,
    totalCount,
  }
}

/**
 * Fonction de fetch partagée entre la query principale et le prefetch.
 * Étape 1 : récupère les entrées de facturation (IDs + dates)
 * Étape 2 : charge les données complètes pour la page demandée
 */
export async function fetchComptabiliteData(
  dateRange: { start: string; end: string } | null,
  page: number = 1,
  pageSize: number = 100
): Promise<ComptabiliteData> {
  // 1. Query légère : toutes les transitions INTER_TERMINEE (filtrées par date si demandé)
  const entries = await fetchFacturationEntries(dateRange)

  // 2. Pagination sur les IDs triés
  const offset = (page - 1) * pageSize
  const pageIds = entries.sortedIds.slice(offset, offset + pageSize)

  // 3. Charger les données complètes pour cette page
  return fetchComptabilitePageData(pageIds, entries.dateMap, entries.total)
}

export function useComptabiliteQuery(options: UseComptabiliteQueryOptions) {
  const queryClient = useQueryClient()
  const { dateRange, enabled = true, page = 1, itemsPerPage = 100 } = options

  const preloadConfig = useMemo(() => getPreloadConfig(), [])

  const queryParams = useMemo((): ComptabiliteQueryParams => ({
    dateStart: dateRange?.start,
    dateEnd: dateRange?.end,
    page,
    pageSize: itemsPerPage,
  }), [dateRange, page, itemsPerPage])

  // Query principale : interventions paginées + dates + checks
  const {
    data: comptaData,
    isLoading,
    isPlaceholderData,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: comptabiliteKeys.list(queryParams),
    queryFn: () => fetchComptabiliteData(dateRange, page, itemsPerPage),
    enabled: enabled,
    staleTime: preloadConfig.staleTime,
    gcTime: preloadConfig.gcTime,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    placeholderData: (previousData) => previousData,
    structuralSharing: false,
  })

  // Données extraites du cache
  const paginatedInterventions = useMemo(
    () => comptaData?.interventions ?? [],
    [comptaData?.interventions]
  )
  const facturationDates = comptaData?.facturationDates ?? new Map<string, string>()
  const totalCount = comptaData?.totalCount ?? 0

  const checkedInterventions = useMemo(
    () => comptaData?.checkedIds ?? new Set<string>(),
    [comptaData?.checkedIds]
  )

  // Pagination
  const totalPages = Math.max(1, Math.ceil(totalCount / itemsPerPage))

  // ── Prefetch page n+1 ──
  const isLowEnd = preloadConfig.isLowEnd
  const prefetchStaleTime = preloadConfig.staleTime

  useEffect(() => {
    if (!enabled || !comptaData || isLowEnd) return

    // Prefetch page suivante si elle existe
    const hasNextPage = page < totalPages
    if (!hasNextPage) return

    const nextPage = page + 1
    const nextParams: ComptabiliteQueryParams = {
      dateStart: dateRange?.start,
      dateEnd: dateRange?.end,
      page: nextPage,
      pageSize: itemsPerPage,
    }

    const timeoutId = setTimeout(() => {
      queryClient.prefetchQuery({
        queryKey: comptabiliteKeys.list(nextParams),
        queryFn: () => fetchComptabiliteData(dateRange, nextPage, itemsPerPage),
        staleTime: prefetchStaleTime,
      }).catch(() => {
        // Ignorer silencieusement les erreurs de préchargement
      })
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [enabled, comptaData, queryClient, isLowEnd, prefetchStaleTime, page, totalPages, dateRange, itemsPerPage])

  // ── Realtime: sync compta checks across users ──
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!enabled) return

    const channel = supabase
      .channel("compta-checks-sync")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "intervention_compta_checks",
        },
        () => {
          // Debounce : regrouper les événements rapides (ex: bulk check)
          // en une seule invalidation
          if (debounceRef.current) clearTimeout(debounceRef.current)
          debounceRef.current = setTimeout(() => {
            queryClient.invalidateQueries({ queryKey: comptabiliteKeys.all })
          }, 300)
        }
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [enabled, queryClient])

  // ── Optimistic updates ──

  const queryKey = comptabiliteKeys.list(queryParams)

  const toggleComptaCheck = useCallback(async (interventionId: string) => {
    const wasChecked = checkedInterventions.has(interventionId)
    const newChecked = !wasChecked

    // Mise à jour optimiste du cache
    queryClient.setQueryData<ComptabiliteData>(queryKey, (old) => {
      if (!old) return old
      const next = new Set(old.checkedIds)
      if (newChecked) {
        next.add(interventionId)
      } else {
        next.delete(interventionId)
      }
      return { ...old, checkedIds: next }
    })

    const success = newChecked
      ? await comptaApi.check(interventionId)
      : await comptaApi.uncheck(interventionId)

    // Rollback si échec
    if (!success) {
      queryClient.setQueryData<ComptabiliteData>(queryKey, (old) => {
        if (!old) return old
        const next = new Set(old.checkedIds)
        if (wasChecked) {
          next.add(interventionId)
        } else {
          next.delete(interventionId)
        }
        return { ...old, checkedIds: next }
      })
    }

    return success
  }, [checkedInterventions, queryKey, queryClient])

  const bulkCheck = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return

    // Mise à jour optimiste
    queryClient.setQueryData<ComptabiliteData>(queryKey, (old) => {
      if (!old) return old
      const next = new Set(old.checkedIds)
      ids.forEach(id => next.add(id))
      return { ...old, checkedIds: next }
    })

    // Appels API en parallèle
    const results = await Promise.all(
      ids.map(id => comptaApi.check(id))
    )

    // Rollback des échecs
    const failedIds = ids.filter((_, index) => !results[index])
    if (failedIds.length > 0) {
      queryClient.setQueryData<ComptabiliteData>(queryKey, (old) => {
        if (!old) return old
        const next = new Set(old.checkedIds)
        failedIds.forEach(id => next.delete(id))
        return { ...old, checkedIds: next }
      })
    }
  }, [queryKey, queryClient])

  // ── Exclusion de lignes ──

  const excludeFromCompta = useCallback(async (interventionId: string) => {
    // Optimistic: retirer la ligne du cache
    queryClient.setQueryData<ComptabiliteData>(queryKey, (old) => {
      if (!old) return old
      return {
        ...old,
        interventions: old.interventions.filter((i) => i.id !== interventionId),
        totalCount: old.totalCount - 1,
      }
    })

    const success = await comptaApi.exclude(interventionId)

    if (!success) {
      // Rollback : invalider pour recharger les vraies données
      queryClient.invalidateQueries({ queryKey: comptabiliteKeys.all })
    }

    return success
  }, [queryKey, queryClient])

  const bulkExclude = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return

    const idsSet = new Set(ids)

    // Optimistic: retirer les lignes du cache
    queryClient.setQueryData<ComptabiliteData>(queryKey, (old) => {
      if (!old) return old
      return {
        ...old,
        interventions: old.interventions.filter((i) => !idsSet.has(i.id)),
        totalCount: old.totalCount - ids.length,
      }
    })

    const results = await Promise.all(
      ids.map((id) => comptaApi.exclude(id))
    )

    const hasFailures = results.some((r) => !r)
    if (hasFailures) {
      queryClient.invalidateQueries({ queryKey: comptabiliteKeys.all })
    }
  }, [queryKey, queryClient])

  // Refresh complet
  const refresh = useCallback(async () => {
    await refetch()
  }, [refetch])

  return {
    // Données (paginées côté serveur — plus de allInterventions séparé)
    interventions: paginatedInterventions,
    allInterventions: paginatedInterventions,
    facturationDates,
    checkedInterventions,

    // Pagination
    totalCount,
    totalPages,
    currentPage: page,

    // États de chargement
    loading: isLoading,
    isPlaceholderData,
    error: queryError ? (queryError instanceof Error ? queryError.message : String(queryError)) : null,

    // Actions
    toggleComptaCheck,
    bulkCheck,
    excludeFromCompta,
    bulkExclude,
    refresh,
  }
}
