/**
 * Reference data pipeline middleware — simple invalidation strategy.
 *
 * Handles tables: intervention_statuses, artisan_statuses, agencies, metiers.
 * Any change to these tables invalidates the corresponding reference query keys
 * so that all components using reference data refetch automatically.
 */

import type { CrmEvent, SyncContext } from '@/lib/realtime/event-router/types'
import { referenceKeys } from '@/lib/react-query/queryKeys'
import { createPipeline } from '@/lib/realtime/event-router/pipeline'

/**
 * Map from table name to the specific reference query key factory.
 */
const TABLE_KEY_MAP: Record<string, () => readonly unknown[]> = {
  intervention_statuses: referenceKeys.statuses,
  artisan_statuses: referenceKeys.artisanStatuses,
  agencies: referenceKeys.agencies,
  metiers: referenceKeys.metiers,
}

/**
 * Invalidate the specific reference query key for the changed table,
 * plus the shared allData() key that bundles all reference data.
 */
export function invalidateReferenceData(
  event: CrmEvent<{ id: string }>,
  ctx: SyncContext
): void {
  // Invalidate the specific table key
  const keyFactory = TABLE_KEY_MAP[event.table]
  if (keyFactory) {
    ctx.queryClient.invalidateQueries({
      queryKey: keyFactory(),
      refetchType: 'active',
    })
  }

  // Always invalidate the combined allData query (used by useReferenceDataQuery)
  ctx.queryClient.invalidateQueries({
    queryKey: referenceKeys.allData(),
    refetchType: 'active',
  })
}

/**
 * Composed reference data pipeline: invalidate specific + allData keys.
 */
export const referenceDataPipeline = createPipeline<{ id: string }>(
  invalidateReferenceData,
)
