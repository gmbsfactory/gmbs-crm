/**
 * Utilitaires pour la détection et validation des adresses françaises
 */

/**
 * Limites géographiques de la France métropolitaine
 */
export const FRANCE_BOUNDS = {
  minLat: 41.0,
  maxLat: 51.5,
  minLng: -5.0,
  maxLng: 10.0,
} as const

/**
 * Mots-clés indiquant une adresse hors de France
 */
const NON_FRENCH_HINTS = [
  "belgique",
  "belgium",
  "suisse",
  "switzerland",
  "espagne",
  "spain",
  "italie",
  "italy",
  "royaume-uni",
  "united kingdom",
  "angleterre",
  "england",
  "allemagne",
  "germany",
  "portugal",
  "maroc",
  "morocco",
  "tunisie",
  "tunisia",
  "algérie",
  "algeria",
  "canada",
  "usa",
  "états-unis",
  "etats-unis",
  "united states",
  "luxembourg",
  "pays-bas",
  "netherlands",
  "monaco",
] as const

/**
 * Vérifie si des coordonnées sont dans les limites de la France métropolitaine
 */
export function isInFrance(lat: number, lng: number): boolean {
  return (
    lat >= FRANCE_BOUNDS.minLat &&
    lat <= FRANCE_BOUNDS.maxLat &&
    lng >= FRANCE_BOUNDS.minLng &&
    lng <= FRANCE_BOUNDS.maxLng
  )
}

/**
 * Détermine si une requête semble concerner une adresse française
 * (utilisé pour prioriser le provider API Adresse France)
 */
export function shouldPreferFrance(query: string): boolean {
  const lowered = query.toLowerCase()
  return !NON_FRENCH_HINTS.some((hint) => lowered.includes(hint))
}

/**
 * Enrichit une adresse avec "France" si nécessaire
 * pour améliorer les résultats des providers internationaux
 */
export function enrichAddressWithFrance(query: string): string {
  const normalized = query.toLowerCase().trim()
  const hasFrance =
    normalized.includes("france") ||
    normalized.includes("fr,") ||
    normalized.endsWith(", fr")

  if (!hasFrance && normalized.length > 0) {
    return `${query.trim()}, France`
  }
  return query.trim()
}

