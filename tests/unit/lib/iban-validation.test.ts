import { describe, it, expect } from 'vitest'
import { normalizeIban, validateIban, ibanFormRule, IBAN_LENGTH, IBAN_GROUPS } from '@/lib/iban-validation'

describe('iban-validation', () => {
  describe('constants', () => {
    it('should have correct IBAN length for French format', () => {
      expect(IBAN_LENGTH).toBe(27)
    })

    it('should have groups summing to IBAN_LENGTH', () => {
      expect(IBAN_GROUPS.reduce((a, b) => a + b, 0)).toBe(IBAN_LENGTH)
    })
  })

  describe('normalizeIban', () => {
    it('should return undefined for empty string', () => {
      expect(normalizeIban('')).toBeUndefined()
    })

    it('should return undefined for incorrect length', () => {
      expect(normalizeIban('FR76')).toBeUndefined()
    })

    it('should return undefined for invalid characters', () => {
      expect(normalizeIban('FR76!234567890123456789012')).toBeUndefined()
    })

    it('should normalize valid IBAN with spaces', () => {
      expect(normalizeIban('fr76 3000 6000 0112 3456 7890 189')).toBe('FR7630006000011234567890189')
    })

    it('should normalize valid IBAN without spaces', () => {
      expect(normalizeIban('FR7630006000011234567890189')).toBe('FR7630006000011234567890189')
    })
  })

  describe('validateIban', () => {
    it('should accept empty value', () => {
      expect(validateIban('')).toEqual({ isValid: true })
      expect(validateIban('   ')).toEqual({ isValid: true })
    })

    it('should reject invalid characters', () => {
      const result = validateIban('FR76-300-060-001-123-456-78')
      expect(result.isValid).toBe(false)
      expect(result.errorMessage).toBe('Caractères invalides')
    })

    it('should reject wrong length', () => {
      const result = validateIban('FR76300060')
      expect(result.isValid).toBe(false)
      expect(result.errorMessage).toContain('27')
    })

    it('should accept valid 27-char IBAN', () => {
      expect(validateIban('FR7630006000011234567890189')).toEqual({ isValid: true })
    })
  })

  describe('ibanFormRule', () => {
    it('should return true for empty/undefined', () => {
      expect(ibanFormRule(undefined)).toBe(true)
      expect(ibanFormRule('')).toBe(true)
      expect(ibanFormRule('  ')).toBe(true)
    })

    it('should return true for valid IBAN', () => {
      expect(ibanFormRule('FR7630006000011234567890189')).toBe(true)
    })

    it('should return error string for invalid IBAN', () => {
      const result = ibanFormRule('FR76')
      expect(typeof result).toBe('string')
    })
  })
})
