'use client'

import { useEntityPresence } from './useEntityPresence'
import type { EntityPresenceResult } from './useEntityPresence'

// Re-export shared counter for backward compatibility
export {
  activePresenceChannels,
  incrementPresenceChannels,
  decrementPresenceChannels,
} from './useEntityPresence'

/**
 * Supabase Presence hook for real-time viewer tracking on an intervention modal.
 * Thin wrapper around useEntityPresence('intervention', id).
 *
 * @param interventionId - ID of the intervention being viewed. Pass null to disable.
 */
export function useInterventionPresence(
  interventionId: string | null
): EntityPresenceResult {
  return useEntityPresence('intervention', interventionId)
}
