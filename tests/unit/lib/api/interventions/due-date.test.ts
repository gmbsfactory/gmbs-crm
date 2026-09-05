import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => ({
  update: vi.fn(),
  getStatusByCode: vi.fn(),
  getStatusByLabel: vi.fn(),
}))

// `server.ts` importe la couche API et le client SSR : on les remplace pour
// isoler la seule question posée ici — que met-on dans `date_prevue` ?
vi.mock('@/lib/api', () => ({
  interventionsApi: {
    update: h.update,
    getStatusByCode: h.getStatusByCode,
    getStatusByLabel: h.getStatusByLabel,
  },
}))
vi.mock('@/lib/supabase/server-ssr', () => ({ createSSRServerClient: vi.fn() }))

import { computeDueDate, transitionStatus } from '@/lib/api/interventions/server'
import { buildStatusUpdatePayload } from '@/lib/interventions/mappers'

const INTERVENTION = 'i-1'

/**
 * Non-régression du constat 8 de la recette : le menu contextuel du CRM change
 * le statut SANS `dueAt` (« Passer en devis envoyé », « Passer en accepté »).
 * Tant que `computeDueDate` renvoyait `null` dans ce cas, la colonne
 * `date_prevue` était effacée — et le démarrage de chantier de l'artisan
 * répondait ensuite « La date prévue doit être renseignée pour passer en cours ».
 */
describe('computeDueDate', () => {
  it('should return undefined when dueAt is not provided at all', () => {
    expect(computeDueDate({ status: 'DEVIS_ENVOYE' })).toBeUndefined()
    expect(computeDueDate({ status: 'ACCEPTE' })).toBeUndefined()
    expect(computeDueDate({})).toBeUndefined()
  })

  it('should return null only when dueAt is explicitly emptied', () => {
    expect(computeDueDate({ status: 'ACCEPTE', dueAt: null })).toBeNull()
    expect(computeDueDate({ status: 'ACCEPTE', dueAt: '' })).toBeNull()
  })

  it('should keep the provided date, as a Date or as a string', () => {
    const date = new Date('2026-09-07T14:00:00.000Z')
    expect(computeDueDate({ status: 'ACCEPTE', dueAt: date })).toBe(date)
    expect(computeDueDate({ status: 'ACCEPTE', dueAt: '2026-09-07T14:00:00.000Z' })).toEqual(date)
  })

  it('should still default INTER_EN_COURS to J+7 when no date is known', () => {
    const result = computeDueDate({ status: 'INTER_EN_COURS' })
    expect(result).toBeInstanceOf(Date)
  })
})

describe('buildStatusUpdatePayload', () => {
  it('should leave date_prevue untouched when dueAt is undefined', () => {
    expect(buildStatusUpdatePayload('DEVIS_ENVOYE', undefined).date_prevue).toBeUndefined()
  })

  it('should empty date_prevue when dueAt is null', () => {
    expect(buildStatusUpdatePayload('DEVIS_ENVOYE', null).date_prevue).toBeNull()
  })
})

describe('transitionStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    h.getStatusByCode.mockResolvedValue({ id: 'st-devis', code: 'DEVIS_ENVOYE' })
    h.update.mockResolvedValue({ id: INTERVENTION, status: { id: 'st-devis', code: 'DEVIS_ENVOYE' } })
  })

  it('should NOT touch date_prevue on a status change sent without dueAt', async () => {
    await transitionStatus(INTERVENTION, { status: 'DEVIS_ENVOYE' })

    expect(h.update).toHaveBeenCalledTimes(1)
    const payload = h.update.mock.calls[0][1] as Record<string, unknown>
    expect(payload.date_prevue).toBeUndefined()
    expect(payload.statut_id).toBe('st-devis')
  })

  it('should write the date when the caller provides one', async () => {
    await transitionStatus(INTERVENTION, { status: 'DEVIS_ENVOYE', dueAt: '2026-09-07T14:00:00.000Z' })

    const payload = h.update.mock.calls[0][1] as Record<string, unknown>
    expect(payload.date_prevue).toBe('2026-09-07T14:00:00.000Z')
  })

  it('should empty the date only when the caller explicitly sends null', async () => {
    await transitionStatus(INTERVENTION, { status: 'DEVIS_ENVOYE', dueAt: null })

    const payload = h.update.mock.calls[0][1] as Record<string, unknown>
    expect(payload.date_prevue).toBeNull()
  })
})
