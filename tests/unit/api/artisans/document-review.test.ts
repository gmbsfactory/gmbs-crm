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

import { POST } from '../../../../app/api/artisans/[id]/documents/[attachmentId]/review/route'
import { createPlannedClient } from '../../../__mocks__/portal-external-client'

const ARTISAN_ID = 'a0000000-0000-4000-8000-000000000001'
const ATTACHMENT_ID = 'b0000000-0000-4000-8000-000000000002'
const params = { params: Promise.resolve({ id: ARTISAN_ID, attachmentId: ATTACHMENT_ID }) }

function makeRequest(body: unknown) {
  return new NextRequest(
    `http://localhost/api/artisans/${ARTISAN_ID}/documents/${ATTACHMENT_ID}/review`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  )
}

const pieceExistante = {
  id: ATTACHMENT_ID,
  artisan_id: ARTISAN_ID,
  kind: 'kbis',
  filename: 'kbis.pdf',
  metadata: { source: 'portal' },
}

function pieceRevue(status: 'approved' | 'rejected', comment: string | null) {
  return {
    id: ATTACHMENT_ID,
    artisan_id: ARTISAN_ID,
    kind: 'kbis',
    filename: 'kbis.pdf',
    url: 'http://storage.local/documents/kbis.pdf',
    mime_type: 'application/pdf',
    file_size: 1234,
    created_at: '2026-09-04T08:00:00.000Z',
    review_status: status,
    reviewed_at: '2026-09-05T10:00:00.000Z',
    review_comment: comment,
    metadata: { source: 'portal' },
  }
}

/**
 * Plan par défaut : lecture de la pièce, mise à jour, relecture de l'artisan,
 * lecture du gestionnaire, insertion au journal.
 */
function planFor(
  status: 'approved' | 'rejected',
  comment: string | null,
  overrides: {
    existing?: unknown
    artisan?: unknown
  } = {},
) {
  const client = createPlannedClient({
    artisan_attachments: [
      { data: overrides.existing === undefined ? pieceExistante : overrides.existing, error: null },
      { data: pieceRevue(status, comment), error: null },
    ],
    artisans: [
      {
        data:
          overrides.artisan ?? {
            id: ARTISAN_ID,
            statut_dossier: 'COMPLET',
            pieces_a_verifier: 0,
            dossier_validated_at: '2026-09-05T10:00:00.000Z',
          },
        error: null,
      },
    ],
    users: [{ data: { firstname: 'Badr', lastname: 'Boujimal', username: 'badr' }, error: null }],
    artisan_portal_actions: [{ data: null, error: null }],
  })
  h.createServerSupabaseAdmin.mockReturnValue(client)
  return client
}

describe('POST /api/artisans/[id]/documents/[attachmentId]/review', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    h.requirePermission.mockResolvedValue({
      user: { id: 'user-badr', roles: ['admin'], permissions: new Set(['write_artisans']) },
    })
  })

  it('should renvoyer 401 si non authentifié', async () => {
    h.requirePermission.mockResolvedValueOnce({
      error: NextResponse.json({ error: 'Non authentifié' }, { status: 401 }),
    })
    const res = await POST(makeRequest({ decision: 'approved' }), params)
    expect(res.status).toBe(401)
    expect(h.requirePermission).toHaveBeenCalledWith(expect.anything(), 'write_artisans')
  })

  it('should renvoyer 403 sans la permission write_artisans, sans toucher à la base', async () => {
    h.requirePermission.mockResolvedValueOnce({
      error: NextResponse.json({ error: 'Permission requise' }, { status: 403 }),
    })
    const res = await POST(makeRequest({ decision: 'approved' }), params)
    expect(res.status).toBe(403)
    expect(h.createServerSupabaseAdmin).not.toHaveBeenCalled()
  })

  it('should renvoyer 400 sur un refus sans motif, sans écrire', async () => {
    const client = planFor('rejected', null)
    const res = await POST(makeRequest({ decision: 'rejected' }), params)
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toMatchObject({
      error: expect.stringContaining('motif'),
    })
    expect(client.calls.some((c) => c.op === 'update')).toBe(false)
  })

  it('should renvoyer 400 sur une décision inconnue', async () => {
    planFor('approved', null)
    const res = await POST(makeRequest({ decision: 'peut-etre' }), params)
    expect(res.status).toBe(400)
  })

  it("should renvoyer 404 quand la pièce n'appartient pas à l'artisan", async () => {
    const client = planFor('approved', null, { existing: null })
    const res = await POST(makeRequest({ decision: 'approved' }), params)
    expect(res.status).toBe(404)
    expect(client.calls.some((c) => c.op === 'update')).toBe(false)
    // La garde est bien une double égalité (id ET artisan_id) : jamais une
    // réponse qui révélerait l'existence de la pièce d'un autre artisan.
    const lecture = client.calls.find((c) => c.table === 'artisan_attachments')
    expect(lecture?.filters).toEqual(
      expect.arrayContaining([
        ['eq', 'id', ATTACHMENT_ID],
        ['eq', 'artisan_id', ARTISAN_ID],
      ]),
    )
  })

  it('should écrire review_status, reviewed_by et reviewed_at à la validation', async () => {
    const client = planFor('approved', null)
    const res = await POST(makeRequest({ decision: 'approved' }), params)
    expect(res.status).toBe(200)

    const update = client.calls.find((c) => c.table === 'artisan_attachments' && c.op === 'update')
    expect(update?.payload).toMatchObject({
      review_status: 'approved',
      reviewed_by: 'user-badr',
      review_comment: null,
    })
    expect((update?.payload as { reviewed_at: string }).reviewed_at).toEqual(expect.any(String))
  })

  it('should conserver metadata.source et poser la date de validité', async () => {
    const client = planFor('approved', null)
    await POST(makeRequest({ decision: 'approved', valid_until: '2027-01-31' }), params)
    const update = client.calls.find((c) => c.table === 'artisan_attachments' && c.op === 'update')
    expect((update?.payload as { metadata: Record<string, unknown> }).metadata).toEqual({
      source: 'portal',
      valid_until: '2027-01-31',
    })
  })

  it('should renvoyer statut_dossier, pieces_a_verifier et dossier_validated_at à jour', async () => {
    planFor('approved', null)
    const res = await POST(makeRequest({ decision: 'approved' }), params)
    await expect(res.json()).resolves.toMatchObject({
      artisan: {
        statut_dossier: 'COMPLET',
        pieces_a_verifier: 0,
        dossier_validated_at: '2026-09-05T10:00:00.000Z',
      },
    })
  })

  it("should n'écrire NI statut_dossier NI pieces_a_verifier (seul le trigger le fait)", async () => {
    const client = planFor('approved', null)
    await POST(makeRequest({ decision: 'approved' }), params)
    const ecrituresArtisan = client.calls.filter((c) => c.table === 'artisans' && c.op === 'update')
    expect(ecrituresArtisan).toHaveLength(0)
  })

  it('should enregistrer un refus motivé et le journaliser avec son acteur', async () => {
    const client = planFor('rejected', 'Kbis de plus de 3 mois')
    const res = await POST(
      makeRequest({ decision: 'rejected', comment: 'Kbis de plus de 3 mois' }),
      params,
    )
    expect(res.status).toBe(200)

    const update = client.calls.find((c) => c.table === 'artisan_attachments' && c.op === 'update')
    expect(update?.payload).toMatchObject({
      review_status: 'rejected',
      review_comment: 'Kbis de plus de 3 mois',
    })

    const journal = client.calls.find(
      (c) => c.table === 'artisan_portal_actions' && c.op === 'insert',
    )
    expect(journal?.payload).toMatchObject({
      artisan_id: ARTISAN_ID,
      action_type: 'DOCUMENT_REJECTED',
      source: 'crm',
      actor_user_id: 'user-badr',
      attachment_id: ATTACHMENT_ID,
    })
    // CHECK `artisan_portal_actions_acteur_check` : une action `crm` doit porter
    // un acteur lisible en plus de la clé étrangère (ON DELETE SET NULL).
    expect((journal?.payload as { payload: Record<string, unknown> }).payload).toMatchObject({
      actor: 'Badr Boujimal',
      comment: 'Kbis de plus de 3 mois',
    })
  })

  it('should journaliser DOCUMENT_APPROVED à la validation', async () => {
    const client = planFor('approved', null)
    await POST(makeRequest({ decision: 'approved' }), params)
    const journal = client.calls.find(
      (c) => c.table === 'artisan_portal_actions' && c.op === 'insert',
    )
    expect(journal?.payload).toMatchObject({ action_type: 'DOCUMENT_APPROVED' })
  })
})
