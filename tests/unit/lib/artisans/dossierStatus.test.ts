import { describe, it, expect } from 'vitest'
import {
  calculateDossierStatus,
  hasDocument,
  countRequiredDocuments,
  REQUIRED_DOCUMENT_KINDS,
  type ArtisanAttachment,
} from '@/lib/artisans/dossierStatus'

const createAttachment = (kind: string, id = 'att-1'): ArtisanAttachment => ({
  id,
  artisan_id: 'art-1',
  kind,
  url: `https://storage.test/${kind}.pdf`,
})

const createFullDocumentSet = (): ArtisanAttachment[] =>
  REQUIRED_DOCUMENT_KINDS.map((kind, i) => createAttachment(kind, `att-${i}`))

describe('artisans/dossierStatus', () => {
  describe('calculateDossierStatus', () => {
    it('should return INCOMPLET when no attachments', () => {
      expect(calculateDossierStatus(null)).toBe('INCOMPLET')
      expect(calculateDossierStatus(undefined)).toBe('INCOMPLET')
      expect(calculateDossierStatus([])).toBe('INCOMPLET')
    })

    it('should return "À compléter" when no attachments but has completed intervention', () => {
      expect(calculateDossierStatus(null, true)).toBe('À compléter')
      expect(calculateDossierStatus([], true)).toBe('À compléter')
    })

    it('should return COMPLET when all required documents present', () => {
      const attachments = createFullDocumentSet()
      expect(calculateDossierStatus(attachments)).toBe('COMPLET')
    })

    it('should return "À compléter" when missing 1 document', () => {
      const attachments = REQUIRED_DOCUMENT_KINDS.slice(0, 4).map((kind, i) =>
        createAttachment(kind, `att-${i}`)
      )
      expect(calculateDossierStatus(attachments)).toBe('À compléter')
    })

    it('should return "À compléter" when missing >1 documents but has completed intervention', () => {
      const attachments = [createAttachment('kbis'), createAttachment('iban')]
      expect(calculateDossierStatus(attachments, true)).toBe('À compléter')
    })

    it('should return INCOMPLET when missing >1 documents and no completed intervention', () => {
      const attachments = [createAttachment('kbis'), createAttachment('iban')]
      expect(calculateDossierStatus(attachments, false)).toBe('INCOMPLET')
    })

    it('should ignore "autre" document kind', () => {
      const attachments = [createAttachment('autre')]
      expect(calculateDossierStatus(attachments)).toBe('INCOMPLET')
    })

    it('should handle case-insensitive kind matching', () => {
      const attachments = REQUIRED_DOCUMENT_KINDS.map((kind, i) =>
        createAttachment(kind.toUpperCase(), `att-${i}`)
      )
      expect(calculateDossierStatus(attachments)).toBe('COMPLET')
    })
  })

  describe('hasDocument', () => {
    it('should return true when document is present', () => {
      const attachments = [createAttachment('kbis')]
      expect(hasDocument(attachments, 'kbis')).toBe(true)
    })

    it('should return false when document is not present', () => {
      const attachments = [createAttachment('kbis')]
      expect(hasDocument(attachments, 'iban')).toBe(false)
    })

    it('should return false for null/empty attachments', () => {
      expect(hasDocument(null, 'kbis')).toBe(false)
      expect(hasDocument(undefined, 'kbis')).toBe(false)
      expect(hasDocument([], 'kbis')).toBe(false)
    })

    it('should handle case-insensitive matching', () => {
      const attachments = [createAttachment('KBIS')]
      expect(hasDocument(attachments, 'kbis')).toBe(true)
    })
  })

  describe('countRequiredDocuments', () => {
    it('should return 0 for empty attachments', () => {
      expect(countRequiredDocuments(null)).toBe(0)
      expect(countRequiredDocuments(undefined)).toBe(0)
      expect(countRequiredDocuments([])).toBe(0)
    })

    it('should count only required document kinds', () => {
      const attachments = [
        createAttachment('kbis', 'att-1'),
        createAttachment('iban', 'att-2'),
        createAttachment('autre', 'att-3'),
      ]
      expect(countRequiredDocuments(attachments)).toBe(2)
    })

    it('should count all 5 when all required are present', () => {
      const attachments = createFullDocumentSet()
      expect(countRequiredDocuments(attachments)).toBe(5)
    })
  })
})
