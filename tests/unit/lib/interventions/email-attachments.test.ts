import { describe, it, expect } from 'vitest'
import {
  EMAIL_ATTACHMENT_FORBIDDEN_KINDS,
  MAX_EMAIL_ATTACHMENTS,
  defaultUploadKind,
  formatFileSize,
  isEmailAttachableKind,
  labelForAttachmentKind,
  toEmailAttachmentOptions,
  totalAttachmentsSize,
  type RawInterventionAttachment,
} from '@/lib/interventions/email-attachments'

function row(overrides: Partial<RawInterventionAttachment> = {}): RawInterventionAttachment {
  return {
    id: overrides.id ?? 'att-1',
    kind: overrides.kind ?? 'devis',
    url: overrides.url ?? 'http://127.0.0.1:54321/storage/v1/object/public/documents/intervention/i-1/devis.pdf',
    filename: overrides.filename ?? 'devis.pdf',
    mime_type: overrides.mime_type ?? 'application/pdf',
    file_size: 'file_size' in overrides ? (overrides.file_size ?? null) : 1024,
    created_at: overrides.created_at ?? '2026-09-01T10:00:00.000Z',
    sent_to_artisan_at: overrides.sent_to_artisan_at ?? null,
  }
}

describe('email-attachments', () => {
  describe('isEmailAttachableKind', () => {
    it('should accept les natures destinées à l\'artisan', () => {
      for (const kind of ['devis', 'photos', 'facturesArtisans', 'facturesMateriel', 'autre', 'a_classe']) {
        expect(isEmailAttachableKind(kind)).toBe(true)
      }
    })

    it('should refuser facturesGMBS : la facture de GMBS à son client ne part jamais chez le sous-traitant', () => {
      expect(EMAIL_ATTACHMENT_FORBIDDEN_KINDS).toContain('facturesGMBS')
      expect(isEmailAttachableKind('facturesGMBS')).toBe(false)
    })

    it('should refuser une nature vide ou absente', () => {
      expect(isEmailAttachableKind('')).toBe(false)
      expect(isEmailAttachableKind(null)).toBe(false)
      expect(isEmailAttachableKind(undefined)).toBe(false)
    })
  })

  describe('toEmailAttachmentOptions', () => {
    it('should ne proposer que des pièces de l\'intervention, jamais facturesGMBS', () => {
      const options = toEmailAttachmentOptions([
        row({ id: 'a', kind: 'devis' }),
        row({ id: 'b', kind: 'facturesGMBS', filename: 'facture-client.pdf' }),
        row({ id: 'c', kind: 'photos', filename: 'photo.jpg' }),
      ])

      expect(options.map((option) => option.id)).toEqual(['a', 'c'])
    })

    it('should trier les devis en tête, puis du plus récent au plus ancien', () => {
      const options = toEmailAttachmentOptions([
        row({ id: 'photo-ancienne', kind: 'photos', created_at: '2026-08-01T10:00:00.000Z' }),
        row({ id: 'photo-recente', kind: 'photos', created_at: '2026-09-10T10:00:00.000Z' }),
        row({ id: 'devis', kind: 'devis', created_at: '2026-07-01T10:00:00.000Z' }),
      ])

      expect(options.map((option) => option.id)).toEqual(['devis', 'photo-recente', 'photo-ancienne'])
    })

    it('should remplacer un nom de fichier vide par un libellé lisible', () => {
      const [option] = toEmailAttachmentOptions([row({ filename: '   ' })])
      expect(option.filename).toBe('Sans nom')
    })

    it('should reporter la marque d\'envoi de la migration 99083', () => {
      const [option] = toEmailAttachmentOptions([row({ sent_to_artisan_at: '2026-09-12T08:00:00.000Z' })])
      expect(option.sentToArtisanAt).toBe('2026-09-12T08:00:00.000Z')
    })

    it('should ignorer une ligne sans identifiant', () => {
      const options = toEmailAttachmentOptions([{ id: '', kind: 'devis', url: 'http://x' } as RawInterventionAttachment])
      expect(options).toHaveLength(0)
    })
  })

  describe('totalAttachmentsSize', () => {
    it('should additionner les tailles connues et compter zéro pour les inconnues', () => {
      const options = toEmailAttachmentOptions([
        row({ id: 'a', file_size: 1000 }),
        row({ id: 'b', file_size: null, kind: 'photos' }),
        row({ id: 'c', file_size: 2000, kind: 'photos' }),
      ])
      expect(totalAttachmentsSize(options)).toBe(3000)
    })
  })

  describe('divers', () => {
    it('should proposer devis pour un e-mail de devis, autre sinon', () => {
      expect(defaultUploadKind('devis')).toBe('devis')
      expect(defaultUploadKind('intervention')).toBe('autre')
    })

    it('should libeller les natures en français et rendre la nature brute si inconnue', () => {
      expect(labelForAttachmentKind('facturesArtisans')).toBe('Facture artisan')
      expect(labelForAttachmentKind('inconnu')).toBe('inconnu')
    })

    it('should formater les tailles en unités françaises', () => {
      expect(formatFileSize(512)).toBe('512 o')
      expect(formatFileSize(2048)).toBe('2.0 Ko')
      expect(formatFileSize(8 * 1024 * 1024)).toBe('8.0 Mo')
      expect(formatFileSize(null)).toBe('taille inconnue')
    })

    it('should borner la sélection à cinq pièces', () => {
      expect(MAX_EMAIL_ATTACHMENTS).toBe(5)
    })
  })
})
