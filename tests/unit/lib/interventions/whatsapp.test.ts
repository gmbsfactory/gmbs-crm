import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
  },
}))

vi.mock('@/lib/email-templates/intervention-emails', () => ({
  generateDevisWhatsAppText: vi.fn(() => 'Message devis'),
  generateInterventionWhatsAppText: vi.fn(() => 'Message intervention'),
  encodeWhatsAppUrl: vi.fn((phone: string, message: string) => `https://web.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(message)}`),
}))

import { formatPhoneForWhatsApp, openWhatsApp } from '@/lib/interventions/whatsapp'
import { toast } from 'sonner'
import {
  generateDevisWhatsAppText,
  generateInterventionWhatsAppText,
  encodeWhatsAppUrl,
} from '@/lib/email-templates/intervention-emails'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setUserAgent(ua: string) {
  Object.defineProperty(navigator, 'userAgent', {
    value: ua,
    configurable: true,
  })
}

// ---------------------------------------------------------------------------
// formatPhoneForWhatsApp
// ---------------------------------------------------------------------------

describe('formatPhoneForWhatsApp', () => {
  describe('empty / falsy input', () => {
    it('should return empty string for empty string', () => {
      expect(formatPhoneForWhatsApp('')).toBe('')
    })
  })

  describe('French numbers starting with 0', () => {
    it('should convert 0x to +33x for a standard mobile number', () => {
      expect(formatPhoneForWhatsApp('0612345678')).toBe('+33612345678')
    })

    it('should convert 0x to +33x for a landline number', () => {
      expect(formatPhoneForWhatsApp('0123456789')).toBe('+33123456789')
    })

    it('should strip spaces before converting', () => {
      expect(formatPhoneForWhatsApp('06 12 34 56 78')).toBe('+33612345678')
    })

    it('should strip dots before converting', () => {
      expect(formatPhoneForWhatsApp('06.12.34.56.78')).toBe('+33612345678')
    })

    it('should strip dashes before converting', () => {
      expect(formatPhoneForWhatsApp('06-12-34-56-78')).toBe('+33612345678')
    })

    it('should strip parentheses before converting', () => {
      expect(formatPhoneForWhatsApp('(06) 12 34 56 78')).toBe('+33612345678')
    })

    it('should strip mixed separators before converting', () => {
      expect(formatPhoneForWhatsApp('06 12-34.56 78')).toBe('+33612345678')
    })
  })

  describe('numbers already in international format', () => {
    it('should keep numbers that already start with +', () => {
      expect(formatPhoneForWhatsApp('+33612345678')).toBe('+33612345678')
    })

    it('should keep non-French international numbers unchanged', () => {
      expect(formatPhoneForWhatsApp('+44712345678')).toBe('+44712345678')
    })

    it('should strip spaces from international numbers', () => {
      expect(formatPhoneForWhatsApp('+33 6 12 34 56 78')).toBe('+33612345678')
    })
  })

  describe('numbers without leading 0 or + (bare digits)', () => {
    it('should prefix bare digit numbers with +33', () => {
      expect(formatPhoneForWhatsApp('612345678')).toBe('+33612345678')
    })
  })
})

// ---------------------------------------------------------------------------
// openWhatsApp
// ---------------------------------------------------------------------------

describe('openWhatsApp', () => {
  const mockGenerateEmailTemplateData = vi.fn(() => ({ someData: true }))

  beforeEach(() => {
    vi.clearAllMocks()
    // Default to desktop user-agent
    setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')
  })

  describe('validation', () => {
    it('should call toast.error and return early when artisanId is missing', () => {
      openWhatsApp({
        emailType: 'devis',
        artisanId: '',
        artisanPhone: '0612345678',
        generateEmailTemplateData: mockGenerateEmailTemplateData,
      })

      expect(toast.error).toHaveBeenCalledWith('Artisan non sélectionné')
      expect(mockGenerateEmailTemplateData).not.toHaveBeenCalled()
    })

    it('should call toast.error and return early when artisanPhone is missing', () => {
      openWhatsApp({
        emailType: 'devis',
        artisanId: 'art-1',
        artisanPhone: '',
        generateEmailTemplateData: mockGenerateEmailTemplateData,
      })

      expect(toast.error).toHaveBeenCalledWith("Numéro de téléphone de l'artisan manquant")
      expect(mockGenerateEmailTemplateData).not.toHaveBeenCalled()
    })

    it('should call toast.error when artisanPhone is whitespace only', () => {
      openWhatsApp({
        emailType: 'devis',
        artisanId: 'art-1',
        artisanPhone: '   ',
        generateEmailTemplateData: mockGenerateEmailTemplateData,
      })

      expect(toast.error).toHaveBeenCalledWith("Numéro de téléphone de l'artisan manquant")
      expect(mockGenerateEmailTemplateData).not.toHaveBeenCalled()
    })
  })

  describe('desktop flow', () => {
    it('should call generateDevisWhatsAppText and open a popup for emailType=devis', () => {
      const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null)

      openWhatsApp({
        emailType: 'devis',
        artisanId: 'art-1',
        artisanPhone: '0612345678',
        generateEmailTemplateData: mockGenerateEmailTemplateData,
      })

      expect(mockGenerateEmailTemplateData).toHaveBeenCalledWith('art-1')
      expect(generateDevisWhatsAppText).toHaveBeenCalledWith({ someData: true })
      expect(generateInterventionWhatsAppText).not.toHaveBeenCalled()
      expect(encodeWhatsAppUrl).toHaveBeenCalledWith('+33612345678', 'Message devis')
      expect(windowOpenSpy).toHaveBeenCalledOnce()
      expect(windowOpenSpy.mock.calls[0][1]).toBe('_blank')

      windowOpenSpy.mockRestore()
    })

    it('should call generateInterventionWhatsAppText and open a popup for emailType=intervention', () => {
      const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null)

      openWhatsApp({
        emailType: 'intervention',
        artisanId: 'art-1',
        artisanPhone: '0612345678',
        generateEmailTemplateData: mockGenerateEmailTemplateData,
      })

      expect(generateInterventionWhatsAppText).toHaveBeenCalledWith({ someData: true })
      expect(generateDevisWhatsAppText).not.toHaveBeenCalled()
      expect(windowOpenSpy).toHaveBeenCalledOnce()

      windowOpenSpy.mockRestore()
    })

    it('should open popup with centered dimensions', () => {
      const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null)

      openWhatsApp({
        emailType: 'devis',
        artisanId: 'art-1',
        artisanPhone: '0612345678',
        generateEmailTemplateData: mockGenerateEmailTemplateData,
      })

      const features = windowOpenSpy.mock.calls[0][2] as string
      expect(features).toContain('width=780')
      expect(features).toContain('height=910')
      expect(features).toContain('resizable=yes')
      expect(features).toContain('scrollbars=yes')

      windowOpenSpy.mockRestore()
    })
  })

  describe('mobile flow', () => {
    it('should set window.location.href to whatsapp:// scheme on Android', () => {
      setUserAgent('Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36')

      // jsdom does not fully mock location.href assignment; we spy on the setter
      const locationSpy = vi.spyOn(window, 'location', 'get').mockReturnValue({
        ...window.location,
        href: '',
      } as Location)
      let capturedHref = ''
      Object.defineProperty(window.location, 'href', {
        set: (value: string) => { capturedHref = value },
        get: () => capturedHref,
        configurable: true,
      })

      openWhatsApp({
        emailType: 'devis',
        artisanId: 'art-1',
        artisanPhone: '0612345678',
        generateEmailTemplateData: mockGenerateEmailTemplateData,
      })

      expect(capturedHref).toMatch(/^whatsapp:\/\/send\?phone=\+33612345678/)
      expect(capturedHref).toContain('text=')

      locationSpy.mockRestore()
      // Reset UA
      setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')
    })

    it('should NOT call window.open on iPhone (uses location.href instead)', () => {
      setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')

      const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null)

      openWhatsApp({
        emailType: 'intervention',
        artisanId: 'art-1',
        artisanPhone: '+33612345678',
        generateEmailTemplateData: mockGenerateEmailTemplateData,
      })

      expect(windowOpenSpy).not.toHaveBeenCalled()

      windowOpenSpy.mockRestore()
      setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')
    })
  })
})
