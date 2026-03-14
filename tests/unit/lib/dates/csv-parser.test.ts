/**
 * CSV Date Parser Tests
 *
 * Comprehensive test suite covering:
 * - Normal date formats (DD/MM/YYYY, YYYY-MM-DD)
 * - Dates with time components
 * - Excel serial dates
 * - Edge cases (leap years, century transitions, boundaries)
 * - Invalid inputs and error handling
 * - Date range validation and checking
 */

import { describe, it, expect } from 'vitest'
import {
  parseCSVDate,
  parseCSVDateRange,
  isValidDate,
  stripTimeComponent,
  isInRange,
  createDateRangeFromStrings,
  getDateParseDebugInfo,
} from '@/lib/dates/csv-parser'

describe('CSV Date Parser', () => {
  // ===== PARSECSV DATE - NORMAL FORMATS =====

  describe('parseCSVDate - Normal formats', () => {
    it('should parse DD/MM/YYYY format', () => {
      const date = parseCSVDate('30/12/1899')
      expect(date).toBeInstanceOf(Date)
      expect(date.toISOString()).toBe('1899-12-30T00:00:00.000Z')
    })

    it('should parse DD/MM/YYYY format with leading zeros', () => {
      const date = parseCSVDate('01/01/2025')
      expect(date.toISOString()).toBe('2025-01-01T00:00:00.000Z')
    })

    it('should parse YYYY-MM-DD format', () => {
      const date = parseCSVDate('1899-12-30')
      expect(date).toBeInstanceOf(Date)
      expect(date.toISOString()).toBe('1899-12-30T00:00:00.000Z')
    })

    it('should parse YYYY-MM-DD with leading zeros', () => {
      const date = parseCSVDate('2025-01-01')
      expect(date.toISOString()).toBe('2025-01-01T00:00:00.000Z')
    })
  })

  // ===== PARSECSV DATE - WITH TIME COMPONENTS =====

  describe('parseCSVDate - With time components', () => {
    it('should parse DD/MM/YYYY HH:mm:ss format', () => {
      const date = parseCSVDate('30/12/1899 14:30:45')
      expect(date.toISOString()).toBe('1899-12-30T14:30:45.000Z')
    })

    it('should parse DD/MM/YYYY with midnight time', () => {
      const date = parseCSVDate('30/12/1899 00:00:00')
      expect(date.toISOString()).toBe('1899-12-30T00:00:00.000Z')
    })

    it('should parse YYYY-MM-DD HH:mm:ss format', () => {
      const date = parseCSVDate('1899-12-30 14:30:45')
      expect(date.toISOString()).toBe('1899-12-30T14:30:45.000Z')
    })

    it('should parse YYYY-MM-DD with end-of-day time', () => {
      const date = parseCSVDate('2025-01-15 23:59:59')
      expect(date.toISOString()).toBe('2025-01-15T23:59:59.000Z')
    })

    it('should handle whitespace around time separator', () => {
      const date = parseCSVDate('30/12/1899  14:30:45')
      expect(date.toISOString()).toBe('1899-12-30T14:30:45.000Z')
    })
  })

  // ===== PARSECSV DATE - EXCEL SERIAL DATES =====

  describe('parseCSVDate - Excel serial dates', () => {
    it('should parse Excel serial number as number', () => {
      // 44927 = 2022-12-31
      const date = parseCSVDate(44927)
      expect(date.getUTCFullYear()).toBe(2022)
      expect(date.getUTCMonth()).toBe(11) // December (0-indexed)
      expect(date.getUTCDate()).toBe(31)
    })

    it('should parse Excel serial number as string', () => {
      const date = parseCSVDate('44927')
      expect(date.getUTCFullYear()).toBe(2022)
      expect(date.getUTCMonth()).toBe(11)
      expect(date.getUTCDate()).toBe(31)
    })

    it('should parse Excel serial 1 as 1899-12-31', () => {
      // Excel epoch is 1899-12-30, so 1 = 1899-12-31
      const date = parseCSVDate(1)
      expect(date.toISOString()).toMatch(/1899-12-31/)
    })

    it('should parse large Excel serial numbers (recent dates)', () => {
      // 45000 ≈ 2023-01-01
      const date = parseCSVDate(45000)
      expect(date.getUTCFullYear()).toBe(2023)
      expect(date.getUTCMonth()).toBe(0) // January
    })
  })

  // ===== PARSECSV DATE - EDGE CASES =====

  describe('parseCSVDate - Edge cases', () => {
    it('should parse leap year date (Feb 29)', () => {
      const date = parseCSVDate('29/02/2020')
      expect(date.toISOString()).toBe('2020-02-29T00:00:00.000Z')
    })

    it('should parse century boundary (2000-01-01)', () => {
      const date = parseCSVDate('01/01/2000')
      expect(date.toISOString()).toBe('2000-01-01T00:00:00.000Z')
    })

    it('should parse century transition (1999-12-31)', () => {
      const date = parseCSVDate('31/12/1999')
      expect(date.toISOString()).toBe('1999-12-31T00:00:00.000Z')
    })

    it('should parse year 1700 (lower boundary)', () => {
      const date = parseCSVDate('01/01/1700')
      expect(date.getUTCFullYear()).toBe(1700)
    })

    it('should parse year 2100 (upper boundary)', () => {
      const date = parseCSVDate('31/12/2100')
      expect(date.getUTCFullYear()).toBe(2100)
    })

    it('should handle single-digit day/month with leading zero', () => {
      const date = parseCSVDate('05/03/2025')
      expect(date.toISOString()).toBe('2025-03-05T00:00:00.000Z')
    })
  })

  // ===== PARSECSV DATE - INVALID INPUTS =====

  describe('parseCSVDate - Invalid inputs', () => {
    it('should throw on null', () => {
      expect(() => parseCSVDate(null)).toThrow()
    })

    it('should throw on undefined', () => {
      expect(() => parseCSVDate(undefined)).toThrow()
    })

    it('should throw on empty string', () => {
      expect(() => parseCSVDate('')).toThrow()
    })

    it('should throw on whitespace-only string', () => {
      expect(() => parseCSVDate('   ')).toThrow()
    })

    it('should throw on malformed DD/MM/YYYY', () => {
      expect(() => parseCSVDate('32/13/2025')).toThrow('Invalid date')
    })

    it('should throw on invalid month', () => {
      expect(() => parseCSVDate('15/13/2025')).toThrow('Invalid date')
    })

    it('should throw on Feb 30', () => {
      expect(() => parseCSVDate('30/02/2025')).toThrow('Invalid date')
    })

    it('should throw on malformed YYYY-MM-DD', () => {
      expect(() => parseCSVDate('2025-13-01')).toThrow('Invalid date')
    })

    it('should throw on invalid time component', () => {
      expect(() => parseCSVDate('30/12/1899 25:00:00')).toThrow()
    })

    it('should throw on completely invalid format', () => {
      expect(() => parseCSVDate('not a date')).toThrow('Cannot parse date')
    })

    it('should throw on negative Excel serial number', () => {
      expect(() => parseCSVDate(-100)).toThrow()
    })

    it('should throw on zero Excel serial number', () => {
      expect(() => parseCSVDate(0)).toThrow()
    })

    it('should throw on non-finite numbers (Infinity, NaN)', () => {
      expect(() => parseCSVDate(Infinity)).toThrow()
      expect(() => parseCSVDate(NaN)).toThrow()
    })

    it('should throw on object input', () => {
      expect(() => parseCSVDate({})).toThrow('Cannot parse date')
    })

    it('should throw on array input', () => {
      expect(() => parseCSVDate(['30', '12', '1899'])).toThrow()
    })
  })

  // ===== ISVALIDDATE =====

  describe('isValidDate', () => {
    it('should return true for valid Date', () => {
      expect(isValidDate(new Date('2025-01-15'))).toBe(true)
    })

    it('should return true for parsed CSV date', () => {
      const date = parseCSVDate('30/12/1899')
      expect(isValidDate(date)).toBe(true)
    })

    it('should return false for Invalid Date', () => {
      expect(isValidDate(new Date('invalid'))).toBe(false)
    })

    it('should return false for null', () => {
      expect(isValidDate(null)).toBe(false)
    })

    it('should return false for undefined', () => {
      expect(isValidDate(undefined)).toBe(false)
    })

    it('should return false for string', () => {
      expect(isValidDate('2025-01-15')).toBe(false)
    })

    it('should return false for number', () => {
      expect(isValidDate(2025)).toBe(false)
    })

    it('should return false for object', () => {
      expect(isValidDate({})).toBe(false)
    })

    it('should return false for date before 1700', () => {
      const date = new Date('1600-01-01T00:00:00Z')
      expect(isValidDate(date)).toBe(false)
    })

    it('should return false for date after 2100', () => {
      const date = new Date('2200-01-01T00:00:00Z')
      expect(isValidDate(date)).toBe(false)
    })
  })

  // ===== STRIPTIMECOMPONENT =====

  describe('stripTimeComponent', () => {
    it('should strip time and normalize to midnight UTC', () => {
      const date = new Date('2025-01-15T14:30:45.123Z')
      const stripped = stripTimeComponent(date)
      expect(stripped.toISOString()).toBe('2025-01-15T00:00:00.000Z')
    })

    it('should handle date already at midnight', () => {
      const date = new Date('2025-01-15T00:00:00Z')
      const stripped = stripTimeComponent(date)
      expect(stripped.toISOString()).toBe('2025-01-15T00:00:00.000Z')
    })

    it('should return new Date instance (immutable)', () => {
      const original = new Date('2025-01-15T14:30:45Z')
      const stripped = stripTimeComponent(original)
      expect(stripped).not.toBe(original)
      expect(original.getUTCHours()).toBe(14) // Original unchanged
      expect(stripped.getUTCHours()).toBe(0) // Stripped version at midnight
    })

    it('should throw for invalid date', () => {
      expect(() => stripTimeComponent(new Date('invalid'))).toThrow()
    })
  })

  // ===== PARSECSVDATERANGE =====

  describe('parseCSVDateRange', () => {
    it('should parse valid date range', () => {
      const range = parseCSVDateRange('01/01/2025', '31/12/2025')
      expect(range.start.toISOString()).toBe('2025-01-01T00:00:00.000Z')
      expect(range.end.toISOString()).toBe('2025-12-31T00:00:00.000Z')
    })

    it('should parse range with same start and end', () => {
      const range = parseCSVDateRange('15/01/2025', '15/01/2025')
      expect(range.start).toEqual(range.end)
    })

    it('should parse range with YYYY-MM-DD format', () => {
      const range = parseCSVDateRange('2025-01-01', '2025-12-31')
      expect(range.start.getUTCFullYear()).toBe(2025)
      expect(range.end.getUTCFullYear()).toBe(2025)
    })

    it('should parse range with mixed formats', () => {
      const range = parseCSVDateRange('01/01/2025', '2025-12-31')
      expect(range.start.getUTCMonth()).toBe(0) // January
      expect(range.end.getUTCMonth()).toBe(11) // December
    })

    it('should throw when start > end', () => {
      expect(() =>
        parseCSVDateRange('31/12/2025', '01/01/2025')
      ).toThrow('Invalid date range')
    })

    it('should throw on invalid start date', () => {
      expect(() => parseCSVDateRange('invalid', '31/12/2025')).toThrow()
    })

    it('should throw on invalid end date', () => {
      expect(() => parseCSVDateRange('01/01/2025', 'invalid')).toThrow()
    })
  })

  // ===== ISINRANGE =====

  describe('isInRange', () => {
    const range = {
      start: new Date('2025-01-01T00:00:00Z'),
      end: new Date('2025-12-31T23:59:59Z'),
    }

    it('should return true for date in range', () => {
      const date = new Date('2025-06-15T12:00:00Z')
      expect(isInRange(date, range)).toBe(true)
    })

    it('should return true for date at range start (inclusive)', () => {
      expect(isInRange(range.start, range)).toBe(true)
    })

    it('should return true for date at range end (inclusive)', () => {
      expect(isInRange(range.end, range)).toBe(true)
    })

    it('should return false for date before range', () => {
      const date = new Date('2024-12-31T23:59:59Z')
      expect(isInRange(date, range)).toBe(false)
    })

    it('should return false for date after range', () => {
      const date = new Date('2026-01-01T00:00:00Z')
      expect(isInRange(date, range)).toBe(false)
    })

    it('should throw for invalid date', () => {
      const invalidDate = new Date('invalid')
      expect(() => isInRange(invalidDate, range)).toThrow()
    })
  })

  // ===== CREATEDATERANGEFROMSTRINGS =====

  describe('createDateRangeFromStrings', () => {
    it('should return DateRange on success', () => {
      const range = createDateRangeFromStrings('01/01/2025', '31/12/2025')
      expect(range).not.toBeNull()
      expect(range?.start.getUTCMonth()).toBe(0)
      expect(range?.end.getUTCMonth()).toBe(11)
    })

    it('should return null on parsing error', () => {
      const range = createDateRangeFromStrings('invalid', '31/12/2025')
      expect(range).toBeNull()
    })

    it('should return null if start > end', () => {
      const range = createDateRangeFromStrings('31/12/2025', '01/01/2025')
      expect(range).toBeNull()
    })

    it('should return null for null/undefined inputs', () => {
      expect(createDateRangeFromStrings(null, '31/12/2025')).toBeNull()
      expect(createDateRangeFromStrings('01/01/2025', undefined)).toBeNull()
    })
  })

  // ===== GETDATEPARSEDEBUGINFO =====

  describe('getDateParseDebugInfo', () => {
    it('should return debug info for failed parse', () => {
      const error = new Error('Cannot parse date')
      const debug = getDateParseDebugInfo('invalid-date', error)

      expect(debug.input).toBe('invalid-date')
      expect(debug.inputType).toBe('string')
      expect(debug.error).toBe('Cannot parse date')
      expect(debug.timestamp).toBeDefined()
    })

    it('should include input type information', () => {
      const error = new Error('Invalid')
      const debugNum = getDateParseDebugInfo(12345, error)
      const debugStr = getDateParseDebugInfo('12345', error)

      expect(debugNum.inputType).toBe('number')
      expect(debugStr.inputType).toBe('string')
    })

    it('should indicate array input', () => {
      const error = new Error('Invalid')
      const debug = getDateParseDebugInfo(['30', '12', '1899'], error)

      expect(debug.inputIsArray).toBe(true)
      expect(debug.inputLength).toBeDefined()
    })
  })

  // ===== INTEGRATION TESTS =====

  describe('Integration - CSV Import scenarios', () => {
    it('should handle mixed date formats in CSV import', () => {
      const csvValues = [
        '30/12/1899',
        '2025-01-15',
        '15/03/2025 14:30:45',
        44927,
      ]

      const dates = csvValues.map((value) => {
        expect(() => parseCSVDate(value)).not.toThrow()
        return parseCSVDate(value)
      })

      expect(dates).toHaveLength(4)
      expect(dates.every((d) => isValidDate(d))).toBe(true)
    })

    it('should filter CSV rows by date range', () => {
      const csvData = [
        { date: '01/01/2025', name: 'Row 1' },
        { date: '15/06/2025', name: 'Row 2' },
        { date: '31/12/2025', name: 'Row 3' },
        { date: '15/01/2026', name: 'Row 4' },
      ]

      const range = parseCSVDateRange('01/01/2025', '31/12/2025')

      const filtered = csvData.filter(({ date }) => {
        const parsed = parseCSVDate(date)
        return isInRange(parsed, range)
      })

      expect(filtered).toHaveLength(3)
      expect(filtered.map((r) => r.name)).toEqual(['Row 1', 'Row 2', 'Row 3'])
    })

    it('should normalize dates for consistent storage', () => {
      const csvDate1 = '30/12/1899 14:30:45'
      const csvDate2 = '1899-12-30 09:15:00'

      const parsed1 = stripTimeComponent(parseCSVDate(csvDate1))
      const parsed2 = stripTimeComponent(parseCSVDate(csvDate2))

      // Both should normalize to midnight on same day
      expect(parsed1.toISOString()).toBe(parsed2.toISOString())
    })
  })
})
