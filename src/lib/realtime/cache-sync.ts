/**
 * Synchronisation du cache TanStack Query avec les événements Supabase Realtime
 * Met à jour le cache optimistiquement puis invalide silencieusement pour garantir la cohérence
 */

import type { QueryClient } from '@tanstack/react-query'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import type { Intervention } from '@/lib/api/v2/common/types'
import type { PaginatedResponse } from '@/lib/api/v2/common/types'
import { interventionKeys } from '@/lib/react-query/queryKeys'
import { matchesFilters, extractFiltersFromQueryKey } from './filter-utils'
import { debounce } from '@/utils/debounce'
import { getInterventionTotalCount, getInterventionCounts } from '@/lib/supabase-api-v2'
import type { GetAllParams } from '@/lib/supabase-api-v2'
import { createBroadcastSync } from './broadcast-sync'
import {
  getRemoteEditIndicatorManager,
  getUserColor,
  getChangedFields,
} from './remote-edit-indicator'

// Import pour l'enrichissement des données
import { mapInterventionRecord } from '@/lib/api/v2/common/utils'
import { referenceApi } from '@/lib/reference-api'

// Cache de référence pour l'enrichissement (similaire aux autres fichiers)
interface ReferenceCache {
  data: any
  fetchedAt: number
  usersById: Map<string, any>
  agenciesById: Map<string, any>
  interventionStatusesById: Map<string, any>
  metiersById: Map<string, any>
}

const REFERENCE_CACHE_DURATION = 5 * 60 * 1000 // 5 minutes
let referenceCache: ReferenceCache | null = null
let referenceCachePromise: Promise<ReferenceCache> | null = null

/**
 * Obtient le cache de référence pour enrichir les données
 */
async function getReferenceCache(): Promise<ReferenceCache> {
  const now = Date.now()
  if (referenceCache && now - referenceCache.fetchedAt < REFERENCE_CACHE_DURATION) {
    return referenceCache
  }

  if (referenceCachePromise) {
    return referenceCachePromise
  }

  referenceCachePromise = (async () => {
    const data = await referenceApi.getAll()
    const cache: ReferenceCache = {
      data,
      fetchedAt: Date.now(),
      usersById: new Map(data.users.map((user: any) => [user.id, user])),
      agenciesById: new Map(data.agencies.map((agency: any) => [agency.id, agency])),
      interventionStatusesById: new Map(
        data.interventionStatuses.map((status: any) => [status.id, status])
      ),
      metiersById: new Map(data.metiers.map((metier: any) => [metier.id, metier])),
    }
    referenceCache = cache
    referenceCachePromise = null
    return cache
  })()

  try {
    return await referenceCachePromise
  } catch (error) {
    referenceCachePromise = null
    throw error
  }
}

/**
 * Enrichit un enregistrement brut de Supabase Realtime avec les données calculées
 * Utilise le même mapper que les requêtes normales pour garantir la cohérence
 */
async function enrichRealtimeRecord(
  rawRecord: Intervention
): Promise<Intervention> {
  try {
    const refs = await getReferenceCache()
    return mapInterventionRecord(rawRecord, refs) as Intervention
  } catch (error) {
    console.error('[cache-sync] Erreur lors de l\'enrichissement:', error)
    // En cas d'erreur, retourner le record brut plutôt que de bloquer
    return rawRecord
  }
}

// Instance singleton de BroadcastSync
let broadcastSync: ReturnType<typeof createBroadcastSync> | null = null

/**
 * Initialise la synchronisation BroadcastChannel
 * 
 * @param queryClient - Instance QueryClient de TanStack Query
 */
export function initializeCacheSync(queryClient: QueryClient) {
  if (!broadcastSync) {
    broadcastSync = createBroadcastSync(queryClient)
  }
  return broadcastSync
}

/**
 * Détermine si un UPDATE est un soft delete (is_active passe à false)
 * 
 * @param oldRecord - Ancien enregistrement
 * @param newRecord - Nouvel enregistrement
 * @returns true si c'est un soft delete
 */
export function isSoftDelete(
  oldRecord: Intervention | null,
  newRecord: Intervention | null
): boolean {
  return oldRecord?.is_active === true && newRecord?.is_active === false
}

/**
 * Détermine si les compteurs doivent être mis à jour selon le type d'événement
 * 
 * @param eventType - Type d'événement (INSERT, UPDATE, DELETE)
 * @param oldRecord - Ancien enregistrement (pour UPDATE)
 * @param newRecord - Nouvel enregistrement
 * @returns true si les compteurs doivent être mis à jour
 */
export function shouldRefreshCounts(
  eventType: 'INSERT' | 'UPDATE' | 'DELETE',
  oldRecord: Intervention | null,
  newRecord: Intervention | null
): boolean {
  if (eventType === 'INSERT' || eventType === 'DELETE') {
    return true
  }

  if (eventType === 'UPDATE' && oldRecord && newRecord) {
    // Mettre à jour les compteurs si les champs affectant les filtres ont changé
    return (
      oldRecord.statut_id !== newRecord.statut_id ||
      oldRecord.assigned_user_id !== newRecord.assigned_user_id ||
      oldRecord.artisan_id !== newRecord.artisan_id ||
      oldRecord.agence_id !== newRecord.agence_id ||
      oldRecord.metier_id !== newRecord.metier_id ||
      oldRecord.is_active !== newRecord.is_active
    )
  }

  return false
}

/**
 * Debounce pour rafraîchir les compteurs
 * Regroupe les mises à jour multiples en un seul appel API
 */
const debouncedRefreshCounts = debounce(async (queryClient: QueryClient) => {
  // Invalider tous les résumés pour forcer le recalcul via API
  queryClient.invalidateQueries({
    queryKey: interventionKeys.summaries(),
    refetchType: 'active', // Refetch pour recalculer via API
  })
}, 500)

/**
 * Synchronise le cache TanStack Query avec un événement Realtime
 * 
 * @param queryClient - Instance QueryClient de TanStack Query
 * @param payload - Payload de l'événement Realtime
 * @param currentUserId - ID de l'utilisateur actuel (pour détecter les modifications distantes)
 */
export async function syncCacheWithRealtimeEvent(
  queryClient: QueryClient,
  payload: RealtimePostgresChangesPayload<Intervention>,
  currentUserId?: string | null
): Promise<void> {
  const { eventType, new: newRecord, old: oldRecord } = payload
  const indicatorManager = getRemoteEditIndicatorManager()

  console.log(`[cache-sync] Événement ${eventType} pour intervention ${newRecord?.id || oldRecord?.id}`)

  // ⚠️ IMPORTANT : Enrichir le nouveau record avant de le mettre dans le cache
  // Le payload Realtime ne contient que les colonnes de la table, pas les données enrichies
  let enrichedNewRecord: Intervention | null = null
  if (newRecord) {
    enrichedNewRecord = await enrichRealtimeRecord(newRecord)
    console.log(`[cache-sync] Record enrichi pour intervention ${enrichedNewRecord.id}, statut: ${enrichedNewRecord.statusValue}`)
  }

  // Gestion des soft deletes
  if (eventType === 'UPDATE' && isSoftDelete(oldRecord, enrichedNewRecord)) {
    console.log(`[cache-sync] Soft delete détecté pour intervention ${enrichedNewRecord!.id}`)
    handleSoftDelete(queryClient, enrichedNewRecord!)
    return
  }

  // Mise à jour optimiste du cache pour toutes les listes complètes
  // Utiliser lists() qui retourne ["interventions", "list"] pour matcher toutes les queries ["interventions", "list", ...]
  const updatedListCount = queryClient.setQueriesData<PaginatedResponse<Intervention>>(
    { 
      queryKey: interventionKeys.lists(), // ["interventions", "list"]
      exact: false // Permet le matching partiel pour matcher ["interventions", "list", params, viewId]
    },
    (oldData, queryKey) => {
      if (!oldData) return oldData

      // Extraire les filtres depuis la query key
      const filters = extractFiltersFromQueryKey(queryKey as unknown[])

      switch (eventType) {
        case 'INSERT':
          return handleInsert(oldData, enrichedNewRecord!, filters)

        case 'UPDATE':
          return handleUpdate(oldData, oldRecord, enrichedNewRecord!, filters)

        case 'DELETE':
          return handleDelete(oldData, oldRecord!.id, filters)

        default:
          return oldData
      }
    }
  )

  // Mise à jour optimiste du cache pour toutes les listes light
  // Utiliser lightLists() qui retourne ["interventions", "light"] pour matcher toutes les queries ["interventions", "light", ...]
  const updatedLightCount = queryClient.setQueriesData<PaginatedResponse<Intervention>>(
    { 
      queryKey: interventionKeys.lightLists(), // ["interventions", "light"]
      exact: false // Permet le matching partiel pour matcher ["interventions", "light", params, viewId]
    },
    (oldData, queryKey) => {
      if (!oldData) return oldData

      // Extraire les filtres depuis la query key
      const filters = extractFiltersFromQueryKey(queryKey as unknown[])

      switch (eventType) {
        case 'INSERT':
          return handleInsert(oldData, enrichedNewRecord!, filters)

        case 'UPDATE':
          return handleUpdate(oldData, oldRecord, enrichedNewRecord!, filters)

        case 'DELETE':
          return handleDelete(oldData, oldRecord!.id, filters)

        default:
          return oldData
      }
    }
  )

  console.log(`[cache-sync] ${updatedListCount} queries de listes complètes mises à jour, ${updatedLightCount} queries de listes light mises à jour`)

  // US7: Détecter les modifications distantes et créer des indicateurs
  if (enrichedNewRecord && (eventType === 'INSERT' || eventType === 'UPDATE')) {
    // Vérifier si c'est une modification distante (pas locale)
    const isRemoteModification = !indicatorManager.isLocalModification(enrichedNewRecord.id)
    
    if (isRemoteModification && currentUserId) {
      // Créer un indicateur de modification distante
      const changedFields = getChangedFields(oldRecord, enrichedNewRecord)
      const userId = enrichedNewRecord.assigned_user_id || null // Utiliser assigned_user_id comme proxy
      
      indicatorManager.addIndicator({
        interventionId: enrichedNewRecord.id,
        userId,
        userName: null, // Sera enrichi plus tard si nécessaire
        userColor: getUserColor(userId),
        fields: changedFields,
        timestamp: Date.now(),
        eventType,
      })
      
      console.log(`[cache-sync] Modification distante détectée pour intervention ${enrichedNewRecord.id} par utilisateur ${userId}`)
    }

    // Mise à jour du détail de l'intervention si elle existe dans le cache
    queryClient.setQueryData(
      interventionKeys.detail(enrichedNewRecord.id),
      enrichedNewRecord
    )
  }

  // Invalidation silencieuse après 100ms pour garantir la cohérence
  setTimeout(() => {
    queryClient.invalidateQueries({
      queryKey: interventionKeys.invalidateLists(),
      refetchType: 'none', // Invalidation silencieuse sans refetch
    })
  }, 100)

  // Rafraîchir les compteurs si nécessaire
  if (shouldRefreshCounts(eventType, oldRecord, enrichedNewRecord)) {
    debouncedRefreshCounts(queryClient)
  }

  // Broadcast aux autres onglets
  if (broadcastSync && enrichedNewRecord) {
    broadcastSync.broadcastRealtimeEvent(
      interventionKeys.invalidateLists(),
      eventType,
      enrichedNewRecord.id
    )
  }
}

/**
 * Gère l'insertion d'une nouvelle intervention dans le cache
 */
function handleInsert(
  oldData: PaginatedResponse<Intervention>,
  newRecord: Intervention,
  filters: GetAllParams | undefined
): PaginatedResponse<Intervention> {
  // Vérification de garde : s'assurer que oldData existe et est valide
  if (!oldData || !oldData.data || !Array.isArray(oldData.data)) {
    return oldData || { data: [], pagination: { limit: 0, offset: 0, total: 0, hasMore: false } }
  }

  // Vérifier si l'intervention correspond aux filtres
  if (!matchesFilters(newRecord, filters)) {
    return oldData
  }

  // Vérifier que pagination existe
  const currentTotal = oldData.pagination?.total ?? oldData.data.length

  // Ajouter l'intervention au début de la liste
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
 * Gère la mise à jour d'une intervention dans le cache
 * 
 * Cette fonction gère automatiquement :
 * - US1: Changements d'assignation (assigned_user_id) - retrait de Market, ajout dans Mes demandes
 * - US2: Changements de statut (statut_id) - retrait des vues avec ancien statut, ajout dans nouvelles vues
 * - US11: Modifications d'autres champs (agence, métier, date, etc.)
 * - US12: Changements d'artisan assigné (artisan_id)
 * 
 * La logique utilise matchesFilters() pour déterminer si l'intervention correspond aux filtres de chaque vue.
 * Si l'intervention ne correspond plus aux filtres après mise à jour, elle est retirée de la vue.
 * Si l'intervention correspond maintenant aux filtres mais n'était pas dans la vue, elle est ajoutée.
 */
function handleUpdate(
  oldData: PaginatedResponse<Intervention>,
  oldRecord: Intervention | null,
  newRecord: Intervention,
  filters: GetAllParams | undefined
): PaginatedResponse<Intervention> {
  // Vérification de garde : s'assurer que oldData existe et est valide
  if (!oldData || !oldData.data || !Array.isArray(oldData.data)) {
    return oldData || { data: [], pagination: { limit: 0, offset: 0, total: 0, hasMore: false } }
  }

  const index = oldData.data.findIndex((i) => i.id === newRecord.id)
  const wasInList = index !== -1
  // matchesFilters() gère automatiquement les filtres user (null pour Market, user_id pour Mes demandes),
  // statut, artisan, agence, métier, date, etc.
  const matchesNow = matchesFilters(newRecord, filters)

  // Vérifier que pagination existe
  const currentTotal = oldData.pagination?.total ?? oldData.data.length

  if (!wasInList && !matchesNow) {
    // L'intervention n'était pas dans la liste et ne doit toujours pas y être
    return oldData
  }

  if (!wasInList && matchesNow) {
    // L'intervention n'était pas dans la liste mais doit maintenant y apparaître
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

  if (wasInList && matchesNow) {
    // L'intervention était dans la liste et doit y rester (mise à jour)
    return {
      ...oldData,
      data: [
        ...oldData.data.slice(0, index),
        newRecord,
        ...oldData.data.slice(index + 1),
      ],
    }
  }

  if (wasInList && !matchesNow) {
    // L'intervention était dans la liste mais ne doit plus y être (retrait)
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

/**
 * Gère la suppression d'une intervention du cache
 */
function handleDelete(
  oldData: PaginatedResponse<Intervention>,
  deletedId: string,
  filters: GetAllParams | undefined
): PaginatedResponse<Intervention> {
  // Vérification de garde : s'assurer que oldData existe et est valide
  if (!oldData || !oldData.data || !Array.isArray(oldData.data)) {
    return oldData || { data: [], pagination: { limit: 0, offset: 0, total: 0, hasMore: false } }
  }

  const index = oldData.data.findIndex((i) => i.id === deletedId)
  if (index === -1) {
    return oldData
  }

  // Vérifier que pagination existe
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

/**
 * Gère les soft deletes (is_active passe à false)
 */
function handleSoftDelete(queryClient: QueryClient, deletedRecord: Intervention) {
  console.log(`[cache-sync] Traitement du soft delete pour intervention ${deletedRecord.id}`)
  
  // Retirer l'intervention de toutes les listes complètes
  const updatedListCount = queryClient.setQueriesData<PaginatedResponse<Intervention>>(
    { 
      queryKey: interventionKeys.lists(),
      exact: false
    },
    (oldData) => {
      if (!oldData) return oldData

      // Vérifier que pagination existe
      const currentTotal = oldData.pagination?.total ?? oldData.data.length

      return {
        ...oldData,
        data: oldData.data.filter((i) => i.id !== deletedRecord.id),
        pagination: {
          ...oldData.pagination,
          limit: oldData.pagination?.limit ?? oldData.data.length,
          offset: oldData.pagination?.offset ?? 0,
          total: Math.max(0, currentTotal - 1),
          hasMore: oldData.pagination?.hasMore ?? false,
        },
      }
    }
  )

  // Retirer l'intervention de toutes les listes light
  const updatedLightCount = queryClient.setQueriesData<PaginatedResponse<Intervention>>(
    { 
      queryKey: interventionKeys.lightLists(),
      exact: false
    },
    (oldData) => {
      if (!oldData) return oldData

      // Vérifier que pagination existe
      const currentTotal = oldData.pagination?.total ?? oldData.data.length

      return {
        ...oldData,
        data: oldData.data.filter((i) => i.id !== deletedRecord.id),
        pagination: {
          ...oldData.pagination,
          limit: oldData.pagination?.limit ?? oldData.data.length,
          offset: oldData.pagination?.offset ?? 0,
          total: Math.max(0, currentTotal - 1),
          hasMore: oldData.pagination?.hasMore ?? false,
        },
      }
    }
  )

  console.log(`[cache-sync] Soft delete: ${updatedListCount} listes complètes et ${updatedLightCount} listes light mises à jour`)

  // Invalider le détail de l'intervention
  queryClient.invalidateQueries({
    queryKey: interventionKeys.detail(deletedRecord.id),
  })

  // Rafraîchir les compteurs
  debouncedRefreshCounts(queryClient)

  // TODO: Afficher une notification toast "Intervention supprimée"
  // TODO: Annuler les modifications en cours sur cette intervention
}

