import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const h = vi.hoisted(() => ({
  createServerSupabaseAdmin: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseAdmin: h.createServerSupabaseAdmin,
}))

import { PATCH, POST } from '../../../../app/api/portal-external/me/interventions/[id]/report/route'
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

const REP_PENDING = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'
const REP_OTHER = 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb'
const WORK_STARTED_AT = '2026-09-12T06:14:00.000Z'

/** Ligne de version telle que `loadReportVersions` la lit (triée version décroissante). */
function versionRow(id: string, status: string, version: number, extra: Record<string, unknown> = {}) {
  return { id, status, version, submitted_at: '2026-09-10T08:00:00.000Z', reviewed_at: null, ...extra }
}

function makePatchRequest(body: unknown, headers: Record<string, string> = portalHeaders()) {
  return new NextRequest(`http://localhost/api/portal-external/me/interventions/${INTERVENTION_ID}/report`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(body),
  })
}

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
        { data: [{ id: 'rep-1', status: 'rejected', version: 1, submitted_at: '2026-09-01T08:00:00.000Z', reviewed_at: '2026-09-01T18:00:00.000Z' }], error: null },
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

  it('course entre deux envois différents : 23505 sur la version → 409 « Report already submitted » (pas 500)', async () => {
    const client = useClient(createPlannedClient({
      artisan_portal_tokens: [{ data: validTokenRow(), error: null }],
      intervention_artisans: [{ data: { id: 'ia-1' }, error: null }],
      interventions: [{ data: intervention('INTER_EN_COURS'), error: null }],
      artisan_reports: [
        { data: null, error: null }, // 1. recherche par portal_report_id → rien
        { data: null, error: null }, // 2. version précédente → rien (l'autre envoi n'a pas encore commité)
        { data: null, error: { message: 'duplicate key value violates unique constraint "ux_artisan_reports_intervention_artisan_version"', code: '23505' } },
        { data: null, error: null }, // 4. relecture par portal_report_id → rien (autre identifiant)
        { data: [{ id: 'rep-1', status: 'submitted', version: 1 }], error: null }, // 5. dernier rapport du couple → soumis
      ],
      intervention_attachments: [{ data: [{ id: PHOTO_ID }], error: null }],
    }))
    const res = await POST(makeRequest(validBody), params)
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'report_pending' })
    expect(client.calls.some((c) => c.table === 'intervention_reminders')).toBe(false)
    expect(client.calls.some((c) => c.table === 'comments')).toBe(false)
  })

  it('renvoie 500 si l’insertion échoue pour une autre raison', async () => {
    useClient(createPlannedClient({
      artisan_portal_tokens: [{ data: validTokenRow(), error: null }],
      intervention_artisans: [{ data: { id: 'ia-1' }, error: null }],
      interventions: [{ data: intervention('INTER_EN_COURS'), error: null }],
      artisan_reports: [
        { data: null, error: null },
        { data: null, error: null },
        { data: null, error: { message: 'disk full', code: '53100' } },
      ],
      intervention_attachments: [{ data: [{ id: PHOTO_ID }], error: null }],
    }))
    const res = await POST(makeRequest(validBody), params)
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'Failed to save report' })
  })

  it('renvoie 409 si un rapport est déjà soumis pour cette intervention', async () => {
    const client = useClient(createPlannedClient({
      artisan_portal_tokens: [{ data: validTokenRow(), error: null }],
      intervention_artisans: [{ data: { id: 'ia-1' }, error: null }],
      interventions: [{ data: intervention('INTER_EN_COURS'), error: null }],
      artisan_reports: [
        { data: null, error: null },
        { data: [{ id: 'rep-1', status: 'submitted', version: 1 }], error: null },
      ],
    }))
    const res = await POST(makeRequest(validBody), params)
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'report_pending' })
    expect(client.calls.some((c) => c.table === 'artisan_reports' && c.op === 'insert')).toBe(false)
  })
})


describe('POST …/report — versions et remplacement (lot L3, §7.3)', () => {
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

  it('recopie work_started_at dans started_at : la durée réelle est figée à l’envoi', async () => {
    const client = useClient(createPlannedClient({
      artisan_portal_tokens: [{ data: validTokenRow(), error: null }],
      intervention_artisans: [{ data: { id: 'ia-1', work_started_at: WORK_STARTED_AT }, error: null }],
      interventions: [{ data: intervention('INTER_EN_COURS'), error: null }],
      artisan_reports: [{ data: null, error: null }, { data: [], error: null }, { data: insertedReport, error: null }],
      intervention_attachments: [{ data: [{ id: PHOTO_ID }], error: null }],
      users: [{ data: { id: USER_BADR, username: 'badr' }, error: null }],
      intervention_reminders: [{ data: null, error: null }, { data: null, error: null }],
    }))
    const res = await POST(makeRequest(validBody), params)
    expect(res.status).toBe(201)
    const insert = client.calls.find((c) => c.table === 'artisan_reports' && c.op === 'insert')
    expect(insert?.payload).toEqual(expect.objectContaining({ started_at: WORK_STARTED_AT, version: 1 }))
  })

  it('refuse une version sur un rapport validé quand rien n’a été rouvert (409 report_already_approved)', async () => {
    const client = useClient(createPlannedClient({
      artisan_portal_tokens: [{ data: validTokenRow(), error: null }],
      intervention_artisans: [{ data: { id: 'ia-1', work_started_at: null }, error: null }],
      interventions: [{ data: intervention('INTER_EN_COURS'), error: null }],
      artisan_reports: [
        { data: null, error: null },
        { data: [versionRow(REP_PENDING, 'approved', 1, { reviewed_at: '2026-09-11T09:00:00.000Z' })], error: null },
      ],
      // Aucun repassage par INTER_EN_COURS / SAV depuis la validation.
      intervention_status_transitions: [{ data: null, error: null }],
    }))
    const res = await POST(makeRequest(validBody), params)
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'report_already_approved' })
    expect(client.calls.some((c) => c.table === 'artisan_reports' && c.op === 'insert')).toBe(false)
  })

  it('ouvre une version après une validation SI l’intervention est repassée en cours', async () => {
    const client = useClient(createPlannedClient({
      artisan_portal_tokens: [{ data: validTokenRow(), error: null }],
      intervention_artisans: [{ data: { id: 'ia-1', work_started_at: null }, error: null }],
      interventions: [{ data: intervention('INTER_EN_COURS'), error: null }],
      artisan_reports: [
        { data: null, error: null },
        { data: [versionRow(REP_PENDING, 'approved', 1, { reviewed_at: '2026-09-11T09:00:00.000Z' })], error: null },
        { data: { ...insertedReport, version: 2 }, error: null },
      ],
      intervention_status_transitions: [{ data: { id: 'tr-1', transition_date: '2026-09-12T07:00:00.000Z' }, error: null }],
      intervention_attachments: [{ data: [{ id: PHOTO_ID }], error: null }],
      users: [{ data: { id: USER_BADR, username: 'badr' }, error: null }],
      intervention_reminders: [{ data: null, error: null }, { data: null, error: null }],
    }))
    const res = await POST(makeRequest(validBody), params)
    expect(res.status).toBe(201)
    const insert = client.calls.find((c) => c.table === 'artisan_reports' && c.op === 'insert')
    expect(insert?.payload).toEqual(expect.objectContaining({ version: 2 }))
    // La réouverture se lit dans le journal des transitions, jamais sur updated_at.
    const transitions = client.calls.find((c) => c.table === 'intervention_status_transitions')
    expect(transitions?.filters).toContainEqual(['in', 'to_status_code', ['INTER_EN_COURS', 'SAV']])
    expect(transitions?.filters).toContainEqual(['gt', 'transition_date', '2026-09-11T09:00:00.000Z'])
  })

  it('ouvre une version en SAV après une validation (§7.5)', async () => {
    const client = useClient(createPlannedClient({
      artisan_portal_tokens: [{ data: validTokenRow(), error: null }],
      intervention_artisans: [{ data: { id: 'ia-1', work_started_at: null }, error: null }],
      interventions: [{ data: intervention('SAV'), error: null }],
      artisan_reports: [
        { data: null, error: null },
        { data: [versionRow(REP_PENDING, 'approved', 2, { reviewed_at: '2026-09-11T09:00:00.000Z' })], error: null },
        { data: { ...insertedReport, version: 3 }, error: null },
      ],
      intervention_status_transitions: [{ data: { id: 'tr-sav' }, error: null }],
      intervention_attachments: [{ data: [{ id: PHOTO_ID }], error: null }],
      users: [{ data: { id: USER_BADR, username: 'badr' }, error: null }],
      intervention_reminders: [{ data: null, error: null }, { data: null, error: null }],
    }))
    const res = await POST(makeRequest(validBody), params)
    expect(res.status).toBe(201)
    const insert = client.calls.find((c) => c.table === 'artisan_reports' && c.op === 'insert')
    expect(insert?.payload).toEqual(expect.objectContaining({ version: 3 }))
  })

  it('remplace le rapport en attente : superseded AVANT l’insertion, puis chaînage superseded_by', async () => {
    const client = useClient(createPlannedClient({
      artisan_portal_tokens: [{ data: validTokenRow(), error: null }],
      intervention_artisans: [{ data: { id: 'ia-1', work_started_at: WORK_STARTED_AT }, error: null }],
      interventions: [{ data: intervention('INTER_EN_COURS'), error: null }],
      artisan_reports: [
        { data: null, error: null },                                        // 1. portal_report_id
        { data: [versionRow(REP_PENDING, 'submitted', 1)], error: null },   // 2. versions
        { data: { id: REP_PENDING }, error: null },                         // 3. supersession
        { data: { ...insertedReport, id: 'rep-2', version: 2 }, error: null }, // 4. insertion
        { data: null, error: null },                                        // 5. chaînage
      ],
      intervention_attachments: [{ data: [{ id: PHOTO_ID }], error: null }],
      users: [{ data: { id: USER_BADR, username: 'badr' }, error: null }],
      intervention_reminders: [{ data: null, error: null }, { data: null, error: null }],
      comments: [{ data: null, error: null }],
    }))

    const res = await POST(makeRequest({ ...validBody, replaces: REP_PENDING }), params)
    expect(res.status).toBe(201)

    const writes = client.calls.filter((c) => c.table === 'artisan_reports' && (c.op === 'update' || c.op === 'insert'))
    // L’ordre est imposé par l’index partiel ux_artisan_reports_one_open : sinon 23505.
    expect(writes.map((c) => c.op)).toEqual(['update', 'insert', 'update'])
    expect(writes[0].payload).toEqual(expect.objectContaining({ status: 'superseded' }))
    expect(writes[0].filters).toContainEqual(['eq', 'id', REP_PENDING])
    expect(writes[0].filters).toContainEqual(['eq', 'status', 'submitted'])
    expect(writes[1].payload).toEqual(expect.objectContaining({ version: 2, status: 'submitted' }))
    expect(writes[2].payload).toEqual({ superseded_by: 'rep-2' })
    expect(writes[2].filters).toContainEqual(['eq', 'id', REP_PENDING])

    const comment = client.calls.find((c) => c.table === 'comments' && c.op === 'insert')
    expect((comment?.payload as { content: string }).content).toContain('remplace la version précédente')
  })

  it('annule la supersession si l’insertion échoue : le rapport en attente ne disparaît pas', async () => {
    const client = useClient(createPlannedClient({
      artisan_portal_tokens: [{ data: validTokenRow(), error: null }],
      intervention_artisans: [{ data: { id: 'ia-1', work_started_at: null }, error: null }],
      interventions: [{ data: intervention('INTER_EN_COURS'), error: null }],
      artisan_reports: [
        { data: null, error: null },
        { data: [versionRow(REP_PENDING, 'submitted', 1)], error: null },
        { data: { id: REP_PENDING }, error: null },
        { data: null, error: { message: 'disk full', code: '53100' } },
        { data: null, error: null }, // compensation
      ],
      intervention_attachments: [{ data: [{ id: PHOTO_ID }], error: null }],
    }))

    const res = await POST(makeRequest({ ...validBody, replaces: REP_PENDING }), params)
    expect(res.status).toBe(500)
    const updates = client.calls.filter((c) => c.table === 'artisan_reports' && c.op === 'update')
    expect(updates).toHaveLength(2)
    expect(updates[1].payload).toEqual({ status: 'submitted', superseded_at: null })
    expect(updates[1].filters).toContainEqual(['eq', 'status', 'superseded'])
  })

  it('refuse un replaces qui ne désigne pas le rapport en attente (409 report_not_replaceable)', async () => {
    const client = useClient(createPlannedClient({
      artisan_portal_tokens: [{ data: validTokenRow(), error: null }],
      intervention_artisans: [{ data: { id: 'ia-1', work_started_at: null }, error: null }],
      interventions: [{ data: intervention('INTER_EN_COURS'), error: null }],
      artisan_reports: [
        { data: null, error: null },
        { data: [versionRow(REP_PENDING, 'submitted', 2), versionRow(REP_OTHER, 'superseded', 1)], error: null },
      ],
    }))
    const res = await POST(makeRequest({ ...validBody, replaces: REP_OTHER }), params)
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'report_not_replaceable' })
    expect(client.calls.some((c) => c.table === 'artisan_reports' && c.op === 'update')).toBe(false)
    expect(client.calls.some((c) => c.table === 'artisan_reports' && c.op === 'insert')).toBe(false)
  })

  it('refuse le remplacement si le gestionnaire a tranché entre l’affichage et l’envoi', async () => {
    const client = useClient(createPlannedClient({
      artisan_portal_tokens: [{ data: validTokenRow(), error: null }],
      intervention_artisans: [{ data: { id: 'ia-1', work_started_at: null }, error: null }],
      interventions: [{ data: intervention('INTER_EN_COURS'), error: null }],
      artisan_reports: [
        { data: null, error: null },
        { data: [versionRow(REP_PENDING, 'submitted', 1)], error: null },
        { data: null, error: null }, // l’UPDATE conditionnel ne touche plus rien
      ],
      intervention_attachments: [{ data: [{ id: PHOTO_ID }], error: null }],
    }))
    const res = await POST(makeRequest({ ...validBody, replaces: REP_PENDING }), params)
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'report_not_replaceable' })
    expect(client.calls.some((c) => c.table === 'artisan_reports' && c.op === 'insert')).toBe(false)
  })

  it('deux artisans : les versions sont lues par couple (intervention, artisan)', async () => {
    const client = useClient(createPlannedClient({
      artisan_portal_tokens: [{ data: validTokenRow(), error: null }],
      intervention_artisans: [{ data: { id: 'ia-2', work_started_at: null }, error: null }],
      interventions: [{ data: intervention('INTER_EN_COURS'), error: null }],
      // Le rapport en attente de l’AUTRE artisan n’apparaît pas dans cette lecture.
      artisan_reports: [{ data: null, error: null }, { data: [], error: null }, { data: insertedReport, error: null }],
      intervention_attachments: [{ data: [{ id: PHOTO_ID }], error: null }],
      users: [{ data: { id: USER_BADR, username: 'badr' }, error: null }],
      intervention_reminders: [{ data: null, error: null }, { data: null, error: null }],
    }))
    const res = await POST(makeRequest(validBody), params)
    expect(res.status).toBe(201)
    const versions = client.calls.filter((c) => c.table === 'artisan_reports')[1]
    expect(versions.filters).toContainEqual(['eq', 'intervention_id', INTERVENTION_ID])
    expect(versions.filters).toContainEqual(['eq', 'artisan_id', 'art-1'])
    const insert = client.calls.find((c) => c.table === 'artisan_reports' && c.op === 'insert')
    expect(insert?.payload).toEqual(expect.objectContaining({ version: 1, artisan_id: 'art-1' }))
  })

  it('journalise l’envoi et le remplacement dans artisan_portal_actions', async () => {
    const client = useClient(createPlannedClient({
      artisan_portal_tokens: [{ data: validTokenRow(), error: null }],
      intervention_artisans: [{ data: { id: 'ia-1', work_started_at: null }, error: null }],
      interventions: [{ data: intervention('INTER_EN_COURS'), error: null }],
      artisan_reports: [
        { data: null, error: null },
        { data: [versionRow(REP_PENDING, 'submitted', 1)], error: null },
        { data: { id: REP_PENDING }, error: null },
        { data: { ...insertedReport, id: 'rep-2', version: 2 }, error: null },
        { data: null, error: null },
      ],
      intervention_attachments: [{ data: [{ id: PHOTO_ID }], error: null }],
      artisan_portal_actions: [{ data: { id: 'act-1' }, error: null }],
      users: [{ data: { id: USER_BADR, username: 'badr' }, error: null }],
      intervention_reminders: [{ data: null, error: null }, { data: null, error: null }],
    }))
    const res = await POST(makeRequest({ ...validBody, replaces: REP_PENDING, event_uid: 'evt-42' }), params)
    expect(res.status).toBe(201)
    const action = client.calls.find((c) => c.table === 'artisan_portal_actions' && c.op === 'insert')
    expect(action?.payload).toEqual(expect.objectContaining({
      artisan_id: 'art-1',
      action_type: 'REPORT_REPLACED',
      source: 'portal',
      report_id: 'rep-2',
      event_uid: 'evt-42',
    }))
  })
})

describe('PATCH /api/portal-external/me/interventions/[id]/report', () => {
  const env = { ...process.env }

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.GMBS_PORTAL_KEY_ID = TEST_KEY_ID
    process.env.GMBS_PORTAL_SECRET = TEST_SECRET
  })

  afterEach(() => {
    process.env = { ...env }
  })

  it('corrige le rapport en attente EN PLACE, sans nouveau numéro de version', async () => {
    const client = useClient(createPlannedClient({
      artisan_portal_tokens: [{ data: validTokenRow(), error: null }],
      intervention_artisans: [{ data: { id: 'ia-1', work_started_at: null }, error: null }],
      interventions: [{ data: intervention('INTER_EN_COURS'), error: null }],
      artisan_reports: [
        { data: [versionRow(REP_PENDING, 'submitted', 1)], error: null },
        { data: { ...insertedReport, id: REP_PENDING, travaux_realises: 'Corrigé.' }, error: null },
      ],
      artisan_portal_actions: [{ data: { id: 'act-1' }, error: null }],
    }))

    const res = await PATCH(makePatchRequest({ travaux_realises: 'Corrigé.', event_uid: 'evt-7' }), params)
    expect(res.status).toBe(200)

    const update = client.calls.find((c) => c.table === 'artisan_reports' && c.op === 'update')
    expect(update?.payload).toEqual(expect.objectContaining({ travaux_realises: 'Corrigé.', content: 'Corrigé.' }))
    expect(update?.payload).not.toHaveProperty('version')
    expect(update?.payload).not.toHaveProperty('status')
    expect(update?.filters).toContainEqual(['eq', 'id', REP_PENDING])
    expect(update?.filters).toContainEqual(['eq', 'status', 'submitted'])
    expect(client.calls.some((c) => c.table === 'artisan_reports' && c.op === 'insert')).toBe(false)

    const action = client.calls.find((c) => c.table === 'artisan_portal_actions' && c.op === 'insert')
    expect((action?.payload as { payload: Record<string, unknown> }).payload).toEqual(
      expect.objectContaining({ mode: 'patch', fields: ['travaux_realises'] }),
    )
  })

  it('refuse de modifier un rapport validé (409 report_already_approved)', async () => {
    const client = useClient(createPlannedClient({
      artisan_portal_tokens: [{ data: validTokenRow(), error: null }],
      intervention_artisans: [{ data: { id: 'ia-1', work_started_at: null }, error: null }],
      interventions: [{ data: intervention('INTER_TERMINEE'), error: null }],
      artisan_reports: [{ data: [versionRow(REP_PENDING, 'approved', 1)], error: null }],
    }))
    const res = await PATCH(makePatchRequest({ travaux_realises: 'Tentative.' }), params)
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'report_already_approved' })
    expect(client.calls.some((c) => c.table === 'artisan_reports' && c.op === 'update')).toBe(false)
  })

  it('refuse de réécrire un rapport refusé : la correction passe par une nouvelle version', async () => {
    const client = useClient(createPlannedClient({
      artisan_portal_tokens: [{ data: validTokenRow(), error: null }],
      intervention_artisans: [{ data: { id: 'ia-1', work_started_at: null }, error: null }],
      interventions: [{ data: intervention('INTER_EN_COURS'), error: null }],
      artisan_reports: [{ data: [versionRow(REP_PENDING, 'rejected', 1)], error: null }],
    }))
    const res = await PATCH(makePatchRequest({ anomalies: 'Rien' }), params)
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'report_not_editable' })
    expect(client.calls.some((c) => c.table === 'artisan_reports' && c.op === 'update')).toBe(false)
  })

  it('renvoie 404 quand aucun rapport n’existe encore', async () => {
    useClient(createPlannedClient({
      artisan_portal_tokens: [{ data: validTokenRow(), error: null }],
      intervention_artisans: [{ data: { id: 'ia-1', work_started_at: null }, error: null }],
      interventions: [{ data: intervention('INTER_EN_COURS'), error: null }],
      artisan_reports: [{ data: [], error: null }],
    }))
    const res = await PATCH(makePatchRequest({ anomalies: 'Rien' }), params)
    expect(res.status).toBe(404)
  })

  it('renvoie 404 si l’artisan n’est pas affecté à l’intervention', async () => {
    const client = useClient(createPlannedClient({
      artisan_portal_tokens: [{ data: validTokenRow(), error: null }],
      intervention_artisans: [{ data: null, error: null }],
    }))
    const res = await PATCH(makePatchRequest({ anomalies: 'Rien' }), params)
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'Intervention not found' })
    expect(client.calls.some((c) => c.table === 'artisan_reports')).toBe(false)
  })

  it('renvoie 400 sur un patch vide', async () => {
    useClient(createPlannedClient({ artisan_portal_tokens: [{ data: validTokenRow(), error: null }] }))
    const res = await PATCH(makePatchRequest({}), params)
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'no field to update' })
  })

  it('renvoie 401 sans en-têtes machine à machine', async () => {
    useClient(createPlannedClient({}))
    const res = await PATCH(makePatchRequest({ anomalies: 'x' }, { 'Content-Type': 'application/json' }), params)
    expect(res.status).toBe(401)
  })
})
