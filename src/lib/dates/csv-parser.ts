/**
 * CSV Date Parser - Production-Grade CSV Date Handling
 *
 * Handles multiple date formats from CSV/Excel imports with:
 * - Explicit validation (no silent failures)
 * - Excel serial date support (1899-12-30 epoch)
 * - Timezone awareness (UTC internally)
 * - Clear error messages for debugging
 * - Edge case handling (leap years, century transitions)
 *
 * Usage:
 *   const date = parseCSVDate("30/12/1899")     // throws if invalid
 *   const isValid = isValidDate(someDate)        // safe, no throw
 *   const range = parseCSVDateRange(start, end)  // throws if invalid
 *   const stripped = stripTimeComponent(date)    // normalize to midnight UTC
 *   const inRange = isInRange(date, range)       // range check
 */

import { DateFormat, type DateRange, type DateValidationContext } from '@/types/dates'

/**
 * Excel's epoch date (1899-12-30)
 * Excel dates are days since this date
 */
const EXCEL_EPOCH = new Date('1899-12-30T00:00:00Z')
const EXCEL_EPOCH_TIME = EXCEL_EPOCH.getTime()

/**
 * Parse a CSV date value with automatic format detection
 *
 * Supports:
 * - DD/MM/YYYY (e.g., "30/12/1899")
 * - DD/MM/YYYY HH:mm:ss (e.g., "30/12/1899 14:30:45")
 * - YYYY-MM-DD (e.g., "1899-12-30")
 * - YYYY-MM-DD HH:mm:ss (e.g., "1899-12-30 14:30:45")
 * - Excel serial numbers (e.g., 44927)
 *
 * @param value - The value to parse (string or number from CSV)
 * @returns Date in UTC
 * @throws Error with clear message on parse failure
 *
 * @example
 *   const date = parseCSVDate("30/12/1899")
 *   const dateWithTime = parseCSVDate("30/12/1899 00:00:00")
 *   const excelDate = parseCSVDate(44927)
 */
export function parseCSVDate(value: unknown): Date {
  const context: DateValidationContext = { inputValue: value }

  // Null/undefined check
  if (value == null) {
    throw new Error(
      `Cannot parse date: value is ${value === null ? 'null' : 'undefined'}`
    )
  }

  // Trim if string
  const trimmed =
    typeof value === 'string' ? value.trim() : String(value).trim()

  if (trimmed === '') {
    throw new Error('Cannot parse date: empty string')
  }

  // Try Excel serial number (numeric)
  if (typeof value === 'number' || /^\d+$/.test(trimmed)) {
    const serial = Number(trimmed)
    if (!Number.isNaN(serial) && serial > 0) {
      const parsed = parseExcelSerialDate(serial)
      if (parsed) return parsed
    }
  }

  // Try DD/MM/YYYY with or without time
  // Matches: 30/12/1899 or 30/12/1899 14:30:45
  const euMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}):(\d{2}))?/)
  if (euMatch) {
    context.attemptedFormat = euMatch[4] ? DateFormat.EU_SLASH_TIME : DateFormat.EU_SLASH
    const day = euMatch[1]
    const month = euMatch[2]
    const year = euMatch[3]
    const hour = euMatch[4] ?? '00'
    const minute = euMatch[5] ?? '00'
    const second = euMatch[6] ?? '00'

    const isoString = `${year}-${month}-${day}T${hour}:${minute}:${second}Z`
    const parsed = new Date(isoString)
    context.parsed = parsed

    // Validate the parsed date
    if (!isValidDate(parsed)) {
      throw new Error(
        `Invalid date: ${trimmed} parses to invalid date ${isoString}. ` +
          `Check month (01-12) and day are valid for the year.`
      )
    }

    return parsed
  }

  // Try YYYY-MM-DD with or without time
  // Matches: 1899-12-30 or 1899-12-30 14:30:45
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{2}):(\d{2}):(\d{2}))?/)
  if (isoMatch) {
    context.attemptedFormat = isoMatch[4] ? DateFormat.ISO_DATETIME : DateFormat.ISO_DATE
    const year = isoMatch[1]
    const month = isoMatch[2]
    const day = isoMatch[3]
    const hour = isoMatch[4] ?? '00'
    const minute = isoMatch[5] ?? '00'
    const second = isoMatch[6] ?? '00'

    const isoString = `${year}-${month}-${day}T${hour}:${minute}:${second}Z`
    const parsed = new Date(isoString)
    context.parsed = parsed

    if (!isValidDate(parsed)) {
      throw new Error(
        `Invalid date: ${trimmed} parses to invalid date ${isoString}. ` +
          `Check month (01-12) and day are valid for the year.`
      )
    }

    return parsed
  }

  // No format matched
  throw new Error(
    `Cannot parse date from "${trimmed}". Expected formats: DD/MM/YYYY, YYYY-MM-DD, ` +
      `or Excel serial number. Include time with HH:mm:ss if needed (e.g., "30/12/1899 14:30:45").`
  )
}

/**
 * Parse a date range from start and end values
 *
 * Both dates must be valid and start <= end
 *
 * @param start - Start date (any supported format)
 * @param end - End date (any supported format)
 * @returns DateRange object with validated dates
 * @throws Error if parsing fails or start > end
 *
 * @example
 *   const range = parseCSVDateRange("01/01/2025", "31/12/2025")
 */
export function parseCSVDateRange(start: unknown, end: unknown): DateRange {
  const startDate = parseCSVDate(start)
  const endDate = parseCSVDate(end)

  if (startDate > endDate) {
    throw new Error(
      `Invalid date range: start (${startDate.toISOString()}) ` +
        `is after end (${endDate.toISOString()})`
    )
  }

  return { start: startDate, end: endDate }
}

/**
 * Check if a value is a valid Date object
 *
 * Safe validation that doesn't throw. Returns false for:
 * - null/undefined
 * - non-Date objects
 * - Invalid Date instances (NaN time value)
 * - Dates outside reasonable range (before 1700 or after 2100)
 *
 * @param date - Value to check
 * @returns true if valid Date, false otherwise
 *
 * @example
 *   isValidDate(new Date())              // true
 *   isValidDate(new Date('invalid'))     // false
 *   isValidDate(null)                    // false
 */
export function isValidDate(date: unknown): boolean {
  if (!(date instanceof Date)) return false

  const time = date.getTime()
  if (Number.isNaN(time)) return false

  // Check reasonable bounds (1700-2100)
  // Adjust if needed for your domain
  const year = date.getUTCFullYear()
  if (year < 1700 || year > 2100) return false

  return true
}

/**
 * Strip time component from a date
 *
 * Normalizes a date to midnight (00:00:00.000) in UTC
 *
 * @param date - Date to normalize
 * @returns New Date at midnight UTC
 * @throws Error if date is invalid
 *
 * @example
 *   stripTimeComponent(new Date('2025-01-15T14:30:45Z'))
 *   // Returns: 2025-01-15T00:00:00Z
 */
export function stripTimeComponent(date: Date): Date {
  if (!isValidDate(date)) {
    throw new Error(`Cannot strip time from invalid date: ${date}`)
  }

  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      0,
      0,
      0,
      0
    )
  )
}

/**
 * Check if a date falls within a range
 *
 * Inclusive on both boundaries (start <= date <= end)
 *
 * @param date - Date to check
 * @param range - DateRange to check against
 * @returns true if date is in range, false otherwise
 * @throws Error if date is invalid
 *
 * @example
 *   const range = { start: new Date('2025-01-01'), end: new Date('2025-12-31') }
 *   isInRange(new Date('2025-06-15'), range)  // true
 */
export function isInRange(date: Date, range: DateRange): boolean {
  if (!isValidDate(date)) {
    throw new Error(`Cannot check range for invalid date: ${date}`)
  }

  const time = date.getTime()
  return time >= range.start.getTime() && time <= range.end.getTime()
}

/**
 * Create a DateRange from string values
 *
 * Convenience function that parses both start and end dates
 *
 * @param startStr - Start date string
 * @param endStr - End date string
 * @returns DateRange or null if parsing fails
 *
 * @example
 *   const range = createDateRangeFromStrings("01/01/2025", "31/12/2025")
 *   if (range) {
 *     console.log(range.start)  // 2025-01-01T00:00:00Z
 *   }
 */
export function createDateRangeFromStrings(
  startStr: unknown,
  endStr: unknown
): DateRange | null {
  try {
    return parseCSVDateRange(startStr, endStr)
  } catch {
    return null
  }
}

/**
 * Parse an Excel serial date number
 *
 * Excel serial dates are days since 1899-12-30
 * - 1 = 1899-12-31
 * - 44927 = 2022-12-31
 * - 45000+ = 2023-01-01+
 *
 * @param serial - Excel serial number
 * @returns Parsed Date or null if invalid
 */
function parseExcelSerialDate(serial: number): Date | null {
  // Validate: must be positive number
  if (!Number.isFinite(serial) || serial <= 0) {
    return null
  }

  // Excel dates are days since 1899-12-30, but use 1-based indexing
  // So serial 1 = 1899-12-31
  const milliseconds = (serial - 1) * 24 * 60 * 60 * 1000
  const date = new Date(EXCEL_EPOCH_TIME + milliseconds)

  // Validate the result
  return isValidDate(date) ? date : null
}

/**
 * Get debug information about a date parse error
 *
 * Useful for logging and troubleshooting CSV import issues
 *
 * @param value - The value that failed to parse
 * @param error - The Error thrown by parseCSVDate
 * @returns Debug info object
 *
 * @example
 *   try {
 *     parseCSVDate(invalidValue)
 *   } catch (error) {
 *     const debug = getDateParseDebugInfo(invalidValue, error as Error)
 *     console.error(`Failed to parse: ${debug.message}`)
 *   }
 */
export function getDateParseDebugInfo(
  value: unknown,
  error: Error
): Record<string, unknown> {
  return {
    input: value,
    inputType: typeof value,
    inputIsArray: Array.isArray(value),
    inputLength: typeof value === 'string' ? value.length : undefined,
    error: error.message,
    timestamp: new Date().toISOString(),
  }
}
