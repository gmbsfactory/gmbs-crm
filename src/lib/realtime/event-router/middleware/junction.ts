/**
 * Junction table (intervention_artisans) pipeline middleware.
 * Invalidates the linked intervention detail + intervention lists + counts.
 * No broadcast needed — intervention list invalidation covers cross-tab.
 */

import type { InterventionArtisanRow } from '@/lib/realtime/realtime-client'
import type { CrmEvent, SyncContext } from '../types'
import { interventionKeys } from '@/lib/react-query/queryKeys'
import { createPipeline } from '../pipeline'
import { refreshCounts } from './shared'

/**
 * Invalidate the detail query for the intervention linked to this junction record.
 * Only fires if the junction record has an intervention_id.
 */
export function invalidateLinkedIntervention(
  event: CrmEvent<InterventionArtisanRow>,
  ctx: SyncContext
): void {
  const interventionId = event.record?.intervention_id ?? event.previousRecord?.intervention_id
  if (!interventionId) return

  ctx.queryClient.invalidateQueries({
    queryKey: interventionKeys.detail(interventionId),
    refetchType: 'active',
  })
}

/**
 * Invalidate intervention list queries (artisan assignment affects filtered views).
 */
export function invalidateInterventionLists(
  _event: CrmEvent<InterventionArtisanRow>,
  ctx: SyncContext
): void {
  ctx.queryClient.invalidateQueries({
    queryKey: interventionKeys.invalidateLists(),
    refetchType: 'active',
  })
  ctx.queryClient.invalidateQueries({
    queryKey: interventionKeys.invalidateLightLists(),
    refetchType: 'active',
  })
}

/**
 * Composed junction pipeline: invalidate linked detail → invalidate lists → refresh counts.
 */
export const junctionPipeline = createPipeline<InterventionArtisanRow>(
  invalidateLinkedIntervention,
  invalidateInterventionLists,
  refreshCounts,
)
