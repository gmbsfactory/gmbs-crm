import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const h = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  createServerSupabaseAdmin: vi.fn(),
}))

vi.mock('@/lib/auth/permissions', () => ({
  requirePermission: h.requirePermission,
  isPermissionError: (result: unknown) =>
    typeof result === 'object' && result !== null && 'error' in result,
}))
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseAdmin: h.createServerSupabaseAdmin,
}))

import { POST } from '../../../../app/api/artisans/[id]/dossier/validate/route'
import { createPlannedClient } from '../../../__mocks__/portal-external-client'

const ARTISAN_ID = 'a0000000-0000-4000-8000-000000000001'
const params = { params: Promise.resolve({ id: ARTISAN_ID }) }

function makeRequest() {
  return new NextRequest(`http://localhost/api/artisans/${ARTISAN_ID}/dossier/validate`, {
    method: 'POST',
  })
}

function planFor(statutDossier: string | null) {
  const client = createPlannedClient({
    artisans: [
      {
        data: statutDossier === null
          ? null
          : {
              id: ARTISAN_ID,
              statut_dossier: statutDossier,
              pieces_a_verifier: 0,
              dossier_validated_at: '2026-09-05T10:00:00.000Z',
            },
        error: null,
      },
      {
        data: {
          statut_dossier: statutDossier,
          pieces_a_verifier: 0,
          dossier_validated_at: '2026-09-05T10:00:00.000Z',
          dossier_validated_by: 'user-badr',
        },
        error: null,
      },
    ],
  })
  h.createServerSupabaseAdmin.mockReturnValue(client)
  return client
}

describe('POST /api/artisans/[id]/dossier/validate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    h.requirePermission.mockResolvedValue({
      user: { id: 'user-badr', roles: ['admin'], permissions: new Set(['write_artisans']) },
    })
  })

  it('should exiger la permission write_artisans', async () => {
    h.requirePermission.mockResolvedValueOnce({
      error: NextResponse.json({ error: 'Permission requise' }, { status: 403 }),
    })
    const res = await POST(makeRequest(), params)
    expect(res.status).toBe(403)
    expect(h.createServerSupabaseAdmin).not.toHaveBeenCalled()
  })

  it('should renvoyer 404 pour un artisan inconnu', async () => {
    planFor(null)
    const res = await POST(makeRequest(), params)
    expect(res.status).toBe(404)
  })

  it("should renvoyer 409 tant que le dossier n'est pas COMPLET, sans écrire", async () => {
    const client = planFor('À compléter')
    const res = await POST(makeRequest(), params)
    expect(res.status).toBe(409)
    expect(client.calls.some((c) => c.op === 'update')).toBe(false)
  })

  it('should poser dossier_validated_by, et RIEN d’autre', async () => {
    const client = planFor('COMPLET')
    const res = await POST(makeRequest(), params)
    expect(res.status).toBe(200)

    const update = client.calls.find((c) => c.table === 'artisans' && c.op === 'update')
    // `dossier_validated_at` est l'affaire du trigger trg_artisan_dossier_sync :
    // deux écrivains sur une table publiée en temps réel, c'est le doublon
    // d'écriture que le socle a précisément retiré.
    expect(update?.payload).toEqual({ dossier_validated_by: 'user-badr' })
  })

  it('should renvoyer l’état du dossier après validation', async () => {
    planFor('COMPLET')
    const res = await POST(makeRequest(), params)
    await expect(res.json()).resolves.toMatchObject({
      artisan: {
        statut_dossier: 'COMPLET',
        dossier_validated_by: 'user-badr',
        dossier_validated_at: '2026-09-05T10:00:00.000Z',
      },
    })
  })
})
