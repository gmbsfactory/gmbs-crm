import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const h = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  createServerSupabaseAdmin: vi.fn(),
}))

vi.mock('@/lib/auth/permissions', () => ({
  requirePermission: h.requirePermission,
  isPermissionError: (result: unknown) => typeof result === 'object' && result !== null && 'error' in result,
}))
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseAdmin: h.createServerSupabaseAdmin,
}))

import { GET } from '../../../../app/api/interventions/[id]/portal-report/route'
import { createPlannedClient } from '../../../__mocks__/portal-external-client'

const INTERVENTION_ID = 'd0000000-0000-4000-8000-000000010006'
const params = { params: Promise.resolve({ id: INTERVENTION_ID }) }
const request = new NextRequest(`http://localhost/api/interventions/${INTERVENTION_ID}/portal-report`)

const sofia = { id: 'art-sofia', nom: 'Martins', prenom: 'Sofia' }
const karim = { id: 'art-karim', nom: 'Benali', prenom: 'Karim' }

function reportRow(id: string, status: string, version: number, artisan: typeof sofia) {
  return {
    id,
    status,
    version,
    artisan_id: artisan.id,
    artisan,
    travaux_realises: 'Travaux',
    duree_minutes: 30,
    materiel_utilise: null,
    reste_a_faire: false,
    reste_a_faire_detail: null,
    anomalies: null,
    client_present: true,
    submitted_at: '2026-09-02T10:00:00.000Z',
    review_comment: null,
    reviewed_at: null,
    attachment_ids: [],
  }
}

function planFor(reports: unknown[], photos: unknown[] = []) {
  const client = createPlannedClient({
    interventions: [{ data: { id: INTERVENTION_ID }, error: null }],
    artisan_reports: [{ data: reports, error: null }],
    intervention_attachments: [{ data: photos, error: null }],
    intervention_artisans: [{ data: { artisan: sofia }, error: null }],
  })
  h.createServerSupabaseAdmin.mockReturnValue(client)
  return client
}

describe('GET /api/interventions/[id]/portal-report', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    h.requirePermission.mockResolvedValue({ user: { id: 'user-badr', roles: ['admin'], permissions: new Set(['read_interventions']) } })
  })

  it('renvoie 401 si non authentifié', async () => {
    h.requirePermission.mockResolvedValueOnce({ error: NextResponse.json({ error: 'Non authentifié' }, { status: 401 }) })
    const res = await GET(request, params)
    expect(res.status).toBe(401)
    expect(h.requirePermission).toHaveBeenCalledWith(expect.anything(), 'read_interventions')
  })

  it("renvoie 404 si l'intervention est introuvable", async () => {
    h.createServerSupabaseAdmin.mockReturnValue(createPlannedClient({ interventions: [{ data: null, error: null }] }))
    const res = await GET(request, params)
    expect(res.status).toBe(404)
  })

  it("sans rapport : report null et artisan principal de l'intervention", async () => {
    planFor([])
    const res = await GET(request, params)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ report: null, photos: [], artisan: sofia })
  })

  it('renvoie le dernier rapport (version la plus haute) et son artisan, sans artisan_id dans report', async () => {
    planFor([reportRow('rep-2', 'approved', 2, sofia), reportRow('rep-1', 'rejected', 1, sofia)], [{ id: 'ph-1' }])
    const res = await GET(request, params)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.report.id).toBe('rep-2')
    expect(body.report.status).toBe('approved')
    expect(body.report).not.toHaveProperty('artisan_id')
    expect(body.report).not.toHaveProperty('artisan')
    expect(body.artisan).toEqual(sofia)
    expect(body.photos).toEqual([{ id: 'ph-1' }])
  })

  it('deux artisans : le rapport en attente du second passe avant le rapport validé (plus récent) du premier', async () => {
    planFor([
      reportRow('rep-sofia-2', 'approved', 2, sofia),
      reportRow('rep-karim-1', 'submitted', 1, karim),
      reportRow('rep-sofia-1', 'rejected', 1, sofia),
    ])
    const res = await GET(request, params)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.report.id).toBe('rep-karim-1')
    expect(body.report.status).toBe('submitted')
    expect(body.artisan).toEqual(karim)
  })
})
