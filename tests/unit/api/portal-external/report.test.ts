import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const h = vi.hoisted(() => ({
  createServerSupabaseAdmin: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseAdmin: h.createServerSupabaseAdmin,
}))

import { POST } from '../../../../app/api/portal-external/me/interventions/[id]/report/route'
import {
  createPlannedClient,
  portalHeaders,
  validTokenRow,
  TEST_KEY_ID,
  TEST_SECRET,
  type PlannedClient,
} from '../../../__mocks__/portal-external-client'

const INTERVENTION_ID = 'd0000000-0000-4000-8000-000000010003'
const PORTAL_REPORT_ID = '11111111-2222-4333-8444-555555555555'
const USER_BADR = '00000000-0000-0000-0000-000000000013'
const PHOTO_ID = '99999999-aaaa-4bbb-8ccc-dddddddddddd'

const validBody = {
  portal_report_id: PORTAL_REPORT_ID,
  travaux_realises: 'Remplacement de la résistance du ballon.',
  duree_minutes: 90,
  materiel_utilise: 'Résistance 1500 W',
  reste_a_faire: false,
  client_present: true,
  attachment_ids: [PHOTO_ID],
}

const insertedReport = {
  id: 'rep-1',
  status: 'submitted',
  version: 1,
  travaux_realises: validBody.travaux_realises,
  duree_minutes: 90,
  materiel_utilise: 'Résistance 1500 W',
  reste_a_faire: false,
  reste_a_faire_detail: null,
  anomalies: null,
  client_present: true,
  submitted_at: '2026-09-02T10:00:00.000Z',
  review_comment: null,
  reviewed_at: null,
  attachment_ids: [PHOTO_ID],
}

function makeRequest(body: unknown, headers: Record<string, string> = portalHeaders()) {
  return new NextRequest(`http://localhost/api/portal-external/me/interventions/${INTERVENTION_ID}/report`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
}

const params = { params: Promise.resolve({ id: INTERVENTION_ID }) }

function intervention(statusCode: string, assignedUserId: string | null = USER_BADR) {
  return { id: INTERVENTION_ID, id_inter: 'DEMO-003', assigned_user_id: assignedUserId, is_active: true, statut: { code: statusCode } }
}

function useClient(client: PlannedClient) {
  h.createServerSupabaseAdmin.mockReturnValue(client)
  return client
}

describe('POST /api/portal-external/me/interventions/[id]/report', () => {
  const env = { ...process.env }

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.GMBS_PORTAL_KEY_ID = TEST_KEY_ID
    process.env.GMBS_PORTAL_SECRET = TEST_SECRET
    delete process.env.PORTAL_FALLBACK_USER_ID
  })

  afterEach(() => {
    process.env = { ...env }
  })

  it('renvoie 401 sans en-têtes machine à machine', async () => {
    useClient(createPlannedClient({}))
    const res = await POST(makeRequest(validBody, { 'Content-Type': 'application/json' }), params)
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'Invalid credentials' })
  })

  it('renvoie 401 « Token invalid » si le jeton est inconnu', async () => {
    useClient(createPlannedClient({ artisan_portal_tokens: [{ data: null, error: null }] }))
    const res = await POST(makeRequest(validBody), params)
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'Token invalid' })
  })

  it('renvoie 400 si le corps est invalide', async () => {
    useClient(createPlannedClient({ artisan_portal_tokens: [{ data: validTokenRow(), error: null }] }))
    const res = await POST(makeRequest({ ...validBody, travaux_realises: '' }), params)
    expect(res.status).toBe(400)
  })

  it('renvoie 404 si l’artisan n’est pas affecté à l’intervention', async () => {
    const client = useClient(createPlannedClient({
      artisan_portal_tokens: [{ data: validTokenRow(), error: null }],
      intervention_artisans: [{ data: null, error: null }],
    }))
    const res = await POST(makeRequest(validBody), params)
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'Intervention not found' })
    expect(client.calls.some((c) => c.table === 'artisan_reports' && c.op === 'insert')).toBe(false)
  })

  it('renvoie 409 si le statut de l’intervention ne permet pas de rapport', async () => {
    const client = useClient(createPlannedClient({
      artisan_portal_tokens: [{ data: validTokenRow(), error: null }],
      intervention_artisans: [{ data: { id: 'ia-1' }, error: null }],
      interventions: [{ data: intervention('INTER_TERMINEE'), error: null }],
      artisan_reports: [{ data: null, error: null }],
    }))
    const res = await POST(makeRequest(validBody), params)
    expect(res.status).toBe(409)
    expect(client.calls.some((c) => c.table === 'artisan_reports' && c.op === 'insert')).toBe(false)
  })

  it('crée le rapport (201), le reminder mentionnant le gestionnaire et le commentaire système', async () => {
    const client = useClient(createPlannedClient({
      artisan_portal_tokens: [{ data: validTokenRow(), error: null }],
      intervention_artisans: [{ data: { id: 'ia-1' }, error: null }],
      interventions: [{ data: intervention('INTER_EN_COURS'), error: null }],
      // 1. recherche par portal_report_id → rien ; 2. version précédente → rien ; 3. insertion
      artisan_reports: [{ data: null, error: null }, { data: null, error: null }, { data: insertedReport, error: null }],
      intervention_attachments: [{ data: [{ id: PHOTO_ID }], error: null }],
      users: [{ data: { id: USER_BADR, username: 'badr' }, error: null }],
      // reminder existant → aucun ; puis insertion
      intervention_reminders: [{ data: null, error: null }, { data: null, error: null }],
      comments: [{ data: null, error: null }],
    }))

    const res = await POST(makeRequest(validBody), params)
    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({ report: insertedReport })

    const insert = client.calls.find((c) => c.table === 'artisan_reports' && c.op === 'insert')
    expect(insert?.payload).toEqual(expect.objectContaining({
      intervention_id: INTERVENTION_ID,
      artisan_id: 'art-1',
      portal_report_id: PORTAL_REPORT_ID,
      status: 'submitted',
      version: 1,
      submitted_from: 'portal',
      attachment_ids: [PHOTO_ID],
    }))
    // has_portal_report n'est jamais écrit par la route (trigger SQL)
    expect(client.calls.some((c) => c.table === 'interventions' && c.op === 'update')).toBe(false)

    const reminder = client.calls.find((c) => c.table === 'intervention_reminders' && c.op === 'insert')
    expect(reminder?.payload).toEqual(expect.objectContaining({
      intervention_id: INTERVENTION_ID,
      user_id: USER_BADR,
      is_active: true,
      mentioned_user_ids: [USER_BADR],
    }))
    expect((reminder?.payload as { note: string }).note).toMatch(/^@badr 📋 Rapport de l'inter #DEMO-003 à vérifier/)
    expect((reminder?.payload as { note: string }).note).toContain('Karim Benali')
    expect((reminder?.payload as { note: string }).note).toContain('1 photo(s) jointe(s)')

    const comment = client.calls.find((c) => c.table === 'comments' && c.op === 'insert')
    expect(comment?.payload).toEqual(expect.objectContaining({
      entity_type: 'intervention',
      entity_id: INTERVENTION_ID,
      comment_type: 'system',
      is_internal: true,
    }))
    expect((comment?.payload as { content: string }).content).toContain("Rapport d'intervention reçu de Karim Benali")
  })

  it('utilise PORTAL_FALLBACK_USER_ID quand assigned_user_id est NULL', async () => {
    process.env.PORTAL_FALLBACK_USER_ID = '00000000-0000-0000-0000-000000000001'
    const client = useClient(createPlannedClient({
      artisan_portal_tokens: [{ data: validTokenRow(), error: null }],
      intervention_artisans: [{ data: { id: 'ia-1' }, error: null }],
      interventions: [{ data: intervention('ACCEPTE', null), error: null }],
      artisan_reports: [{ data: null, error: null }, { data: null, error: null }, { data: insertedReport, error: null }],
      intervention_attachments: [{ data: [{ id: PHOTO_ID }], error: null }],
      users: [{ data: { id: '00000000-0000-0000-0000-000000000001', username: 'admin' }, error: null }],
      intervention_reminders: [{ data: null, error: null }, { data: null, error: null }],
    }))
    const res = await POST(makeRequest(validBody), params)
    expect(res.status).toBe(201)
    const usersCall = client.calls.find((c) => c.table === 'users')
    expect(usersCall?.filters).toContainEqual(['eq', 'id', '00000000-0000-0000-0000-000000000001'])
    const reminder = client.calls.find((c) => c.table === 'intervention_reminders' && c.op === 'insert')
    expect((reminder?.payload as { note: string }).note).toMatch(/^@admin 📋 Rapport/)
  })

  it('est idempotent : même portal_report_id → 200 avec le même rapport, sans nouvelle insertion', async () => {
    const existing = { ...insertedReport, intervention_id: INTERVENTION_ID, artisan_id: 'art-1' }
    const client = useClient(createPlannedClient({
      artisan_portal_tokens: [{ data: validTokenRow(), error: null }],
      intervention_artisans: [{ data: { id: 'ia-1' }, error: null }],
      interventions: [{ data: intervention('INTER_EN_COURS'), error: null }],
      artisan_reports: [{ data: existing, error: null }],
    }))
    const res = await POST(makeRequest(validBody), params)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ report: insertedReport })
    expect(client.calls.some((c) => c.table === 'artisan_reports' && c.op === 'insert')).toBe(false)
    expect(client.calls.some((c) => c.table === 'intervention_reminders')).toBe(false)
    expect(client.calls.some((c) => c.table === 'comments')).toBe(false)
  })

  it('ouvre une version 2 quand le rapport précédent est rejeté', async () => {
    const client = useClient(createPlannedClient({
      artisan_portal_tokens: [{ data: validTokenRow(), error: null }],
      intervention_artisans: [{ data: { id: 'ia-1' }, error: null }],
      interventions: [{ data: intervention('INTER_EN_COURS'), error: null }],
      artisan_reports: [
        { data: null, error: null },
        { data: { status: 'rejected', version: 1 }, error: null },
        { data: { ...insertedReport, version: 2 }, error: null },
      ],
      intervention_attachments: [{ data: [{ id: PHOTO_ID }], error: null }],
      users: [{ data: { id: USER_BADR, username: 'badr' }, error: null }],
      intervention_reminders: [{ data: null, error: null }, { data: null, error: null }],
    }))
    const res = await POST(makeRequest(validBody), params)
    expect(res.status).toBe(201)
    const insert = client.calls.find((c) => c.table === 'artisan_reports' && c.op === 'insert')
    expect(insert?.payload).toEqual(expect.objectContaining({ version: 2 }))
  })

  it('renvoie 409 si un rapport est déjà soumis pour cette intervention', async () => {
    const client = useClient(createPlannedClient({
      artisan_portal_tokens: [{ data: validTokenRow(), error: null }],
      intervention_artisans: [{ data: { id: 'ia-1' }, error: null }],
      interventions: [{ data: intervention('INTER_EN_COURS'), error: null }],
      artisan_reports: [{ data: null, error: null }, { data: { status: 'submitted', version: 1 }, error: null }],
    }))
    const res = await POST(makeRequest(validBody), params)
    expect(res.status).toBe(409)
    expect(client.calls.some((c) => c.table === 'artisan_reports' && c.op === 'insert')).toBe(false)
  })
})
