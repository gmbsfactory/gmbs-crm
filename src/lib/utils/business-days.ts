import { getBusinessParts } from './business-timezone'

/**
 * Checks if a given date is a business day (Monday-Friday) in the business
 * timezone (Europe/Paris)
 * Excludes weekends but does not account for holidays
 *
 * @param date - The date to check
 * @returns true if the date is a weekday (Mon-Fri) in Paris, false otherwise
 */
export function isBusinessDay(date: Date): boolean {
  const { dayOfWeek } = getBusinessParts(date) // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  return dayOfWeek >= 1 && dayOfWeek <= 5 // Monday (1) to Friday (5)
}

/**
 * Checks if the given instant is after 10:00 AM in the business timezone
 * (Europe/Paris), regardless of the server's own timezone
 *
 * @param date - The date to check (defaults to now)
 * @returns true if time is >= 10:00 AM in Paris
 */
export function isAfter10AM(date: Date = new Date()): boolean {
  const { hours } = getBusinessParts(date)
  return hours >= 10
}

/**
 * Combined check: is it a business day AND after 10:00 AM (Paris time)?
 * Used to determine if a login should be counted as "late"
 *
 * @param date - The date to check (defaults to now)
 * @returns true if it's a weekday after 10:00 AM in Paris
 */
export function isLateLogin(date: Date = new Date()): boolean {
  return isBusinessDay(date) && isAfter10AM(date)
}

export { BUSINESS_TIMEZONE, getBusinessDateString } from './business-timezone'
