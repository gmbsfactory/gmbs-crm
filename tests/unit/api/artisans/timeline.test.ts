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

import { GET } from '../../../../app/api/artisans/[id]/timeline/route'
import { createPlannedClient } from '../../../__mocks__/portal-external-client'

const ARTISAN = 'art-1'
const USER = '00000000-0000-4000-8000-000000000013'
const params = { params: Promise.resolve({ id: ARTISAN }) }

function get(query = '') {
  return new NextRequest(`http://localhost/api/artisans/${ARTISAN}/timeline${query}`)
}

const artisan = { id: ARTISAN, prenom: 'Karim', nom: 'Benali', raison_sociale: 'BENALI PLOMBERIE' }

const journal = [
  {
    id: 'log-prix',
    action_type: 'PRICE_ACCEPTED',
    source: 'portal',
    occurred_at: '2026-09-10T08:00:00.000Z',
    recorded_at: '2026-09-10T08:00:02.000Z',
    payload: { amount: 480 },
    report_id: null,
    attachment_id: null,
    intervention: { id: 'i-1', id_inter: 'GMBS-1' },
    actor: null,
  },
  {
    id: 'log-demarrage',
    action_type: 'WORK_STARTED',
    source: 'crm',
    occurred_at: '2026-09-12T06:14:00.000Z',
    recorded_at: '2026-09-12T06:14:01.000Z',
    payload: { actor: 'badr@gmbs.fr' },
    report_id: null,
    attachment_id: null,
    intervention: { id: 'i-1', id_inter: 'GMBS-1' },
    actor: null,
  },
]

function client(over: Record<string, unknown> = {}) {
  return createPlannedClient({
    artisans: [{ data: artisan, error: null }],
    artisan_portal_actions: [{ data: journal, error: null }],
    artisan_reports: [{ data: [], error: null }],
    ...over,
  })
}

describe('GET /api/artisans/{id}/timeline', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    h.requirePermission.mockResolvedValue({ user: { id: USER, roles: ['admin'], permissions: new Set() } })
  })

  it('should refuse a caller without read_artisans', async () => {
    h.requirePermission.mockResolvedValue({ error: new Response('nope', { status: 403 }) })
    expect((await GET(get(), params)).status).toBe(403)
  })

  it('should answer 404 for an unknown artisan', async () => {
    h.createServerSupabaseAdmin.mockReturnValue(client({ artisans: [{ data: null, error: null }] }))
    expect((await GET(get(), params)).status).toBe(404)
  })

  it('should return the events from the most recent, with actor and source', async () => {
    h.createServerSupabaseAdmin.mockReturnValue(client())
    const response = await GET(get(), params)
    expect(response.status).toBe(200)
    const body = await response.json()

    expect(body.events.map((e: { id: string }) => e.id)).toEqual(['log-demarrage', 'log-prix'])
    expect(body.events[0]).toMatchObject({ action_type: 'WORK_STARTED', source: 'crm', actor: 'badr@gmbs.fr' })
    // Une action du portail sans compte joint est attribuée à l'artisan.
    expect(body.events[1]).toMatchObject({ source: 'portal', actor: 'Karim Benali' })
    expect(body.events[1].intervention).toEqual({ id: 'i-1', id_inter: 'GMBS-1' })
  })

  it('should derive a report submission the journal does not carry', async () => {
    h.createServerSupabaseAdmin.mockReturnValue(
      client({
        artisan_reports: [
          {
            data: [
              {
                id: 'r-1',
                intervention_id: 'i-1',
                version: 2,
                status: 'submitted',
                submitted_at: '2026-09-11T18:00:00.000Z',
                intervention: { id: 'i-1', id_inter: 'GMBS-1' },
              },
            ],
            error: null,
          },
        ],
      }),
    )

    const body = await (await GET(get(), params)).json()
    expect(body.events.map((e: { action_type: string }) => e.action_type)).toEqual([
      'WORK_STARTED',
      'REPORT_SUBMITTED',
      'PRICE_ACCEPTED',
    ])
  })

  it('should cap the page size and expose a cursor', async () => {
    h.createServerSupabaseAdmin.mockReturnValue(client())
    const response = await GET(get('?limit=1'), params)
    const body = await response.json()
    expect(body.events).toHaveLength(1)
    expect(body.next_before).toBe('2026-09-12T06:14:00.000Z')
  })

  it('should apply the before cursor to both sources', async () => {
    const planned = client()
    h.createServerSupabaseAdmin.mockReturnValue(planned)
    await GET(get('?before=2026-09-11T00:00:00.000Z'), params)

    const journalCall = planned.calls.find((c) => c.table === 'artisan_portal_actions')
    const reportCall = planned.calls.find((c) => c.table === 'artisan_reports')
    expect(journalCall?.filters.some((f) => f[0] === 'lt' && f[1] === 'occurred_at')).toBe(true)
    expect(reportCall?.filters.some((f) => f[0] === 'lt' && f[1] === 'submitted_at')).toBe(true)
  })

  it('should still answer when the report fallback fails', async () => {
    h.createServerSupabaseAdmin.mockReturnValue(
      client({ artisan_reports: [{ data: null, error: { message: 'boom' } }] }),
    )
    const response = await GET(get(), params)
    expect(response.status).toBe(200)
    expect((await response.json()).events).toHaveLength(2)
  })
})
