/**
 * Pipeline runner — executes an ordered array of middleware functions.
 *
 * Each middleware receives the normalized event and sync context.
 * Returning STOP halts the pipeline (used for access-revoked, soft-delete).
 */

import type { CrmEvent, SyncContext, SyncMiddleware } from './types'
import { STOP } from './types'

/**
 * Create a pipeline from an ordered list of middleware functions.
 *
 * @param steps - Middleware functions to run in order
 * @returns An async function that runs the full pipeline
 *
 * @example
 * ```ts
 * const pipeline = createPipeline<Intervention>(
 *   enrichRecord,
 *   handleSpecialCases,  // may return STOP
 *   updateListCaches,
 *   broadcastToTabs,
 * )
 * await pipeline(event, ctx)
 * ```
 */
export function createPipeline<T extends { id: string }>(
  ...steps: SyncMiddleware<T>[]
) {
  return async (event: CrmEvent<T>, ctx: SyncContext): Promise<void> => {
    for (const step of steps) {
      const result = await step(event, ctx)
      if (result === STOP) return
    }
  }
}
