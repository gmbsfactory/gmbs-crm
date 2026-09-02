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

function planFor(status: 'approved' | 'rejected', comment: string | null) {
  const client = createPlannedClient({
    artisan_reports: [{ data: submitted, error: null }, { data: reviewedReport(status, comment), error: null }],
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
    h.createServerSupabaseAdmin.mockReturnValue(createPlannedClient({ artisan_reports: [{ data: null, error: null }] }))
    const res = await POST(makeRequest({ decision: 'approved' }), params)
    expect(res.status).toBe(404)
  })

  it('renvoie 409 si le rapport a déjà été traité', async () => {
    h.createServerSupabaseAdmin.mockReturnValue(createPlannedClient({ artisan_reports: [{ data: { ...submitted, status: 'approved' }, error: null }] }))
    const res = await POST(makeRequest({ decision: 'rejected' }), params)
    expect(res.status).toBe(409)
  })

  it('valide le rapport : statut approved, reviewed_by, reminder du rapport clos, commentaire système', async () => {
    const client = planFor('approved', 'Bon travail')
    const res = await POST(makeRequest({ decision: 'approved', comment: 'Bon travail' }), params)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ report: reviewedReport('approved', 'Bon travail') })

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
