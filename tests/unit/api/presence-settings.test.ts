import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ─── Mocks (hoisted) ────────────────────────────────────────────────────────
const h = vi.hoisted(() => ({
  getAuthenticatedUser: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
}))

vi.mock('@/lib/auth/permissions', () => ({
  getAuthenticatedUser: h.getAuthenticatedUser,
}))
vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: { from: h.from, rpc: h.rpc },
}))

import { GET, PATCH } from '../../../app/api/monitoring/presence-settings/route'

interface SbResult {
  data: unknown
  error: { message: string } | null
}

/** GET : from().select().eq().maybeSingle() */
function mockSelect(result: SbResult) {
  h.from.mockReturnValue({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle: vi.fn().mockResolvedValue(result),
      })),
    })),
  })
}

/** PATCH : from().upsert().select().single() */
function mockUpsert(result: SbResult) {
  h.from.mockReturnValue({
    upsert: vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn().mockResolvedValue(result),
      })),
    })),
  })
}

const adminUser = { id: 'admin-1', roles: ['admin'], permissions: new Set<string>() }
const plainUser = { id: 'user-2', roles: ['gestionnaire'], permissions: new Set<string>() }

function getRequest() {
  return new NextRequest('http://localhost/api/monitoring/presence-settings')
}
function patchRequest(body: unknown) {
  return new NextRequest('http://localhost/api/monitoring/presence-settings', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('GET /api/monitoring/presence-settings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    h.getAuthenticatedUser.mockResolvedValue(adminUser)
  })

  it('renvoie 401 si non authentifié', async () => {
    h.getAuthenticatedUser.mockResolvedValueOnce(null)
    const res = await GET(getRequest())
    expect(res.status).toBe(401)
  })

  it('renvoie les défauts quand la table est vide', async () => {
    mockSelect({ data: null, error: null })
    const res = await GET(getRequest())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ idleAfterMinutes: 5, offlineAfterMinutes: 60, updatedAt: null, updatedBy: null })
  })

  it('renvoie les valeurs stockées (normalisées)', async () => {
    mockSelect({
      data: { idle_after_minutes: 10, offline_after_minutes: 120, updated_at: '2026-06-25T10:00:00Z', updated_by: 'admin-1' },
      error: null,
    })
    const res = await GET(getRequest())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ idleAfterMinutes: 10, offlineAfterMinutes: 120, updatedAt: '2026-06-25T10:00:00Z', updatedBy: 'admin-1' })
  })
})

describe('PATCH /api/monitoring/presence-settings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    h.getAuthenticatedUser.mockResolvedValue(adminUser)
    h.rpc.mockResolvedValue({ data: null, error: null })
  })

  it('renvoie 403 sans rôle dev/admin', async () => {
    h.getAuthenticatedUser.mockResolvedValueOnce(plainUser)
    const res = await PATCH(patchRequest({ idleAfterMinutes: 5, offlineAfterMinutes: 60 }))
    expect(res.status).toBe(403)
  })

  it('renvoie 400 si offline <= idle', async () => {
    const res = await PATCH(patchRequest({ idleAfterMinutes: 60, offlineAfterMinutes: 60 }))
    expect(res.status).toBe(400)
  })

  it('renvoie 400 si les minutes ne sont pas des entiers', async () => {
    const res = await PATCH(patchRequest({ idleAfterMinutes: '5', offlineAfterMinutes: 60 }))
    expect(res.status).toBe(400)
  })

  it('upsert les réglages et relance check_inactive_users', async () => {
    mockUpsert({
      data: { idle_after_minutes: 8, offline_after_minutes: 45, updated_at: '2026-06-25T11:00:00Z', updated_by: 'admin-1' },
      error: null,
    })
    const res = await PATCH(patchRequest({ idleAfterMinutes: 8, offlineAfterMinutes: 45 }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ idleAfterMinutes: 8, offlineAfterMinutes: 45, updatedAt: '2026-06-25T11:00:00Z', updatedBy: 'admin-1' })
    expect(h.rpc).toHaveBeenCalledWith('check_inactive_users')
  })
})
