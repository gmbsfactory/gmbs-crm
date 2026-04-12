/**
 * Pure derivation functions for intervention edit form.
 *
 * These encode domain rules on intervention data — extracted from
 * InterventionEditForm so they can be tested in isolation and reused.
 * They are intentionally pure (no React, no side effects): call them
 * from `useMemo` in components, or directly from other utilities.
 */

import type { InterventionFormData } from "@/lib/interventions/form-types"

// ============================================================================
// artisansWithEmail
// ============================================================================

export interface ArtisanWithEmail {
  id: string
  email: string
  telephone: string
  name: string
  is_primary: boolean
}

/** Shape of an intervention_artisans row (joined with artisans). */
interface InterventionArtisanRow {
  artisan_id: string
  is_primary: boolean
  artisans?: {
    email?: string | null
    telephone?: string | null
    prenom?: string | null
    nom?: string | null
    plain_nom?: string | null
  } | null
}

/** Shape of the selected artisan from the form state (NearbyArtisan-ish). */
interface SelectedArtisanLike {
  id: string
  email?: string | null
  telephone?: string | null
  displayName?: string | null
}

/**
 * Returns the list of artisans that have a non-empty email for an intervention.
 * Merges:
 * 1. Artisans already linked to the intervention (intervention_artisans join)
 * 2. The artisan currently selected in the form (if any and not already in #1)
 *
 * Used to populate the "send email" recipient list.
 */
export function getArtisansWithEmail(
  interventionArtisans: InterventionArtisanRow[],
  selectedArtisan: SelectedArtisanLike | null | undefined,
): ArtisanWithEmail[] {
  const fromIntervention: ArtisanWithEmail[] = interventionArtisans
    .filter((ia) => ia.artisans?.email && ia.artisans.email.trim().length > 0)
    .map((ia) => ({
      id: ia.artisan_id,
      email: ia.artisans!.email!,
      telephone: ia.artisans?.telephone || '',
      name:
        `${ia.artisans?.prenom || ''} ${ia.artisans?.nom || ''}`.trim() ||
        ia.artisans?.plain_nom ||
        'Artisan',
      is_primary: ia.is_primary,
    }))

  // Add currently-selected artisan if it has an email and isn't already listed
  if (
    selectedArtisan &&
    selectedArtisan.email &&
    selectedArtisan.email.trim().length > 0
  ) {
    const existingIds = new Set(fromIntervention.map((a) => a.id))
    if (!existingIds.has(selectedArtisan.id)) {
      fromIntervention.push({
        id: selectedArtisan.id,
        email: selectedArtisan.email,
        telephone: selectedArtisan.telephone || '',
        name: selectedArtisan.displayName || 'Artisan',
        is_primary: false, // Will be determined when saved
      })
    }
  }

  return fromIntervention
}

// ============================================================================
// selectableUsers
// ============================================================================

interface UserLike {
  id: string
  status?: string | null
  archived_at?: string | null
}

/**
 * Returns the users eligible for assignment on an intervention.
 *
 * Rules:
 * - Active users are always included.
 * - Archived users are included only if they were archived *after* the
 *   intervention date (they were still active on that date).
 * - The current user is sorted first for convenience.
 */
export function getSelectableUsers<T extends UserLike>(params: {
  activeUsers: T[]
  allUsers: T[] | undefined
  interventionDate: string | null | undefined
  currentUserId: string | undefined
}): T[] {
  const { activeUsers, allUsers, interventionDate, currentUserId } = params

  if (!allUsers || !interventionDate) return activeUsers

  const date = new Date(interventionDate)
  if (Number.isNaN(date.getTime())) return activeUsers

  const activeIds = new Set(activeUsers.map((u) => u.id))
  const archivedEligible = allUsers.filter(
    (u) =>
      u.status === 'archived' &&
      u.archived_at &&
      !activeIds.has(u.id) &&
      new Date(u.archived_at) > date,
  )

  const merged = [...activeUsers, ...archivedEligible]
  return merged.sort((a, b) => {
    if (a.id === currentUserId) return -1
    if (b.id === currentUserId) return 1
    return 0
  })
}

// ============================================================================
// isInterventionEmailButtonDisabled
// ============================================================================

/**
 * Returns true if the "Send intervention email" button should be disabled.
 *
 * All fields required for a valid INTER_EN_COURS transition must be filled,
 * because sending the intervention email implies the intervention is ready
 * to dispatch. Client fields are optional for vacant housing.
 */
export function isInterventionEmailButtonDisabled(params: {
  selectedArtisanId: string | null
  formData: Pick<
    InterventionFormData,
    | 'id_inter'
    | 'coutIntervention'
    | 'coutSST'
    | 'consigne_intervention'
    | 'nomPrenomClient'
    | 'telephoneClient'
    | 'date_prevue'
    | 'is_vacant'
  >
}): boolean {
  const { selectedArtisanId, formData } = params

  if (!selectedArtisanId) return true
  if (!formData.id_inter?.trim()) return true
  if (!(parseFloat(formData.coutIntervention) > 0)) return true
  if (!(parseFloat(formData.coutSST) > 0)) return true
  if (!formData.consigne_intervention?.trim()) return true
  // Client fields optional for vacant housing
  if (!formData.is_vacant && !formData.nomPrenomClient?.trim()) return true
  if (!formData.is_vacant && !formData.telephoneClient?.trim()) return true
  if (!formData.date_prevue?.trim()) return true
  return false
}
