import { describe, it, expect } from 'vitest'
import { toDate, compareDateValues, isBetween, isSameDay, getLocalDateString } from '@/lib/date-utils'

describe('date-utils', () => {
  describe('toDate', () => {
    it('should return null for falsy values', () => {
      expect(toDate(null)).toBeNull()
      expect(toDate(undefined)).toBeNull()
      expect(toDate(0)).toBeNull()
      expect(toDate('')).toBeNull()
    })

    it('should return Date for valid Date object', () => {
      const d = new Date('2024-01-15')
      expect(toDate(d)).toEqual(d)
    })

    it('should return null for invalid Date object', () => {
      expect(toDate(new Date('invalid'))).toBeNull()
    })

    it('should parse number as timestamp', () => {
      const ts = 1705276800000
      const result = toDate(ts)
      expect(result).toBeInstanceOf(Date)
      expect(result!.getTime()).toBe(ts)
    })

    it('should return null for NaN number timestamp', () => {
      expect(toDate(NaN)).toBeNull()
    })

    it('should parse valid string dates', () => {
      const result = toDate('2024-01-15')
      expect(result).toBeInstanceOf(Date)
      expect(result!.getFullYear()).toBe(2024)
    })

    it('should return null for invalid string dates', () => {
      expect(toDate('not-a-date')).toBeNull()
    })

    it('should return null for non-date types', () => {
      expect(toDate({})).toBeNull()
      expect(toDate([])).toBeNull()
      expect(toDate(true)).toBeNull()
    })
  })

  describe('compareDateValues', () => {
    it('should return 0 when both are null', () => {
      expect(compareDateValues(null, null)).toBe(0)
    })

    it('should return -1 when first is null', () => {
      expect(compareDateValues(null, '2024-01-15')).toBe(-1)
    })

    it('should return 1 when second is null', () => {
      expect(compareDateValues('2024-01-15', null)).toBe(1)
    })

    it('should compare two valid dates', () => {
      expect(compareDateValues('2024-01-10', '2024-01-15')).toBeLessThan(0)
      expect(compareDateValues('2024-01-15', '2024-01-10')).toBeGreaterThan(0)
      expect(compareDateValues('2024-01-15', '2024-01-15')).toBe(0)
    })
  })

  describe('isBetween', () => {
    it('should return false for null date', () => {
      expect(isBetween(null, '2024-01-01', '2024-12-31')).toBe(false)
    })

    it('should return true when date is in range', () => {
      expect(isBetween('2024-06-15', '2024-01-01', '2024-12-31')).toBe(true)
    })

    it('should return false when date is before from', () => {
      expect(isBetween('2023-06-15', '2024-01-01', '2024-12-31')).toBe(false)
    })

    it('should return false when date is after to', () => {
      expect(isBetween('2025-06-15', '2024-01-01', '2024-12-31')).toBe(false)
    })

    it('should work with no from bound', () => {
      expect(isBetween('2024-06-15', undefined, '2024-12-31')).toBe(true)
    })

    it('should work with no to bound', () => {
      expect(isBetween('2024-06-15', '2024-01-01', undefined)).toBe(true)
    })

    it('should work with no bounds at all', () => {
      expect(isBetween('2024-06-15')).toBe(true)
    })
  })

  describe('isSameDay', () => {
    it('should return true for same day', () => {
      expect(isSameDay('2024-01-15T10:00:00', '2024-01-15T22:00:00')).toBe(true)
    })

    it('should return false for different days', () => {
      expect(isSameDay('2024-01-15', '2024-01-16')).toBe(false)
    })

    it('should return false when either is null', () => {
      expect(isSameDay(null, '2024-01-15')).toBe(false)
      expect(isSameDay('2024-01-15', null)).toBe(false)
    })
  })

  describe('getLocalDateString', () => {
    it('should format date as YYYY-MM-DD', () => {
      const date = new Date(2024, 0, 15)
      expect(getLocalDateString(date)).toBe('2024-01-15')
    })

    it('should pad month and day with zeros', () => {
      const date = new Date(2024, 0, 5)
      expect(getLocalDateString(date)).toBe('2024-01-05')
    })

    it('should use current date when no arg provided', () => {
      const result = getLocalDateString()
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })
  })
})
