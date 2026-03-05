import { describe, it, expect } from 'vitest'
import {
  parseVersion,
  formatVersion,
  incrementMinor,
  suggestNextVersion,
} from '@/features/settings/_components/updates/version-utils'

describe('version-utils', () => {
  describe('parseVersion', () => {
    it('should parse "1.03" into { major: 1, minor: 3 }', () => {
      expect(parseVersion('1.03')).toEqual({ major: 1, minor: 3 })
    })

    it('should parse "2.15" into { major: 2, minor: 15 }', () => {
      expect(parseVersion('2.15')).toEqual({ major: 2, minor: 15 })
    })

    it('should parse "0.00" into { major: 0, minor: 0 }', () => {
      expect(parseVersion('0.00')).toEqual({ major: 0, minor: 0 })
    })

    it('should handle single number "3"', () => {
      expect(parseVersion('3')).toEqual({ major: 3, minor: 0 })
    })

    it('should handle empty string', () => {
      expect(parseVersion('')).toEqual({ major: 0, minor: 0 })
    })

    it('should handle invalid input gracefully', () => {
      expect(parseVersion('abc.def')).toEqual({ major: 0, minor: 0 })
    })
  })

  describe('formatVersion', () => {
    it('should format 1, 3 as "1.03"', () => {
      expect(formatVersion(1, 3)).toBe('1.03')
    })

    it('should format 2, 15 as "2.15"', () => {
      expect(formatVersion(2, 15)).toBe('2.15')
    })

    it('should format 0, 0 as "0.00"', () => {
      expect(formatVersion(0, 0)).toBe('0.00')
    })

    it('should zero-pad single digit minor', () => {
      expect(formatVersion(1, 0)).toBe('1.00')
    })

    it('should not pad double digit minor', () => {
      expect(formatVersion(1, 99)).toBe('1.99')
    })
  })

  describe('incrementMinor', () => {
    it('should increment minor from 1.03 to 1.04', () => {
      expect(incrementMinor('1.03')).toBe('1.04')
    })

    it('should increment minor from 1.00 to 1.01', () => {
      expect(incrementMinor('1.00')).toBe('1.01')
    })

    it('should bump major when minor reaches 99', () => {
      expect(incrementMinor('1.99')).toBe('2.00')
    })

    it('should handle 0.99 => 1.00', () => {
      expect(incrementMinor('0.99')).toBe('1.00')
    })

    it('should handle 3.50 => 3.51', () => {
      expect(incrementMinor('3.50')).toBe('3.51')
    })
  })

  describe('suggestNextVersion', () => {
    it('should return "1.00" when no version given', () => {
      expect(suggestNextVersion()).toBe('1.00')
    })

    it('should return "1.00" when null given', () => {
      expect(suggestNextVersion(null)).toBe('1.00')
    })

    it('should return "1.00" when empty string given', () => {
      expect(suggestNextVersion('')).toBe('1.00')
    })

    it('should increment from latest version', () => {
      expect(suggestNextVersion('1.05')).toBe('1.06')
    })

    it('should handle major bump', () => {
      expect(suggestNextVersion('2.99')).toBe('3.00')
    })
  })
})
