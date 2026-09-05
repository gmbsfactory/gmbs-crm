import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const h = vi.hoisted(() => ({ createServerSupabaseAdmin: vi.fn() }))

vi.mock('@/lib/supabase/server', () => ({ createServerSupabaseAdmin: h.createServerSupabaseAdmin }))

import { GET } from '../../../../app/api/portal-external/me/stream/route'
import {
  createPlannedClient,
  portalHeaders,
  validTokenRow,
  TEST_KEY_ID,
  TEST_SECRET,
} from '../../../__mocks__/portal-external-client'

/**
 * Les écritures sur `intervention_artisans` (prix, démarrage, paiement)
 * remontent déjà dans l'application par le flux SSE. Ce test vérifie qu'elles
 * arrivent sous un NOM, et pas fondues dans un unique « assignment » : le
 * portail rejoue toutes ses requêtes montées à chaque événement reçu.
 */

type Rappel = (status: string) => void
type Handler = (payload: Record<string, unknown>) => void | Promise<void>

function clientAvecCanal() {
  const handlers: Record<string, Handler> = {}
  const client = createPlannedClient({
    artisan_portal_tokens: [{ data: validTokenRow(), error: null }],
    intervention_artisans: [{ data: [{ intervention_id: 'i-1' }], error: null }],
  }) as unknown as Record<string, unknown>
  const canal = {
    on: vi.fn((_type: string, config: { table: string }, handler: Handler) => {
      handlers[config.table] = handler
      return canal
    }),
    subscribe: vi.fn((cb: Rappel) => {
      cb('SUBSCRIBED')
      return canal
    }),
  }
  client.channel = vi.fn(() => canal)
  client.removeChannel = vi.fn()
  return { client, handlers }
}

async function evenementsApres(
  handlers: Record<string, Handler>,
  payload: Record<string, unknown>,
): Promise<string> {
  const controleur = new AbortController()
  const reponse = await GET(
    new NextRequest('http://localhost:3000/api/portal-external/me/stream', {
      headers: portalHeaders(),
      signal: controleur.signal,
    }),
  )
  const lecteur = reponse.body!.getReader()
  await lecteur.read() // « ready »
  await handlers.intervention_artisans(payload)
  const { value } = await lecteur.read()
  controleur.abort()
  await lecteur.cancel().catch(() => {})
  return new TextDecoder().decode(value)
}

describe('GET /me/stream — événements nommés de intervention_artisans', () => {
  let handlers: Record<string, Handler>

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.GMBS_PORTAL_KEY_ID = TEST_KEY_ID
    process.env.GMBS_PORTAL_SECRET = TEST_SECRET
    const monte = clientAvecCanal()
    handlers = monte.handlers
    h.createServerSupabaseAdmin.mockReturnValue(monte.client)
  })

  afterEach(() => {
    delete process.env.GMBS_PORTAL_KEY_ID
    delete process.env.GMBS_PORTAL_SECRET
  })

  it('should emit a "price" event when the artisan answers the price', async () => {
    const flux = await evenementsApres(handlers, {
      eventType: 'UPDATE',
      old: { intervention_id: 'i-1', price_response: null, price_accepted_amount: null },
      new: {
        intervention_id: 'i-1',
        price_response: 'accepted',
        price_responded_at: '2026-09-10T09:12:00.000Z',
        price_accepted_amount: 480,
      },
    })
    expect(flux).toContain('event: price')
    expect(flux).toContain('"response":"accepted"')
    expect(flux).toContain('"accepted_amount":480')
  })

  it('should emit a "work" event when the chantier starts', async () => {
    const flux = await evenementsApres(handlers, {
      eventType: 'UPDATE',
      old: { intervention_id: 'i-1', work_started_at: null },
      new: { intervention_id: 'i-1', work_started_at: '2026-09-12T08:40:00.000Z' },
    })
    expect(flux).toContain('event: work')
    expect(flux).toContain('"started_at":"2026-09-12T08:40:00.000Z"')
  })

  it('should emit a "payment" event when the manager records a payment', async () => {
    const flux = await evenementsApres(handlers, {
      eventType: 'UPDATE',
      old: { intervention_id: 'i-1', payment_status: 'in_progress', paid_at: null },
      new: { intervention_id: 'i-1', payment_status: 'paid', paid_at: '2026-09-20T10:00:00.000Z' },
    })
    expect(flux).toContain('event: payment')
    expect(flux).toContain('"state":"paid"')
  })

  it('should still emit "assignment" on an INSERT — the visible list changed', async () => {
    const flux = await evenementsApres(handlers, {
      eventType: 'INSERT',
      new: { intervention_id: 'i-2' },
    })
    expect(flux).toContain('event: assignment')
    expect(flux).toContain('"action":"added"')
  })

  it('should fall back to "assignment" when an uncovered column moved', async () => {
    const flux = await evenementsApres(handlers, {
      eventType: 'UPDATE',
      old: { intervention_id: 'i-1', role: 'primary' },
      new: { intervention_id: 'i-1', role: 'secondary' },
    })
    expect(flux).toContain('event: assignment')
    expect(flux).toContain('"action":"updated"')
  })
})
