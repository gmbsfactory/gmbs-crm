import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ─── Mocks (hoisted pour être accessibles dans les factories vi.mock) ───────
const h = vi.hoisted(() => ({
  getAuthenticatedUser: vi.fn(),
  rpc: vi.fn(),
}))

vi.mock('@/lib/auth/permissions', () => ({
  getAuthenticatedUser: h.getAuthenticatedUser,
}))
vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: { rpc: h.rpc },
}))

import { POST } from '../../../app/api/auth/presence/route'

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/auth/presence', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/auth/presence', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    h.getAuthenticatedUser.mockResolvedValue({ id: 'user-1', roles: [], permissions: new Set<string>() })
    h.rpc.mockResolvedValue({ data: { ok: true }, error: null })
  })

  it('renvoie 401 si non authentifié', async () => {
    h.getAuthenticatedUser.mockResolvedValueOnce(null)
    const res = await POST(makeRequest({ state: 'active', event: 'PRESENCE_START' }))
    expect(res.status).toBe(401)
  })

  it('renvoie 400 si le state est invalide', async () => {
    const res = await POST(makeRequest({ state: 'nope', event: 'PRESENCE_START' }))
    expect(res.status).toBe(400)
  })

  it('renvoie 400 si l’événement est invalide', async () => {
    const res = await POST(makeRequest({ state: 'active', event: 'NOPE' }))
    expect(res.status).toBe(400)
  })

  it('accepte le nouveau kind PRESENCE_PING', async () => {
    const res = await POST(makeRequest({ state: 'active', event: 'PRESENCE_PING' }))
    expect(res.status).toBe(200)
    expect(h.rpc).toHaveBeenCalledWith(
      'record_user_presence_event',
      expect.objectContaining({ p_kind: 'PRESENCE_PING', p_state: 'active' }),
    )
  })

  it('force p_user_id depuis la session, jamais depuis le body', async () => {
    h.getAuthenticatedUser.mockResolvedValue({ id: 'real-user', roles: [], permissions: new Set<string>() })
    await POST(makeRequest({ state: 'offline', event: 'PRESENCE_END', userId: 'attacker', p_user_id: 'attacker' }))
    expect(h.rpc).toHaveBeenCalledWith(
      'record_user_presence_event',
      expect.objectContaining({ p_user_id: 'real-user' }),
    )
  })

  it('nettoie un sessionId non-uuid en null', async () => {
    await POST(makeRequest({ state: 'active', event: 'PRESENCE_START', sessionId: 'pas-un-uuid' }))
    expect(h.rpc).toHaveBeenCalledWith(
      'record_user_presence_event',
      expect.objectContaining({ p_session_id: null }),
    )
  })

  it('renvoie 500 si la RPC échoue', async () => {
    h.rpc.mockResolvedValueOnce({ data: null, error: { message: 'boom' } })
    const res = await POST(makeRequest({ state: 'active', event: 'PRESENCE_START' }))
    expect(res.status).toBe(500)
  })
})
