import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

const h = vi.hoisted(() => ({ update: vi.fn() }))

// La bascule de statut passe par la couche API partagée : on la remplace pour
// pouvoir jouer les deux cas — projection réussie, projection refusée.
vi.mock('@/lib/api', () => ({ interventionsApi: { update: h.update } }))

import { createPlannedClient, type PlannedClient } from '../../../__mocks__/portal-external-client'
import { collectMissingFields, startWork } from '@/lib/portal-external/work-start'

const ARTISAN = 'art-1'
const INTERVENTION = 'i-1'

function assignmentRow(over: Record<string, unknown> = {}) {
  return {
    id: 'ia-1',
    role: 'primary',
    is_primary: true,
    price_response: 'accepted',
    work_started_at: null,
    work_started_from: null,
    ...over,
  }
}

/** Fiche complète : aucun des quatorze champs ne manque. */
function interventionRow(over: Record<string, unknown> = {}) {
  return {
    id: INTERVENTION,
    id_inter: 'DEMO-004',
    adresse: '1 rue de Paris',
    code_postal: '75001',
    ville: 'Paris',
    contexte_intervention: 'Fuite sous évier',
    consigne_intervention: 'Sonner chez la gardienne',
    date_prevue: '2026-09-12',
    agence_id: 'ag-1',
    metier_id: 'me-1',
    assigned_user_id: 'u-1',
    tenant_id: 't-1',
    owner_id: 'o-1',
    is_active: true,
    statut: { code: 'ACCEPTE' },
    ...over,
  }
}

function client(options: {
  journal?: unknown
  assignment?: unknown
  intervention?: unknown
  costs?: unknown[]
  tenant?: unknown
  owner?: unknown
}): PlannedClient {
  const assignment = options.assignment === undefined ? assignmentRow() : options.assignment
  return createPlannedClient({
    artisan_portal_actions: [
      { data: options.journal ?? null, error: null },
      { data: { id: 'log-1' }, error: null },
    ],
    intervention_artisans: [
      { data: assignment, error: null },
      { data: assignment, error: null },
      { data: assignment, error: null },
    ],
    interventions: [{ data: options.intervention ?? interventionRow(), error: null }],
    intervention_statuses: [{ data: { id: 'st-encours' }, error: null }],
    intervention_costs: [
      {
        data:
          options.costs ?? [
            { cost_type: 'intervention', amount: '900.00', artisan_order: null },
            { cost_type: 'sst', amount: '480.00', artisan_order: 1 },
          ],
        error: null,
      },
    ],
    tenants: [
      {
        data:
          options.tenant === undefined
            ? { firstname: 'Jeanne', lastname: 'Durand', plain_nom_client: null, telephone: '0612345678' }
            : options.tenant,
        error: null,
      },
    ],
    owner: [
      {
        data:
          options.owner === undefined
            ? { owner_firstname: 'Paul', owner_lastname: 'Martin', plain_nom_facturation: 'SCI Martin' }
            : options.owner,
        error: null,
      },
    ],
  })
}

function call(planned: PlannedClient, over: Record<string, unknown> = {}) {
  return startWork({
    supabase: planned as unknown as SupabaseClient,
    artisanId: ARTISAN,
    interventionId: INTERVENTION,
    source: 'portal',
    envelope: { event_uid: 'evt-1', occurred_at_declared: null },
    ...over,
  })
}

describe('collectMissingFields', () => {
  it('should list every field a complete fiche does not miss', () => {
    expect(
      collectMissingFields({
        idIntervention: 'DEMO-004',
        artisanId: ARTISAN,
        agenceId: 'ag-1',
        metierId: 'me-1',
        adresse: '1 rue de Paris',
        contexteIntervention: 'Fuite',
        assignedUserId: 'u-1',
        nomPrenomFacturation: 'SCI Martin',
        coutIntervention: 900,
        coutSST: 480,
        consigneArtisan: 'Sonner',
        nomPrenomClient: 'Jeanne Durand',
        telephoneClient: '0612345678',
        datePrevue: '2026-09-12',
      }),
    ).toEqual([])
  })

  it('should name the missing fields of an incomplete fiche', () => {
    const manquants = collectMissingFields({ idIntervention: 'DEMO-004', artisanId: ARTISAN })
    const cles = manquants.map((m) => m.key)
    expect(cles).toContain('INTER_EN_COURS_COUT_INTERVENTION')
    expect(cles).toContain('INTER_EN_COURS_TELEPHONE_CLIENT')
    expect(cles).toContain('DEMANDE_ADRESSE_REQUIRED')
    expect(manquants.every((m) => m.label.length > 0)).toBe(true)
  })

  it('should accept a SST cost of zero (travaux offerts) but not its absence', () => {
    const base = {
      idIntervention: 'X',
      artisanId: ARTISAN,
      agenceId: 'a',
      metierId: 'm',
      adresse: 'a',
      contexteIntervention: 'c',
      assignedUserId: 'u',
      nomPrenomFacturation: 'f',
      coutIntervention: 900,
      consigneArtisan: 'c',
      nomPrenomClient: 'n',
      telephoneClient: 't',
      datePrevue: 'd',
    }
    expect(collectMissingFields({ ...base, coutSST: 0 })).toEqual([])
    expect(collectMissingFields({ ...base, coutSST: null }).map((m) => m.key)).toContain(
      'INTER_EN_COURS_COUT_SST',
    )
  })
})

describe('startWork', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    h.update.mockResolvedValue({ id: INTERVENTION })
  })

  it('should record the start and advance the status on a complete fiche', async () => {
    const planned = client({})
    const result = await call(planned)

    expect(result.status).toBe(200)
    expect(result.body).toMatchObject({
      status_advanced: true,
      statut_code: 'INTER_EN_COURS',
      missing_fields: [],
    })
    const update = planned.calls.find((c) => c.table === 'intervention_artisans' && c.op === 'update')
    expect(update?.payload).toMatchObject({ work_started_from: 'portal' })
    expect(h.update).toHaveBeenCalledWith(INTERVENTION, expect.objectContaining({ statut_id: 'st-encours' }))
  })

  it('should NEVER overwrite an existing date_prevue with J+7', async () => {
    await call(client({}))
    expect(h.update).toHaveBeenCalledWith(INTERVENTION, expect.objectContaining({ date_prevue: '2026-09-12' }))
  })

  it('should keep the fact even when the transition fails (règle P3)', async () => {
    h.update.mockRejectedValue(new Error('transition refusée'))
    const planned = client({ intervention: interventionRow({ consigne_intervention: null, date_prevue: null }) })
    const result = await call(planned)

    expect(result.status).toBe(200)
    if (result.status !== 200) throw new Error('unreachable')
    expect(result.body.status_advanced).toBe(false)
    expect(result.body.statut_code).toBe('ACCEPTE')
    expect(result.body.work.started_at).toBeTruthy()
    // Le fait est écrit AVANT la tentative de projection : il survit à son échec.
    const update = planned.calls.find((c) => c.table === 'intervention_artisans' && c.op === 'update')
    expect(update?.payload).toMatchObject({ work_started_from: 'portal' })
    const journal = planned.calls.find((c) => c.table === 'artisan_portal_actions' && c.op === 'insert')
    expect(journal?.payload).toMatchObject({ action_type: 'WORK_STARTED', event_uid: 'evt-1' })
  })

  it('should report the missing fields of an incomplete fiche', async () => {
    const planned = client({
      intervention: interventionRow({ consigne_intervention: null }),
      tenant: null,
    })
    const result = await call(planned)
    if (result.status !== 200) throw new Error('unreachable')
    const cles = result.body.missing_fields.map((m) => m.key)
    expect(cles).toContain('INTER_EN_COURS_CONSIGNE_ARTISAN')
    expect(cles).toContain('INTER_EN_COURS_NOM_CLIENT')
    expect(result.body.missing_fields.length).toBeGreaterThan(0)
  })

  it('should refuse the start when the price was not accepted', async () => {
    const planned = client({ assignment: assignmentRow({ price_response: null }) })
    const result = await call(planned)
    expect(result.status).toBe(409)
    expect(result.body).toEqual({ error: 'price_not_accepted' })
    expect(planned.calls.some((c) => c.table === 'intervention_artisans' && c.op === 'update')).toBe(false)
  })

  it('should accept a price answered by the manager over the phone', async () => {
    const planned = client({ assignment: assignmentRow({ price_response: 'accepted' }) })
    const result = await call(planned)
    expect(result.status).toBe(200)
  })

  it('should refuse the start outside ACCEPTE', async () => {
    const planned = client({ intervention: interventionRow({ statut: { code: 'DEVIS_ENVOYE' } }) })
    const result = await call(planned)
    expect(result.status).toBe(409)
    expect(result.body).toEqual({ error: 'status_not_allowed' })
  })

  it('should answer 404 when the artisan is not assigned', async () => {
    const result = await call(client({ assignment: null }))
    expect(result.status).toBe(404)
  })

  it('should be idempotent by the fact: a second call returns the same date', async () => {
    const planned = client({
      assignment: assignmentRow({ work_started_at: '2026-09-12T08:40:00.000Z', work_started_from: 'portal' }),
      intervention: interventionRow({ statut: { code: 'INTER_EN_COURS' } }),
    })
    const result = await call(planned, { envelope: { event_uid: 'evt-2', occurred_at_declared: null } })
    expect(result.status).toBe(200)
    if (result.status !== 200) throw new Error('unreachable')
    expect(result.body.work).toEqual({ started_at: '2026-09-12T08:40:00.000Z', from: 'portal' })
    expect(planned.calls.some((c) => c.table === 'intervention_artisans' && c.op === 'update')).toBe(false)
    expect(h.update).not.toHaveBeenCalled()
  })

  it('should replay a known event_uid without writing anything', async () => {
    const planned = client({
      journal: { id: 'log-1', action_type: 'WORK_STARTED', payload: {}, occurred_at: 'x', recorded_at: 'x' },
      assignment: assignmentRow({ work_started_at: '2026-09-12T08:40:00.000Z', work_started_from: 'portal' }),
    })
    const result = await call(planned)
    expect(result.status).toBe(200)
    expect(result.body).toMatchObject({ replayed: true })
    expect(planned.calls.some((c) => c.op === 'update')).toBe(false)
  })

  it('should recale a phone clock adrift instead of rejecting the fact', async () => {
    const planned = client({})
    const result = await call(planned, {
      envelope: { event_uid: 'evt-3', occurred_at_declared: '2019-01-01T00:00:00.000Z' },
    })
    expect(result.status).toBe(200)
    const journal = planned.calls.find((c) => c.table === 'artisan_portal_actions' && c.op === 'insert')
    const payload = (journal?.payload as { payload: Record<string, unknown> }).payload
    expect(payload.clock_skew).toBe(true)
    expect(payload.occurred_at_declared).toBe('2019-01-01T00:00:00.000Z')
  })
})
