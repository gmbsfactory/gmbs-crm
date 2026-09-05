import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const h = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  createServerSupabaseAdmin: vi.fn(),
  update: vi.fn(),
}))

vi.mock('@/lib/auth/permissions', () => ({
  requirePermission: h.requirePermission,
  isPermissionError: (r: unknown) => !!r && typeof r === 'object' && 'error' in (r as object),
}))
vi.mock('@/lib/supabase/server', () => ({ createServerSupabaseAdmin: h.createServerSupabaseAdmin }))
vi.mock('@/lib/api', () => ({ interventionsApi: { update: h.update } }))

import { PATCH as PATCH_PRICE } from '../../../../app/api/interventions/[id]/artisans/[artisanId]/price/route'
import { PATCH as PATCH_START } from '../../../../app/api/interventions/[id]/artisans/[artisanId]/start/route'
import { createPlannedClient, type PlannedClient } from '../../../__mocks__/portal-external-client'

const INTERVENTION = 'i-1'
const ARTISAN = 'art-1'
const USER = '00000000-0000-4000-8000-000000000013'
const params = { params: Promise.resolve({ id: INTERVENTION, artisanId: ARTISAN }) }

function request(path: string, body: unknown) {
  return new NextRequest(`http://localhost/api/interventions/${INTERVENTION}/artisans/${ARTISAN}/${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const assignment = {
  id: 'ia-1',
  role: 'primary',
  is_primary: true,
  price_response: null,
  price_responded_at: null,
  price_accepted_amount: null,
  price_refused_reason: null,
  price_response_source: null,
  work_started_at: null,
  work_started_from: null,
}

const intervention = {
  id: INTERVENTION,
  id_inter: 'DEMO-001',
  adresse: '1 rue de Paris',
  code_postal: '75001',
  ville: 'Paris',
  contexte_intervention: 'Fuite',
  consigne_intervention: 'Sonner',
  date_prevue: '2026-09-12',
  agence_id: 'ag-1',
  metier_id: 'me-1',
  assigned_user_id: USER,
  tenant_id: 't-1',
  owner_id: 'o-1',
  is_active: true,
  statut: { code: 'DEVIS_ENVOYE' },
}

function client(over: Record<string, unknown> = {}): PlannedClient {
  return createPlannedClient({
    users: [{ data: { email: 'badr@gmbs.fr', username: 'badr', firstname: 'Badr', lastname: 'B' }, error: null }],
    artisan_portal_actions: [
      { data: null, error: null },
      { data: { id: 'log-1' }, error: null },
    ],
    intervention_artisans: [
      { data: assignment, error: null },
      { data: assignment, error: null },
      { data: { ...assignment, price_response: 'accepted', price_accepted_amount: '480.00', price_response_source: 'crm' }, error: null },
    ],
    interventions: [{ data: intervention, error: null }],
    intervention_costs: [
      {
        data: [
          { cost_type: 'sst', amount: '480.00', artisan_order: 1 },
          { cost_type: 'intervention', amount: '900.00', artisan_order: null },
        ],
        error: null,
      },
    ],
    intervention_statuses: [{ data: { id: 'st-encours' }, error: null }],
    tenants: [{ data: { firstname: 'Jeanne', lastname: 'Durand', plain_nom_client: null, telephone: '0612345678' }, error: null }],
    owner: [{ data: { owner_firstname: 'Paul', owner_lastname: 'Martin', plain_nom_facturation: 'SCI Martin' }, error: null }],
    intervention_reminders: [{ data: null, error: null }],
    ...over,
  })
}

describe('Repli gestionnaire — prix et démarrage saisis au CRM', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    h.requirePermission.mockResolvedValue({ user: { id: USER, roles: ['admin'], permissions: new Set() } })
    h.update.mockResolvedValue({ id: INTERVENTION })
  })

  it('should record a price accepted over the phone with source crm and its author', async () => {
    const planned = client()
    h.createServerSupabaseAdmin.mockReturnValue(planned)

    const response = await PATCH_PRICE(request('price', { response: 'accepted', amount: 480 }), params)
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.price).toMatchObject({ response: 'accepted', accepted_amount: 480, source: 'crm' })

    const update = planned.calls.find((c) => c.table === 'intervention_artisans' && c.op === 'update')
    expect(update?.payload).toMatchObject({ price_response_source: 'crm', price_response_by: USER })

    const journal = planned.calls.find((c) => c.table === 'artisan_portal_actions' && c.op === 'insert')
    expect(journal?.payload).toMatchObject({ source: 'crm', actor_user_id: USER, event_uid: null })
    // L'identité immuable survit à la suppression du compte (FK ON DELETE SET NULL).
    expect((journal?.payload as { payload: Record<string, unknown> }).payload.actor).toBe('badr@gmbs.fr')
  })

  // Constat 7 de la recette : le repli était refusé en 409 sur toute intervention
  // déjà passée en ACCEPTE — c'est-à-dire sur la quasi-totalité du stock, et donc
  // sur toutes celles où le gestionnaire appelle réellement l'artisan.
  it('should accept a price answered by phone on an intervention already in ACCEPTE', async () => {
    const planned = client({
      interventions: [{ data: { ...intervention, statut: { code: 'ACCEPTE' } }, error: null }],
    })
    h.createServerSupabaseAdmin.mockReturnValue(planned)

    const response = await PATCH_PRICE(request('price', { response: 'accepted', amount: 480 }), params)
    expect(response.status).toBe(200)
    expect((await response.json()).price).toMatchObject({ response: 'accepted', source: 'crm' })
  })

  it('should still refuse a status where the price makes no sense', async () => {
    const planned = client({
      interventions: [{ data: { ...intervention, statut: { code: 'INTER_TERMINEE' } }, error: null }],
    })
    h.createServerSupabaseAdmin.mockReturnValue(planned)

    const response = await PATCH_PRICE(request('price', { response: 'accepted', amount: 480 }), params)
    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({ error: 'status_not_allowed' })
  })

  it('should refuse a permission-less caller', async () => {
    h.requirePermission.mockResolvedValue({ error: new Response(null, { status: 403 }) })
    const response = await PATCH_PRICE(request('price', { response: 'accepted', amount: 480 }), params)
    expect(response.status).toBe(403)
  })

  it('should validate the body before touching the database', async () => {
    const planned = client()
    h.createServerSupabaseAdmin.mockReturnValue(planned)
    const response = await PATCH_PRICE(request('price', { response: 'peut-etre', amount: 480 }), params)
    expect(response.status).toBe(400)
    expect(planned.calls).toHaveLength(0)
  })

  it('should keep the optimistic lock for the manager too', async () => {
    const planned = client({
      intervention_costs: [{ data: [{ cost_type: 'sst', amount: '520.00', artisan_order: 1 }], error: null }],
    })
    h.createServerSupabaseAdmin.mockReturnValue(planned)
    const response = await PATCH_PRICE(request('price', { response: 'accepted', amount: 480 }), params)
    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({ error: 'price_changed', current_amount: 520 })
  })

  it('should record a work start declared over the phone with from crm', async () => {
    const planned = client({
      intervention_artisans: [
        { data: { ...assignment, price_response: 'accepted' }, error: null },
        { data: { ...assignment, price_response: 'accepted' }, error: null },
        { data: { ...assignment, price_response: 'accepted' }, error: null },
      ],
      interventions: [{ data: { ...intervention, statut: { code: 'ACCEPTE' } }, error: null }],
    })
    h.createServerSupabaseAdmin.mockReturnValue(planned)

    const response = await PATCH_START(request('start', { started_at: '2026-09-04T08:40:00.000Z' }), params)
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.work).toEqual({ started_at: '2026-09-04T08:40:00.000Z', from: 'crm' })
    expect(body.status_advanced).toBe(true)

    const update = planned.calls.find((c) => c.table === 'intervention_artisans' && c.op === 'update')
    expect(update?.payload).toMatchObject({ work_started_from: 'crm', work_started_by: USER })
  })
})
