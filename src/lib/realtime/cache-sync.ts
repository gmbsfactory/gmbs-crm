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
import { interventionsApi, type InterventionQueryParams } from '@/lib/api/v2'
import { createBroadcastSync } from './broadcast-sync'

// Alias pour compatibilité avec le code existant
type GetAllParams = InterventionQueryParams
import {
  getRemoteEditIndicatorManager,
  getUserColor,
  getChangedFields,
} from './remote-edit-indicator'
import { getSyncQueue } from './sync-queue'
import { toast } from 'sonner'

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
      JSON.stringify(oldRecord.artisans || []) !== JSON.stringify(newRecord.artisans || []) ||
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

  const newIntervention = newRecord && 'id' in newRecord ? newRecord : null
  const oldIntervention = oldRecord && 'id' in oldRecord ? oldRecord : null

  console.log(`[cache-sync] 🔄 Événement ${eventType} pour intervention ${newIntervention?.id || oldIntervention?.id}`, {
    eventType,
    newRecordId: newIntervention?.id,
    oldRecordId: oldIntervention?.id,
    currentUserId,
    hasNewRecord: !!newIntervention,
    hasOldRecord: !!oldIntervention,
    newRecordUpdatedBy: (newIntervention as any)?.updated_by,
    newRecordAssignedUserId: newIntervention?.assigned_user_id,
    fullNewRecord: newIntervention,
  })

  // ⚠️ IMPORTANT : Enrichir le nouveau record avant de le mettre dans le cache
  // Le payload Realtime ne contient que les colonnes de la table, pas les données enrichies
  let enrichedNewRecord: Intervention | null = null
  if (newIntervention) {
    enrichedNewRecord = await enrichRealtimeRecord(newIntervention)
    console.log(`[cache-sync] Record enrichi pour intervention ${enrichedNewRecord.id}`, {
      statut_id: enrichedNewRecord.statut_id,
      updated_by: (enrichedNewRecord as any).updated_by,
      assigned_user_id: enrichedNewRecord.assigned_user_id,
      hasUpdatedBy: !!(enrichedNewRecord as any).updated_by,
    })
  }

  // T088: Gestion de la perte d'accès RLS (payload.new absent => plus de permission SELECT)
  if (eventType === 'UPDATE' && !newIntervention && oldIntervention) {
    console.warn(
      `[cache-sync] Accès retiré détecté pour intervention ${oldIntervention.id} (payload.new manquant)`
    )
    handleAccessRevoked(queryClient, oldIntervention as Intervention, indicatorManager)
    return
  }

  // Gestion des soft deletes
  if (eventType === 'UPDATE' && isSoftDelete(oldIntervention as Intervention | null, enrichedNewRecord)) {
    console.log(`[cache-sync] Soft delete détecté pour intervention ${enrichedNewRecord!.id}`)
    handleSoftDelete(queryClient, enrichedNewRecord!, indicatorManager)
    return
  }

  // Mise à jour optimiste du cache pour toutes les listes complètes
  const updatedListCount = updateInterventionQueries(
    queryClient,
    interventionKeys.lists,
    (oldData, filters, queryKey) => {
      if (!oldData) {
        return oldData
      }

      if (filters && filters.user !== undefined) {
        console.log(`[cache-sync] Filtres extraits pour query key:`, {
          queryKey: queryKey.slice(0, 3),
          filters: {
            user: filters.user,
            statut: filters.statut,
            artisan: filters.artisan,
          },
        })
      }

      switch (eventType) {
        case 'INSERT':
          return handleInsert(oldData, enrichedNewRecord!, filters)
        case 'UPDATE':
          return handleUpdate(oldData, oldIntervention as Intervention | null, enrichedNewRecord!, filters)
        case 'DELETE':
          return handleDelete(oldData, (oldIntervention as Intervention)!.id, filters)
        default:
          return oldData
      }
    }
  )

  // Mise à jour optimiste du cache pour toutes les listes light
  const updatedLightCount = updateInterventionQueries(
    queryClient,
    interventionKeys.lightLists,
    (oldData, filters, queryKey) => {
      if (!oldData) {
        return oldData
      }

      if (filters && filters.user !== undefined) {
        console.log(`[cache-sync] Filtres extraits pour query key (light):`, {
          queryKey: queryKey.slice(0, 3),
          filters: {
            user: filters.user,
            statut: filters.statut,
            artisan: filters.artisan,
          },
        })
      }

      switch (eventType) {
        case 'INSERT':
          return handleInsert(oldData, enrichedNewRecord!, filters)
        case 'UPDATE':
          return handleUpdate(oldData, oldIntervention as Intervention | null, enrichedNewRecord!, filters)
        case 'DELETE':
          return handleDelete(oldData, (oldIntervention as Intervention)!.id, filters)
        default:
          return oldData
      }
    }
  )

  console.log(`[cache-sync] ${updatedListCount} queries de listes complètes mises à jour, ${updatedLightCount} queries de listes light mises à jour`)

  // CRITIQUE: Invalider les queries actives pour forcer le re-render
  // Utiliser un délai minimal pour éviter les conflits de rendu React lors de la suppression d'interventions
  // Cela garantit que les mises à jour du DOM sont synchronisées et évite l'erreur "removeChild"
  setTimeout(() => {
    // Debug: Compter les queries qui seront invalidées
    const listQueries = queryClient.getQueryCache().findAll({ 
      queryKey: interventionKeys.invalidateLists() 
    })
    const lightQueries = queryClient.getQueryCache().findAll({ 
      queryKey: interventionKeys.invalidateLightLists() 
    })
    
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[cache-sync] Invalidating ${listQueries.length} list queries and ${lightQueries.length} light queries`)
      if (listQueries.length === 0 && lightQueries.length === 0) {
        console.warn('[cache-sync] ⚠️ Aucune query trouvée pour invalidation - vérifier les clés de requête')
      }
    }
    
    queryClient.invalidateQueries({
      queryKey: interventionKeys.invalidateLists(),
      refetchType: 'active', // Forcer le re-render des queries actives (celles utilisées par les composants montés)
    })
    queryClient.invalidateQueries({
      queryKey: interventionKeys.invalidateLightLists(),
      refetchType: 'active',
    })
  }, 0)

  // US7: Détecter les modifications distantes et créer des indicateurs
  // US8: Détecter les conflits et afficher les notifications
  if (enrichedNewRecord && (eventType === 'INSERT' || eventType === 'UPDATE')) {
    // Vérifier si c'est une modification distante (pas locale)
    const isLocal = indicatorManager.isLocalModification(enrichedNewRecord.id)
    const isRemoteModification = !isLocal
    
    console.log(`[cache-sync] 🏷️ Vérification badge pour intervention ${enrichedNewRecord.id}:`, {
      isLocal,
      isRemoteModification,
      currentUserId,
      eventType,
      localModificationsSet: indicatorManager.getLocalModifications(),
    })
    
    // US8: Vérifier les conflits pour les UPDATE
    if (eventType === 'UPDATE' && oldIntervention && enrichedNewRecord) {
      const localUpdatedAt = indicatorManager.getLocalUpdatedAt(enrichedNewRecord.id)
      const remoteUpdatedAt = enrichedNewRecord.updated_at
      
      if (localUpdatedAt && remoteUpdatedAt) {
        const conflictDetected = detectConflict(
          enrichedNewRecord.id,
          oldIntervention.updated_at ?? null,
          remoteUpdatedAt,
          indicatorManager
        )
        
        if (conflictDetected && isLocal) {
          // Conflit détecté : la modification distante est plus récente
          // Afficher une notification pour informer l'utilisateur que sa modification a été écrasée
          const changedFields = getChangedFields(oldIntervention as Intervention, enrichedNewRecord)
          const remoteUserId = (enrichedNewRecord as any).updated_by || null
          
          // Récupérer le nom de l'utilisateur distant
          let remoteUserName: string | null = null
          try {
            const refs = await getReferenceCache()
            if (remoteUserId && refs.usersById) {
              const remoteUser = refs.usersById.get(remoteUserId)
              if (remoteUser) {
                remoteUserName = `${remoteUser.firstname || ''} ${remoteUser.lastname || ''}`.trim() || null
              }
            }
          } catch (error) {
            console.warn('[cache-sync] Erreur lors de la récupération du nom utilisateur:', error)
          }
          
          showConflictNotification(
            remoteUserName || 'Un autre utilisateur',
            changedFields.length > 0 ? changedFields[0] : 'les données',
            oldIntervention as Intervention,
            enrichedNewRecord
          )
        }
      }
    }
    
    if (isRemoteModification && currentUserId) {
      // Créer un indicateur de modification distante
      const changedFields = getChangedFields(oldIntervention as Intervention | null, enrichedNewRecord)
      // Utiliser updated_by pour identifier l'utilisateur qui a effectué la modification
      const userId = (enrichedNewRecord as any).updated_by || null
      
      console.log(`[cache-sync] 🎨 Récupération couleur pour utilisateur ${userId}`, {
      updated_by: (enrichedNewRecord as any).updated_by,
      hasUpdatedBy: !!(enrichedNewRecord as any).updated_by,
        interventionId: enrichedNewRecord.id,
      })
      
      // Récupérer la couleur depuis la table users via le cache de référence (avec fallback en cas d'erreur)
      let userColor: string
      try {
        const refs = await getReferenceCache()
        console.log(`[cache-sync] 📦 Cache récupéré:`, {
          usersCount: refs.usersById?.size || 0,
          userId,
          userInCache: refs.usersById?.has(userId || ''),
          userData: userId ? refs.usersById?.get(userId) : null,
        })
        userColor = getUserColor(userId, refs)
        console.log(`[cache-sync] 🎨 Couleur obtenue: ${userColor}`)
      } catch (error) {
        console.warn(`[cache-sync] ⚠️ Erreur lors de la récupération du cache de référence, utilisation du fallback:`, error)
        // Fallback : utiliser getUserColor sans cache si erreur
        userColor = getUserColor(userId)
        console.log(`[cache-sync] 🎨 Couleur fallback: ${userColor}`)
      }
      
      indicatorManager.addIndicator({
        interventionId: enrichedNewRecord.id,
        userId,
        userName: null, // Sera enrichi plus tard si nécessaire
        userColor,
        fields: changedFields,
        timestamp: Date.now(),
        eventType,
      })
      
      console.log(`[cache-sync] ✅ Badge créé pour intervention ${enrichedNewRecord.id} par utilisateur ${userId} (couleur: ${userColor})`)
    } else if (!currentUserId) {
      console.log(`[cache-sync] ⚠️ Pas de currentUserId (${currentUserId}), badge non créé pour intervention ${enrichedNewRecord.id}`)
    } else if (!isRemoteModification) {
      console.log(`[cache-sync] ℹ️ Modification locale détectée pour intervention ${enrichedNewRecord.id}, badge non créé (dans localModifications: ${isLocal})`)
    }

    // Mise à jour du détail de l'intervention si elle existe dans le cache
    queryClient.setQueryData(
      interventionKeys.detail(enrichedNewRecord.id),
      enrichedNewRecord
    )
  }

  // Note: L'invalidation immédiate ci-dessus avec refetchType: 'active' garantit déjà
  // que les queries actives sont marquées comme stale et déclenchent un re-render.
  // Avec un staleTime court, les données restent rapidement périmées,
  // donc le re-render se produit immédiatement après setQueryData + invalidation.

  // Rafraîchir les compteurs si nécessaire
  if (shouldRefreshCounts(eventType, oldIntervention as Intervention | null, enrichedNewRecord)) {
    debouncedRefreshCounts(queryClient)
  }

  // Broadcast aux autres onglets
  if (broadcastSync && enrichedNewRecord) {
    broadcastSync.broadcastRealtimeEvent(
      interventionKeys.invalidateLists(),
      eventType,
      enrichedNewRecord.id
    )
    broadcastSync.broadcastRealtimeEvent(
      interventionKeys.invalidateLightLists(),
      eventType,
      enrichedNewRecord.id
    )
  }
}

type InterventionQueryUpdater = (
  oldData: PaginatedResponse<Intervention>,
  filters: GetAllParams | undefined,
  queryKey: readonly unknown[]
) => PaginatedResponse<Intervention>

function updateInterventionQueries(
  queryClient: QueryClient,
  keyFactory: () => readonly unknown[],
  updater: InterventionQueryUpdater
): number {
  const queryCache = queryClient.getQueryCache()
  const queries = queryCache.findAll({
    queryKey: keyFactory(),
    exact: false,
  })

  let updatedCount = 0

  for (const query of queries) {
    const oldData = query.state.data as PaginatedResponse<Intervention> | undefined
    if (!oldData) {
      continue
    }

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

/**
 * Gère l'insertion d'une nouvelle intervention dans le cache
 * 
 * IMPORTANT: Cette fonction garantit que seules les interventions correspondant aux filtres
 * de la vue sont ajoutées au cache. Si les filtres ne sont pas définis, l'intervention n'est pas ajoutée.
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

  // CRITIQUE: Si les filtres ne sont pas définis, ne pas ajouter l'intervention
  // Cela évite d'ajouter des interventions à des queries qui n'ont pas de filtres spécifiques
  if (!filters) {
    return oldData
  }

  // Vérifier si l'intervention correspond aux filtres
  // Si elle ne correspond pas, ne pas l'ajouter à cette vue
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
 * 
 * IMPORTANT: Cette fonction garantit que seules les interventions correspondant aux filtres de la vue
 * sont ajoutées ou conservées dans le cache. Les interventions qui ne correspondent pas aux filtres
 * sont automatiquement retirées, même si elles étaient présentes avant la mise à jour.
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
  
  // CRITIQUE: Si les filtres ne sont pas définis, ne pas modifier cette query
  // Cela évite d'ajouter des interventions à des queries qui n'ont pas de filtres spécifiques
  // (par exemple, les queries de préchargement ou les queries générales)
  if (!filters) {
    // Si l'intervention était déjà dans la liste, la mettre à jour
    // Sinon, ne rien faire (ne pas l'ajouter)
    if (wasInList) {
      return {
        ...oldData,
        data: [
          ...oldData.data.slice(0, index),
          newRecord,
          ...oldData.data.slice(index + 1),
        ],
      }
    }
    // Ne pas ajouter l'intervention si elle n'était pas dans la liste et qu'il n'y a pas de filtres
    return oldData
  }
  
  // CRITIQUE: Vérifier si l'intervention correspond aux filtres de cette vue
  // matchesFilters() gère automatiquement les filtres user (null pour Market, user_id pour Mes demandes),
  // statut, artisan, agence, métier, date, etc.
  // IMPORTANT: Les filtres sont extraits depuis la query key de chaque utilisateur,
  // donc chaque utilisateur vérifie si l'intervention correspond à SES propres filtres
  const matchesNow = matchesFilters(newRecord, filters)
  
  // Log pour débogage : toujours logger les cas critiques pour comprendre le problème
  const filterSummary = {
    statut: filters.statut,
    user: filters.user,
    artisan: filters.artisan,
  }
  
  // Logger les cas critiques pour comprendre ce qui se passe
  // Cas critiques : ajout/retrait d'intervention ou filtres user présents
  if ((wasInList && !matchesNow) || (!wasInList && matchesNow) || (filters.user !== undefined && filters.user !== null)) {
    const action = wasInList && !matchesNow ? 'RETRAIT' : !wasInList && matchesNow ? 'AJOUT' : 'MISE_A_JOUR'
    console.log(`[cache-sync] handleUpdate - Intervention ${newRecord.id} - ${action}:`, {
      wasInList,
      matchesNow,
      filters: filterSummary,
      intervention: {
        statut_id: newRecord.statut_id,
        assigned_user_id: newRecord.assigned_user_id,
        is_active: newRecord.is_active,
      },
      // Détails de correspondance pour débogage
      matchDetails: {
        statutMatch: filters.statut === undefined || filters.statut === newRecord.statut_id,
        userMatch: filters.user === undefined || filters.user === newRecord.assigned_user_id || (filters.user === null && newRecord.assigned_user_id === null),
      },
    })
  }

  // Vérifier que pagination existe
  const currentTotal = oldData.pagination?.total ?? oldData.data.length

  // CAS 1: L'intervention n'était pas dans la liste et ne doit toujours pas y être
  if (!wasInList && !matchesNow) {
    // Ne rien faire - l'intervention ne doit pas apparaître dans cette vue
    return oldData
  }

  // CAS 2: L'intervention n'était pas dans la liste mais doit maintenant y apparaître
  if (!wasInList && matchesNow) {
    // Ajouter l'intervention au début de la liste
    console.log(`[cache-sync] Ajout de l'intervention ${newRecord.id} à la vue (correspond aux filtres)`)
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

  // CAS 3: L'intervention était dans la liste et doit y rester (mise à jour)
  if (wasInList && matchesNow) {
    // Mettre à jour l'intervention existante
    return {
      ...oldData,
      data: [
        ...oldData.data.slice(0, index),
        newRecord,
        ...oldData.data.slice(index + 1),
      ],
    }
  }

  // CAS 4: L'intervention était dans la liste mais ne doit plus y être (retrait)
  // C'est le cas critique : l'intervention ne correspond plus aux filtres de la vue
  if (wasInList && !matchesNow) {
    // Retirer l'intervention de la liste car elle ne correspond plus aux filtres
    console.log(`[cache-sync] Retrait de l'intervention ${newRecord.id} de la vue (ne correspond plus aux filtres)`)
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

  // Par défaut, retourner les données inchangées
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

function removeInterventionFromResponse(
  oldData: PaginatedResponse<Intervention> | undefined,
  interventionId: string
): PaginatedResponse<Intervention> | undefined {
  if (!oldData || !oldData.data || !Array.isArray(oldData.data)) {
    return oldData
  }

  const exists = oldData.data.some((i) => i.id === interventionId)
  if (!exists) {
    return oldData
  }

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

function removeInterventionFromAllCaches(
  queryClient: QueryClient,
  interventionId: string
) {
  const updatedListCount = queryClient.setQueriesData<PaginatedResponse<Intervention>>(
    {
      queryKey: interventionKeys.lists(),
      exact: false,
    },
    (oldData) => removeInterventionFromResponse(oldData, interventionId)
  )

  const updatedLightCount = queryClient.setQueriesData<PaginatedResponse<Intervention>>(
    {
      queryKey: interventionKeys.lightLists(),
      exact: false,
    },
    (oldData) => removeInterventionFromResponse(oldData, interventionId)
  )

  return { updatedListCount, updatedLightCount }
}

/**
 * Détecte un conflit de modification simultanée
 * Un conflit existe si :
 * 1. Une modification locale a été effectuée récemment (dans les 5 dernières secondes)
 * 2. Le timestamp updated_at distant est plus récent que le timestamp local
 * 
 * @param interventionId - ID de l'intervention
 * @param oldUpdatedAt - Ancien timestamp updated_at (depuis le cache local)
 * @param newUpdatedAt - Nouveau timestamp updated_at (depuis Realtime)
 * @param indicatorManager - Gestionnaire d'indicateurs pour vérifier les modifications locales
 * @returns true si un conflit est détecté
 */
function detectConflict(
  interventionId: string,
  oldUpdatedAt: string | null,
  newUpdatedAt: string | null,
  indicatorManager: ReturnType<typeof getRemoteEditIndicatorManager>
): boolean {
  if (!oldUpdatedAt || !newUpdatedAt) {
    return false
  }

  // Vérifier si une modification locale a été effectuée récemment
  const localUpdatedAt = indicatorManager.getLocalUpdatedAt(interventionId)
  if (!localUpdatedAt) {
    return false // Pas de modification locale récente
  }

  // Comparer les timestamps ISO
  const localTimestamp = new Date(localUpdatedAt).getTime()
  const remoteTimestamp = new Date(newUpdatedAt).getTime()
  const oldTimestamp = new Date(oldUpdatedAt).getTime()

  // Conflit si :
  // 1. La modification distante est plus récente que la modification locale
  // 2. La modification distante est plus récente que l'ancien timestamp
  const isRemoteNewerThanLocal = remoteTimestamp > localTimestamp
  const isRemoteNewerThanOld = remoteTimestamp > oldTimestamp

  return isRemoteNewerThanLocal && isRemoteNewerThanOld
}

/**
 * Affiche une notification toast pour un conflit de modification
 * 
 * @param remoteUser - Nom de l'utilisateur distant
 * @param field - Champ modifié (ou description)
 * @param oldRecord - Ancien enregistrement (modification locale écrasée)
 * @param newRecord - Nouvel enregistrement (modification distante)
 */
function showConflictNotification(
  remoteUser: string,
  field: string,
  oldRecord: Intervention | null,
  newRecord: Intervention
): void {
  // Récupérer les valeurs pour le champ modifié
  let oldValue: string | null = null
  let newValue: string | null = null

  if (oldRecord && newRecord) {
    // Essayer de récupérer les valeurs pour les champs communs
    const fieldMap: Record<string, keyof Intervention> = {
      'statut_id': 'statut_id',
      'assigned_user_id': 'assigned_user_id',
      'artisans': 'artisans',
      'date': 'date',
      'date_prevue': 'date_prevue',
    }

    const fieldKey = fieldMap[field] || field
    if (fieldKey in oldRecord && fieldKey in newRecord) {
      oldValue = String(oldRecord[fieldKey as keyof Intervention] || '')
      newValue = String(newRecord[fieldKey as keyof Intervention] || '')
    }
  }

  // Construire le message de notification
  let message = `${remoteUser} a modifié cette intervention en premier.`
  if (oldValue && newValue && oldValue !== newValue) {
    message += ` Votre modification de "${field}" a été remplacée.`
  } else {
    message += ` Vos modifications ont été remplacées.`
  }

  toast.warning('Conflit de modification', {
    description: message,
    duration: 5000,
  })
}

function cleanupAfterInterventionRemoval(
  interventionId: string,
  indicatorManager: ReturnType<typeof getRemoteEditIndicatorManager>
) {
  indicatorManager.removeIndicator(interventionId)

  if (typeof window === 'undefined') {
    return
  }

  try {
    const syncQueue = getSyncQueue()
    syncQueue.dequeueByInterventionId(interventionId)
  } catch (error) {
    console.warn(`[cache-sync] Erreur lors du nettoyage de la file pour ${interventionId}:`, error)
  }
}

function handleAccessRevoked(
  queryClient: QueryClient,
  revokedRecord: Intervention,
  indicatorManager: ReturnType<typeof getRemoteEditIndicatorManager>
) {
  console.warn(`[cache-sync] Traitement de la perte d'accès pour intervention ${revokedRecord.id}`)

  const { updatedListCount, updatedLightCount } = removeInterventionFromAllCaches(
    queryClient,
    revokedRecord.id
  )

  console.warn(
    `[cache-sync] Accès retiré: ${updatedListCount} listes complètes et ${updatedLightCount} listes light mises à jour`
  )

  queryClient.removeQueries({
    queryKey: interventionKeys.detail(revokedRecord.id),
  })

  // Utiliser setTimeout pour éviter les conflits de rendu React lors de la suppression
  setTimeout(() => {
    queryClient.invalidateQueries({
      queryKey: interventionKeys.invalidateLists(),
      refetchType: 'active',
    })
    queryClient.invalidateQueries({
      queryKey: interventionKeys.invalidateLightLists(),
      refetchType: 'active',
    })
  }, 0)

  debouncedRefreshCounts(queryClient)

  cleanupAfterInterventionRemoval(revokedRecord.id, indicatorManager)

  toast.error('Accès retiré', {
    description:
      'Vous n\'avez plus accès à cette intervention. Elle a été réassignée ou vos permissions ont changé.',
    duration: 5000,
  })

  if (broadcastSync) {
    broadcastSync.broadcastRealtimeEvent(
      interventionKeys.invalidateLists(),
      'DELETE',
      revokedRecord.id
    )
    broadcastSync.broadcastRealtimeEvent(
      interventionKeys.invalidateLightLists(),
      'DELETE',
      revokedRecord.id
    )
  }
}

/**
 * Gère les soft deletes (is_active passe à false)
 */
function handleSoftDelete(
  queryClient: QueryClient,
  deletedRecord: Intervention,
  indicatorManager: ReturnType<typeof getRemoteEditIndicatorManager>
) {
  console.log(`[cache-sync] Traitement du soft delete pour intervention ${deletedRecord.id}`)
  const { updatedListCount, updatedLightCount } = removeInterventionFromAllCaches(
    queryClient,
    deletedRecord.id
  )

  console.log(
    `[cache-sync] Soft delete: ${updatedListCount} listes complètes et ${updatedLightCount} listes light mises à jour`
  )

  // Invalider le détail de l'intervention
  queryClient.invalidateQueries({
    queryKey: interventionKeys.detail(deletedRecord.id),
  })

  // Rafraîchir les compteurs
  debouncedRefreshCounts(queryClient)

  // T087: Afficher une notification toast "Intervention supprimée"
  toast.info('Intervention supprimée', {
    description: `L'intervention a été supprimée par ${(deletedRecord as any).updated_by ? 'un autre utilisateur' : 'le système'}.`,
    duration: 5000,
  })

  // Annuler les modifications en cours sur cette intervention
  cleanupAfterInterventionRemoval(deletedRecord.id, indicatorManager)
}
