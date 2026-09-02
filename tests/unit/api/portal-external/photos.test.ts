import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const h = vi.hoisted(() => ({
  createServerSupabaseAdmin: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseAdmin: h.createServerSupabaseAdmin,
}))

import { POST } from '../../../../app/api/portal-external/me/interventions/[id]/photos/route'
import { PNG_SIGNATURE } from '@/lib/portal-external/uploads'
import { createPlannedClient, portalHeaders, validTokenRow, TEST_KEY_ID, TEST_SECRET } from '../../../__mocks__/portal-external-client'

const INTERVENTION_ID = 'd0000000-0000-4000-8000-000000010003'
const params = { params: Promise.resolve({ id: INTERVENTION_ID }) }
const PDF_BASE64 = Buffer.from('%PDF-1.4\n%%EOF').toString('base64')
const PNG_BASE64 = Buffer.concat([PNG_SIGNATURE, Buffer.alloc(16)]).toString('base64')

function post(body: unknown) {
  return new NextRequest(`http://localhost/api/portal-external/me/interventions/${INTERVENTION_ID}/photos`, {
    method: 'POST',
    headers: portalHeaders(),
    body: JSON.stringify(body),
  })
}

describe('POST /api/portal-external/me/interventions/[id]/photos', () => {
  const env = { ...process.env }

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.GMBS_PORTAL_KEY_ID = TEST_KEY_ID
    process.env.GMBS_PORTAL_SECRET = TEST_SECRET
    h.createServerSupabaseAdmin.mockReturnValue(createPlannedClient({ artisan_portal_tokens: [{ data: validTokenRow(), error: null }] }))
  })

  afterEach(() => {
    process.env = { ...env }
  })

  it('renvoie 415 quand le MIME déclaré n’est pas dans la liste (SVG)', async () => {
    const res = await POST(post({ filename: 'a.svg', mimeType: 'image/svg+xml', base64Data: PNG_BASE64, phase: 'avant' }), params)
    expect(res.status).toBe(415)
    expect(await res.json()).toEqual({ error: 'Unsupported media type' })
  })

  it('renvoie 415 quand les octets ne correspondent pas au MIME déclaré (PDF déguisé en PNG)', async () => {
    const client = h.createServerSupabaseAdmin() as ReturnType<typeof createPlannedClient>
    const res = await POST(post({ filename: 'a.png', mimeType: 'image/png', base64Data: PDF_BASE64, phase: 'avant' }), params)
    expect(res.status).toBe(415)
    expect(await res.json()).toEqual({ error: 'File content does not match mimeType' })
    expect(client.uploads).toHaveLength(0)
  })

  it('renvoie 400 pour une phase invalide', async () => {
    const res = await POST(post({ filename: 'a.png', mimeType: 'image/png', base64Data: PNG_BASE64, phase: 'pendant' }), params)
    expect(res.status).toBe(400)
  })
})
