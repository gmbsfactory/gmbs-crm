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
  /** Form field currently focused by this user, or null */
  activeField: string | null
  /** ISO timestamp when the field was focused — used for stale lock detection */
  fieldLockedAt: string | null
}

/** Processed viewer data consumed by the PresenceAvatars component */
export interface PresenceUser {
  userId: string
  name: string
  color: string | null
  avatarUrl: string | null
  joinedAt: string
  activeField: string | null
  fieldLockedAt: string | null
}

/** Map of fieldName → the user who has it locked */
export type FieldLockMap = Record<string, PresenceUser>
