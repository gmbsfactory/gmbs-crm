import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { isCheckStatus, CHECK_STATUS_CODES } from '@/lib/interventions/checkStatus'

describe('interventions/checkStatus', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-06-15'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('CHECK_STATUS_CODES', () => {
    it('should include VISITE_TECHNIQUE', () => {
      expect(CHECK_STATUS_CODES.has('VISITE_TECHNIQUE')).toBe(true)
    })

    it('should include INTER_EN_COURS', () => {
      expect(CHECK_STATUS_CODES.has('INTER_EN_COURS')).toBe(true)
    })

    it('should not include other statuses', () => {
      expect(CHECK_STATUS_CODES.has('DEMANDE')).toBe(false)
      expect(CHECK_STATUS_CODES.has('ACCEPTE')).toBe(false)
    })
  })

  describe('isCheckStatus', () => {
    it('should return true when date is in the past for eligible status', () => {
      expect(isCheckStatus('VISITE_TECHNIQUE', '2024-06-14')).toBe(true)
      expect(isCheckStatus('INTER_EN_COURS', '2024-06-10')).toBe(true)
    })

    it('should return true when date is today', () => {
      expect(isCheckStatus('VISITE_TECHNIQUE', '2024-06-15')).toBe(true)
    })

    it('should return false when date is in the future', () => {
      expect(isCheckStatus('VISITE_TECHNIQUE', '2024-06-16')).toBe(false)
    })

    it('should return false for non-check statuses', () => {
      expect(isCheckStatus('DEMANDE', '2024-06-14')).toBe(false)
      expect(isCheckStatus('ACCEPTE', '2024-06-14')).toBe(false)
    })

    it('should return false when statusCode is null/undefined', () => {
      expect(isCheckStatus(null, '2024-06-14')).toBe(false)
      expect(isCheckStatus(undefined, '2024-06-14')).toBe(false)
    })

    it('should return false when datePrevue is null/undefined', () => {
      expect(isCheckStatus('VISITE_TECHNIQUE', null)).toBe(false)
      expect(isCheckStatus('VISITE_TECHNIQUE', undefined)).toBe(false)
    })

    it('should return false for invalid date string', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      expect(isCheckStatus('VISITE_TECHNIQUE', 'not-a-date')).toBe(false)
      consoleSpy.mockRestore()
    })
  })
})
