/**
 * Date handling type definitions
 * Provides interfaces for parsing results, date ranges, and formatting options
 */

/**
 * Result type for date parsing operations
 * Follows the { success: boolean, data?, error? } pattern
 */
export interface DateParseResult<T = Date> {
  success: boolean
  data?: T
  error?: {
    message: string
    code: string
    context?: Record<string, unknown>
  }
}

/**
 * Supported date input formats
 */
export enum DateFormat {
  /** DD/MM/YYYY */
  EU_SLASH = 'DD/MM/YYYY',
  /** DD/MM/YYYY HH:mm:ss */
  EU_SLASH_TIME = 'DD/MM/YYYY HH:mm:ss',
  /** YYYY-MM-DD */
  ISO_DATE = 'YYYY-MM-DD',
  /** YYYY-MM-DD HH:mm:ss */
  ISO_DATETIME = 'YYYY-MM-DD HH:mm:ss',
  /** Excel serial number (e.g., 44927 = 2022-12-31) */
  EXCEL_SERIAL = 'EXCEL_SERIAL',
}

/**
 * Date range with optional timezone information
 */
export interface DateRange {
  start: Date
  end: Date
  timezone?: string // IANA timezone (e.g., 'Europe/Paris')
}

/**
 * Options for formatting dates
 */
export interface DateFormatOptions {
  /** Locale for formatting (default: 'en-US') */
  locale?: string
  /** IANA timezone for display (default: system timezone) */
  timezone?: string
  /** Include time in output (default: false) */
  includeTime?: boolean
}

/**
 * Context for validation errors (for debugging and logging)
 */
export interface DateValidationContext {
  inputValue: unknown
  attemptedFormat?: DateFormat
  parsed?: Date
  reason?: string
}
