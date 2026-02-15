/**
 * Synchronisation du cache TanStack Query avec les evenements Supabase Realtime
 * Met a jour le cache optimistiquement puis invalide silencieusement pour garantir la coherence
 *
 * Ce fichier est une facade qui reexporte les sous-modules et orchestre la synchronisation.
 * Gere 3 tables : interventions (optimiste), artisans (invalidation), intervention_artisans (invalidation).
 */

import type { Intervention } from '@/lib/api/v2/common/types'

// Event Router — the preferred entry point for all Realtime events
export { routeRealtimeEvent } from './event-router/router'
export type { CrmEvent, SyncContext, SyncMiddleware } from './event-router/types'
export { STOP } from './event-router/types'
export { normalizePayload } from './event-router/normalize'
export { createPipeline } from './event-router/pipeline'

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


/**
 * Options for sync functions.
 * skipBroadcast: when true, skip the BroadcastChannel invalidation broadcast.
 * Used when leader election is active — cross-tab distribution is handled
 * by the realtime-relay instead of broadcast-sync invalidation.
 */
export interface SyncOptions {
  skipBroadcast?: boolean
}

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

