import { describe, it, expect } from 'vitest'
import {
  getArtisansWithEmail,
  getSelectableUsers,
  isInterventionEmailButtonDisabled,
} from '@/lib/interventions/derivations'

// ============================================================================
// getArtisansWithEmail
// ============================================================================

describe('getArtisansWithEmail', () => {
  const baseArtisan = {
    prenom: 'Jean',
    nom: 'Dupont',
    email: 'jean@example.com',
    telephone: '0601020304',
    plain_nom: null,
  }

  it('returns empty array when no artisans and no selected artisan', () => {
    expect(getArtisansWithEmail([], null)).toEqual([])
  })

  it('filters out intervention artisans without email', () => {
    const result = getArtisansWithEmail(
      [
        { artisan_id: '1', is_primary: true, artisans: { ...baseArtisan, email: '' } },
        { artisan_id: '2', is_primary: false, artisans: { ...baseArtisan, email: '   ' } },
        { artisan_id: '3', is_primary: false, artisans: null },
      ],
      null,
    )
    expect(result).toEqual([])
  })

  it('maps intervention artisans with email to ArtisanWithEmail shape', () => {
    const result = getArtisansWithEmail(
      [
        {
          artisan_id: 'a1',
          is_primary: true,
          artisans: { ...baseArtisan, email: 'a@x.com', telephone: '0102' },
        },
      ],
      null,
    )
    expect(result).toEqual([
      {
        id: 'a1',
        email: 'a@x.com',
        telephone: '0102',
        name: 'Jean Dupont',
        is_primary: true,
      },
    ])
  })

  it('falls back to plain_nom when prenom and nom are empty', () => {
    const result = getArtisansWithEmail(
      [
        {
          artisan_id: 'a1',
          is_primary: false,
          artisans: { prenom: '', nom: '', plain_nom: 'SARL Dupont', email: 'x@y.com' },
        },
      ],
      null,
    )
    expect(result[0].name).toBe('SARL Dupont')
  })

  it('falls back to "Artisan" when all name fields are empty', () => {
    const result = getArtisansWithEmail(
      [
        {
          artisan_id: 'a1',
          is_primary: false,
          artisans: { prenom: null, nom: null, plain_nom: null, email: 'x@y.com' },
        },
      ],
      null,
    )
    expect(result[0].name).toBe('Artisan')
  })

  it('adds the selected artisan when not already in the intervention list', () => {
    const result = getArtisansWithEmail([], {
      id: 'sel-1',
      email: 'sel@x.com',
      telephone: '0102',
      displayName: 'Selected Co',
    })
    expect(result).toEqual([
      {
        id: 'sel-1',
        email: 'sel@x.com',
        telephone: '0102',
        name: 'Selected Co',
        is_primary: false,
      },
    ])
  })

  it('does NOT duplicate the selected artisan if already in the intervention list', () => {
    const result = getArtisansWithEmail(
      [
        {
          artisan_id: 'a1',
          is_primary: true,
          artisans: { ...baseArtisan, email: 'a@x.com' },
        },
      ],
      { id: 'a1', email: 'different@x.com', displayName: 'Same Guy' },
    )
    expect(result).toHaveLength(1)
    expect(result[0].email).toBe('a@x.com') // keeps intervention version
  })

  it('skips the selected artisan when it has no email', () => {
    const result = getArtisansWithEmail([], { id: 'sel-1', email: '', displayName: 'X' })
    expect(result).toEqual([])
  })

  it('skips the selected artisan when email is whitespace only', () => {
    const result = getArtisansWithEmail([], { id: 'sel-1', email: '   ', displayName: 'X' })
    expect(result).toEqual([])
  })
})

// ============================================================================
// getSelectableUsers
// ============================================================================

describe('getSelectableUsers', () => {
  const active = [
    { id: 'u1', status: 'active' as const },
    { id: 'u2', status: 'active' as const },
  ]

  it('returns active users as-is when allUsers is undefined', () => {
    const result = getSelectableUsers({
      activeUsers: active,
      allUsers: undefined,
      interventionDate: '2026-01-15',
      currentUserId: undefined,
    })
    expect(result).toEqual(active)
  })

  it('returns active users as-is when interventionDate is missing', () => {
    const result = getSelectableUsers({
      activeUsers: active,
      allUsers: [...active, { id: 'u3', status: 'archived', archived_at: '2026-02-01' }],
      interventionDate: null,
      currentUserId: undefined,
    })
    expect(result).toEqual(active)
  })

  it('returns active users as-is when interventionDate is invalid', () => {
    const result = getSelectableUsers({
      activeUsers: active,
      allUsers: [...active],
      interventionDate: 'not-a-date',
      currentUserId: undefined,
    })
    expect(result).toEqual(active)
  })

  it('includes archived user if archived_at is AFTER intervention date', () => {
    const result = getSelectableUsers({
      activeUsers: active,
      allUsers: [
        ...active,
        { id: 'u3', status: 'archived', archived_at: '2026-03-01' },
      ],
      interventionDate: '2026-01-15',
      currentUserId: undefined,
    })
    expect(result.map((u) => u.id)).toEqual(['u1', 'u2', 'u3'])
  })

  it('excludes archived user if archived_at is BEFORE intervention date', () => {
    const result = getSelectableUsers({
      activeUsers: active,
      allUsers: [
        ...active,
        { id: 'u3', status: 'archived', archived_at: '2025-12-01' },
      ],
      interventionDate: '2026-01-15',
      currentUserId: undefined,
    })
    expect(result.map((u) => u.id)).toEqual(['u1', 'u2'])
  })

  it('excludes archived user without archived_at', () => {
    const result = getSelectableUsers({
      activeUsers: active,
      allUsers: [
        ...active,
        { id: 'u3', status: 'archived', archived_at: null },
      ],
      interventionDate: '2026-01-15',
      currentUserId: undefined,
    })
    expect(result.map((u) => u.id)).toEqual(['u1', 'u2'])
  })

  it('does not duplicate a user already in activeUsers', () => {
    const result = getSelectableUsers({
      activeUsers: active,
      allUsers: [
        ...active,
        { id: 'u1', status: 'archived', archived_at: '2026-03-01' }, // same id as active u1
      ],
      interventionDate: '2026-01-15',
      currentUserId: undefined,
    })
    expect(result).toHaveLength(2)
  })

  it('sorts the current user first (only after merge path runs)', () => {
    // Note: the sort only runs on the merged-path; the early-return path
    // returns activeUsers as-is. We pass valid allUsers + interventionDate
    // to force the merge path.
    const result = getSelectableUsers({
      activeUsers: active,
      allUsers: active,
      interventionDate: '2026-01-15',
      currentUserId: 'u2',
    })
    expect(result[0].id).toBe('u2')
  })
})

// ============================================================================
// isInterventionEmailButtonDisabled
// ============================================================================

describe('isInterventionEmailButtonDisabled', () => {
  const validFormData = {
    id_inter: 'INT-001',
    coutIntervention: '100',
    coutSST: '50',
    consigne_intervention: 'Faire attention',
    nomPrenomClient: 'Jean Dupont',
    telephoneClient: '0601020304',
    date_prevue: '2026-05-01',
    is_vacant: false,
  } as any

  it('returns true when no artisan selected', () => {
    expect(
      isInterventionEmailButtonDisabled({
        selectedArtisanId: null,
        formData: validFormData,
      }),
    ).toBe(true)
  })

  it('returns false when all required fields are filled and artisan selected', () => {
    expect(
      isInterventionEmailButtonDisabled({
        selectedArtisanId: 'a1',
        formData: validFormData,
      }),
    ).toBe(false)
  })

  it('returns true when id_inter is empty', () => {
    expect(
      isInterventionEmailButtonDisabled({
        selectedArtisanId: 'a1',
        formData: { ...validFormData, id_inter: '' },
      }),
    ).toBe(true)
  })

  it('returns true when id_inter is whitespace only', () => {
    expect(
      isInterventionEmailButtonDisabled({
        selectedArtisanId: 'a1',
        formData: { ...validFormData, id_inter: '   ' },
      }),
    ).toBe(true)
  })

  it('returns true when coutIntervention is zero', () => {
    expect(
      isInterventionEmailButtonDisabled({
        selectedArtisanId: 'a1',
        formData: { ...validFormData, coutIntervention: '0' },
      }),
    ).toBe(true)
  })

  it('returns true when coutSST is zero', () => {
    expect(
      isInterventionEmailButtonDisabled({
        selectedArtisanId: 'a1',
        formData: { ...validFormData, coutSST: '' },
      }),
    ).toBe(true)
  })

  it('returns true when consigne_intervention is empty', () => {
    expect(
      isInterventionEmailButtonDisabled({
        selectedArtisanId: 'a1',
        formData: { ...validFormData, consigne_intervention: '' },
      }),
    ).toBe(true)
  })

  it('returns true when date_prevue is empty', () => {
    expect(
      isInterventionEmailButtonDisabled({
        selectedArtisanId: 'a1',
        formData: { ...validFormData, date_prevue: '' },
      }),
    ).toBe(true)
  })

  it('returns true when client fields empty and NOT vacant', () => {
    expect(
      isInterventionEmailButtonDisabled({
        selectedArtisanId: 'a1',
        formData: { ...validFormData, nomPrenomClient: '', is_vacant: false },
      }),
    ).toBe(true)
    expect(
      isInterventionEmailButtonDisabled({
        selectedArtisanId: 'a1',
        formData: { ...validFormData, telephoneClient: '', is_vacant: false },
      }),
    ).toBe(true)
  })

  it('returns false when client fields empty but housing IS vacant', () => {
    expect(
      isInterventionEmailButtonDisabled({
        selectedArtisanId: 'a1',
        formData: {
          ...validFormData,
          nomPrenomClient: '',
          telephoneClient: '',
          is_vacant: true,
        },
      }),
    ).toBe(false)
  })
})
