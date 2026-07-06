/**
 * Handlers pour les evenements Realtime (INSERT, UPDATE, DELETE)
 * Gere la mise a jour optimiste du cache TanStack Query
 */

import type { QueryClient } from '@tanstack/react-query'
import type { Intervention } from '@/lib/api/common/types'
import type { PaginatedResponse } from '@/lib/api/common/types'
import type { InterventionQueryParams } from '@/lib/api'
import { interventionKeys } from '@/lib/react-query/queryKeys'
import { matchesFilters, extractFiltersFromQueryKey } from '@/lib/realtime/filter-utils'
import { getRemoteEditIndicatorManager } from '@/lib/realtime/remote-edit-indicator'
import { getSyncQueue } from '@/lib/realtime/sync-queue'
import { toast } from 'sonner'
import { debouncedRefreshCounts, getBroadcastSync } from './broadcasting'

type GetAllParams = InterventionQueryParams

const EMPTY_PAGINATION = { limit: 0, offset: 0, total: 0, hasMore: false }

export type InterventionQueryUpdater = (
  oldData: PaginatedResponse<Intervention>,
  filters: GetAllParams | undefined,
  queryKey: readonly unknown[]
) => PaginatedResponse<Intervention>

export function updateInterventionQueries(
  queryClient: QueryClient,
  keyFactory: () => readonly unknown[],
  updater: InterventionQueryUpdater
): number {
  const queries = queryClient.getQueryCache().findAll({ queryKey: keyFactory(), exact: false })
  let updatedCount = 0

  for (const query of queries) {
    const oldData = query.state.data as PaginatedResponse<Intervention> | undefined
    if (!oldData) continue

    const queryKey = query.queryKey as unknown[]
    const filters = extractFiltersFromQueryKey(queryKey)
    const nextData = updater(oldData, filters, queryKey)

    if (nextData !== oldData) {
      queryClient.setQueryData(queryKey, nextData)
      updatedCount++
    }
  }
  return updatedCount
}

/** Gere l'insertion d'une nouvelle intervention dans le cache */
export function handleInsert(
  oldData: PaginatedResponse<Intervention>,
  newRecord: Intervention,
  filters: GetAllParams | undefined
): PaginatedResponse<Intervention> {
  if (!oldData || !oldData.data || !Array.isArray(oldData.data)) {
    return oldData || { data: [], pagination: EMPTY_PAGINATION }
  }
  if (!filters) return oldData
  // Recherche server-authoritative : la composition d'une liste filtree par `search` est
  // tranchee par la RPC full-text serveur (search_interventions), que le client ne peut pas
  // reproduire (elle couvre id_inter, agence, artisan, locataire... la-ou matchesFilters ne
  // teste que 4 champs). On n'insere donc pas optimistiquement ici ; le refetch des listes
  // actives (declenche sur INSERT) recompose la liste cote serveur.
  if (filters.search) return oldData
  if (!matchesFilters(newRecord, filters)) return oldData

  const currentTotal = oldData.pagination?.total ?? oldData.data.length
  return {
    ...oldData,
    data: [newRecord, ...oldData.data],
    pagination: {
      ...oldData.pagination,
      limit: oldData.pagination?.limit ?? oldData.data.length,
      offset: oldData.pagination?.offset ?? 0,
      total: currentTotal + 1,
      hasMore: oldData.pagination?.hasMore ?? false,
    },
  }
}

/**
 * Preserve les champs d'affichage derives de l'artisan lors d'une mise a jour Realtime.
 *
 * Un payload Realtime de la table `interventions` ne transporte JAMAIS ses relations
 * (intervention_artisans). `mapInterventionRecord` remet donc `artisan`/`primaryArtisan`/
 * `deuxiemeArtisan` a null et `artisans` a []. Sans correction, l'artisan « disparait » de
 * la ligne des qu'un commentaire / cout / paiement bump `interventions.updated_at`
 * (trigger 00082), jusqu'au prochain refetch. On restaure donc ces champs depuis la version
 * deja presente en cache.
 *
 * C'est sur : l'affectation d'un artisan ne peut pas changer via un UPDATE de la table
 * `interventions` (elle vit dans `intervention_artisans`). Une vraie (re)assignation reste
 * refletee par l'invalidation du detail (bridgeDetailCache) puis le refetch des listes.
 */
function preserveArtisanDisplayFields(
  previous: Intervention,
  incoming: Intervention
): Intervention {
  const prev = previous as any
  const next = incoming as any
  const incomingHasArtisans = Array.isArray(next.artisans) && next.artisans.length > 0
  return {
    ...incoming,
    artisan: next.artisan ?? prev.artisan ?? null,
    primaryArtisan: next.primaryArtisan ?? prev.primaryArtisan ?? null,
    deuxiemeArtisan: next.deuxiemeArtisan ?? prev.deuxiemeArtisan ?? null,
    artisans: incomingHasArtisans ? next.artisans : (prev.artisans ?? next.artisans ?? []),
  } as Intervention
}

/**
 * Gere la mise a jour d'une intervention dans le cache.
 * Utilise matchesFilters() pour determiner si l'intervention correspond aux filtres de chaque vue.
 */
export function handleUpdate(
  oldData: PaginatedResponse<Intervention>,
  oldRecord: Intervention | null,
  newRecord: Intervention,
  filters: GetAllParams | undefined
): PaginatedResponse<Intervention> {
  if (!oldData || !oldData.data || !Array.isArray(oldData.data)) {
    return oldData || { data: [], pagination: EMPTY_PAGINATION }
  }

  const index = oldData.data.findIndex((i) => i.id === newRecord.id)
  const wasInList = index !== -1

  // Le record vient du Realtime (relations absentes) : quand l'intervention figure deja
  // dans la liste, on restaure l'artisan depuis le cache pour eviter qu'il « disparaisse ».
  const nextRecord = wasInList
    ? preserveArtisanDisplayFields(oldData.data[index], newRecord)
    : newRecord

  if (!filters) {
    if (wasInList) {
      return {
        ...oldData,
        data: [...oldData.data.slice(0, index), nextRecord, ...oldData.data.slice(index + 1)],
      }
    }
    return oldData
  }

  // Recherche server-authoritative (cf. handleInsert) : on ne laisse pas matchesFilters
  // trancher l'appartenance d'une liste de recherche, car son matching a 4 champs
  // (contexte/adresse/ville/commentaire_agent) differe de la RPC full-text serveur.
  // Mise a jour EN PLACE uniquement : jamais d'ejection — sinon l'intervention « saute »
  // des qu'un commentaire/cout/paiement/artisan touche updated_at via le trigger 00082,
  // alors que `invalidateActiveLists` ne refetch pas sur UPDATE — ni insertion. Le refetch
  // serveur reste seul maitre de la composition d'une recherche.
  if (filters.search) {
    if (wasInList) {
      return {
        ...oldData,
        data: [...oldData.data.slice(0, index), nextRecord, ...oldData.data.slice(index + 1)],
      }
    }
    return oldData
  }

  const matchesNow = matchesFilters(newRecord, filters)
  const currentTotal = oldData.pagination?.total ?? oldData.data.length

  // CAS 1: Pas dans la liste et ne doit toujours pas y etre
  if (!wasInList && !matchesNow) return oldData

  // CAS 2: Pas dans la liste mais doit maintenant y apparaitre
  if (!wasInList && matchesNow) {
    return {
      ...oldData,
      data: [nextRecord, ...oldData.data],
      pagination: {
        ...oldData.pagination,
        limit: oldData.pagination?.limit ?? oldData.data.length,
        offset: oldData.pagination?.offset ?? 0,
        total: currentTotal + 1,
        hasMore: oldData.pagination?.hasMore ?? false,
      },
    }
  }

  // CAS 3: Dans la liste et doit y rester (mise a jour)
  if (wasInList && matchesNow) {
    return {
      ...oldData,
      data: [...oldData.data.slice(0, index), nextRecord, ...oldData.data.slice(index + 1)],
    }
  }

  // CAS 4: Dans la liste mais ne doit plus y etre (retrait)
  if (wasInList && !matchesNow) {
    return {
      ...oldData,
      data: oldData.data.filter((i) => i.id !== newRecord.id),
      pagination: {
        ...oldData.pagination,
        limit: oldData.pagination?.limit ?? oldData.data.length,
        offset: oldData.pagination?.offset ?? 0,
        total: Math.max(0, currentTotal - 1),
        hasMore: oldData.pagination?.hasMore ?? false,
      },
    }
  }

  return oldData
}

/** Gere la suppression d'une intervention du cache */
export function handleDelete(
  oldData: PaginatedResponse<Intervention>,
  deletedId: string,
  filters: GetAllParams | undefined
): PaginatedResponse<Intervention> {
  if (!oldData || !oldData.data || !Array.isArray(oldData.data)) {
    return oldData || { data: [], pagination: EMPTY_PAGINATION }
  }

  const index = oldData.data.findIndex((i) => i.id === deletedId)
  if (index === -1) return oldData

  const currentTotal = oldData.pagination?.total ?? oldData.data.length
  return {
    ...oldData,
    data: oldData.data.filter((i) => i.id !== deletedId),
    pagination: {
      ...oldData.pagination,
      limit: oldData.pagination?.limit ?? oldData.data.length,
      offset: oldData.pagination?.offset ?? 0,
      total: Math.max(0, currentTotal - 1),
      hasMore: oldData.pagination?.hasMore ?? false,
    },
  }
}

function removeInterventionFromResponse(
  oldData: PaginatedResponse<Intervention> | undefined,
  interventionId: string
): PaginatedResponse<Intervention> | undefined {
  if (!oldData || !oldData.data || !Array.isArray(oldData.data)) return oldData
  if (!oldData.data.some((i) => i.id === interventionId)) return oldData

  const currentTotal = oldData.pagination?.total ?? oldData.data.length
  return {
    ...oldData,
    data: oldData.data.filter((i) => i.id !== interventionId),
    pagination: {
      ...(oldData.pagination ?? {}),
      limit: oldData.pagination?.limit ?? oldData.data.length,
      offset: oldData.pagination?.offset ?? 0,
      total: Math.max(0, currentTotal - 1),
      hasMore: oldData.pagination?.hasMore ?? false,
    },
  }
}

export function removeInterventionFromAllCaches(
  queryClient: QueryClient,
  interventionId: string
) {
  const updatedListCount = queryClient.setQueriesData<PaginatedResponse<Intervention>>(
    { queryKey: interventionKeys.lists(), exact: false },
    (oldData) => removeInterventionFromResponse(oldData, interventionId)
  )
  const updatedLightCount = queryClient.setQueriesData<PaginatedResponse<Intervention>>(
    { queryKey: interventionKeys.lightLists(), exact: false },
    (oldData) => removeInterventionFromResponse(oldData, interventionId)
  )
  return { updatedListCount, updatedLightCount }
}

function cleanupAfterInterventionRemoval(
  interventionId: string,
  indicatorManager: ReturnType<typeof getRemoteEditIndicatorManager>
) {
  indicatorManager.removeIndicator(interventionId)
  if (typeof window === 'undefined') return

  try {
    const syncQueue = getSyncQueue()
    syncQueue.dequeueByInterventionId(interventionId)
  } catch (error) {
    console.warn(`[cache-sync] Erreur lors du nettoyage de la file pour ${interventionId}:`, error)
  }
}

export function handleAccessRevoked(
  queryClient: QueryClient,
  revokedRecord: Intervention,
  indicatorManager: ReturnType<typeof getRemoteEditIndicatorManager>
) {
  console.warn(`[cache-sync] Traitement de la perte d'accès pour intervention ${revokedRecord.id}`)

  const { updatedListCount, updatedLightCount } = removeInterventionFromAllCaches(queryClient, revokedRecord.id)
  console.warn(`[cache-sync] Accès retiré: ${updatedListCount} listes complètes et ${updatedLightCount} listes light mises à jour`)

  queryClient.removeQueries({ queryKey: interventionKeys.detail(revokedRecord.id) })

  setTimeout(() => {
    queryClient.invalidateQueries({ queryKey: interventionKeys.invalidateLists(), refetchType: 'active' })
    queryClient.invalidateQueries({ queryKey: interventionKeys.invalidateLightLists(), refetchType: 'active' })
    queryClient.invalidateQueries({ queryKey: interventionKeys.invalidateFilterCounts() })
  }, 0)

  debouncedRefreshCounts(queryClient)
  cleanupAfterInterventionRemoval(revokedRecord.id, indicatorManager)

  toast.error('Accès retiré', {
    description: 'Vous n\'avez plus accès à cette intervention. Elle a été réassignée ou vos permissions ont changé.',
    duration: 5000,
  })

  const broadcastSync = getBroadcastSync()
  if (broadcastSync) {
    broadcastSync.broadcastRealtimeEvent(interventionKeys.invalidateLists(), 'DELETE', revokedRecord.id)
    broadcastSync.broadcastRealtimeEvent(interventionKeys.invalidateLightLists(), 'DELETE', revokedRecord.id)
  }
}

/** Gere les soft deletes (is_active passe a false) */
export function handleSoftDelete(
  queryClient: QueryClient,
  deletedRecord: Intervention,
  indicatorManager: ReturnType<typeof getRemoteEditIndicatorManager>
) {
  removeInterventionFromAllCaches(queryClient, deletedRecord.id)

  queryClient.invalidateQueries({ queryKey: interventionKeys.detail(deletedRecord.id) })
  debouncedRefreshCounts(queryClient)

  toast.info('Intervention supprimée', {
    description: `L'intervention a été supprimée par ${(deletedRecord as any).updated_by ? 'un autre utilisateur' : 'le système'}.`,
    duration: 5000,
  })

  cleanupAfterInterventionRemoval(deletedRecord.id, indicatorManager)
}
