/**
 * Types for Supabase Presence in the intervention modal.
 *
 * Architecture: one channel per open intervention ('presence:intervention-{id}').
 * Each tab subscribes independently — presence bypasses leader election.
 */

/** Shape of user data sent to Supabase via channel.track() */
export interface PresencePayload {
  userId: string
  /** Display name: surnom, or "{prenom} {nom}", or 'Utilisateur' */
  name: string
  color: string | null
  avatarUrl: string | null
  /** ISO timestamp — used for stable sort order (oldest first) */
  joinedAt: string
}

/** Processed viewer data consumed by the PresenceAvatars component */
export interface PresenceUser {
  userId: string
  name: string
  color: string | null
  avatarUrl: string | null
  joinedAt: string
}
