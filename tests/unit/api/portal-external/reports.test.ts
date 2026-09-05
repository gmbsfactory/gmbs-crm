import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const h = vi.hoisted(() => ({
  createServerSupabaseAdmin: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseAdmin: h.createServerSupabaseAdmin,
}))

import { GET } from '../../../../app/api/portal-external/me/interventions/[id]/reports/route'
import {
  createPlannedClient,
  portalHeaders,
  validTokenRow,
  TEST_KEY_ID,
  TEST_SECRET,
  type PlannedClient,
} from '../../../__mocks__/portal-external-client'

/**
 * `GET /me/interventions/{id}/reports` — historique des versions (lot L3, §4.2, §6.5).
 *
 * Ce que la route doit garantir : l'artisan voit **ses** versions et seulement
 * les siennes, la version qui fait foi est désignée sans ambiguïté, et une
 * intervention à laquelle il n'est pas affecté répond `404` — jamais `403`.
 */

const INTERVENTION_ID = 'd0000000-0000-4000-8000-000000010003'
const params = { params: Promise.resolve({ id: INTERVENTION_ID }) }

function makeRequest(headers: Record<string, string> = portalHeaders()) {
  return new NextRequest(`http://localhost/api/portal-external/me/interventions/${INTERVENTION_ID}/reports`, {
    method: 'GET',
    headers,
  })
}

function useClient(client: PlannedClient) {
  h.createServerSupabaseAdmin.mockReturnValue(client)
  return client
}

const v1 = {
  id: 'rep-1',
  status: 'superseded',
  version: 1,
  submitted_at: '2026-09-10T08:00:00.000Z',
  started_at: '2026-09-10T06:14:00.000Z',
  reviewed_at: null,
  review_comment: null,
  superseded_at: '2026-09-11T07:30:00.000Z',
  attachment_ids: ['ph-1', 'ph-2'],
}
const v2 = {
  id: 'rep-2',
  status: 'rejected',
  version: 2,
  submitted_at: '2026-09-11T07:30:00.000Z',
  started_at: '2026-09-10T06:14:00.000Z',
  reviewed_at: '2026-09-11T18:00:00.000Z',
  review_comment: 'Il manque la photo du compteur après intervention.',
  superseded_at: null,
  attachment_ids: ['ph-3'],
}
const v3 = {
  id: 'rep-3',
  status: 'submitted',
  version: 3,
  submitted_at: '2026-09-12T08:40:00.000Z',
  started_at: '2026-09-10T06:14:00.000Z',
  reviewed_at: null,
  review_comment: null,
  superseded_at: null,
  attachment_ids: ['ph-3', 'ph-4'],
}

describe('GET /api/portal-external/me/interventions/[id]/reports', () => {
  const env = { ...process.env }

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.GMBS_PORTAL_KEY_ID = TEST_KEY_ID
    process.env.GMBS_PORTAL_SECRET = TEST_SECRET
  })

  afterEach(() => {
    process.env = { ...env }
  })

  it('renvoie 401 sans en-têtes machine à machine', async () => {
    useClient(createPlannedClient({}))
    const res = await GET(makeRequest({}), params)
    expect(res.status).toBe(401)
  })

  it('renvoie 404 si l’artisan n’est pas affecté (jamais 403 révélateur)', async () => {
    const client = useClient(createPlannedClient({
      artisan_portal_tokens: [{ data: validTokenRow(), error: null }],
      intervention_artisans: [{ data: null, error: null }],
    }))
    const res = await GET(makeRequest(), params)
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'Intervention not found' })
    expect(client.calls.some((c) => c.table === 'artisan_reports')).toBe(false)
  })

  it('renvoie les versions triées, avec le nombre de photos et la version courante', async () => {
    const client = useClient(createPlannedClient({
      artisan_portal_tokens: [{ data: validTokenRow(), error: null }],
      intervention_artisans: [{ data: { id: 'ia-1', work_started_at: null }, error: null }],
      artisan_reports: [{ data: [v3, v2, v1], error: null }],
    }))
    const res = await GET(makeRequest(), params)
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.current_report_id).toBe('rep-3')
    expect(body.reports.map((r: { version: number }) => r.version)).toEqual([3, 2, 1])
    expect(body.reports.map((r: { is_current: boolean }) => r.is_current)).toEqual([true, false, false])
    expect(body.reports[0]).toEqual({
      id: 'rep-3',
      version: 3,
      status: 'submitted',
      submitted_at: '2026-09-12T08:40:00.000Z',
      started_at: '2026-09-10T06:14:00.000Z',
      reviewed_at: null,
      review_comment: null,
      superseded_at: null,
      photos_count: 2,
      is_current: true,
    })
    // Le motif du refus est renvoyé EN ENTIER : sans lui l'artisan redépose la même chose.
    expect(body.reports[1].review_comment).toBe('Il manque la photo du compteur après intervention.')

    const lecture = client.calls.find((c) => c.table === 'artisan_reports')
    expect(lecture?.filters).toContainEqual(['eq', 'intervention_id', INTERVENTION_ID])
    expect(lecture?.filters).toContainEqual(['eq', 'artisan_id', 'art-1'])
    expect(lecture?.filters).toContainEqual(['order', 'version', { ascending: false }])
  })

  it('désigne la plus récente comme courante quand aucune n’est en attente', async () => {
    useClient(createPlannedClient({
      artisan_portal_tokens: [{ data: validTokenRow(), error: null }],
      intervention_artisans: [{ data: { id: 'ia-1', work_started_at: null }, error: null }],
      artisan_reports: [{ data: [{ ...v2, status: 'approved' }, v1], error: null }],
    }))
    const res = await GET(makeRequest(), params)
    const body = await res.json()
    expect(body.current_report_id).toBe('rep-2')
    expect(body.reports[0].is_current).toBe(true)
  })

  it('renvoie une liste vide quand l’artisan n’a encore rien envoyé', async () => {
    useClient(createPlannedClient({
      artisan_portal_tokens: [{ data: validTokenRow(), error: null }],
      intervention_artisans: [{ data: { id: 'ia-1', work_started_at: null }, error: null }],
      artisan_reports: [{ data: [], error: null }],
    }))
    const res = await GET(makeRequest(), params)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ reports: [], current_report_id: null })
  })
})
