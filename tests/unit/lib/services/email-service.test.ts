import { describe, it, expect, vi, beforeEach } from 'vitest'

const sendMail = vi.fn()

vi.mock('nodemailer', () => ({
  default: { createTransport: vi.fn(() => ({ sendMail })) },
  createTransport: vi.fn(() => ({ sendMail })),
}))

import { sendEmailToArtisan, validateEmail, validateGmailEmail } from '@/lib/services/email-service'

const BASE = {
  type: 'intervention' as const,
  artisanEmail: 'artisan@exemple.fr',
  subject: 'Mission',
  htmlContent: '<p>Bonjour</p>',
  smtpEmail: 'gmbs@gmail.com',
  smtpPassword: 'secret',
}

describe('email-service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sendMail.mockResolvedValue({ messageId: 'm-1', response: '250 OK', accepted: [BASE.artisanEmail], rejected: [] })
  })

  describe('sendEmailToArtisan', () => {
    it("should refuser une pièce jointe désignée par un chemin de fichier local", async () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {})

      const result = await sendEmailToArtisan({
        ...BASE,
        attachments: [{ filename: 'passwd', path: '/etc/passwd' }],
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('chemin de fichier local interdit')
      expect(sendMail).not.toHaveBeenCalled()
      error.mockRestore()
    })

    it("should envoyer une pièce fournie en octets, sans chemin local dans le message", async () => {
      const result = await sendEmailToArtisan({
        ...BASE,
        attachments: [{ filename: 'devis.pdf', content: Buffer.from('pdf'), contentType: 'application/pdf' }],
      })

      expect(result.success).toBe(true)
      const options = sendMail.mock.calls[0][0]
      const piece = options.attachments[1]
      expect(piece).toEqual({
        filename: 'devis.pdf',
        content: expect.any(Buffer),
        cid: undefined,
        contentType: 'application/pdf',
      })
      // Seul le logo, construit par le service, a le droit de lire un fichier du disque.
      expect(options.attachments[0].cid).toBe('logoGM')
      expect('path' in piece).toBe(false)
    })

    it("should envoyer sans pièce jointe quand aucune n'est fournie", async () => {
      const result = await sendEmailToArtisan(BASE)

      expect(result.success).toBe(true)
      expect(sendMail.mock.calls[0][0].attachments).toHaveLength(1)
    })
  })

  describe('validateEmail / validateGmailEmail', () => {
    it('should accepter une adresse valide et refuser une adresse hors Gmail', () => {
      expect(validateEmail('a@b.fr')).toBe(true)
      expect(validateEmail('a@b')).toBe(false)
      expect(validateGmailEmail('gmbs@gmail.com')).toBe(true)
      expect(validateGmailEmail('gmbs@orange.fr')).toBe(false)
    })
  })
})
