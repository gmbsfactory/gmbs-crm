import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const h = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  createServerSupabaseAdmin: vi.fn(),
}))

vi.mock('@/lib/auth/permissions', () => ({
  requirePermission: h.requirePermission,
  isPermissionError: (r: unknown) => !!r && typeof r === 'object' && 'error' in (r as object),
}))
vi.mock('@/lib/supabase/server', () => ({ createServerSupabaseAdmin: h.createServerSupabaseAdmin }))

import { PATCH } from '../../../../app/api/interventions/[id]/artisans/[artisanId]/payment/route'
import { parseArtisanPaymentBody } from '@/lib/interventions/artisan-payment'
import { createPlannedClient } from '../../../__mocks__/portal-external-client'

const INTERVENTION = 'i-1'
const ARTISAN = 'art-1'
const USER = '00000000-0000-4000-8000-000000000013'
const params = { params: Promise.resolve({ id: INTERVENTION, artisanId: ARTISAN }) }

function request(body: unknown) {
  return new NextRequest(
    `http://localhost/api/interventions/${INTERVENTION}/artisans/${ARTISAN}/payment`,
    { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
  )
}

function client(row: unknown) {
  return createPlannedClient({ intervention_artisans: [{ data: row, error: null }] })
}

describe('parseArtisanPaymentBody', () => {
  it('should refuse a value outside the CHECK', () => {
    const parsed = parseArtisanPaymentBody({ payment_status: 'rembourse' })
    expect(parsed).toMatchObject({ ok: false, status: 400 })
  })

  it('should accept the six known states', () => {
    for (const statut of ['not_applicable', 'awaiting_invoice', 'invoice_received', 'in_progress', 'disputed']) {
      expect(parseArtisanPaymentBody({ payment_status: statut }).ok).toBe(true)
    }
    expect(parseArtisanPaymentBody({ payment_status: 'paid', paid_at: '2026-09-20' }).ok).toBe(true)
  })

  it('should require paid_at for paid', () => {
    const parsed = parseArtisanPaymentBody({ payment_status: 'paid' })
    expect(parsed.ok).toBe(false)
    if (!parsed.ok) expect(parsed.error).toContain('paid_at')
  })

  it('should refuse an unreadable paid_at', () => {
    expect(parseArtisanPaymentBody({ payment_status: 'paid', paid_at: 'hier' }).ok).toBe(false)
  })

  it('should clear paid_at as soon as the state is not paid', () => {
    const parsed = parseArtisanPaymentBody({ payment_status: 'disputed', paid_at: '2026-09-20' })
    expect(parsed).toMatchObject({ ok: true, value: { payment_status: 'disputed', paid_at: null } })
  })
})

describe('PATCH /api/interventions/{id}/artisans/{artisanId}/payment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    h.requirePermission.mockResolvedValue({ user: { id: USER, roles: ['admin'], permissions: new Set() } })
  })

  it('should refuse a caller without write_interventions', async () => {
    h.requirePermission.mockResolvedValue({ error: new Response('nope', { status: 403 }) })
    const response = await PATCH(request({ payment_status: 'paid', paid_at: '2026-09-20' }), params)
    expect(response.status).toBe(403)
  })

  it('should reject a value outside the CHECK with a 400', async () => {
    h.createServerSupabaseAdmin.mockReturnValue(client(null))
    const response = await PATCH(request({ payment_status: 'rembourse' }), params)
    expect(response.status).toBe(400)
  })

  it('should record the payment and return the artisan label', async () => {
    const planned = client({
      payment_status: 'paid',
      paid_at: '2026-09-20T00:00:00.000Z',
      payment_updated_at: '2026-09-21T09:00:00.000Z',
    })
    h.createServerSupabaseAdmin.mockReturnValue(planned)

    const response = await PATCH(request({ payment_status: 'paid', paid_at: '2026-09-20T00:00:00.000Z' }), params)
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.payment).toMatchObject({ state: 'paid', tone: 'success' })
    expect(body.payment.label).toBe('Payé le 20/09')

    const update = planned.calls.find((c) => c.table === 'intervention_artisans' && c.op === 'update')
    expect(update?.payload).toMatchObject({
      payment_status: 'paid',
      paid_at: '2026-09-20T00:00:00.000Z',
      payment_updated_by: USER,
    })
    // Le paiement de l'artisan ne touche JAMAIS l'encaissement client.
    expect(planned.calls.some((c) => c.table === 'intervention_payments')).toBe(false)
  })

  it('should answer 404 when the artisan is not assigned to the intervention', async () => {
    h.createServerSupabaseAdmin.mockReturnValue(client(null))
    const response = await PATCH(request({ payment_status: 'in_progress' }), params)
    expect(response.status).toBe(404)
  })
})
