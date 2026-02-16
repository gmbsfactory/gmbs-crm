/**
 * Event Router — single entry point for all Realtime events.
 *
 * Normalizes the Supabase payload, looks up the pipeline for the table,
 * and runs it. Adding a new table = one pipeline, one line in PIPELINES.
 */

import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import type { CrmEvent, SyncContext } from './types'
import { normalizePayload } from './normalize'
import { interventionPipeline } from './middleware/interventions'
import { artisanPipeline } from './middleware/artisans'
import { junctionPipeline } from './middleware/junction'

// ─── Pipeline Registry ─────────────────────────────────────────────────────────

type Pipeline = (event: CrmEvent<any>, ctx: SyncContext) => Promise<void>

const PIPELINES: Record<string, Pipeline> = {
  interventions: interventionPipeline,
  artisans: artisanPipeline,
  intervention_artisans: junctionPipeline,
}

// ─── Public Entry Point ────────────────────────────────────────────────────────

/**
 * Route a Realtime event through the appropriate pipeline.
 *
 * @param table - Source table name ('interventions', 'artisans', 'intervention_artisans')
 * @param payload - Raw Supabase Realtime payload
 * @param ctx - Sync context (queryClient, currentUserId, options)
 *
 * @example
 * ```ts
 * await routeRealtimeEvent('interventions', payload, {
 *   queryClient,
 *   currentUserId,
 *   options: { skipBroadcast: true },
 * })
 * ```
 */
export async function routeRealtimeEvent<T extends { id: string }>(
  table: string,
  payload: RealtimePostgresChangesPayload<T>,
  ctx: SyncContext
): Promise<void> {
  const pipeline = PIPELINES[table]
  if (!pipeline) {
    console.warn(`[event-router] No pipeline registered for table: ${table}`)
    return
  }

  const event = normalizePayload(table, payload)
  await pipeline(event, ctx)
}
