import { describe, it, expect } from 'vitest'
import {
  DOCUMENT_MIME_TYPES,
  MAX_BASE64_LENGTH,
  PNG_SIGNATURE,
  decodeBase64Payload,
  isDocumentMimeAllowed,
  matchesDeclaredMime,
  sanitizeFilename,
  sniffMimeType,
} from '@/lib/portal-external/uploads'

const PDF = Buffer.from('%PDF-1.4\n%%EOF')
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46])
const PNG = Buffer.concat([PNG_SIGNATURE, Buffer.from([0, 0, 0, 13])])
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0x10, 0, 0, 0]), Buffer.from('WEBPVP8 ')])
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')

describe('portal-external/uploads', () => {
  describe('isDocumentMimeAllowed', () => {
    it('accepte uniquement la liste fermée (PDF, JPEG, PNG, WebP)', () => {
      for (const mime of DOCUMENT_MIME_TYPES) expect(isDocumentMimeAllowed(mime)).toBe(true)
    })

    it('refuse image/svg+xml, HTML et les autres images', () => {
      expect(isDocumentMimeAllowed('image/svg+xml')).toBe(false)
      expect(isDocumentMimeAllowed('text/html')).toBe(false)
      expect(isDocumentMimeAllowed('image/gif')).toBe(false)
      expect(isDocumentMimeAllowed('application/octet-stream')).toBe(false)
    })
  })

  describe('sniffMimeType / matchesDeclaredMime', () => {
    it('détecte PDF, JPEG, PNG et WebP par leurs octets magiques', () => {
      expect(sniffMimeType(PDF)).toBe('application/pdf')
      expect(sniffMimeType(JPEG)).toBe('image/jpeg')
      expect(sniffMimeType(PNG)).toBe('image/png')
      expect(sniffMimeType(WEBP)).toBe('image/webp')
    })

    it('renvoie null pour un contenu inconnu (SVG, vide, RIFF non WebP)', () => {
      expect(sniffMimeType(SVG)).toBeNull()
      expect(sniffMimeType(Buffer.alloc(0))).toBeNull()
      expect(sniffMimeType(Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WAVE')]))).toBeNull()
    })

    it('exige la correspondance entre les octets et le type déclaré', () => {
      expect(matchesDeclaredMime(PDF, 'application/pdf')).toBe(true)
      expect(matchesDeclaredMime(PNG, 'application/pdf')).toBe(false)
      expect(matchesDeclaredMime(SVG, 'image/png')).toBe(false)
      expect(matchesDeclaredMime(PDF, 'image/svg+xml')).toBe(false)
    })
  })

  describe('decodeBase64Payload', () => {
    it('décode avec ou sans préfixe data:', () => {
      const b64 = PDF.toString('base64')
      const plain = decodeBase64Payload(b64)
      const prefixed = decodeBase64Payload(`data:application/pdf;base64,${b64}`)
      expect(plain.ok && plain.buffer.equals(PDF)).toBe(true)
      expect(prefixed.ok && prefixed.buffer.equals(PDF)).toBe(true)
    })

    it('renvoie 413 au-delà de 4 Mo et 400 si vide ou invalide', () => {
      expect(decodeBase64Payload('A'.repeat(MAX_BASE64_LENGTH + 1))).toEqual({ ok: false, status: 413, error: 'Payload too large' })
      expect(decodeBase64Payload('')).toEqual({ ok: false, status: 400, error: 'base64Data required' })
      expect(decodeBase64Payload('%%%')).toEqual({ ok: false, status: 400, error: 'Invalid base64Data' })
    })
  })

  describe('sanitizeFilename', () => {
    it('assainit le nom et supprime les chemins', () => {
      expect(sanitizeFilename('../secret/Extrait Kbis.pdf')).toBe('Extrait_Kbis.pdf')
      expect(sanitizeFilename('', 'kbis.pdf')).toBe('kbis.pdf')
    })
  })
})
