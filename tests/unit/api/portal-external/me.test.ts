import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const h = vi.hoisted(() => ({
  createServerSupabaseAdmin: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseAdmin: h.createServerSupabaseAdmin,
}))

import { GET } from '../../../../app/api/portal-external/me/route'
import {
  createPlannedClient,
  portalHeaders,
  validTokenRow,
  TEST_KEY_ID,
  TEST_SECRET,
} from '../../../__mocks__/portal-external-client'

function get() {
  return new NextRequest('http://localhost/api/portal-external/me', { headers: portalHeaders() })
}

describe('GET /api/portal-external/me', () => {
  const env = { ...process.env }

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.GMBS_PORTAL_KEY_ID = TEST_KEY_ID
    process.env.GMBS_PORTAL_SECRET = TEST_SECRET
  })

  afterEach(() => {
    process.env = { ...env }
  })

  it('should expose pending, rejected, avatar and dossier_validated_at', async () => {
    h.createServerSupabaseAdmin.mockReturnValue(
      createPlannedClient({
        artisan_portal_tokens: [{ data: validTokenRow(), error: null }],
        intervention_artisans: [{ data: [], error: null }],
        artisan_attachments: [
          {
            data: [
              { id: 'a', artisan_id: 'art-1', kind: 'kbis', url: 'u1', review_status: 'pending', created_at: '2026-09-01T10:00:00.000Z' },
              { id: 'b', artisan_id: 'art-1', kind: 'assurance', url: 'u2', review_status: 'approved', created_at: '2026-09-01T10:00:00.000Z' },
              { id: 'c', artisan_id: 'art-1', kind: 'iban', url: 'u3', review_status: 'rejected', created_at: '2026-09-01T10:00:00.000Z' },
              {
                id: 'p',
                artisan_id: 'art-1',
                kind: 'photo_profil',
                url: 'http://storage.local/documents/moi.jpg',
                review_status: 'approved',
                created_at: '2026-09-02T10:00:00.000Z',
                derived_sizes: { '40': 'a', '80': 'b', '160': 'c' },
              },
            ],
            error: null,
          },
        ],
        artisans: [{ data: { dossier_validated_at: '2026-09-12T08:00:00.000Z' }, error: null }],
      }),
    )

    const response = await GET(get())
    expect(response.status).toBe(200)
    const body = await response.json()

    expect(body.documents).toEqual({ required: 5, present: 3, pending: 1, rejected: 1 })
    expect(body.avatar).toEqual({
      url: 'http://storage.local/documents/moi.jpg',
      sizes: { '40': 'a', '80': 'b', '160': 'c' },
    })
    expect(body.dossier_validated_at).toBe('2026-09-12T08:00:00.000Z')
    expect(body.counters).toMatchObject({ missions_total: 0, missions_a_accepter: 0 })
  })

  it('should return a null avatar and no validation date on a bare account', async () => {
    h.createServerSupabaseAdmin.mockReturnValue(
      createPlannedClient({
        artisan_portal_tokens: [{ data: validTokenRow(), error: null }],
        intervention_artisans: [{ data: [], error: null }],
        artisan_attachments: [{ data: [], error: null }],
        artisans: [{ data: { dossier_validated_at: null }, error: null }],
      }),
    )

    const body = await (await GET(get())).json()
    expect(body.avatar).toBeNull()
    expect(body.dossier_validated_at).toBeNull()
    expect(body.documents).toEqual({ required: 5, present: 0, pending: 0, rejected: 0 })
  })
})
