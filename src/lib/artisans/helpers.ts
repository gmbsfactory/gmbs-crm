/**
 * Fonctions utilitaires pour extraire et formater les données artisan
 *
 * Ces helpers permettent d'accéder facilement aux informations normalisées
 */

import type { ArtisanDisplayData } from "./types"

/**
 * Extrait les segments d'adresse d'un artisan
 *
 * @param data - Données normalisées de l'artisan
 * @returns Objet avec les segments d'adresse (rue, code postal, ville)
 *
 * @example
 * ```typescript
 * const address = getAddressSegments(data)
 * console.log(address)
 * // { street: "123 Rue de la Paix", postalCode: "75001", city: "Paris" }
 * ```
 */
export function getAddressSegments(data: ArtisanDisplayData): {
  street: string | null
  postalCode: string | null
  city: string | null
} {
  return {
    street: data.address.street,
    postalCode: data.address.postalCode,
    city: data.address.city,
  }
}

/**
 * Formate l'adresse complète sur une seule ligne
 *
 * @param data - Données normalisées de l'artisan
 * @param separator - Séparateur entre les segments (par défaut: ", ")
 * @returns Adresse formatée ou null si aucune adresse
 *
 * @example
 * ```typescript
 * const formatted = getFormattedAddress(data)
 * // → "123 Rue de la Paix, 75001 Paris"
 *
 * const withCustomSep = getFormattedAddress(data, " - ")
 * // → "123 Rue de la Paix - 75001 Paris"
 * ```
 */
export function getFormattedAddress(
  data: ArtisanDisplayData,
  separator: string = ", "
): string | null {
  const segments = []

  if (data.address.street) {
    segments.push(data.address.street)
  }

  if (data.address.postalCode && data.address.city) {
    segments.push(`${data.address.postalCode} ${data.address.city}`)
  } else if (data.address.postalCode) {
    segments.push(data.address.postalCode)
  } else if (data.address.city) {
    segments.push(data.address.city)
  }

  return segments.length > 0 ? segments.join(separator) : null
}

/**
 * Récupère les informations de statut (label + couleur)
 *
 * @param data - Données normalisées de l'artisan
 * @returns Objet avec label et couleur, ou null si pas de statut
 *
 * @example
 * ```typescript
 * const status = getStatusInfo(data)
 * console.log(status)
 * // { label: "Expert", color: "#22c55e" }
 * ```
 */
export function getStatusInfo(data: ArtisanDisplayData): {
  label: string
  color: string
} | null {
  return data.statusInfo
}

/**
 * Récupère le métier principal de l'artisan
 *
 * @param data - Données normalisées de l'artisan
 * @returns Objet avec id, code et label du métier, ou null
 *
 * @example
 * ```typescript
 * const metier = getPrimaryMetier(data)
 * console.log(metier)
 * // { id: "uuid-123", code: "PLOMBIER", label: "Plombier" }
 * ```
 */
export function getPrimaryMetier(data: ArtisanDisplayData): {
  id: string
  code: string
  label: string
} | null {
  return data.primaryMetier
}

/**
 * Récupère le numéro associé de l'artisan
 *
 * @param data - Données normalisées de l'artisan
 * @returns Numéro associé ou null
 *
 * @example
 * ```typescript
 * const numero = getNumeroAssocie(data)
 * console.log(numero) // → "A12345"
 * ```
 */
export function getNumeroAssocie(data: ArtisanDisplayData): string | null {
  return data.numero_associe
}

/**
 * Récupère la distance en km par rapport à un point de référence
 *
 * @param data - Données normalisées de l'artisan
 * @returns Distance en km ou null si non disponible
 *
 * @example
 * ```typescript
 * const distance = getDistanceKm(data)
 * console.log(distance) // → 12.5
 * ```
 */
export function getDistanceKm(data: ArtisanDisplayData): number | null {
  return data.distanceKm
}

/**
 * Formate la distance pour l'affichage
 *
 * @param data - Données normalisées de l'artisan
 * @param decimals - Nombre de décimales (par défaut: 1)
 * @param unit - Unité à afficher (par défaut: " km")
 * @returns Distance formatée ou null
 *
 * @example
 * ```typescript
 * const formatted = getFormattedDistance(data)
 * // → "12.5 km"
 *
 * const customFormat = getFormattedDistance(data, 2, "km")
 * // → "12.50km"
 * ```
 */
export function getFormattedDistance(
  data: ArtisanDisplayData,
  decimals: number = 1,
  unit: string = " km"
): string | null {
  if (data.distanceKm === null) return null
  return `${data.distanceKm.toFixed(decimals)}${unit}`
}

/**
 * Récupère tous les numéros de téléphone disponibles
 *
 * @param data - Données normalisées de l'artisan
 * @returns Tableau des numéros de téléphone (peut être vide)
 *
 * @example
 * ```typescript
 * const phones = getAllPhones(data)
 * console.log(phones)
 * // ["06 12 34 56 78", "01 23 45 67 89"]
 * ```
 */
export function getAllPhones(data: ArtisanDisplayData): string[] {
  const phones: string[] = []
  if (data.telephone) phones.push(data.telephone)
  if (data.telephone2) phones.push(data.telephone2)
  return phones
}

/**
 * Vérifie si l'artisan a au moins un numéro de téléphone
 *
 * @param data - Données normalisées de l'artisan
 * @returns true si au moins un téléphone existe
 *
 * @example
 * ```typescript
 * if (hasPhone(data)) {
 *   console.log("L'artisan est joignable par téléphone")
 * }
 * ```
 */
export function hasPhone(data: ArtisanDisplayData): boolean {
  return data.telephone !== null || data.telephone2 !== null
}

/**
 * Vérifie si l'artisan a une adresse email
 *
 * @param data - Données normalisées de l'artisan
 * @returns true si un email existe
 *
 * @example
 * ```typescript
 * if (hasEmail(data)) {
 *   console.log("L'artisan est joignable par email")
 * }
 * ```
 */
export function hasEmail(data: ArtisanDisplayData): boolean {
  return data.email !== null
}

/**
 * Vérifie si l'artisan a une adresse complète
 *
 * @param data - Données normalisées de l'artisan
 * @returns true si au moins un segment d'adresse existe
 *
 * @example
 * ```typescript
 * if (hasAddress(data)) {
 *   console.log("Adresse disponible:", getFormattedAddress(data))
 * }
 * ```
 */
export function hasAddress(data: ArtisanDisplayData): boolean {
  return (
    data.address.street !== null ||
    data.address.postalCode !== null ||
    data.address.city !== null
  )
}
