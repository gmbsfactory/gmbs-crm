import { describe, it, expect } from 'vitest'
import { pickAvatar, summarizeDossier, type DossierAttachmentRow } from '@/lib/portal-external/dossier-summary'

function piece(over: Partial<DossierAttachmentRow> & { id: string; kind: string }): DossierAttachmentRow {
  return {
    id: over.id,
    artisan_id: 'art-1',
    kind: over.kind,
    url: over.url ?? `http://storage.local/documents/${over.id}.pdf`,
    review_status: over.review_status ?? 'approved',
    created_at: over.created_at ?? '2026-09-01T10:00:00.000Z',
    derived_sizes: over.derived_sizes ?? null,
  }
}

describe('portal-external/dossier-summary', () => {
  describe('summarizeDossier', () => {
    it('should count the five required kinds', () => {
      expect(summarizeDossier([])).toEqual({ required: 5, present: 0, pending: 0, rejected: 0 })
    })

    it('should split pending and rejected from present', () => {
      const counters = summarizeDossier([
        piece({ id: 'a', kind: 'kbis', review_status: 'pending' }),
        piece({ id: 'b', kind: 'assurance', review_status: 'approved' }),
        piece({ id: 'c', kind: 'cni_recto_verso', review_status: 'rejected' }),
      ])
      expect(counters).toEqual({ required: 5, present: 3, pending: 1, rejected: 1 })
    })

    it('should only look at the latest deposit of a kind', () => {
      // Kbis refusé le 1er, redéposé le 5 : une seule pièce « en attente »,
      // jamais « une refusée ET une en attente ».
      const counters = summarizeDossier([
        piece({ id: 'vieux', kind: 'kbis', review_status: 'rejected', created_at: '2026-09-01T10:00:00.000Z' }),
        piece({ id: 'neuf', kind: 'kbis', review_status: 'pending', created_at: '2026-09-05T10:00:00.000Z' }),
      ])
      expect(counters).toMatchObject({ present: 1, pending: 1, rejected: 0 })
    })

    it('should ignore the profile photo, which is not a dossier piece', () => {
      const counters = summarizeDossier([piece({ id: 'p', kind: 'photo_profil', review_status: 'pending' })])
      expect(counters).toEqual({ required: 5, present: 0, pending: 0, rejected: 0 })
    })

    it('should ignore the « autre » kind in pending and rejected counts', () => {
      const counters = summarizeDossier([piece({ id: 'x', kind: 'autre', review_status: 'pending' })])
      expect(counters).toMatchObject({ present: 0, pending: 0 })
    })
  })

  describe('pickAvatar', () => {
    it('should return null without a profile photo', () => {
      expect(pickAvatar([piece({ id: 'a', kind: 'kbis' })])).toBeNull()
    })

    it('should return the latest photo_profil with its derived sizes', () => {
      const avatar = pickAvatar([
        piece({
          id: 'vieille',
          kind: 'photo_profil',
          url: 'http://storage.local/documents/old.jpg',
          created_at: '2026-08-01T10:00:00.000Z',
        }),
        piece({
          id: 'recente',
          kind: 'photo_profil',
          url: 'http://storage.local/documents/new.jpg',
          created_at: '2026-09-01T10:00:00.000Z',
          derived_sizes: { '40': 'a.jpg', '80': 'b.jpg', '160': 'c.jpg' },
        }),
      ])
      expect(avatar).toEqual({
        url: 'http://storage.local/documents/new.jpg',
        sizes: { '40': 'a.jpg', '80': 'b.jpg', '160': 'c.jpg' },
      })
    })

    it('should fall back to an empty sizes map when process-avatar has not run', () => {
      expect(pickAvatar([piece({ id: 'p', kind: 'photo_profil' })])?.sizes).toEqual({})
    })
  })
})
