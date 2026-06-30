import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ─── Mocks hoistés ──────────────────────────────────────────────────────────
const h = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  isPermissionError: vi.fn(),
  createSSRServerClient: vi.fn(),
  update: vi.fn(),
  createComment: vi.fn(),
  getUserResult: { data: { user: { id: 'user-1' } }, error: null } as any,
  statusResult: { data: { id: 'archive-id' }, error: null } as any,
}))

vi.mock('@/lib/auth/permissions', () => ({
  requirePermission: h.requirePermission,
  isPermissionError: h.isPermissionError,
}))
vi.mock('@/lib/api', () => ({
  artisansApi: { update: h.update },
  commentsApi: { create: h.createComment },
}))
vi.mock('@/lib/supabase/server-ssr', () => ({
  createSSRServerClient: h.createSSRServerClient,
}))

import { POST } from '../../../app/api/artisans/[id]/archive/route'

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/artisans/artisan-1/archive', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const ctx = (id = 'artisan-1') => ({ params: Promise.resolve({ id }) })

let statusBuilder: any

beforeEach(() => {
  vi.clearAllMocks()
  h.getUserResult = { data: { user: { id: 'user-1' } }, error: null }
  h.statusResult = { data: { id: 'archive-id' }, error: null }
  h.requirePermission.mockResolvedValue({ ok: true })
  h.isPermissionError.mockReturnValue(false)
  h.update.mockResolvedValue({ id: 'artisan-1', statut_id: 'archive-id' })
  h.createComment.mockResolvedValue({ id: 'comment-1' })

  // Builder fluent : .from().select().eq().eq().single()
  statusBuilder = {
    select: vi.fn(() => statusBuilder),
    eq: vi.fn(() => statusBuilder),
    single: vi.fn(() => Promise.resolve(h.statusResult)),
  }
  h.createSSRServerClient.mockResolvedValue({
    auth: { getUser: vi.fn(() => Promise.resolve(h.getUserResult)) },
    from: vi.fn(() => statusBuilder),
  })
})

describe('POST /api/artisans/[id]/archive', () => {
  it('archive en passant au statut ARCHIVE SANS toucher is_active (comportement chemin B)', async () => {
    const res = await POST(makeRequest({ reason: 'Ne répond plus' }), ctx())

    expect(res.status).toBe(200)
    expect(h.update).toHaveBeenCalledTimes(1)
    const [id, payload] = h.update.mock.calls[0]
    expect(id).toBe('artisan-1')
    expect(payload).toEqual({ statut_id: 'archive-id' })
    // Régression : is_active ne doit PLUS être forcé à false (archive ≠ soft-delete)
    expect(payload).not.toHaveProperty('is_active')
  })

  it('résout le statut ARCHIVE actif via le client SSR authentifié (pas le client anon)', async () => {
    await POST(makeRequest({ reason: 'x' }), ctx())

    const supa = await h.createSSRServerClient.mock.results[0].value
    expect(supa.from).toHaveBeenCalledWith('artisan_statuses')
    expect(statusBuilder.eq).toHaveBeenCalledWith('code', 'ARCHIVE')
    expect(statusBuilder.eq).toHaveBeenCalledWith('is_active', true)
  })

  it('crée un commentaire système avec le motif trimmé', async () => {
    await POST(makeRequest({ reason: '  Motif important  ' }), ctx())

    expect(h.createComment).toHaveBeenCalledWith(
      expect.objectContaining({
        entity_id: 'artisan-1',
        entity_type: 'artisan',
        content: 'Motif important',
        comment_type: 'system',
        author_id: 'user-1',
      }),
    )
  })

  it('renvoie 400 si le motif est vide', async () => {
    const res = await POST(makeRequest({ reason: '   ' }), ctx())
    expect(res.status).toBe(400)
    expect(h.update).not.toHaveBeenCalled()
  })

  it('renvoie 401 si non authentifié', async () => {
    h.getUserResult = { data: { user: null }, error: null }
    const res = await POST(makeRequest({ reason: 'x' }), ctx())
    expect(res.status).toBe(401)
    expect(h.update).not.toHaveBeenCalled()
  })

  it('renvoie 500 "Statut d\'archivage introuvable" si le statut ARCHIVE est absent', async () => {
    h.statusResult = { data: null, error: { message: 'no rows' } }
    const res = await POST(makeRequest({ reason: 'x' }), ctx())

    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toMatch(/introuvable/i)
    expect(h.update).not.toHaveBeenCalled()
  })
})
