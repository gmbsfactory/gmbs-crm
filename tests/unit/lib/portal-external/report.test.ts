import { describe, it, expect } from 'vitest'
import {
  decideNewVersion,
  optionalEventEnvelope,
  validateReportBody,
  validateReportPatchBody,
} from '@/lib/portal-external/report'

/**
 * Règle de versionnage des rapports (§7.3) et validation des corps de requête.
 *
 * `decideNewVersion` est volontairement **pure** : c'est là que vit toute la
 * règle métier du lot L3, et elle doit être vérifiable sans base ni HTTP.
 */

const REP_1 = '11111111-1111-4111-8111-111111111111'
const REP_2 = '22222222-2222-4222-8222-222222222222'

const version = (id: string, v: number, status: string, extra: Record<string, unknown> = {}) => ({
  id,
  version: v,
  status,
  submitted_at: '2026-09-10T08:00:00.000Z',
  reviewed_at: null,
  ...extra,
})

describe('decideNewVersion', () => {
  it('should ouvrir la version 1 quand aucun rapport n’existe', () => {
    expect(decideNewVersion({ reports: [], replaces: null, reopened: false })).toEqual({
      ok: true,
      version: 1,
      replacesId: null,
    })
  })

  it('should ouvrir une version après un refus', () => {
    const reports = [version(REP_1, 1, 'rejected', { reviewed_at: '2026-09-11T09:00:00.000Z' })]
    expect(decideNewVersion({ reports, replaces: null, reopened: false })).toEqual({
      ok: true,
      version: 2,
      replacesId: null,
    })
  })

  it('should refuser une version sur un rapport validé sans réouverture', () => {
    const reports = [version(REP_1, 1, 'approved', { reviewed_at: '2026-09-11T09:00:00.000Z' })]
    expect(decideNewVersion({ reports, replaces: null, reopened: false })).toEqual({
      ok: false,
      error: 'report_already_approved',
    })
  })

  it('should ouvrir une version sur un rapport validé quand l’intervention est repassée en cours', () => {
    const reports = [version(REP_1, 1, 'approved', { reviewed_at: '2026-09-11T09:00:00.000Z' })]
    expect(decideNewVersion({ reports, replaces: null, reopened: true })).toEqual({
      ok: true,
      version: 2,
      replacesId: null,
    })
  })

  it('should refuser un second rapport en attente sans replaces', () => {
    const reports = [version(REP_1, 1, 'submitted')]
    expect(decideNewVersion({ reports, replaces: null, reopened: false })).toEqual({
      ok: false,
      error: 'report_pending',
    })
  })

  it('should remplacer le rapport en attente désigné par replaces', () => {
    const reports = [version(REP_2, 2, 'submitted'), version(REP_1, 1, 'superseded')]
    expect(decideNewVersion({ reports, replaces: REP_2, reopened: false })).toEqual({
      ok: true,
      version: 3,
      replacesId: REP_2,
    })
  })

  it('should refuser un replaces qui ne désigne pas le rapport en attente', () => {
    const reports = [version(REP_2, 2, 'submitted'), version(REP_1, 1, 'superseded')]
    expect(decideNewVersion({ reports, replaces: REP_1, reopened: false })).toEqual({
      ok: false,
      error: 'report_not_replaceable',
    })
  })

  it('should refuser un replaces quand plus rien n’est en attente (intention périmée)', () => {
    const reports = [version(REP_1, 1, 'rejected')]
    expect(decideNewVersion({ reports, replaces: REP_1, reopened: false })).toEqual({
      ok: false,
      error: 'report_not_replaceable',
    })
  })

  it('should numéroter à partir de la version la plus haute, pas du nombre de rapports', () => {
    const reports = [version(REP_2, 7, 'rejected'), version(REP_1, 1, 'superseded')]
    const decision = decideNewVersion({ reports, replaces: null, reopened: false })
    expect(decision).toEqual({ ok: true, version: 8, replacesId: null })
  })

  it('should ne pas coincer l’artisan sur une supersession interrompue', () => {
    const reports = [version(REP_1, 1, 'superseded')]
    expect(decideNewVersion({ reports, replaces: null, reopened: false })).toEqual({
      ok: true,
      version: 2,
      replacesId: null,
    })
  })
})

describe('validateReportBody — replaces', () => {
  const base = {
    portal_report_id: REP_1,
    travaux_realises: 'Remplacement du mitigeur.',
    reste_a_faire: false,
    client_present: true,
  }

  it('should accepter un corps sans replaces', () => {
    const result = validateReportBody(base)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.replaces).toBeNull()
  })

  it('should normaliser replaces en minuscules', () => {
    const result = validateReportBody({ ...base, replaces: REP_2.toUpperCase() })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.replaces).toBe(REP_2)
  })

  it('should refuser un replaces qui n’est pas un uuid', () => {
    const result = validateReportBody({ ...base, replaces: 'rep-2' })
    expect(result).toEqual({ ok: false, error: 'replaces must be a uuid' })
  })
})

describe('validateReportPatchBody', () => {
  it('should refuser un patch vide', () => {
    expect(validateReportPatchBody({})).toEqual({ ok: false, error: 'no field to update' })
  })

  it('should ne retenir que les champs transmis et tenir content aligné', () => {
    const result = validateReportPatchBody({ travaux_realises: '  Résistance changée  ' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.patch).toEqual({ travaux_realises: 'Résistance changée', content: 'Résistance changée' })
    expect(result.value.fields).toEqual(['travaux_realises'])
  })

  it('should accepter la remise à null d’un champ texte facultatif', () => {
    const result = validateReportPatchBody({ anomalies: '' })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.patch).toEqual({ anomalies: null })
  })

  it('should accepter les booléens et la durée', () => {
    const result = validateReportPatchBody({ reste_a_faire: true, client_present: false, duree_minutes: 45 })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.patch).toEqual({ reste_a_faire: true, client_present: false, duree_minutes: 45 })
    expect(result.value.fields).toEqual(['duree_minutes', 'reste_a_faire', 'client_present'])
  })

  it('should refuser un travaux_realises vide', () => {
    expect(validateReportPatchBody({ travaux_realises: '   ' })).toEqual({
      ok: false,
      error: 'travaux_realises required',
    })
  })

  it('should refuser une durée non entière', () => {
    expect(validateReportPatchBody({ duree_minutes: 12.5 })).toEqual({ ok: false, error: 'duree_minutes invalid' })
  })

  it('should refuser un attachment_ids qui n’est pas une liste d’uuid', () => {
    expect(validateReportPatchBody({ attachment_ids: ['ph-1'] })).toEqual({
      ok: false,
      error: 'attachment_ids must be an array of uuid',
    })
  })
})

describe('optionalEventEnvelope', () => {
  it('should accepter l’absence d’enveloppe (téléphone non mis à jour)', () => {
    expect(optionalEventEnvelope({})).toEqual({ ok: true, value: null })
  })

  it('should valider l’enveloppe quand elle est fournie', () => {
    const result = optionalEventEnvelope({ event_uid: ' evt-1 ', occurred_at: '2026-09-12T08:12:04.000Z' })
    expect(result).toEqual({
      ok: true,
      value: { event_uid: 'evt-1', occurred_at_declared: '2026-09-12T08:12:04.000Z' },
    })
  })

  it('should refuser un event_uid vide', () => {
    expect(optionalEventEnvelope({ event_uid: '   ' })).toEqual({ ok: false, error: 'event_uid required' })
  })
})
