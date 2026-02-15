/**
 * Artisan pipeline middleware — simple invalidation strategy.
 * No optimistic updates, no enrichment, no conflict detection.
 */

import type { Artisan } from '@/lib/api/v2/common/types'
import type { CrmEvent, SyncContext } from '../types'
import { artisanKeys } from '@/lib/react-query/queryKeys'
import { createPipeline } from '../pipeline'
import { createBroadcastMiddleware, refreshCounts } from './shared'

/**
 * Invalidate all active artisan list queries.
 */
export function invalidateArtisanLists(
  _event: CrmEvent<Artisan>,
  ctx: SyncContext
): void {
  ctx.queryClient.invalidateQueries({
    queryKey: artisanKeys.invalidateLists(),
    refetchType: 'active',
  })
}

/**
 * Invalidate artisan detail queries (if modal is open).
 */
export function invalidateArtisanDetails(
  _event: CrmEvent<Artisan>,
  ctx: SyncContext
): void {
  ctx.queryClient.invalidateQueries({
    queryKey: artisanKeys.details(),
    refetchType: 'active',
  })
}

/**
 * Composed artisan pipeline: invalidate lists → invalidate details → broadcast.
 */
export const artisanPipeline = createPipeline<Artisan>(
  invalidateArtisanLists,
  invalidateArtisanDetails,
  createBroadcastMiddleware<Artisan>(() => [artisanKeys.invalidateLists()]),
)
