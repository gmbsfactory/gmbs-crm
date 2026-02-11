/**
 * Synchronisation du cache TanStack Query avec les evenements Supabase Realtime
 * Point d'entree qui reexporte tous les sous-modules
 */

// Enrichissement des donnees Realtime
export { getReferenceCache, enrichRealtimeRecord } from './enrichment'
export type { ReferenceCache } from './enrichment'

// Handlers d'evenements (INSERT, UPDATE, DELETE)
export {
  handleInsert,
  handleUpdate,
  handleDelete,
  handleAccessRevoked,
  handleSoftDelete,
  removeInterventionFromAllCaches,
  updateInterventionQueries,
} from './event-handlers'
export type { InterventionQueryUpdater } from './event-handlers'

// Broadcasting / diffusion
export {
  initializeCacheSync,
  getBroadcastSync,
  debouncedRefreshCounts,
} from './broadcasting'

// Detection de conflits
export { detectConflict, showConflictNotification } from './conflict-detection'
