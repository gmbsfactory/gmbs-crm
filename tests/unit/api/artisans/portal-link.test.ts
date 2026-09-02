import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

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

import { POST } from '../../../../app/api/artisans/[id]/portal-link/route'
import { createPlannedClient } from '../../../__mocks__/portal-external-client'

const ARTISAN_ID = 'd0000000-0000-4000-8000-00000000a001'
const params = { params: Promise.resolve({ id: ARTISAN_ID }) }

function makeRequest() {
  return new NextRequest(`http://localhost/api/artisans/${ARTISAN_ID}/portal-link`, { method: 'POST' })
}

function clientWithArtisan(isActive = true) {
  const client = createPlannedClient({
    artisans: [{ data: { id: ARTISAN_ID, is_active: isActive }, error: null }],
    artisan_portal_tokens: [{ data: null, error: null }, { data: null, error: null }],
  })
  h.createServerSupabaseAdmin.mockReturnValue(client)
  return client
}

describe('POST /api/artisans/[id]/portal-link', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    h.requirePermission.mockResolvedValue({ user: { id: 'user-1' } })
    vi.unstubAllEnvs()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('renvoie 503 « Portal not configured » en production sans PORTAL_BASE_URL, sans toucher aux jetons', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('PORTAL_BASE_URL', '')
    const client = clientWithArtisan()
    const res = await POST(makeRequest(), params)
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ error: 'Portal not configured' })
    expect(client.from).not.toHaveBeenCalled()
  })

  it('construit le lien avec PORTAL_BASE_URL, désactive les anciens jetons et stocke seulement le hachage', async () => {
    vi.stubEnv('PORTAL_BASE_URL', 'https://portail.example.invalid/')
    const client = clientWithArtisan()
    const res = await POST(makeRequest(), params)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { url: string; expires_at: string }
    expect(body.url).toMatch(/^https:\/\/portail\.example\.invalid\/t\/[0-9a-f]{64}$/)

    const deactivate = client.calls.find((c) => c.table === 'artisan_portal_tokens' && c.op === 'update')
    expect(deactivate?.payload).toEqual({ is_active: false })
    const insert = client.calls.find((c) => c.table === 'artisan_portal_tokens' && c.op === 'insert')
    const payload = insert?.payload as Record<string, unknown>
    expect(payload.token_hash).toMatch(/^[0-9a-f]{64}$/)
    expect(payload).not.toHaveProperty('token')
    expect(body.url.endsWith(String(payload.token_hash))).toBe(false)
  })

  it('hors production, se replie sur http://localhost:3001 quand PORTAL_BASE_URL est absent', async () => {
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv('PORTAL_BASE_URL', '')
    clientWithArtisan()
    const res = await POST(makeRequest(), params)
    expect(res.status).toBe(200)
    expect(((await res.json()) as { url: string }).url).toMatch(/^http:\/\/localhost:3001\/t\//)
  })

  it('renvoie 404 pour un artisan inconnu et 409 pour un artisan désactivé', async () => {
    vi.stubEnv('PORTAL_BASE_URL', 'http://localhost:3001')
    h.createServerSupabaseAdmin.mockReturnValue(createPlannedClient({ artisans: [{ data: null, error: null }] }))
    expect((await POST(makeRequest(), params)).status).toBe(404)

    clientWithArtisan(false)
    expect((await POST(makeRequest(), params)).status).toBe(409)
  })

  it('renvoie la réponse de requirePermission quand la permission manque', async () => {
    const denied = new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 })
    h.requirePermission.mockResolvedValue({ error: denied })
    const res = await POST(makeRequest(), params)
    expect(res.status).toBe(403)
  })
})
