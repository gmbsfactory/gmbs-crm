/**
 * Shared middleware — reusable steps for all table pipelines.
 *
 * - createBroadcastMiddleware: cross-tab broadcast (respects skipBroadcast from Layer 2)
 * - refreshCounts: debounced counter refresh
 */

import type { CrmEvent, SyncContext } from '../types'
import { getBroadcastSync, debouncedRefreshCounts } from '@/lib/realtime/cache-sync/broadcasting'

/**
 * Factory that creates a broadcast middleware for a given table's query keys.
 *
 * @param getQueryKeys - Function that returns the query key(s) to broadcast
 * @returns Middleware that broadcasts the event to other tabs
 *
 * @example
 * ```ts
 * createBroadcastMiddleware(() => [artisanKeys.invalidateLists()])
 * createBroadcastMiddleware(() => [interventionKeys.invalidateLists(), interventionKeys.invalidateLightLists()])
 * ```
 */
export function createBroadcastMiddleware<T extends { id: string }>(
  getQueryKeys: () => readonly (readonly unknown[])[]
) {
  return (event: CrmEvent<T>, ctx: SyncContext): void => {
    if (ctx.options.skipBroadcast) return

    const broadcastSync = getBroadcastSync()
    if (!broadcastSync) return

    const recordId = event.record?.id ?? event.previousRecord?.id
    if (!recordId) return

    for (const queryKey of getQueryKeys()) {
      broadcastSync.broadcastRealtimeEvent(
        queryKey,
        event.eventType,
        recordId
      )
    }
  }
}

/**
 * Middleware that triggers a debounced refresh of summary/counter queries.
 */
export function refreshCounts<T extends { id: string }>(
  _event: CrmEvent<T>,
  ctx: SyncContext
): void {
  debouncedRefreshCounts(ctx.queryClient)
}
