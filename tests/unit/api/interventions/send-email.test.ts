import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => ({
  createSSRServerClient: vi.fn(),
  sendEmailToArtisan: vi.fn(),
  decryptPassword: vi.fn(() => 'mot-de-passe'),
}))

vi.mock('@/lib/supabase/server-ssr', () => ({
  createSSRServerClient: h.createSSRServerClient,
}))
vi.mock('@/lib/utils/encryption', () => ({
  decryptPassword: h.decryptPassword,
}))
vi.mock('@/lib/services/email-service', () => ({
  sendEmailToArtisan: h.sendEmailToArtisan,
  validateGmailEmail: (email: string) => /@(gmail|googlemail)\.com$/i.test(email),
}))

import { POST } from '../../../../app/api/interventions/[id]/send-email/route'

const INTERVENTION_ID = 'i-0001'
const params = { params: Promise.resolve({ id: INTERVENTION_ID }) }

interface AttachmentRow {
  id: string
  kind: string
  url: string
  filename: string | null
  mime_type: string | null
  file_size: number | null
}

function attachmentRow(overrides: Partial<AttachmentRow> = {}): AttachmentRow {
  return {
    id: overrides.id ?? 'att-1',
    kind: overrides.kind ?? 'devis',
    url:
      overrides.url ??
      'http://127.0.0.1:54321/storage/v1/object/public/documents/intervention/i-0001/devis.pdf',
    filename: overrides.filename ?? 'devis.pdf',
    mime_type: overrides.mime_type ?? 'application/pdf',
    file_size: overrides.file_size ?? 2048,
  }
}

interface Recorded {
  table: string
  op: 'select' | 'insert' | 'update'
  payload?: unknown
  filters: Array<[string, ...unknown[]]>
}

function createSupabaseStub(options: { attachments?: AttachmentRow[]; downloadBytes?: Buffer } = {}) {
  const calls: Recorded[] = []
  const downloaded: string[] = []

  const results: Record<string, unknown> = {
    interventions: { id: INTERVENTION_ID, id_inter: 'GMBS-2026-0001' },
    auth_user_mapping: { public_user_id: 'user-1' },
    users: {
      id: 'user-1',
      email_smtp: 'gestionnaire@gmail.com',
      email_password_encrypted: 'chiffre',
    },
    email_logs: { id: 'log-1' },
  }

  const from = vi.fn((table: string) => {
    const call: Recorded = { table, op: 'select', filters: [] }
    calls.push(call)
    const chain: Record<string, unknown> = {}

    chain.select = vi.fn(() => chain)
    chain.insert = vi.fn((payload: unknown) => {
      call.op = 'insert'
      call.payload = payload
      return chain
    })
    chain.update = vi.fn((payload: unknown) => {
      call.op = 'update'
      call.payload = payload
      return chain
    })
    for (const method of ['eq', 'in', 'is'] as const) {
      chain[method] = vi.fn((...args: unknown[]) => {
        call.filters.push([method, ...args])
        return chain
      })
    }

    const listResult = () =>
      table === 'intervention_attachments'
        ? { data: options.attachments ?? [], error: null }
        : { data: results[table] ?? null, error: null }

    chain.single = vi.fn(() => Promise.resolve({ data: results[table] ?? null, error: null }))
    chain.maybeSingle = vi.fn(() => Promise.resolve({ data: results[table] ?? null, error: null }))
    chain.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(call.op === 'update' ? { data: null, error: null } : listResult()).then(resolve, reject)

    return chain
  })

  const storage = {
    from: vi.fn(() => ({
      download: vi.fn(async (path: string) => {
        downloaded.push(path)
        const buffer = options.downloadBytes ?? Buffer.from('contenu-pdf')
        return {
          data: {
            arrayBuffer: async () =>
              buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
          },
          error: null,
        }
      }),
    })),
  }

  return {
    client: {
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'auth-1', email: 'gestionnaire@gmail.com' } } })) },
      from,
      storage,
    },
    calls,
    downloaded,
  }
}

function makeRequest(body: unknown) {
  return new Request(`http://localhost/api/interventions/${INTERVENTION_ID}/send-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    type: 'devis',
    artisanId: 'art-1',
    artisanEmail: 'karim@example.invalid',
    subject: 'Demande de devis',
    htmlContent: '<p>Bonjour</p>',
    ...overrides,
  }
}

describe('POST /api/interventions/[id]/send-email', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    h.sendEmailToArtisan.mockResolvedValue({
      success: true,
      messageId: 'msg-1',
      accepted: ['karim@example.invalid'],
      rejected: [],
    })
  })

  it('should envoyer sans pièce jointe (non-régression)', async () => {
    const stub = createSupabaseStub()
    h.createSSRServerClient.mockResolvedValue(stub.client)

    const response = await POST(makeRequest(validBody()), params)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.data.attachmentIds).toEqual([])
    expect(h.sendEmailToArtisan).toHaveBeenCalledWith(expect.objectContaining({ attachments: [] }))
    expect(stub.downloaded).toEqual([])
    expect(stub.calls.some((call) => call.table === 'intervention_attachments')).toBe(false)
  })

  it('should lire les pièces dans le stockage : le corps ne contient plus de base64', async () => {
    const stub = createSupabaseStub({ attachments: [attachmentRow()] })
    h.createSSRServerClient.mockResolvedValue(stub.client)

    const request = makeRequest(validBody({ attachmentIds: ['att-1'] }))
    const rawBody = await request.clone().text()

    const response = await POST(request, params)
    expect(response.status).toBe(200)

    // Le corps ne transporte que des identifiants — aucun champ de contenu de fichier.
    expect(rawBody).not.toContain('content')
    expect(rawBody).toContain('att-1')

    expect(stub.downloaded).toEqual(['intervention/i-0001/devis.pdf'])
    expect(h.sendEmailToArtisan).toHaveBeenCalledWith(
      expect.objectContaining({
        attachments: [
          expect.objectContaining({ filename: 'devis.pdf', contentType: 'application/pdf' }),
        ],
      }),
    )
  })

  it('should envoyer un PDF de 8 Mo, refusé avant le lot L7 par le plafond de corps de requête', async () => {
    const big = Buffer.alloc(8 * 1024 * 1024, 1)
    const stub = createSupabaseStub({
      attachments: [attachmentRow({ file_size: big.length })],
      downloadBytes: big,
    })
    h.createSSRServerClient.mockResolvedValue(stub.client)

    const response = await POST(makeRequest(validBody({ attachmentIds: ['att-1'] })), params)

    expect(response.status).toBe(200)
    const sent = h.sendEmailToArtisan.mock.calls[0][0]
    expect(sent.attachments[0].content.length).toBe(8 * 1024 * 1024)
  })

  it('should journaliser les pièces envoyées et estampiller les lignes', async () => {
    const stub = createSupabaseStub({ attachments: [attachmentRow()] })
    h.createSSRServerClient.mockResolvedValue(stub.client)

    await POST(makeRequest(validBody({ attachmentIds: ['att-1'] })), params)

    const log = stub.calls.find((call) => call.table === 'email_logs' && call.op === 'insert')
    expect(log?.payload).toMatchObject({
      attachment_ids: ['att-1'],
      attachments_count: 2, // pièce + logo GMBS
    })

    const mark = stub.calls.find(
      (call) => call.table === 'intervention_attachments' && call.op === 'update',
    )
    expect(mark?.payload).toMatchObject({ sent_to_artisan_email_log_id: 'log-1' })
    expect(mark?.filters).toContainEqual(['is', 'sent_to_artisan_at', null])
  })

  it('should refuser 404 une pièce qui n\'appartient pas à l\'intervention, sans envoyer', async () => {
    const stub = createSupabaseStub({ attachments: [] })
    h.createSSRServerClient.mockResolvedValue(stub.client)

    const response = await POST(makeRequest(validBody({ attachmentIds: ['att-fantome'] })), params)

    expect(response.status).toBe(404)
    expect(h.sendEmailToArtisan).not.toHaveBeenCalled()
  })

  it('should refuser 400 une facture GMBS, sans envoyer', async () => {
    const stub = createSupabaseStub({ attachments: [attachmentRow({ kind: 'facturesGMBS' })] })
    h.createSSRServerClient.mockResolvedValue(stub.client)

    const response = await POST(makeRequest(validBody({ attachmentIds: ['att-1'] })), params)
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload.error).toContain('artisan')
    expect(h.sendEmailToArtisan).not.toHaveBeenCalled()
  })

  it('should ne pas estampiller quand l\'envoi échoue', async () => {
    h.sendEmailToArtisan.mockResolvedValue({ success: false, error: 'SMTP KO' })
    const stub = createSupabaseStub({ attachments: [attachmentRow()] })
    h.createSSRServerClient.mockResolvedValue(stub.client)

    const response = await POST(makeRequest(validBody({ attachmentIds: ['att-1'] })), params)

    expect(response.status).toBe(500)
    expect(
      stub.calls.some((call) => call.table === 'intervention_attachments' && call.op === 'update'),
    ).toBe(false)
  })

  it('should refuser 401 sans session', async () => {
    const stub = createSupabaseStub()
    stub.client.auth.getUser = vi.fn(async () => ({ data: { user: null } })) as never
    h.createSSRServerClient.mockResolvedValue(stub.client)

    const response = await POST(makeRequest(validBody()), params)
    expect(response.status).toBe(401)
  })
})
