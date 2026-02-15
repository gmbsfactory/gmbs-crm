/**
 * Intervention pipeline middleware — the most complex table.
 *
 * Each middleware is a faithful extraction from the monolithic
 * syncCacheWithRealtimeEvent(). No behavior changes, just decomposition.
 */

import type { Intervention } from '@/lib/api/v2/common/types'
import type { CrmEvent, SyncContext, SyncMiddleware } from '@/lib/realtime/event-router/types'
import { STOP } from '@/lib/realtime/event-router/types'
import { interventionKeys } from '@/lib/react-query/queryKeys'
import { enrichRealtimeRecord, getReferenceCache } from '@/lib/realtime/cache-sync/enrichment'
import {
  handleInsert,
  handleUpdate,
  handleDelete,
  handleAccessRevoked,
  handleSoftDelete,
  updateInterventionQueries,
} from '@/lib/realtime/cache-sync/event-handlers'
import { detectConflict, showConflictNotification } from '@/lib/realtime/cache-sync/conflict-detection'
import {
  getRemoteEditIndicatorManager,
  getUserColor,
  getChangedFields,
} from '@/lib/realtime/remote-edit-indicator'
import { isSoftDelete, shouldRefreshCounts } from '@/lib/realtime/cache-sync'
import { debouncedRefreshCounts } from '@/lib/realtime/cache-sync/broadcasting'
import { createPipeline } from '@/lib/realtime/event-router/pipeline'
import { createBroadcastMiddleware } from './shared'

// ─── Middleware 1: Enrich ──────────────────────────────────────────────────────

/**
 * Enrich the raw Realtime record with reference data (user names, agency names, etc.)
 * Mutates event.record in-place with the enriched version.
 */
export const enrichRecord: SyncMiddleware<Intervention> = async (event) => {
  if (event.record) {
    event.record = await enrichRealtimeRecord(event.record)
  }
}

// ─── Middleware 2: Special Cases (may STOP) ────────────────────────────────────

/**
 * Handle access revoked (RLS) and soft delete. Returns STOP to halt pipeline.
 */
export const handleSpecialCases: SyncMiddleware<Intervention> = (event, ctx) => {
  const indicatorManager = getRemoteEditIndicatorManager()

  // T088: RLS access revoked — payload.new absent on UPDATE
  if (event.meta.isAccessRevoked && event.previousRecord) {
    console.warn(
      `[event-router] Acces retire detecte pour intervention ${event.previousRecord.id} (payload.new manquant)`
    )
    handleAccessRevoked(ctx.queryClient, event.previousRecord, indicatorManager)
    return STOP
  }

  // Soft delete: is_active went true→false
  if (event.meta.isSoftDelete && event.record) {
    handleSoftDelete(ctx.queryClient, event.record, indicatorManager)
    return STOP
  }
}

// ─── Middleware 3: Optimistic List Cache Update ────────────────────────────────

/**
 * Optimistic update of all intervention list caches (full + light).
 * Uses filter matching to add/remove/update records in each cached view.
 */
export const updateListCaches: SyncMiddleware<Intervention> = (event, ctx) => {
  const { eventType, record, previousRecord } = event
  if (!record && eventType !== 'DELETE') return

  const buildUpdater = (keyFactory: () => readonly unknown[]) => {
    updateInterventionQueries(
      ctx.queryClient,
      keyFactory,
      (oldData, filters) => {
        if (!oldData) return oldData

        switch (eventType) {
          case 'INSERT':
            return handleInsert(oldData, record!, filters)
          case 'UPDATE':
            return handleUpdate(oldData, previousRecord, record!, filters)
          case 'DELETE':
            return handleDelete(oldData, previousRecord!.id, filters)
          default:
            return oldData
        }
      }
    )
  }

  buildUpdater(interventionKeys.lists)
  buildUpdater(interventionKeys.lightLists)
}

// ─── Middleware 4: Invalidate Active Lists ─────────────────────────────────────

/**
 * CRITICAL: Invalidate active queries in the next tick to force re-render.
 * The optimistic update (middleware 3) sets data, but invalidation triggers
 * the actual refetch for server reconciliation.
 */
export const invalidateActiveLists: SyncMiddleware<Intervention> = (event, ctx) => {
  setTimeout(() => {
    const listQueries = ctx.queryClient.getQueryCache().findAll({
      queryKey: interventionKeys.invalidateLists()
    })
    const lightQueries = ctx.queryClient.getQueryCache().findAll({
      queryKey: interventionKeys.invalidateLightLists()
    })

    if (process.env.NODE_ENV !== 'production') {
      if (listQueries.length === 0 && lightQueries.length === 0) {
        console.warn('[event-router] Aucune query trouvee pour invalidation - verifier les cles de requete')
      }
    }

    ctx.queryClient.invalidateQueries({
      queryKey: interventionKeys.invalidateLists(),
      refetchType: 'active',
    })
    ctx.queryClient.invalidateQueries({
      queryKey: interventionKeys.invalidateLightLists(),
      refetchType: 'active',
    })
  }, 0)
}

// ─── Middleware 5: Conflict Detection + Remote Edit Indicators ─────────────────

/**
 * US7: Create visual indicators for remote modifications.
 * US8: Detect concurrent edits and show conflict notifications.
 *
 * Combined because they share the isRemote check and indicator manager.
 */
export const detectConflictsAndIndicators: SyncMiddleware<Intervention> = async (event, ctx) => {
  if (!event.record) return
  if (event.eventType !== 'INSERT' && event.eventType !== 'UPDATE') return

  const indicatorManager = getRemoteEditIndicatorManager()
  const enrichedRecord = event.record
  const previousRecord = event.previousRecord

  // US8: Conflict detection for UPDATE events
  if (event.eventType === 'UPDATE' && previousRecord && enrichedRecord) {
    const localUpdatedAt = indicatorManager.getLocalUpdatedAt(enrichedRecord.id)
    const remoteUpdatedAt = enrichedRecord.updated_at

    if (localUpdatedAt && remoteUpdatedAt) {
      const conflictDetected = detectConflict(
        enrichedRecord.id,
        previousRecord.updated_at ?? null,
        remoteUpdatedAt,
        indicatorManager
      )

      if (conflictDetected && !event.meta.isRemote) {
        const changedFields = getChangedFields(previousRecord, enrichedRecord)
        const remoteUserId = (enrichedRecord as any).updated_by || null

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
          console.warn('[event-router] Erreur lors de la recuperation du nom utilisateur:', error)
        }

        showConflictNotification(
          remoteUserName || 'Un autre utilisateur',
          changedFields.length > 0 ? changedFields[0] : 'les donnees',
          previousRecord,
          enrichedRecord
        )
      }
    }
  }

  // US7: Remote edit indicators
  if (event.meta.isRemote && ctx.currentUserId) {
    const changedFields = getChangedFields(previousRecord, enrichedRecord)
    const userId = (enrichedRecord as any).updated_by || null

    let userColor: string
    try {
      const refs = await getReferenceCache()
      userColor = getUserColor(userId, refs)
    } catch (error) {
      console.warn('[event-router] Erreur lors de la recuperation du cache de reference, utilisation du fallback:', error)
      userColor = getUserColor(userId)
    }

    indicatorManager.addIndicator({
      interventionId: enrichedRecord.id,
      userId,
      userName: null,
      userColor,
      fields: changedFields,
      timestamp: Date.now(),
      eventType: event.eventType,
    })
  }
}

// ─── Middleware 6: Bridge Detail Cache ──────────────────────────────────────────

/**
 * Invalidate the detail query if the modal is open (query mounted).
 * Uses refetchType: 'active' so it's a no-op when the modal is closed.
 */
export const bridgeDetailCache: SyncMiddleware<Intervention> = (event, ctx) => {
  if (!event.record) return
  if (event.eventType !== 'INSERT' && event.eventType !== 'UPDATE') return

  ctx.queryClient.invalidateQueries({
    queryKey: interventionKeys.detail(event.record.id),
    refetchType: 'active',
  })
}

// ─── Middleware 7: Refresh Counts If Needed ────────────────────────────────────

/**
 * Trigger debounced counter refresh only when filter-affecting fields changed.
 */
export const refreshCountsIfNeeded: SyncMiddleware<Intervention> = (event, ctx) => {
  if (shouldRefreshCounts(event.eventType, event.previousRecord, event.record)) {
    debouncedRefreshCounts(ctx.queryClient)
  }
}

// ─── Composed Pipeline ─────────────────────────────────────────────────────────

/**
 * Full intervention pipeline:
 * enrich → special cases (STOP?) → optimistic update → invalidate → conflicts → detail → counts → broadcast
 */
export const interventionPipeline = createPipeline<Intervention>(
  enrichRecord,
  handleSpecialCases,
  updateListCaches,
  invalidateActiveLists,
  detectConflictsAndIndicators,
  bridgeDetailCache,
  refreshCountsIfNeeded,
  createBroadcastMiddleware<Intervention>(() => [
    interventionKeys.invalidateLists(),
    interventionKeys.invalidateLightLists(),
  ]),
)
