import { getDay } from 'date-fns'

/**
 * Checks if a given date is a business day (Monday-Friday)
 * Excludes weekends but does not account for holidays
 *
 * @param date - The date to check
 * @returns true if the date is a weekday (Mon-Fri), false otherwise
 */
export function isBusinessDay(date: Date): boolean {
  const dayOfWeek = getDay(date) // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  return dayOfWeek >= 1 && dayOfWeek <= 5 // Monday (1) to Friday (5)
}

/**
 * Checks if current time is after 10:00 AM
 *
 * @param date - The date to check (defaults to now)
 * @returns true if time is >= 10:00 AM
 */
export function isAfter10AM(date: Date = new Date()): boolean {
  const hours = date.getHours()
  return hours >= 10
}

/**
 * Combined check: is it a business day AND after 10:00 AM?
 * Used to determine if a login should be counted as "late"
 *
 * @param date - The date to check (defaults to now)
 * @returns true if it's a weekday after 10:00 AM
 */
export function isLateLogin(date: Date = new Date()): boolean {
  return isBusinessDay(date) && isAfter10AM(date)
}
