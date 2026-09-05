import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const h = vi.hoisted(() => ({
  createServerSupabaseAdmin: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseAdmin: h.createServerSupabaseAdmin,
}))

import { POST } from '../../../../app/api/portal-external/me/profile-photo/route'
import {
  createPlannedClient,
  portalHeaders,
  validTokenRow,
  TEST_KEY_ID,
  TEST_SECRET,
} from '../../../__mocks__/portal-external-client'

/** JPEG minimal : les octets magiques FF D8 FF sont vérifiés par la route. */
const JPEG_BASE64 = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]).toString('base64')
/** PDF : type interdit pour un avatar. */
const PDF_BASE64 = Buffer.from('%PDF-1.4\n%%EOF').toString('base64')

const ATTACHMENT_ID = 'photo-1'
const SIZES = {
  '40': 'http://storage.local/avatars/40.webp',
  '80': 'http://storage.local/avatars/80.webp',
  '160': 'http://storage.local/avatars/160.webp',
}

function post(body: unknown) {
  return new NextRequest('http://localhost/api/portal-external/me/profile-photo', {
    method: 'POST',
    headers: portalHeaders(),
    body: JSON.stringify(body),
  })
}

function plannedWithToken(extra: Record<string, Array<{ data: unknown; error: null }>> = {}) {
  const client = createPlannedClient({
    artisan_portal_tokens: [{ data: validTokenRow(), error: null }],
    ...extra,
  })
  h.createServerSupabaseAdmin.mockReturnValue(client)
  return client
}

/** Plan nominal : insertion puis relecture des dérivées produites par process-avatar. */
function planNominal() {
  return plannedWithToken({
    artisan_attachments: [
      // 1. DELETE de l'ancienne photo
      { data: null, error: null },
      // 2. INSERT de la nouvelle
      {
        data: {
          id: ATTACHMENT_ID,
          url: 'http://storage.local/documents/photo.jpg',
          content_hash: null,
          derived_sizes: null,
          mime_preferred: null,
        },
        error: null,
      },
      // 3. relecture après process-avatar
      {
        data: {
          id: ATTACHMENT_ID,
          url: 'http://storage.local/documents/photo.jpg',
          content_hash: 'abc123',
          derived_sizes: SIZES,
          mime_preferred: 'image/webp',
        },
        error: null,
      },
    ],
    artisan_portal_actions: [{ data: null, error: null }],
  })
}

describe('POST /api/portal-external/me/profile-photo', () => {
  const env = { ...process.env }

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.GMBS_PORTAL_KEY_ID = TEST_KEY_ID
    process.env.GMBS_PORTAL_SECRET = TEST_SECRET
  })

  afterEach(() => {
    process.env = { ...env }
  })

  it('should renvoyer 401 sans jeton artisan valide', async () => {
    plannedWithToken({ artisan_portal_tokens: [{ data: null, error: null }] })
    const res = await POST(
      post({ event_uid: 'e1', filename: 'a.jpg', mime_type: 'image/jpeg', content_base64: JPEG_BASE64 }),
    )
    expect(res.status).toBe(401)
  })

  it('should refuser un type non image en 415', async () => {
    planNominal()
    const res = await POST(
      post({ event_uid: 'e1', filename: 'a.pdf', mime_type: 'application/pdf', content_base64: PDF_BASE64 }),
    )
    expect(res.status).toBe(415)
  })

  it("should refuser un contenu dont les octets ne correspondent pas au type déclaré", async () => {
    planNominal()
    const res = await POST(
      post({ event_uid: 'e1', filename: 'a.jpg', mime_type: 'image/jpeg', content_base64: PDF_BASE64 }),
    )
    expect(res.status).toBe(415)
  })

  it('should refuser un contenu trop volumineux en 413', async () => {
    planNominal()
    const res = await POST(
      post({ event_uid: 'e1', filename: 'a.jpg', mime_type: 'image/jpeg', content_base64: 'A'.repeat(5 * 1024 * 1024) }),
    )
    expect(res.status).toBe(413)
  })

  it('should supprimer l’ancienne photo AVANT d’insérer la nouvelle', async () => {
    const client = planNominal()
    const res = await POST(
      post({ event_uid: 'e1', filename: 'moi.jpg', mime_type: 'image/jpeg', content_base64: JPEG_BASE64 }),
    )
    expect(res.status).toBe(201)

    const ops = client.calls
      .filter((c) => c.table === 'artisan_attachments')
      .map((c) => c.op)
    expect(ops.indexOf('delete')).toBeGreaterThanOrEqual(0)
    expect(ops.indexOf('delete')).toBeLessThan(ops.indexOf('insert'))

    const suppression = client.calls.find(
      (c) => c.table === 'artisan_attachments' && c.op === 'delete',
    )
    expect(suppression?.filters).toEqual(
      expect.arrayContaining([['eq', 'kind', 'photo_profil']]),
    )
  })

  it("should NE PAS poser review_status='pending' (l'avatar n'est pas une tâche du gestionnaire)", async () => {
    const client = planNominal()
    await POST(
      post({ event_uid: 'e1', filename: 'moi.jpg', mime_type: 'image/jpeg', content_base64: JPEG_BASE64 }),
    )
    const insertion = client.calls.find(
      (c) => c.table === 'artisan_attachments' && c.op === 'insert',
    )
    expect(insertion?.payload).toMatchObject({ kind: 'photo_profil', metadata: { source: 'portal' } })
    expect(insertion?.payload).not.toHaveProperty('review_status')
  })

  it('should attendre process-avatar et renvoyer les dérivées 40 / 80 / 160', async () => {
    const client = planNominal()
    const res = await POST(
      post({ event_uid: 'e1', filename: 'moi.jpg', mime_type: 'image/jpeg', content_base64: JPEG_BASE64 }),
    )
    expect(res.status).toBe(201)
    expect(client.invocations).toEqual([
      {
        name: 'process-avatar',
        body: expect.objectContaining({
          artisan_id: 'art-1',
          attachment_id: ATTACHMENT_ID,
          mime_type: 'image/jpeg',
        }),
      },
    ])
    await expect(res.json()).resolves.toMatchObject({
      avatar: { url: 'http://storage.local/documents/photo.jpg', sizes: SIZES },
    })
  })

  it('should rester en 201 si process-avatar échoue (repli sur l’URL de base)', async () => {
    const client = planNominal()
    client.functions.invoke.mockResolvedValueOnce({ data: null, error: { message: 'sharp KO' } })
    const res = await POST(
      post({ event_uid: 'e1', filename: 'moi.jpg', mime_type: 'image/jpeg', content_base64: JPEG_BASE64 }),
    )
    expect(res.status).toBe(201)
    await expect(res.json()).resolves.toMatchObject({
      avatar: { url: 'http://storage.local/documents/photo.jpg', sizes: {} },
    })
  })

  it("should supprimer la photo en mode 'initials'", async () => {
    const client = plannedWithToken({
      artisan_attachments: [{ data: null, error: null }],
      artisan_portal_actions: [{ data: null, error: null }],
    })
    const res = await POST(post({ event_uid: 'e2', mode: 'initials' }))
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ avatar: null })

    const suppression = client.calls.find(
      (c) => c.table === 'artisan_attachments' && c.op === 'delete',
    )
    expect(suppression).toBeDefined()
    expect(client.calls.some((c) => c.table === 'artisan_attachments' && c.op === 'insert')).toBe(false)
  })

  it("should rejouer un event_uid connu sans redéposer ni supprimer (P5)", async () => {
    const client = plannedWithToken({
      // Le journal connaît déjà cet event_uid : rejeu du téléphone hors ligne.
      artisan_portal_actions: [{ data: { id: 'act-1' }, error: null }],
      artisan_attachments: [
        {
          data: {
            id: ATTACHMENT_ID,
            url: 'http://storage.local/documents/photo.jpg',
            content_hash: 'abc123',
            derived_sizes: SIZES,
            mime_preferred: 'image/webp',
          },
          error: null,
        },
      ],
    })

    const res = await POST(
      post({ event_uid: 'deja-vu', filename: 'moi.jpg', mime_type: 'image/jpeg', content_base64: JPEG_BASE64 }),
    )

    // 200 (pas 409, pas 201) avec l'avatar déjà enregistré.
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({
      avatar: { url: 'http://storage.local/documents/photo.jpg', sizes: SIZES },
    })
    // Rien n'a été redéposé, rien n'a été supprimé, rien n'a été réinséré.
    expect(client.uploads).toHaveLength(0)
    expect(client.calls.some((c) => c.table === 'artisan_attachments' && c.op === 'delete')).toBe(false)
    expect(client.calls.some((c) => c.table === 'artisan_attachments' && c.op === 'insert')).toBe(false)
    expect(client.invocations).toHaveLength(0)
  })

  it("should chercher le rejeu sur (artisan_id, event_uid), jamais event_uid seul", async () => {
    const client = planNominal()
    await POST(
      post({ event_uid: 'evt-1', filename: 'moi.jpg', mime_type: 'image/jpeg', content_base64: JPEG_BASE64 }),
    )
    const lookup = client.calls.find((c) => c.table === 'artisan_portal_actions' && c.op === 'select')
    expect(lookup?.filters).toEqual(
      expect.arrayContaining([
        ['eq', 'artisan_id', 'art-1'],
        ['eq', 'event_uid', 'evt-1'],
      ]),
    )
  })

  it("should journaliser AVATAR_CHANGED avec la source 'portal'", async () => {
    const client = planNominal()
    await POST(
      post({ event_uid: 'evt-42', filename: 'moi.jpg', mime_type: 'image/jpeg', content_base64: JPEG_BASE64 }),
    )
    const journal = client.calls.find(
      (c) => c.table === 'artisan_portal_actions' && c.op === 'insert',
    )
    expect(journal?.payload).toMatchObject({
      artisan_id: 'art-1',
      action_type: 'AVATAR_CHANGED',
      source: 'portal',
      event_uid: 'evt-42',
      attachment_id: ATTACHMENT_ID,
    })
  })
})
