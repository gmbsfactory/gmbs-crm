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

/** Heure limite d'arrivee par defaut, en heure de Paris. */
export const DEFAULT_ARRIVAL_TIME: ArrivalTime = { hour: 10, minute: 0 }

/** Heure limite d'arrivee, exprimee dans le fuseau metier (Europe/Paris). */
export interface ArrivalTime {
  /** 0-23 */
  hour: number
  /** 0-59 */
  minute: number
}

/**
 * Normalise une heure d'arrivee potentiellement absente ou invalide.
 * Toute valeur hors bornes retombe sur la valeur par defaut plutot que de
 * produire un seuil aberrant (ex. un retard compte des minuit).
 */
export function normalizeArrivalTime(arrival?: Partial<ArrivalTime> | null): ArrivalTime {
  const hour = Number(arrival?.hour)
  const minute = Number(arrival?.minute)

  return {
    hour: Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : DEFAULT_ARRIVAL_TIME.hour,
    minute: Number.isInteger(minute) && minute >= 0 && minute <= 59 ? minute : DEFAULT_ARRIVAL_TIME.minute,
  }
}

/**
 * Checks if the given instant is at or after the configured arrival time in the
 * business timezone (Europe/Paris), regardless of the server's own timezone
 *
 * @param date - The date to check (defaults to now)
 * @param arrival - Heure limite d'arrivee (defaut : 10h00)
 * @returns true if time is >= arrival time in Paris
 */
export function isAfterArrivalTime(
  date: Date = new Date(),
  arrival: ArrivalTime = DEFAULT_ARRIVAL_TIME,
): boolean {
  const { hours, minutes } = getBusinessParts(date)
  const { hour, minute } = normalizeArrivalTime(arrival)

  return hours * 60 + minutes >= hour * 60 + minute
}

/**
 * Combined check: is it a business day AND at/after the arrival time (Paris time)?
 * Used to determine if a login should be counted as "late"
 *
 * @param date - The date to check (defaults to now)
 * @param arrival - Heure limite d'arrivee (defaut : 10h00)
 * @returns true if it's a weekday at/after the arrival time in Paris
 */
export function isLateLogin(
  date: Date = new Date(),
  arrival: ArrivalTime = DEFAULT_ARRIVAL_TIME,
): boolean {
  return isBusinessDay(date) && isAfterArrivalTime(date, arrival)
}

/**
 * Minutes de retard par rapport a l'heure d'arrivee, en heure de Paris.
 * Meme source de verite que `isLateLogin` : le libelle de l'email et la
 * decision de compter un retard ne peuvent plus diverger.
 *
 * @returns Un nombre positif si en retard, negatif ou nul sinon
 */
export function getLatenessMinutes(
  date: Date = new Date(),
  arrival: ArrivalTime = DEFAULT_ARRIVAL_TIME,
): number {
  const { hours, minutes } = getBusinessParts(date)
  const { hour, minute } = normalizeArrivalTime(arrival)

  return hours * 60 + minutes - (hour * 60 + minute)
}

export { BUSINESS_TIMEZONE, getBusinessDateString } from './business-timezone'
