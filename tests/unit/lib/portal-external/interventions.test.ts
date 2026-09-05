import { describe, it, expect } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createPlannedClient } from '../../../__mocks__/portal-external-client'
import {
  PORTAL_ONGOING_STATUSES,
  PORTAL_PRICE_STATUSES,
  PORTAL_REPORT_STATUSES,
  PORTAL_START_STATUSES,
  PORTAL_TENANT_STATUSES,
  PORTAL_VISIBLE_STATUSES,
  isPriceAllowedStatus,
  isReportAllowedStatus,
  isStartAllowedStatus,
  isTenantVisibleStatus,
  listPortalInterventions,
  pickPortalReport,
} from '@/lib/portal-external/interventions'

describe('pickPortalReport', () => {
  it('should return null without report', () => {
    expect(pickPortalReport([])).toBeNull()
  })

  it('should return the first (most recent) report when none is pending', () => {
    const reports = [{ id: 'b', status: 'approved' }, { id: 'a', status: 'rejected' }]
    expect(pickPortalReport(reports)?.id).toBe('b')
  })

  it('should prefer the submitted report even if an approved one is more recent', () => {
    const reports = [
      { id: 'sofia-v2', status: 'approved' },
      { id: 'karim-v1', status: 'submitted' },
      { id: 'sofia-v1', status: 'rejected' },
    ]
    expect(pickPortalReport(reports)?.id).toBe('karim-v1')
  })

  it('should keep the first submitted report when several are pending', () => {
    const reports = [{ id: 'k', status: 'submitted' }, { id: 's', status: 'submitted' }]
    expect(pickPortalReport(reports)?.id).toBe('k')
  })
})

describe('Constantes de visibilité du portail (spécification §7.1)', () => {
  it('should expose six independent literal lists, never aliases', () => {
    const listes = [
      PORTAL_VISIBLE_STATUSES,
      PORTAL_TENANT_STATUSES,
      PORTAL_REPORT_STATUSES,
      PORTAL_ONGOING_STATUSES,
      PORTAL_PRICE_STATUSES,
      PORTAL_START_STATUSES,
    ]
    // Deux alias partageraient la même référence : c'est exactement le bug
    // d'origine (modifier l'une modifiait silencieusement les trois).
    for (let i = 0; i < listes.length; i += 1) {
      for (let j = i + 1; j < listes.length; j += 1) {
        expect(listes[i]).not.toBe(listes[j])
      }
    }
  })

  it('should never leak the tenant in DEVIS_ENVOYE (RGPD, principe P4)', () => {
    expect(isTenantVisibleStatus('DEVIS_ENVOYE')).toBe(false)
    expect(PORTAL_TENANT_STATUSES).not.toContain('DEVIS_ENVOYE')
  })

  it('should never allow a report in DEVIS_ENVOYE', () => {
    expect(isReportAllowedStatus('DEVIS_ENVOYE')).toBe(false)
  })

  it('should not count DEVIS_ENVOYE as an ongoing mission', () => {
    expect(PORTAL_ONGOING_STATUSES).not.toContain('DEVIS_ENVOYE')
  })

  it('should allow a price response only in DEVIS_ENVOYE', () => {
    expect(isPriceAllowedStatus('DEVIS_ENVOYE')).toBe(true)
    expect(isPriceAllowedStatus('ACCEPTE')).toBe(false)
    expect(isPriceAllowedStatus(null)).toBe(false)
  })

  it('should allow a work start only in ACCEPTE', () => {
    expect(isStartAllowedStatus('ACCEPTE')).toBe(true)
    expect(isStartAllowedStatus('DEVIS_ENVOYE')).toBe(false)
    expect(isStartAllowedStatus('INTER_EN_COURS')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Règle de visibilité complète et projections (spécification §7.1, §7.6, §4.2.1)
// ---------------------------------------------------------------------------

const ARTISAN_ID = 'art-1'

function assignment(over: Partial<Record<string, unknown>> = {}) {
  return {
    role: 'primary',
    is_primary: true,
    price_response: null,
    price_responded_at: null,
    price_accepted_amount: null,
    price_refused_reason: null,
    work_started_at: null,
    payment_status: 'not_applicable',
    paid_at: null,
    intervention: {
      id: 'i1',
      id_inter: 'DEMO-001',
      date: '2026-09-10',
      date_prevue: '2026-09-12',
      adresse: '1 rue de Paris',
      code_postal: '75001',
      ville: 'Paris',
      latitude: null,
      longitude: null,
      contexte_intervention: 'Fuite',
      consigne_intervention: null,
      consigne_second_artisan: null,
      assigned_user_id: 'u1',
      is_active: true,
      statut: { code: 'DEVIS_ENVOYE', label: 'Devis Envoyé', color: '#8B5CF6' },
      metier: { label: 'Plomberie' },
      tenant: {
        firstname: 'Jeanne',
        lastname: 'Durand',
        plain_nom_client: 'Jeanne Durand',
        telephone: '06 12 34 56 78',
      },
      agence: { label: 'Agence Nord' },
    },
    ...over,
  }
}

function withStatus(code: string, over: Record<string, unknown> = {}) {
  const row = assignment(over) as Record<string, unknown>
  const inter = row.intervention as Record<string, unknown>
  inter.statut = { code, label: code, color: '#000000' }
  return row
}

function plan(options: {
  assignments: unknown[]
  costs?: unknown[]
  transitions?: unknown[]
}) {
  return createPlannedClient({
    intervention_artisans: [{ data: options.assignments, error: null }],
    intervention_attachments: [{ data: [], error: null }],
    intervention_costs: [{ data: options.costs ?? [], error: null }],
    artisan_reports: [{ data: [], error: null }],
    intervention_status_transitions: [{ data: options.transitions ?? [], error: null }],
  }) as unknown as SupabaseClient
}

const COUT_SST = [{ intervention_id: 'i1', amount: '480.00', artisan_order: 1 }]

describe('listPortalInterventions — visibilité', () => {
  it('should expose a DEVIS_ENVOYE mission once a SST cost is set', async () => {
    const list = await listPortalInterventions(plan({ assignments: [assignment()], costs: COUT_SST }), ARTISAN_ID)
    expect(list).toHaveLength(1)
    expect(list[0].statut_code).toBe('DEVIS_ENVOYE')
    expect(list[0].groupe).toBe('a_accepter')
    expect(list[0].cout_sst).toBe(480)
  })

  it('should NEVER expose the tenant in DEVIS_ENVOYE (RGPD, principe P4)', async () => {
    const list = await listPortalInterventions(plan({ assignments: [assignment()], costs: COUT_SST }), ARTISAN_ID)
    expect(list[0].tenant).toBeNull()
  })

  it('should still expose the tenant once the mission is ACCEPTE', async () => {
    const list = await listPortalInterventions(
      plan({ assignments: [withStatus('ACCEPTE')], costs: COUT_SST }),
      ARTISAN_ID,
    )
    expect(list[0].tenant).toEqual({ nom: 'Jeanne Durand', telephone: '06 12 34 56 78' })
  })

  it('should hide a DEVIS_ENVOYE mission without any SST cost', async () => {
    const list = await listPortalInterventions(plan({ assignments: [assignment()], costs: [] }), ARTISAN_ID)
    expect(list).toHaveLength(0)
  })

  it('should keep a DEVIS_ENVOYE mission whose SST cost is zero (travaux offerts)', async () => {
    const list = await listPortalInterventions(
      plan({ assignments: [assignment()], costs: [{ intervention_id: 'i1', amount: '0.00', artisan_order: 1 }] }),
      ARTISAN_ID,
    )
    expect(list).toHaveLength(1)
    expect(list[0].price.can_accept).toBe(true)
  })

  it('should put a STAND_BY mission in the "en cours" group instead of hiding it', async () => {
    const list = await listPortalInterventions(plan({ assignments: [withStatus('STAND_BY')] }), ARTISAN_ID)
    expect(list).toHaveLength(1)
    expect(list[0].groupe).toBe('en_cours')
  })

  it('should keep a mission cancelled less than 7 days ago, in the "terminee" group', async () => {
    const hier = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
    const list = await listPortalInterventions(
      plan({
        assignments: [withStatus('ANNULE')],
        transitions: [{ intervention_id: 'i1', to_status_code: 'ANNULE', transition_date: hier }],
      }),
      ARTISAN_ID,
    )
    expect(list).toHaveLength(1)
    expect(list[0].groupe).toBe('terminee')
  })

  it('should drop a mission cancelled more than 7 days ago', async () => {
    const vieux = new Date(Date.now() - 9 * 24 * 3600 * 1000).toISOString()
    const list = await listPortalInterventions(
      plan({
        assignments: [withStatus('REFUSE')],
        transitions: [{ intervention_id: 'i1', to_status_code: 'REFUSE', transition_date: vieux }],
      }),
      ARTISAN_ID,
    )
    expect(list).toHaveLength(0)
  })

  it('should never list a status outside the portal lists', async () => {
    const list = await listPortalInterventions(plan({ assignments: [withStatus('VISITE_TECHNIQUE')] }), ARTISAN_ID)
    expect(list).toHaveLength(0)
  })
})

describe('listPortalInterventions — projections prix, chantier, paiement', () => {
  it('should allow a price answer only while nothing has been answered', async () => {
    const list = await listPortalInterventions(plan({ assignments: [assignment()], costs: COUT_SST }), ARTISAN_ID)
    expect(list[0].price).toMatchObject({ response: null, amount: 480, can_accept: true })
    expect(list[0].work.can_start).toBe(false)
  })

  it('should close can_accept once the artisan has answered', async () => {
    const list = await listPortalInterventions(
      plan({
        assignments: [
          assignment({
            price_response: 'accepted',
            price_responded_at: '2026-09-10T09:12:00.000Z',
            price_accepted_amount: '480.00',
          }),
        ],
        costs: COUT_SST,
      }),
      ARTISAN_ID,
    )
    expect(list[0].price).toMatchObject({
      response: 'accepted',
      accepted_amount: 480,
      can_accept: false,
    })
  })

  it('should allow the start only in ACCEPTE with an accepted price and no start yet', async () => {
    const list = await listPortalInterventions(
      plan({ assignments: [withStatus('ACCEPTE', { price_response: 'accepted' })], costs: COUT_SST }),
      ARTISAN_ID,
    )
    expect(list[0].work.can_start).toBe(true)
  })

  it('should refuse the start when the price was not accepted', async () => {
    const list = await listPortalInterventions(
      plan({ assignments: [withStatus('ACCEPTE', { price_response: 'refused' })], costs: COUT_SST }),
      ARTISAN_ID,
    )
    expect(list[0].work.can_start).toBe(false)
  })

  it('should refuse a second start once work_started_at is set', async () => {
    const list = await listPortalInterventions(
      plan({
        assignments: [
          withStatus('ACCEPTE', { price_response: 'accepted', work_started_at: '2026-09-12T08:40:00.000Z' }),
        ],
        costs: COUT_SST,
      }),
      ARTISAN_ID,
    )
    expect(list[0].work).toEqual({ started_at: '2026-09-12T08:40:00.000Z', can_start: false })
  })

  it('should project the payment only on a finished mission, with HIS own cost', async () => {
    const enCours = await listPortalInterventions(
      plan({ assignments: [withStatus('INTER_EN_COURS')], costs: COUT_SST }),
      ARTISAN_ID,
    )
    expect(enCours[0].payment).toBeNull()

    const terminee = await listPortalInterventions(
      plan({
        assignments: [withStatus('INTER_TERMINEE', { payment_status: 'paid', paid_at: '2026-09-20T10:00:00.000Z' })],
        costs: COUT_SST,
      }),
      ARTISAN_ID,
    )
    expect(terminee[0].payment).toMatchObject({ state: 'paid', label: 'Payé le 20/09', amount: 480 })
  })
})
