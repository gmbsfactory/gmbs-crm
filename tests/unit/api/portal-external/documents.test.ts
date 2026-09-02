import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const h = vi.hoisted(() => ({
  createServerSupabaseAdmin: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseAdmin: h.createServerSupabaseAdmin,
}))

import { GET, POST } from '../../../../app/api/portal-external/me/documents/route'
import { MAX_BASE64_LENGTH } from '@/lib/portal-external/uploads'
import {
  createPlannedClient,
  portalHeaders,
  validTokenRow,
  TEST_KEY_ID,
  TEST_SECRET,
} from '../../../__mocks__/portal-external-client'

const PDF_BASE64 = Buffer.from('%PDF-1.4\n%%EOF').toString('base64')

function post(body: unknown) {
  return new NextRequest('http://localhost/api/portal-external/me/documents', {
    method: 'POST',
    headers: portalHeaders(),
    body: JSON.stringify(body),
  })
}

function plannedWithToken(extra: Record<string, { data: unknown; error: null }[]> = {}) {
  const client = createPlannedClient({
    artisan_portal_tokens: [{ data: validTokenRow(), error: null }],
    ...extra,
  })
  h.createServerSupabaseAdmin.mockReturnValue(client)
  return client
}

describe('/api/portal-external/me/documents', () => {
  const env = { ...process.env }

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.GMBS_PORTAL_KEY_ID = TEST_KEY_ID
    process.env.GMBS_PORTAL_SECRET = TEST_SECRET
  })

  afterEach(() => {
    process.env = { ...env }
  })

  describe('POST', () => {
    it('renvoie 401 sans jeton artisan', async () => {
      h.createServerSupabaseAdmin.mockReturnValue(createPlannedClient({ artisan_portal_tokens: [{ data: null, error: null }] }))
      const res = await POST(post({ kind: 'kbis', filename: 'k.pdf', mimeType: 'application/pdf', base64Data: PDF_BASE64 }))
      expect(res.status).toBe(401)
    })

    it('renvoie 400 pour un kind invalide', async () => {
      const client = plannedWithToken()
      const res = await POST(post({ kind: 'passeport', filename: 'k.pdf', mimeType: 'application/pdf', base64Data: PDF_BASE64 }))
      expect(res.status).toBe(400)
      expect(await res.json()).toEqual({ error: 'Invalid document kind' })
      expect(client.uploads).toHaveLength(0)
    })

    it('renvoie 413 si le base64 dépasse 4 Mo', async () => {
      const client = plannedWithToken()
      const res = await POST(post({ kind: 'kbis', filename: 'k.pdf', mimeType: 'application/pdf', base64Data: 'A'.repeat(MAX_BASE64_LENGTH + 4) }))
      expect(res.status).toBe(413)
      expect(await res.json()).toEqual({ error: 'Payload too large' })
      expect(client.uploads).toHaveLength(0)
    })

    it('renvoie 415 pour un type MIME refusé', async () => {
      const client = plannedWithToken()
      const res = await POST(post({ kind: 'kbis', filename: 'k.txt', mimeType: 'text/plain', base64Data: PDF_BASE64 }))
      expect(res.status).toBe(415)
      expect(client.uploads).toHaveLength(0)
    })

    it('renvoie 400 si base64Data est vide', async () => {
      plannedWithToken()
      const res = await POST(post({ kind: 'kbis', filename: 'k.pdf', mimeType: 'application/pdf', base64Data: '' }))
      expect(res.status).toBe(400)
    })

    it('dépose la pièce dans le bucket documents et crée la ligne (201, review_status pending)', async () => {
      const client = plannedWithToken({
        artisan_attachments: [{ data: { id: 'doc-1', kind: 'kbis', url: 'http://storage.local/documents/x' }, error: null }],
      })
      const res = await POST(post({ kind: 'kbis', filename: 'Extrait Kbis.pdf', mimeType: 'application/pdf', base64Data: PDF_BASE64 }))
      expect(res.status).toBe(201)
      expect(await res.json()).toEqual({ document: { id: 'doc-1', kind: 'kbis', url: 'http://storage.local/documents/x' } })

      expect(client.uploads).toHaveLength(1)
      expect(client.uploads[0].bucket).toBe('documents')
      expect(client.uploads[0].path).toMatch(/^artisans\/art-1\/kbis\/\d+-Extrait_Kbis\.pdf$/)
      expect(client.uploads[0].contentType).toBe('application/pdf')

      const insert = client.calls.find((c) => c.table === 'artisan_attachments' && c.op === 'insert')
      expect(insert?.payload).toEqual(expect.objectContaining({
        artisan_id: 'art-1',
        kind: 'kbis',
        mime_type: 'application/pdf',
        created_by: null,
        created_by_display: 'Karim Benali (artisan)',
        review_status: 'pending',
        metadata: { source: 'portal' },
      }))
    })
  })

  describe('GET', () => {
    it('renvoie les pièces et la plus récente par type', async () => {
      const docs = [
        { id: 'd2', kind: 'kbis', filename: 'kbis-2.pdf', url: 'u2', mime_type: 'application/pdf', file_size: 10, created_at: '2026-09-02', review_status: 'pending', metadata: null },
        { id: 'd1', kind: 'kbis', filename: 'kbis-1.pdf', url: 'u1', mime_type: 'application/pdf', file_size: 10, created_at: '2026-09-01', review_status: 'approved', metadata: {} },
      ]
      plannedWithToken({ artisan_attachments: [{ data: docs, error: null }] })
      const res = await GET(new NextRequest('http://localhost/api/portal-external/me/documents', { headers: portalHeaders() }))
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.requiredDocuments).toEqual(['kbis', 'assurance', 'cni_recto_verso', 'iban', 'decharge_partenariat'])
      expect(body.documents).toHaveLength(2)
      expect(body.documentsByKind.kbis.id).toBe('d2')
      expect(body.documentsByKind.iban).toBeNull()
      expect(body.documentsByKind.autre).toBeNull()
    })
  })
})
