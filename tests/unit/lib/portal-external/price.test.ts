import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createPlannedClient, type PlannedClient } from '../../../__mocks__/portal-external-client'
import { respondToPrice, round2, validatePriceBody } from '@/lib/portal-external/price'

const ARTISAN = 'art-1'
const USER_BADR = '00000000-0000-4000-8000-000000000013'
const INTERVENTION = 'i-1'

function assignmentRow(over: Record<string, unknown> = {}) {
  return {
    id: 'ia-1',
    role: 'primary',
    is_primary: true,
    price_response: null,
    price_responded_at: null,
    price_accepted_amount: null,
    price_refused_reason: null,
    price_response_source: null,
    ...over,
  }
}

function interventionRow(code = 'DEVIS_ENVOYE') {
  return {
    id: INTERVENTION,
    id_inter: 'DEMO-001',
    adresse: '1 rue de Paris',
    assigned_user_id: USER_BADR,
    is_active: true,
    statut: { code },
  }
}

/**
 * Plan d'appels, dans l'ordre où `respondToPrice` les émet :
 * artisan_portal_actions (idempotence) → intervention_artisans (affectation)
 * → interventions → intervention_artisans (rang) → intervention_costs
 * → intervention_artisans (update) → artisan_portal_actions (journal).
 */
function client(options: {
  journal?: unknown
  assignment?: unknown
  intervention?: unknown
  cost?: unknown[]
  updated?: unknown
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
      { data: options.updated ?? assignment, error: null },
    ],
    interventions: [{ data: options.intervention ?? interventionRow(), error: null }],
    intervention_costs: [{ data: options.cost ?? [{ amount: '480.00', artisan_order: 1 }], error: null }],
    intervention_reminders: [{ data: null, error: null }],
    users: [{ data: { id: USER_BADR, username: 'badr' }, error: null }],
  })
}

const ENVELOPE = { event_uid: 'evt-1', occurred_at_declared: null }

function call(planned: PlannedClient, over: Record<string, unknown> = {}) {
  return respondToPrice({
    supabase: planned as unknown as SupabaseClient,
    artisanId: ARTISAN,
    interventionId: INTERVENTION,
    input: { response: 'accepted', amount_seen: 480, reason: null },
    source: 'portal',
    envelope: ENVELOPE,
    ...over,
  })
}

describe('validatePriceBody', () => {
  it('should refuse an unknown response', () => {
    expect(validatePriceBody({ response: 'maybe', amount_seen: 10 })).toEqual({
      ok: false,
      error: "response must be 'accepted' or 'refused'",
    })
  })

  it('should require amount_seen — the optimistic lock has no default', () => {
    expect(validatePriceBody({ response: 'accepted' })).toEqual({ ok: false, error: 'amount_seen required' })
  })

  it('should refuse a negative or unreadable amount', () => {
    expect(validatePriceBody({ response: 'accepted', amount_seen: -1 }).ok).toBe(false)
    expect(validatePriceBody({ response: 'accepted', amount_seen: 'beaucoup' }).ok).toBe(false)
  })

  it('should round the amount to two decimals, like NUMERIC(12,2)', () => {
    const parsed = validatePriceBody({ response: 'accepted', amount_seen: 480.004 })
    expect(parsed.ok && parsed.value.amount_seen).toBe(480)
    expect(round2(480.005)).toBe(480.01)
  })

  it('should keep a refusal reason, trimmed', () => {
    const parsed = validatePriceBody({ response: 'refused', amount_seen: 480, reason: '  trop loin  ' })
    expect(parsed.ok && parsed.value.reason).toBe('trop loin')
  })
})

describe('respondToPrice', () => {
  beforeEach(() => vi.clearAllMocks())

  it('should accept the price and freeze the amount', async () => {
    const planned = client({
      updated: assignmentRow({
        price_response: 'accepted',
        price_responded_at: '2026-09-10T09:12:00.000Z',
        price_accepted_amount: '480.00',
        price_response_source: 'portal',
      }),
    })
    const result = await call(planned)

    expect(result.status).toBe(200)
    expect(result.body).toMatchObject({
      price: { response: 'accepted', accepted_amount: 480, source: 'portal' },
    })
    const update = planned.calls.find((c) => c.table === 'intervention_artisans' && c.op === 'update')
    expect(update?.payload).toMatchObject({
      price_response: 'accepted',
      price_accepted_amount: 480,
      price_response_source: 'portal',
    })
  })

  it('should NEVER change the status of the intervention', async () => {
    const planned = client({})
    await call(planned)
    expect(planned.calls.some((c) => c.table === 'interventions' && c.op === 'update')).toBe(false)
  })

  it('should write the journal with the denormalised intervention', async () => {
    const planned = client({})
    await call(planned)
    const journal = planned.calls.find((c) => c.table === 'artisan_portal_actions' && c.op === 'insert')
    expect(journal?.payload).toMatchObject({
      artisan_id: ARTISAN,
      action_type: 'PRICE_ACCEPTED',
      source: 'portal',
      event_uid: 'evt-1',
    })
    expect((journal?.payload as { payload: Record<string, unknown> }).payload).toMatchObject({
      amount: 480,
      intervention: { id: INTERVENTION, id_inter: 'DEMO-001', adresse: '1 rue de Paris' },
    })
  })

  it('should answer 409 price_changed when the SST cost moved, with the real amount', async () => {
    const planned = client({ cost: [{ amount: '520.00', artisan_order: 1 }] })
    const result = await call(planned)
    expect(result.status).toBe(409)
    expect(result.body).toEqual({ error: 'price_changed', current_amount: 520 })
    expect(planned.calls.some((c) => c.table === 'intervention_artisans' && c.op === 'update')).toBe(false)
  })

  it('should answer 409 price_unavailable when no SST cost is set', async () => {
    const planned = client({ cost: [] })
    const result = await call(planned)
    expect(result.status).toBe(409)
    expect(result.body).toEqual({ error: 'price_unavailable' })
  })

  it('should answer 409 status_not_allowed outside DEVIS_ENVOYE', async () => {
    const planned = client({ intervention: interventionRow('ACCEPTE') })
    const result = await call(planned)
    expect(result.status).toBe(409)
    expect(result.body).toEqual({ error: 'status_not_allowed' })
  })

  it('should answer 404 when the artisan is not assigned — never a revealing 403', async () => {
    const planned = client({ assignment: null })
    const result = await call(planned)
    expect(result.status).toBe(404)
  })

  it('should refuse a second answer from the artisan (§7.3)', async () => {
    const planned = client({ assignment: assignmentRow({ price_response: 'accepted' }) })
    const result = await call(planned)
    expect(result.status).toBe(409)
    expect(result.body).toEqual({ error: 'price_already_answered' })
  })

  it('should let the manager rewrite an answer already given (Q5)', async () => {
    const planned = client({ assignment: assignmentRow({ price_response: 'refused' }) })
    const result = await call(planned, {
      source: 'crm',
      envelope: null,
      allowOverwrite: true,
      actor: { userId: 'u-9', label: 'badr@gmbs.fr' },
    })
    expect(result.status).toBe(200)
    const journal = planned.calls.find((c) => c.table === 'artisan_portal_actions' && c.op === 'insert')
    expect(journal?.payload).toMatchObject({ source: 'crm', actor_user_id: 'u-9' })
    expect((journal?.payload as { payload: Record<string, unknown> }).payload.actor).toBe('badr@gmbs.fr')
  })

  it('should replay the same event_uid as a 200, never a 409', async () => {
    const planned = client({
      journal: { id: 'log-1', action_type: 'PRICE_ACCEPTED', payload: {}, occurred_at: 'x', recorded_at: 'x' },
      assignment: assignmentRow({
        price_response: 'accepted',
        price_accepted_amount: '480.00',
        price_response_source: 'portal',
      }),
    })
    const result = await call(planned)
    expect(result.status).toBe(200)
    expect(result.body).toMatchObject({ replayed: true, price: { response: 'accepted', accepted_amount: 480 } })
    expect(planned.calls.some((c) => c.table === 'intervention_artisans' && c.op === 'update')).toBe(false)
  })

  it('should record the refusal reason and open a reminder for the manager', async () => {
    const planned = client({
      updated: assignmentRow({ price_response: 'refused', price_refused_reason: 'trop loin' }),
    })
    const result = await call(planned, {
      input: { response: 'refused', amount_seen: 480, reason: 'trop loin' },
    })
    expect(result.status).toBe(200)
    const update = planned.calls.find((c) => c.table === 'intervention_artisans' && c.op === 'update')
    expect(update?.payload).toMatchObject({
      price_response: 'refused',
      price_refused_reason: 'trop loin',
      price_accepted_amount: null,
    })
    const reminder = planned.calls.find((c) => c.table === 'intervention_reminders' && c.op === 'insert')
    expect(reminder?.payload).toBeDefined()
    expect(String((reminder?.payload as { note: string }).note)).toContain('trop loin')
  })
})
