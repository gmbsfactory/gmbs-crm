/**
 * Simple callback registry for reminder Realtime events.
 *
 * useCrmRealtime pushes events here (both leader and follower paths).
 * RemindersContext subscribes to receive them.
 *
 * Module-level singleton — no React dependency.
 */

import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import type { InterventionReminder } from '@/lib/api/v2'

export type ReminderEventCallback = (
  payload: RealtimePostgresChangesPayload<InterventionReminder>
) => void

const listeners = new Set<ReminderEventCallback>()

/**
 * Subscribe to reminder Realtime events.
 * Returns an unsubscribe function.
 */
export function onReminderRealtimeEvent(cb: ReminderEventCallback): () => void {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

/**
 * Emit a reminder Realtime event to all subscribers.
 * Called by useCrmRealtime (leader handler + follower relay).
 */
export function emitReminderRealtimeEvent(
  payload: RealtimePostgresChangesPayload<InterventionReminder>
): void {
  listeners.forEach((cb) => {
    try {
      cb(payload)
    } catch (error) {
      console.error('[ReminderEvents] Error in listener:', error)
    }
  })
}
