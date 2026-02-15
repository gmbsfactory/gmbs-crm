/**
 * Types for the Event Router — normalize → route → pipeline architecture.
 *
 * CrmEvent<T>      : uniform representation of a Supabase Realtime event
 * SyncContext       : everything middleware needs (queryClient, userId, options)
 * SyncMiddleware<T> : a single composable step in the pipeline
 * STOP              : sentinel to short-circuit the pipeline
 */

import type { QueryClient } from '@tanstack/react-query'
import type { SyncOptions } from '@/lib/realtime/cache-sync'

// ─── Normalized Event ──────────────────────────────────────────────────────────

/**
 * Uniform representation of a Supabase Realtime event, regardless of table.
 * Produced by `normalizePayload()`, consumed by every middleware.
 */
export interface CrmEvent<T extends { id: string }> {
  /** Source table name (e.g. 'interventions', 'artisans', 'intervention_artisans') */
  table: string
  eventType: 'INSERT' | 'UPDATE' | 'DELETE'
  /** New record from payload.new (may be enriched by middleware). Null on DELETE or access-revoked. */
  record: T | null
  /** Previous record from payload.old. Null on INSERT. */
  previousRecord: T | null
  meta: {
    /** UPDATE with empty new → RLS stripped access (permission lost) */
    isAccessRevoked: boolean
    /** UPDATE where is_active went true→false (soft delete) */
    isSoftDelete: boolean
    /** Not a local optimistic mutation — i.e. another user's change */
    isRemote: boolean
  }
}

// ─── Sync Context ──────────────────────────────────────────────────────────────

/**
 * Everything a middleware function needs to do its job.
 * Constructed once per event and passed through the pipeline.
 */
export interface SyncContext {
  queryClient: QueryClient
  currentUserId: string | null
  /** Options from Layer 2 (leader election). skipBroadcast = true when relay handles cross-tab. */
  options: SyncOptions
}

// ─── Middleware ─────────────────────────────────────────────────────────────────

/**
 * Sentinel value returned by middleware to stop the pipeline.
 * Used for short-circuit cases (access revoked, soft delete).
 */
export const STOP = Symbol('STOP_PIPELINE')

/**
 * A single composable step in the pipeline.
 * Return `STOP` to halt further processing.
 */
export type SyncMiddleware<T extends { id: string }> = (
  event: CrmEvent<T>,
  ctx: SyncContext
) => void | typeof STOP | Promise<void | typeof STOP>
