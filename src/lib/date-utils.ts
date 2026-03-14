export function toDate(value: unknown): Date | null {
  if (!value) return null
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }
  if (typeof value === "number") {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
  }
  if (typeof value === "string") {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
  }
  return null
}

export function compareDateValues(a: unknown, b: unknown): number {
  const da = toDate(a)
  const db = toDate(b)
  if (!da && !db) return 0
  if (!da) return -1
  if (!db) return 1
  return da.getTime() - db.getTime()
}

export function isBetween(date: unknown, from?: unknown, to?: unknown): boolean {
  const value = toDate(date)
  const fromDate = toDate(from ?? null)
  const toDateValue = toDate(to ?? null)
  if (!value) return false
  if (fromDate && value.getTime() < fromDate.getTime()) return false
  if (toDateValue && value.getTime() > toDateValue.getTime()) return false
  return true
}

export function isSameDay(a: unknown, b: unknown): boolean {
  const da = toDate(a)
  const db = toDate(b)
  if (!da || !db) return false
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  )
}

/**
 * Converts a Date to a local date string in YYYY-MM-DD format.
 * Uses the local timezone to ensure consistency with user's actual time.
 * 
 * @param date - The date to convert (defaults to now)
 * @returns Date string in YYYY-MM-DD format using local timezone
 */
export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Re-export CSV parser functions for convenient access
export {
  parseCSVDate,
  parseCSVDateRange,
  isValidDate,
  stripTimeComponent,
  isInRange,
  createDateRangeFromStrings,
  getDateParseDebugInfo,
} from './dates/csv-parser'
export type { DateRange, DateFormat, DateFormatOptions, DateValidationContext } from '@/types/dates'
