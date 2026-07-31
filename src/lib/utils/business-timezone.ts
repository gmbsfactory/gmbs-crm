/**
 * Fuseau horaire metier de reference.
 *
 * Les regles de retard (heure d'arrivee, bascule de journee) sont des regles
 * RH francaises : elles doivent etre evaluees a Paris, jamais dans le fuseau
 * du process. Le runtime serveur (Vercel / serverless) tourne en UTC, donc
 * `Date#getHours()` y vaut 2 h de moins qu'a Paris en heure d'ete et la
 * journee y bascule a 02 h heure locale.
 */
export const BUSINESS_TIMEZONE = 'Europe/Paris'

interface ZonedParts {
  /** Date calendaire dans le fuseau metier, format YYYY-MM-DD */
  dateString: string
  /** 0 = dimanche, 1 = lundi, ... 6 = samedi */
  dayOfWeek: number
  /** Heure sur 24 h (0-23) */
  hours: number
  minutes: number
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
}

// en-CA formate les dates en YYYY-MM-DD, ce qui evite un reassemblage manuel.
const formatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: BUSINESS_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  weekday: 'short',
})

/**
 * Decompose une Date dans le fuseau metier.
 *
 * @param date - Instant a convertir (par defaut : maintenant)
 * @returns Les composantes calendaires telles que vues a Paris
 */
export function getBusinessParts(date: Date = new Date()): ZonedParts {
  const parts = formatter.formatToParts(date)
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? ''

  return {
    dateString: `${get('year')}-${get('month')}-${get('day')}`,
    dayOfWeek: WEEKDAY_INDEX[get('weekday')] ?? 0,
    hours: Number(get('hour')),
    minutes: Number(get('minute')),
  }
}

/**
 * Date calendaire (YYYY-MM-DD) dans le fuseau metier.
 *
 * A utiliser partout ou une "journee de travail" est comparee cote serveur
 * (last_activity_date, last_lateness_date, lateness_email_sent_at...).
 *
 * @param date - Instant a convertir (par defaut : maintenant)
 */
export function getBusinessDateString(date: Date = new Date()): string {
  return getBusinessParts(date).dateString
}
