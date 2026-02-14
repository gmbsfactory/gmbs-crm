import { useCallback, useEffect, useMemo } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { interventionsApi } from "@/lib/api/v2"
import { comptaApi } from "@/lib/api/compta"
import { comptabiliteKeys, type ComptabiliteQueryParams } from "@/lib/react-query/queryKeys"
import { getPreloadConfig } from "@/lib/device-capabilities"
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
 * Fonction de fetch partagée entre la query principale et le prefetch.
 * Récupère les interventions INTER_TERMINEE, les dates de facturation et les checks
 * en parallélisant les appels indépendants.
 */
export async function fetchComptabiliteData(
  dateRange: { start: string; end: string } | null
): Promise<ComptabiliteData> {
  // 1. Récupérer le statut INTER_TERMINEE
  const status = await interventionsApi.getStatusByCode("INTER_TERMINEE")
  if (!status?.id) {
    throw new Error("Statut INTER_TERMINEE introuvable")
  }

  // 2. Fetch toutes les interventions terminées
  const { data } = await interventionsApi.getAll({
    statut: status.id,
    include: ["artisans", "costs", "payments", "owner"],
    limit: 1000,
  })

  const allInterventions = (data || []).filter((intervention) => {
    const statusCode = (intervention.status?.code || (intervention as any).statusValue || (intervention as any).statut || "").toUpperCase()
    return statusCode === "INTER_TERMINEE"
  })

  // 3. PARALLÈLE : fetch dates de facturation ET checks compta simultanément
  const allIds = allInterventions.map(i => i.id)
  const [dates, checkedIds] = await Promise.all([
    comptaApi.getFacturationDates(allIds),
    comptaApi.getCheckedInterventions(allIds),
  ])

  // 4. Filtrer par plage de dates de facturation
  let filtered = allInterventions
  if (dateRange) {
    const start = new Date(dateRange.start)
    const end = new Date(dateRange.end)
    filtered = allInterventions.filter((intervention) => {
      const dateFacturation = dates.get(intervention.id)
      if (!dateFacturation) return false
      const date = new Date(dateFacturation)
      return date >= start && date <= end
    })
  }

  // 5. Trier par date de facturation (plus récent en premier)
  filtered.sort((a, b) => {
    const dateA = new Date(dates.get(a.id) || 0).getTime()
    const dateB = new Date(dates.get(b.id) || 0).getTime()
    return dateB - dateA
  })

  return {
    interventions: filtered as InterventionRecord[],
    facturationDates: dates,
    checkedIds,
    totalCount: filtered.length,
  }
}

export function useComptabiliteQuery(options: UseComptabiliteQueryOptions) {
  const queryClient = useQueryClient()
  const { dateRange, enabled = true, page = 1, itemsPerPage = 100 } = options

  const preloadConfig = useMemo(() => getPreloadConfig(), [])

  const queryParams = useMemo((): ComptabiliteQueryParams => ({
    dateStart: dateRange?.start,
    dateEnd: dateRange?.end,
  }), [dateRange])

  // Query principale unifiée : interventions + dates + checks en parallèle
  const {
    data: comptaData,
    isLoading,
    isPlaceholderData,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: comptabiliteKeys.list(queryParams),
    queryFn: () => fetchComptabiliteData(dateRange),
    enabled: enabled,
    staleTime: preloadConfig.staleTime,
    gcTime: preloadConfig.gcTime,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    placeholderData: (previousData) => previousData,
    structuralSharing: false,
  })

  // Données extraites du cache (stabilisées via useMemo)
  const allInterventions = useMemo(
    () => comptaData?.interventions ?? [],
    [comptaData?.interventions]
  )
  const facturationDates = comptaData?.facturationDates ?? new Map<string, string>()
  const totalCount = comptaData?.totalCount ?? 0

  // Checks extraits du cache, converti en Set stable
  const checkedInterventions = useMemo(
    () => comptaData?.checkedIds ?? new Set<string>(),
    [comptaData?.checkedIds]
  )

  // Pagination client-side sur les données cachées
  const totalPages = Math.max(1, Math.ceil(totalCount / itemsPerPage))
  const paginatedInterventions = useMemo(() => {
    const startIndex = (page - 1) * itemsPerPage
    return allInterventions.slice(startIndex, startIndex + itemsPerPage)
  }, [allInterventions, page, itemsPerPage])

  // ── Prefetch des périodes adjacentes ──
  // Après le chargement de la période courante, précharger la période suivante
  // pour que le changement de filtre soit instantané
  const isLowEnd = preloadConfig.isLowEnd
  const prefetchStaleTime = preloadConfig.staleTime

  useEffect(() => {
    if (!enabled || !dateRange || !comptaData || isLowEnd) return

    const prefetchAdjacentPeriod = (adjacentRange: { start: string; end: string }) => {
      const adjacentParams: ComptabiliteQueryParams = {
        dateStart: adjacentRange.start,
        dateEnd: adjacentRange.end,
      }

      queryClient.prefetchQuery({
        queryKey: comptabiliteKeys.list(adjacentParams),
        queryFn: () => fetchComptabiliteData(adjacentRange),
        staleTime: prefetchStaleTime,
      }).catch(() => {
        // Ignorer silencieusement les erreurs de préchargement
      })
    }

    // Calculer la période suivante (mois ou année selon la taille de la plage)
    const startDate = new Date(dateRange.start)
    const endDate = new Date(dateRange.end)
    const durationMs = endDate.getTime() - startDate.getTime()

    // Prefetch avec un délai pour ne pas bloquer le rendu
    const timeoutId = setTimeout(() => {
      // Période suivante
      const nextStart = new Date(endDate.getTime() + 1)
      const nextEnd = new Date(nextStart.getTime() + durationMs)
      prefetchAdjacentPeriod({
        start: nextStart.toISOString(),
        end: nextEnd.toISOString(),
      })
    }, 800)

    return () => clearTimeout(timeoutId)
  }, [enabled, dateRange, comptaData, queryClient, isLowEnd, prefetchStaleTime])

  // ── Optimistic updates ──

  const queryKey = comptabiliteKeys.list(queryParams)

  // Toggle optimiste d'un check compta (mise à jour directe du cache unifié)
  const toggleComptaCheck = useCallback(async (interventionId: string) => {
    const wasChecked = checkedInterventions.has(interventionId)
    const newChecked = !wasChecked

    // Mise à jour optimiste du cache unifié
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

  // Check en masse (copier + marquer comme gérées)
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

  // Refresh complet
  const refresh = useCallback(async () => {
    await refetch()
  }, [refetch])

  return {
    // Données
    interventions: paginatedInterventions,
    allInterventions,
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
    refresh,
  }
}
