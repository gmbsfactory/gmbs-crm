import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => ({
  getAllStatuses: vi.fn(),
  update: vi.fn(),
  createComment: vi.fn(),
}))

vi.mock('@/lib/api', () => ({
  artisanStatusesApi: { getAll: h.getAllStatuses },
  artisansApi: { update: h.update },
  commentsApi: { create: h.createComment },
}))

import { archiveArtisan } from '@/lib/artisans/archiveArtisan'

beforeEach(() => {
  vi.clearAllMocks()
  h.getAllStatuses.mockResolvedValue([
    { id: 'pot', code: 'POTENTIEL', is_active: true },
    { id: 'arch', code: 'ARCHIVE', is_active: true },
  ])
  h.update.mockResolvedValue({ id: 'art-1', statut_id: 'arch' })
  h.createComment.mockResolvedValue({ id: 'c1' })
})

describe('archiveArtisan', () => {
  it('passe le statut ARCHIVE sans toucher is_active (comme le modal)', async () => {
    const res = await archiveArtisan({ artisanId: 'art-1', reason: '  motif  ', authorId: 'u1' })

    expect(h.update).toHaveBeenCalledTimes(1)
    const [id, payload] = h.update.mock.calls[0]
    expect(id).toBe('art-1')
    expect(payload).toEqual({ statut_id: 'arch' })
    expect(payload).not.toHaveProperty('is_active')
    expect(res).toEqual({ id: 'art-1', statut_id: 'arch' })
  })

  it('crée le commentaire de motif (trim + reason_type archive + auteur)', async () => {
    await archiveArtisan({ artisanId: 'art-1', reason: '  Ne répond plus  ', authorId: 'u1' })

    expect(h.createComment).toHaveBeenCalledWith({
      entity_id: 'art-1',
      entity_type: 'artisan',
      content: 'Ne répond plus',
      comment_type: 'internal',
      is_internal: true,
      author_id: 'u1',
      reason_type: 'archive',
    })
  })

  it("lève « Statut d'archivage introuvable » si ARCHIVE est absent, sans rien modifier", async () => {
    h.getAllStatuses.mockResolvedValue([{ id: 'pot', code: 'POTENTIEL', is_active: true }])

    await expect(archiveArtisan({ artisanId: 'art-1', reason: 'x' })).rejects.toThrow(/introuvable/i)
    expect(h.update).not.toHaveBeenCalled()
    expect(h.createComment).not.toHaveBeenCalled()
  })

  it('ignore un statut ARCHIVE inactif', async () => {
    h.getAllStatuses.mockResolvedValue([{ id: 'arch', code: 'ARCHIVE', is_active: false }])

    await expect(archiveArtisan({ artisanId: 'art-1', reason: 'x' })).rejects.toThrow(/introuvable/i)
    expect(h.update).not.toHaveBeenCalled()
  })

  it("ne crée pas le commentaire si l'update échoue", async () => {
    h.update.mockRejectedValue(new Error('update failed'))

    await expect(archiveArtisan({ artisanId: 'art-1', reason: 'x' })).rejects.toThrow('update failed')
    expect(h.createComment).not.toHaveBeenCalled()
  })
})
