'use client'

import { useEntityPresence } from './useEntityPresence'
import type { EntityPresenceResult } from './useEntityPresence'

/**
 * Supabase Presence hook for real-time viewer tracking on an artisan modal.
 * Thin wrapper around useEntityPresence('artisan', id).
 *
 * @param artisanId - ID of the artisan being viewed. Pass null to disable.
 */
export function useArtisanPresence(
  artisanId: string | null
): EntityPresenceResult {
  return useEntityPresence('artisan', artisanId)
}
