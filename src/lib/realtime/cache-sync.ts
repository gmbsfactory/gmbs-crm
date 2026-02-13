/**
 * Synchronisation du cache TanStack Query avec les evenements Supabase Realtime
 * Met a jour le cache optimistiquement puis invalide silencieusement pour garantir la coherence
 *
 * Ce fichier est une facade qui reexporte les sous-modules et orchestre la synchronisation.
 */

import type { QueryClient } from '@tanstack/react-query'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import type { Intervention } from '@/lib/api/v2/common/types'
import type { InterventionQueryParams } from '@/lib/api/v2'
import { interventionKeys } from '@/lib/react-query/queryKeys'
import {
  getRemoteEditIndicatorManager,
  getUserColor,
  getChangedFields,
} from './remote-edit-indicator'

// Re-exports publics depuis les sous-modules
export { initializeCacheSync } from './cache-sync/broadcasting'
export {
  enrichRealtimeRecord,
  getReferenceCache,
} from './cache-sync/enrichment'
export type { ReferenceCache } from './cache-sync/enrichment'
export {
  handleInsert,
  handleUpdate,
  handleDelete,
  handleAccessRevoked,
  handleSoftDelete,
  removeInterventionFromAllCaches,
  updateInterventionQueries,
} from './cache-sync/event-handlers'
export type { InterventionQueryUpdater } from './cache-sync/event-handlers'
export { detectConflict, showConflictNotification } from './cache-sync/conflict-detection'
export { getBroadcastSync, debouncedRefreshCounts } from './cache-sync/broadcasting'

// Imports internes pour l'orchestration
import { enrichRealtimeRecord, getReferenceCache } from './cache-sync/enrichment'
import {
  handleInsert,
  handleUpdate,
  handleDelete,
  handleAccessRevoked,
  handleSoftDelete,
  updateInterventionQueries,
} from './cache-sync/event-handlers'
import { debouncedRefreshCounts, getBroadcastSync } from './cache-sync/broadcasting'
import { detectConflict, showConflictNotification } from './cache-sync/conflict-detection'

// Alias pour compatibilite avec le code existant
type GetAllParams = InterventionQueryParams

/**
 * Determine si un UPDATE est un soft delete (is_active passe a false)
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
 * Determine si les compteurs doivent etre mis a jour selon le type d'evenement
 *
 * @param eventType - Type d'evenement (INSERT, UPDATE, DELETE)
 * @param oldRecord - Ancien enregistrement (pour UPDATE)
 * @param newRecord - Nouvel enregistrement
 * @returns true si les compteurs doivent etre mis a jour
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
    // Mettre a jour les compteurs si les champs affectant les filtres ont change
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
 * Synchronise le cache TanStack Query avec un evenement Realtime
 *
 * @param queryClient - Instance QueryClient de TanStack Query
 * @param payload - Payload de l'evenement Realtime
 * @param currentUserId - ID de l'utilisateur actuel (pour detecter les modifications distantes)
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

  // Enrichir le nouveau record avant de le mettre dans le cache
  let enrichedNewRecord: Intervention | null = null
  if (newIntervention) {
    enrichedNewRecord = await enrichRealtimeRecord(newIntervention)
  }

  // T088: Gestion de la perte d'acces RLS (payload.new absent => plus de permission SELECT)
  if (eventType === 'UPDATE' && !newIntervention && oldIntervention) {
    console.warn(
      `[cache-sync] Acces retire detecte pour intervention ${oldIntervention.id} (payload.new manquant)`
    )
    handleAccessRevoked(queryClient, oldIntervention as Intervention, indicatorManager)
    return
  }

  // Gestion des soft deletes
  if (eventType === 'UPDATE' && isSoftDelete(oldIntervention as Intervention | null, enrichedNewRecord)) {
    handleSoftDelete(queryClient, enrichedNewRecord!, indicatorManager)
    return
  }

  // Mise a jour optimiste du cache pour toutes les listes completes
  const updatedListCount = updateInterventionQueries(
    queryClient,
    interventionKeys.lists,
    (oldData, filters, queryKey) => {
      if (!oldData) {
        return oldData
      }

      if (filters && filters.user !== undefined) {
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

  // Mise a jour optimiste du cache pour toutes les listes light
  const updatedLightCount = updateInterventionQueries(
    queryClient,
    interventionKeys.lightLists,
    (oldData, filters, queryKey) => {
      if (!oldData) {
        return oldData
      }

      if (filters && filters.user !== undefined) {
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

  // CRITIQUE: Invalider les queries actives pour forcer le re-render
  setTimeout(() => {
    const listQueries = queryClient.getQueryCache().findAll({
      queryKey: interventionKeys.invalidateLists()
    })
    const lightQueries = queryClient.getQueryCache().findAll({
      queryKey: interventionKeys.invalidateLightLists()
    })

    if (process.env.NODE_ENV !== 'production') {
      if (listQueries.length === 0 && lightQueries.length === 0) {
        console.warn('[cache-sync] Aucune query trouvee pour invalidation - verifier les cles de requete')
      }
    }

    queryClient.invalidateQueries({
      queryKey: interventionKeys.invalidateLists(),
      refetchType: 'active',
    })
    queryClient.invalidateQueries({
      queryKey: interventionKeys.invalidateLightLists(),
      refetchType: 'active',
    })
  }, 0)

  // US7: Detecter les modifications distantes et creer des indicateurs
  // US8: Detecter les conflits et afficher les notifications
  if (enrichedNewRecord && (eventType === 'INSERT' || eventType === 'UPDATE')) {
    // Verifier si c'est une modification distante (pas locale)
    const isLocal = indicatorManager.isLocalModification(enrichedNewRecord.id)
    const isRemoteModification = !isLocal


    // US8: Verifier les conflits pour les UPDATE
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
          const changedFields = getChangedFields(oldIntervention as Intervention, enrichedNewRecord)
          const remoteUserId = (enrichedNewRecord as any).updated_by || null

          // Recuperer le nom de l'utilisateur distant
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
            console.warn('[cache-sync] Erreur lors de la recuperation du nom utilisateur:', error)
          }

          showConflictNotification(
            remoteUserName || 'Un autre utilisateur',
            changedFields.length > 0 ? changedFields[0] : 'les donnees',
            oldIntervention as Intervention,
            enrichedNewRecord
          )
        }
      }
    }

    if (isRemoteModification && currentUserId) {
      // Creer un indicateur de modification distante
      const changedFields = getChangedFields(oldIntervention as Intervention | null, enrichedNewRecord)
      const userId = (enrichedNewRecord as any).updated_by || null


      // Recuperer la couleur depuis la table users via le cache de reference
      let userColor: string
      try {
        const refs = await getReferenceCache()
        userColor = getUserColor(userId, refs)
      } catch (error) {
        console.warn(`[cache-sync] Erreur lors de la recuperation du cache de reference, utilisation du fallback:`, error)
        userColor = getUserColor(userId)
      }

      indicatorManager.addIndicator({
        interventionId: enrichedNewRecord.id,
        userId,
        userName: null,
        userColor,
        fields: changedFields,
        timestamp: Date.now(),
        eventType,
      })

    } else if (!currentUserId) {
    } else if (!isRemoteModification) {
    }

    // Invalider le détail pour forcer un refetch avec JOINs complets (costs, payments, artisans)
    // On utilise invalidateQueries au lieu de setQueryData car le payload Realtime
    // ne contient que les colonnes de la table interventions, pas les données enfants.
    // refetchType: 'active' = refetch uniquement si le modal est ouvert (query montée)
    queryClient.invalidateQueries({
      queryKey: interventionKeys.detail(enrichedNewRecord.id),
      refetchType: 'active',
    })
  }

  // Rafraichir les compteurs si necessaire
  if (shouldRefreshCounts(eventType, oldIntervention as Intervention | null, enrichedNewRecord)) {
    debouncedRefreshCounts(queryClient)
  }

  // Broadcast aux autres onglets
  const broadcastSync = getBroadcastSync()
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
