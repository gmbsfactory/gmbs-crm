/**
 * Comments pipeline middleware — simple invalidation strategy.
 *
 * Handles table: comments (entity_type = 'intervention' | 'artisan').
 * When a comment is inserted, updated, or deleted, invalidates
 * the comment queries for the affected entity and the intervention detail
 * if the comment targets an intervention.
 */

import type { CrmEvent, SyncContext } from '@/lib/realtime/event-router/types'
import { commentKeys } from '@/lib/react-query/queryKeys'
import { interventionKeys } from '@/lib/react-query/queryKeys'
import { createPipeline } from '@/lib/realtime/event-router/pipeline'

/** Shape of a comment record as received from Realtime. */
interface CommentRow {
  id: string
  entity_id: string
  entity_type: string
}

/**
 * Invalidate comment queries for the affected entity.
 */
export function invalidateCommentQueries(
  event: CrmEvent<CommentRow>,
  ctx: SyncContext
): void {
  const record = event.record ?? event.previousRecord
  if (!record?.entity_id || !record?.entity_type) return

  ctx.queryClient.invalidateQueries({
    queryKey: commentKeys.invalidateByEntity(record.entity_type, record.entity_id),
    refetchType: 'active',
  })
}

/**
 * Invalidate the intervention detail query when a comment targets an intervention.
 * This ensures the comment count / last comment preview stays fresh.
 */
export function invalidateInterventionDetail(
  event: CrmEvent<CommentRow>,
  ctx: SyncContext
): void {
  const record = event.record ?? event.previousRecord
  if (!record?.entity_id || record.entity_type !== 'intervention') return

  ctx.queryClient.invalidateQueries({
    queryKey: interventionKeys.detail(record.entity_id),
    refetchType: 'active',
  })
}

/**
 * Composed comments pipeline: invalidate comment queries + intervention detail.
 */
export const commentsPipeline = createPipeline<CommentRow>(
  invalidateCommentQueries,
  invalidateInterventionDetail,
)
