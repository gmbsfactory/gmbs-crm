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

function reportRow(id: string, status: string, version: number, artisan: typeof sofia, overrides: Record<string, unknown> = {}) {
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
    started_at: null,
    superseded_at: null,
    superseded_by: null,
    ...overrides,
  }
}

function assignmentRow(artisan: typeof sofia, overrides: Record<string, unknown> = {}) {
  return {
    artisan_id: artisan.id,
    is_primary: artisan.id === sofia.id,
    role: null,
    price_response: null,
    price_responded_at: null,
    price_accepted_amount: null,
    price_refused_reason: null,
    price_response_source: null,
    work_started_at: null,
    work_started_from: null,
    payment_status: 'not_applicable',
    paid_at: null,
    artisan,
    ...overrides,
  }
}

function planFor(
  reports: unknown[],
  photos: unknown[] = [],
  assignments: unknown[] = [assignmentRow(sofia)],
  costs: unknown[] = [],
) {
  const client = createPlannedClient({
    interventions: [{ data: { id: INTERVENTION_ID }, error: null }],
    artisan_reports: [{ data: reports, error: null }],
    intervention_attachments: [{ data: photos, error: null }],
    intervention_artisans: [{ data: assignments, error: null }],
    intervention_costs: [{ data: costs, error: null }],
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
    const body = await res.json()
    expect(body.report).toBeNull()
    expect(body.photos).toEqual([])
    expect(body.artisan).toEqual(sofia)
    expect(body.reports).toEqual([])
    expect(body.photosByReport).toEqual({})
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

describe('GET /api/interventions/[id]/portal-report — élargissement L2', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    h.requirePermission.mockResolvedValue({ user: { id: 'user-badr', roles: ['admin'], permissions: new Set(['read_interventions']) } })
  })

  it('reports[] : rapport en attente en tête, puis date décroissante, artisan résolu', async () => {
    planFor([
      reportRow('rep-sofia-2', 'approved', 2, sofia, { submitted_at: '2026-09-03T10:00:00.000Z' }),
      reportRow('rep-karim-1', 'submitted', 1, karim, { submitted_at: '2026-09-01T10:00:00.000Z' }),
      reportRow('rep-sofia-1', 'superseded', 1, sofia, { submitted_at: '2026-09-02T10:00:00.000Z' }),
    ])
    const res = await GET(request, params)
    const body = await res.json()
    expect(body.reports.map((r: { id: string }) => r.id)).toEqual(['rep-karim-1', 'rep-sofia-2', 'rep-sofia-1'])
    expect(body.reports[0].artisan).toEqual(karim)
    expect(body.reports[0].artisan_id).toBe(karim.id)
    // Rétro-compat : `report` reste la sélection de pickPortalReport.
    expect(body.report.id).toBe('rep-karim-1')
  })

  it('photosByReport : une clé par version, les orphelines sous _hors_rapport', async () => {
    planFor(
      [
        reportRow('rep-2', 'submitted', 2, sofia, { attachment_ids: ['ph-3'] }),
        reportRow('rep-1', 'superseded', 1, sofia, { attachment_ids: ['ph-1', 'ph-2'] }),
      ],
      [{ id: 'ph-1' }, { id: 'ph-2' }, { id: 'ph-3' }, { id: 'ph-orphan' }],
    )
    const res = await GET(request, params)
    const body = await res.json()
    expect(body.photosByReport).toEqual({
      'rep-2': ['ph-3'],
      'rep-1': ['ph-1', 'ph-2'],
      _hors_rapport: ['ph-orphan'],
    })
    // `photos` reste la liste complète (rétro-compat).
    expect(body.photos).toHaveLength(4)
  })

  it("photosByReport ignore un attachment_id qui n'existe plus", async () => {
    planFor([reportRow('rep-1', 'submitted', 1, sofia, { attachment_ids: ['ph-1', 'ph-supprimee'] })], [{ id: 'ph-1' }])
    const res = await GET(request, params)
    const body = await res.json()
    expect(body.photosByReport).toEqual({ 'rep-1': ['ph-1'] })
  })

  it('assignments[] : prix, démarrage, paiement et rapports par artisan', async () => {
    planFor(
      [reportRow('rep-karim-1', 'submitted', 1, karim)],
      [],
      [
        assignmentRow(sofia, {
          price_response: 'accepted',
          price_responded_at: '2026-09-10T09:12:00.000Z',
          price_accepted_amount: 320,
          price_response_source: 'portal',
          work_started_at: '2026-09-12T06:40:00.000Z',
          work_started_from: 'portal',
          payment_status: 'awaiting_invoice',
        }),
        assignmentRow(karim, { is_primary: false, price_response: 'refused', price_refused_reason: 'trop loin' }),
      ],
      [
        { amount: '280.00', artisan_order: 1 },
        { amount: '150.00', artisan_order: 2 },
      ],
    )
    const res = await GET(request, params)
    const body = await res.json()
    expect(body.assignments).toHaveLength(2)

    const [premier, second] = body.assignments
    expect(premier.artisan).toEqual(sofia)
    expect(premier.cout_sst).toBe(280)
    expect(premier.price).toEqual({
      response: 'accepted',
      responded_at: '2026-09-10T09:12:00.000Z',
      accepted_amount: 320,
      source: 'portal',
      refused_reason: null,
      // 320 accepté ≠ 280 enregistré : dérive signalée au gestionnaire.
      drift: true,
    })
    expect(premier.work).toEqual({ started_at: '2026-09-12T06:40:00.000Z', from: 'portal' })
    expect(premier.payment).toEqual({ state: 'awaiting_invoice', paid_at: null })
    expect(premier.report_ids).toEqual([])

    expect(second.artisan).toEqual(karim)
    expect(second.cout_sst).toBe(150)
    expect(second.price.response).toBe('refused')
    expect(second.price.refused_reason).toBe('trop loin')
    expect(second.price.drift).toBe(false)
    expect(second.report_ids).toEqual(['rep-karim-1'])
  })

  it("cout_sst null quand aucun coût SST n'est posé (l'artisan ne voit pas la mission)", async () => {
    planFor([], [], [assignmentRow(sofia)], [])
    const res = await GET(request, params)
    const body = await res.json()
    expect(body.assignments[0].cout_sst).toBeNull()
    expect(body.assignments[0].price.response).toBeNull()
  })
})
