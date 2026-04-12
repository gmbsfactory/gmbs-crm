import { describe, it, expect } from 'vitest'
import { validateSiretLuhn, validateSiret, siretFormRule } from '@/lib/siret-validation'

describe('siret-validation', () => {
  describe('validateSiretLuhn', () => {
    it('should return true for a valid SIRET (La Poste)', () => {
      // La Poste: 35600000000048 - known valid SIRET
      expect(validateSiretLuhn('35600000000048')).toBe(true)
    })

    it('should return true for another valid SIRET', () => {
      // SIREN 732829320 + NIC 00074 = 73282932000074
      expect(validateSiretLuhn('73282932000074')).toBe(true)
    })

    it('should return false for an invalid SIRET (bad checksum)', () => {
      expect(validateSiretLuhn('12345678901235')).toBe(false)
    })

    it('should return false for non-digit characters', () => {
      expect(validateSiretLuhn('1234ABCD901234')).toBe(false)
    })

    it('should return false for wrong length (too short)', () => {
      expect(validateSiretLuhn('1234567890')).toBe(false)
    })

    it('should return false for wrong length (too long)', () => {
      expect(validateSiretLuhn('123456789012345')).toBe(false)
    })

    it('should handle SIRET with spaces (strips them)', () => {
      expect(validateSiretLuhn('356 000 000 00048')).toBe(true)
    })

    it('should return false for empty string', () => {
      expect(validateSiretLuhn('')).toBe(false)
    })

    it('should return true for all zeros SIRET (0 mod 10)', () => {
      expect(validateSiretLuhn('00000000000000')).toBe(true)
    })
  })

  describe('validateSiret', () => {
    it('should return isValid true for empty string', () => {
      const result = validateSiret('')
      expect(result.isValid).toBe(true)
      expect(result.errorMessage).toBeUndefined()
    })

    it('should return isValid true for whitespace-only string', () => {
      const result = validateSiret('   ')
      expect(result.isValid).toBe(true)
    })

    it('should return isValid true for valid SIRET', () => {
      const result = validateSiret('35600000000048')
      expect(result.isValid).toBe(true)
      expect(result.errorMessage).toBeUndefined()
    })

    it('should return isValid true for valid SIRET with spaces', () => {
      const result = validateSiret('356 000 000 00048')
      expect(result.isValid).toBe(true)
    })

    it('should return error for non-digit characters', () => {
      const result = validateSiret('ABCDEFGHIJKLMN')
      expect(result.isValid).toBe(false)
      expect(result.errorMessage).toBe('Le SIRET doit contenir uniquement des chiffres')
    })

    it('should return error for wrong length', () => {
      const result = validateSiret('1234567890')
      expect(result.isValid).toBe(false)
      expect(result.errorMessage).toBe('Le SIRET doit contenir exactement 14 chiffres')
    })

    it('should return error for invalid Luhn checksum', () => {
      const result = validateSiret('12345678901235')
      expect(result.isValid).toBe(false)
      expect(result.errorMessage).toBe("Le SIRET n'est pas valide (erreur de clé de contrôle)")
    })

    it('should handle mixed invalid characters', () => {
      const result = validateSiret('123-456-789-01')
      expect(result.isValid).toBe(false)
      expect(result.errorMessage).toBe('Le SIRET doit contenir uniquement des chiffres')
    })
  })

  describe('siretFormRule', () => {
    it('should return true for empty/undefined', () => {
      expect(siretFormRule(undefined)).toBe(true)
      expect(siretFormRule('')).toBe(true)
      expect(siretFormRule('  ')).toBe(true)
    })

    it('should return true for valid 14-digit SIRET', () => {
      expect(siretFormRule('12345678901234')).toBe(true)
    })

    it('should return error string for wrong length', () => {
      expect(siretFormRule('1234')).toBe('14 chiffres requis')
    })

    it('should return error string for non-digit characters', () => {
      expect(siretFormRule('1234567890123A')).toBe('14 chiffres requis')
    })
  })
})
