/**
 * Payload normalization — transforms heterogeneous Supabase Realtime payloads
 * into uniform CrmEvent<T> objects.
 *
 * Eliminates the `payload.new && 'id' in payload.new ? ...` pattern
 * that was duplicated across all 3 sync handlers.
 */

import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import type { CrmEvent } from './types'
import { getRemoteEditIndicatorManager } from '@/lib/realtime/remote-edit-indicator'

/**
 * Normalize a Supabase Realtime payload into a uniform CrmEvent.
 *
 * @param table - Source table name
 * @param payload - Raw Supabase payload
 * @returns Normalized event with extracted records and computed meta flags
 */
export function normalizePayload<T extends { id: string }>(
  table: string,
  payload: RealtimePostgresChangesPayload<T>
): CrmEvent<T> {
  const { eventType } = payload

  const record = payload.new && typeof payload.new === 'object' && 'id' in payload.new
    ? (payload.new as T)
    : null

  const previousRecord = payload.old && typeof payload.old === 'object' && 'id' in payload.old
    ? (payload.old as T)
    : null

  // Access revoked: UPDATE where RLS strips the new record (SELECT no longer permitted)
  const isAccessRevoked = eventType === 'UPDATE' && !record && !!previousRecord

  // Soft delete: UPDATE where is_active transitions from true to false
  const isSoftDelete = eventType === 'UPDATE'
    && (previousRecord as Record<string, unknown> | null)?.is_active === true
    && (record as Record<string, unknown> | null)?.is_active === false

  // Remote: not a local optimistic mutation (checked via the indicator manager)
  const indicatorManager = getRemoteEditIndicatorManager()
  const recordId = record?.id ?? previousRecord?.id
  const isRemote = recordId ? !indicatorManager.isLocalModification(recordId) : true

  return {
    table,
    eventType: eventType as CrmEvent<T>['eventType'],
    record,
    previousRecord,
    meta: {
      isAccessRevoked,
      isSoftDelete,
      isRemote,
    },
  }
}
