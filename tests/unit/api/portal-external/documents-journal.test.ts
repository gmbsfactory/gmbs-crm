import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const h = vi.hoisted(() => ({
  createServerSupabaseAdmin: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseAdmin: h.createServerSupabaseAdmin,
}))

import { POST } from '../../../../app/api/portal-external/me/documents/route'
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

/**
 * Lot L6 : « pièce déposée » doit apparaître dans la frise du modal artisan au
 * même titre que « prix accepté » — sans quoi le journal ne raconte qu'une
 * moitié du parcours.
 */
describe('POST /api/portal-external/me/documents — journal des actions', () => {
  const env = { ...process.env }

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.GMBS_PORTAL_KEY_ID = TEST_KEY_ID
    process.env.GMBS_PORTAL_SECRET = TEST_SECRET
  })

  afterEach(() => {
    process.env = { ...env }
  })

  function client() {
    const planned = createPlannedClient({
      artisan_portal_tokens: [{ data: validTokenRow(), error: null }],
      artisan_attachments: [{ data: { id: 'att-1', kind: 'kbis', url: 'http://storage.local/x.pdf' }, error: null }],
      artisan_portal_actions: [{ data: { id: 'log-1' }, error: null }],
    })
    h.createServerSupabaseAdmin.mockReturnValue(planned)
    return planned
  }

  it('should journal DOCUMENT_UPLOADED with the artisan as author', async () => {
    const planned = client()
    const response = await POST(
      post({ kind: 'kbis', filename: 'kbis.pdf', mimeType: 'application/pdf', base64Data: PDF_BASE64, event_uid: 'evt-1' }),
    )
    expect(response.status).toBe(201)

    const journal = planned.calls.find((c) => c.table === 'artisan_portal_actions' && c.op === 'insert')
    expect(journal?.payload).toMatchObject({
      artisan_id: 'art-1',
      action_type: 'DOCUMENT_UPLOADED',
      source: 'portal',
      attachment_id: 'att-1',
      event_uid: 'evt-1',
    })
    const contenu = (journal?.payload as { payload: Record<string, unknown> }).payload
    expect(contenu).toMatchObject({ kind: 'kbis', filename: 'kbis.pdf', mime_type: 'application/pdf' })
    expect(contenu.actor).toContain('Karim Benali')
  })

  it('should accept a deposit without an event_uid (no envelope on this route)', async () => {
    const planned = client()
    const response = await POST(
      post({ kind: 'iban', filename: 'iban.pdf', mimeType: 'application/pdf', base64Data: PDF_BASE64 }),
    )
    expect(response.status).toBe(201)
    const journal = planned.calls.find((c) => c.table === 'artisan_portal_actions' && c.op === 'insert')
    expect(journal?.payload).toMatchObject({ event_uid: null })
  })
})
