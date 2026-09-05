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

import { POST } from '../../../../app/api/interventions/[id]/portal-report/review/route'
import { createPlannedClient } from '../../../__mocks__/portal-external-client'

const INTERVENTION_ID = 'd0000000-0000-4000-8000-000000010003'
const params = { params: Promise.resolve({ id: INTERVENTION_ID }) }

function makeRequest(body: unknown) {
  return new NextRequest(`http://localhost/api/interventions/${INTERVENTION_ID}/portal-report/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const submitted = { id: 'rep-1', status: 'submitted', version: 1 }

function reviewedReport(status: 'approved' | 'rejected', comment: string | null) {
  return {
    id: 'rep-1',
    status,
    version: 1,
    travaux_realises: 'Travaux',
    duree_minutes: 60,
    materiel_utilise: null,
    reste_a_faire: false,
    reste_a_faire_detail: null,
    anomalies: null,
    client_present: true,
    submitted_at: '2026-09-02T10:00:00.000Z',
    review_comment: comment,
    reviewed_at: '2026-09-02T11:00:00.000Z',
    attachment_ids: [],
  }
}

function planFor(status: 'approved' | 'rejected', comment: string | null, reports: unknown[] = [submitted]) {
  const client = createPlannedClient({
    artisan_reports: [{ data: reports, error: null }, { data: reviewedReport(status, comment), error: null }],
    intervention_reminders: [{ data: null, error: null }],
    users: [{ data: { firstname: 'Badr', lastname: 'Boujimal', username: 'badr' }, error: null }],
    comments: [{ data: null, error: null }],
  })
  h.createServerSupabaseAdmin.mockReturnValue(client)
  return client
}

describe('POST /api/interventions/[id]/portal-report/review', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    h.requirePermission.mockResolvedValue({ user: { id: 'user-badr', roles: ['admin'], permissions: new Set(['write_interventions']) } })
  })

  it('renvoie 401 si non authentifié', async () => {
    h.requirePermission.mockResolvedValueOnce({ error: NextResponse.json({ error: 'Non authentifié' }, { status: 401 }) })
    const res = await POST(makeRequest({ decision: 'approved' }), params)
    expect(res.status).toBe(401)
    expect(h.requirePermission).toHaveBeenCalledWith(expect.anything(), 'write_interventions')
  })

  it('renvoie 403 sans la permission write_interventions', async () => {
    h.requirePermission.mockResolvedValueOnce({ error: NextResponse.json({ error: 'Permission requise' }, { status: 403 }) })
    const res = await POST(makeRequest({ decision: 'approved' }), params)
    expect(res.status).toBe(403)
    expect(h.createServerSupabaseAdmin).not.toHaveBeenCalled()
  })

  it('renvoie 400 pour une décision inconnue', async () => {
    planFor('approved', null)
    const res = await POST(makeRequest({ decision: 'peut-être' }), params)
    expect(res.status).toBe(400)
  })

  it('renvoie 404 sans rapport portail', async () => {
    h.createServerSupabaseAdmin.mockReturnValue(createPlannedClient({ artisan_reports: [{ data: [], error: null }] }))
    const res = await POST(makeRequest({ decision: 'approved' }), params)
    expect(res.status).toBe(404)
  })

  it('renvoie 409 si le rapport a déjà été traité', async () => {
    h.createServerSupabaseAdmin.mockReturnValue(createPlannedClient({ artisan_reports: [{ data: [{ ...submitted, status: 'approved' }], error: null }] }))
    // Motif fourni : sans lui, la route répondrait 400 avant même de regarder le rapport.
    const res = await POST(makeRequest({ decision: 'rejected', comment: 'Déjà traité' }), params)
    expect(res.status).toBe(409)
  })

  it('deux artisans : traite le rapport en attente du second même si un rapport plus récent est déjà validé', async () => {
    // Sofia (principale) : v1 refusé puis v2 validé ; Karim (secondaire) : v1 soumis.
    const sofiaV2 = { id: 'rep-sofia-2', status: 'approved', version: 2 }
    const sofiaV1 = { id: 'rep-sofia-1', status: 'rejected', version: 1 }
    const karimV1 = { id: 'rep-karim-1', status: 'submitted', version: 1 }
    const client = planFor('approved', null, [sofiaV2, karimV1, sofiaV1])

    const res = await POST(makeRequest({ decision: 'approved' }), params)
    expect(res.status).toBe(200)

    const update = client.calls.find((c) => c.table === 'artisan_reports' && c.op === 'update')
    expect(update?.filters).toContainEqual(['eq', 'id', 'rep-karim-1'])
    // Plus aucun rapport en attente : le reminder est clos.
    expect(client.calls.some((c) => c.table === 'intervention_reminders' && c.op === 'update')).toBe(true)
  })

  it("deux artisans : ne clôt pas le reminder tant qu'un autre rapport reste en attente", async () => {
    const karimV1 = { id: 'rep-karim-1', status: 'submitted', version: 1 }
    const sofiaV1 = { id: 'rep-sofia-1', status: 'submitted', version: 1 }
    const client = planFor('approved', null, [karimV1, sofiaV1])

    const res = await POST(makeRequest({ decision: 'approved' }), params)
    expect(res.status).toBe(200)

    const update = client.calls.find((c) => c.table === 'artisan_reports' && c.op === 'update')
    expect(update?.filters).toContainEqual(['eq', 'id', 'rep-karim-1'])
    expect(client.calls.some((c) => c.table === 'intervention_reminders')).toBe(false)
    // Le commentaire système est bien ajouté malgré le reminder conservé.
    expect(client.calls.some((c) => c.table === 'comments' && c.op === 'insert')).toBe(true)
  })

  it('valide le rapport : statut approved, reviewed_by, reminder du rapport clos, commentaire système', async () => {
    const client = planFor('approved', 'Bon travail')
    const res = await POST(makeRequest({ decision: 'approved', comment: 'Bon travail' }), params)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      report: reviewedReport('approved', 'Bon travail'),
      intervention: { statut_code: null },
    })

    const update = client.calls.find((c) => c.table === 'artisan_reports' && c.op === 'update')
    expect(update?.payload).toEqual(expect.objectContaining({
      status: 'approved',
      reviewed_by: 'user-badr',
      reviewed_at: expect.any(String),
      review_comment: 'Bon travail',
    }))
    expect(update?.filters).toContainEqual(['eq', 'id', 'rep-1'])

    const reminder = client.calls.find((c) => c.table === 'intervention_reminders' && c.op === 'update')
    expect(reminder?.payload).toEqual(expect.objectContaining({ is_active: false, is_completed: true }))
    expect(reminder?.filters).toContainEqual(['eq', 'intervention_id', INTERVENTION_ID])
    expect(reminder?.filters).toContainEqual(['eq', 'is_active', true])
    expect(reminder?.filters).toContainEqual(['ilike', 'note', '@%📋 Rapport%'])

    const comment = client.calls.find((c) => c.table === 'comments' && c.op === 'insert')
    expect(comment?.payload).toEqual(expect.objectContaining({
      entity_type: 'intervention',
      entity_id: INTERVENTION_ID,
      comment_type: 'system',
      author_id: 'user-badr',
      content: 'Rapport validé par Badr Boujimal : Bon travail',
    }))

    // Le statut de l'intervention n'est jamais modifié par la revue.
    expect(client.calls.some((c) => c.table === 'interventions')).toBe(false)
  })

  it('refuse le rapport : statut rejected et commentaire « Rapport refusé par … »', async () => {
    const client = planFor('rejected', 'Photos manquantes')
    const res = await POST(makeRequest({ decision: 'rejected', comment: 'Photos manquantes' }), params)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.report.status).toBe('rejected')

    const update = client.calls.find((c) => c.table === 'artisan_reports' && c.op === 'update')
    expect(update?.payload).toEqual(expect.objectContaining({ status: 'rejected', review_comment: 'Photos manquantes' }))

    const comment = client.calls.find((c) => c.table === 'comments' && c.op === 'insert')
    expect((comment?.payload as { content: string }).content).toBe('Rapport refusé par Badr Boujimal : Photos manquantes')
  })
})

describe('POST /api/interventions/[id]/portal-report/review — L2 : rapport visé et réouverture', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    h.requirePermission.mockResolvedValue({ user: { id: 'user-badr', roles: ['admin'], permissions: new Set(['write_interventions']) } })
  })

  it('renvoie 400 si un refus arrive sans motif', async () => {
    planFor('rejected', null)
    const res = await POST(makeRequest({ decision: 'rejected' }), params)
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/motif est obligatoire/i)
  })

  it('report_id : vise le rapport demandé, pas la sélection par défaut', async () => {
    const client = planFor('approved', null, [
      { id: 'rep-karim', status: 'submitted', version: 1 },
      { id: 'rep-sofia', status: 'submitted', version: 3 },
    ])
    const res = await POST(makeRequest({ decision: 'approved', report_id: 'rep-sofia' }), params)
    expect(res.status).toBe(200)
    const update = client.calls.find((c) => c.table === 'artisan_reports' && c.op === 'update')
    expect(update?.filters).toContainEqual(['eq', 'id', 'rep-sofia'])
  })

  it("renvoie 409 si le report_id n'appartient pas à l'intervention", async () => {
    planFor('approved', null, [{ id: 'rep-1', status: 'submitted', version: 1 }])
    const res = await POST(makeRequest({ decision: 'approved', report_id: 'rep-etranger' }), params)
    expect(res.status).toBe(409)
    expect((await res.json()).error).toMatch(/n'appartient pas/i)
  })

  it('renvoie 409 si le rapport visé a déjà été traité', async () => {
    planFor('approved', null, [
      { id: 'rep-1', status: 'submitted', version: 2 },
      { id: 'rep-0', status: 'approved', version: 1 },
    ])
    const res = await POST(makeRequest({ decision: 'approved', report_id: 'rep-0' }), params)
    expect(res.status).toBe(409)
  })

  it('reopen_intervention : INTER_TERMINEE repasse en INTER_EN_COURS', async () => {
    const client = createPlannedClient({
      artisan_reports: [{ data: [submitted], error: null }, { data: reviewedReport('rejected', 'Photo illisible'), error: null }],
      intervention_reminders: [{ data: null, error: null }],
      interventions: [{ data: { statut_id: 'st-terminee', statut: { code: 'INTER_TERMINEE' } }, error: null }],
      intervention_statuses: [{ data: { id: 'st-en-cours' }, error: null }],
      users: [{ data: { firstname: 'Badr', lastname: 'Boujimal', username: 'badr' }, error: null }],
      comments: [{ data: null, error: null }],
    })
    h.createServerSupabaseAdmin.mockReturnValue(client)

    const res = await POST(
      makeRequest({ decision: 'rejected', comment: 'Photo illisible', reopen_intervention: true }),
      params,
    )
    expect(res.status).toBe(200)
    expect((await res.json()).intervention).toEqual({ statut_code: 'INTER_EN_COURS' })

    const update = client.calls.find((c) => c.table === 'interventions' && c.op === 'update')
    expect(update?.payload).toEqual({ statut_id: 'st-en-cours' })
  })

  it("reopen_intervention ne touche à rien si l'intervention n'est pas terminée", async () => {
    const client = createPlannedClient({
      artisan_reports: [{ data: [submitted], error: null }, { data: reviewedReport('rejected', 'Photo illisible'), error: null }],
      intervention_reminders: [{ data: null, error: null }],
      interventions: [{ data: { statut_id: 'st-en-cours', statut: { code: 'INTER_EN_COURS' } }, error: null }],
      users: [{ data: { firstname: 'Badr', lastname: 'Boujimal', username: 'badr' }, error: null }],
      comments: [{ data: null, error: null }],
    })
    h.createServerSupabaseAdmin.mockReturnValue(client)

    const res = await POST(
      makeRequest({ decision: 'rejected', comment: 'Photo illisible', reopen_intervention: true }),
      params,
    )
    expect(res.status).toBe(200)
    expect(client.calls.some((c) => c.table === 'interventions' && c.op === 'update')).toBe(false)
  })
})
