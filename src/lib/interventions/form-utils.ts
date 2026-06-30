// ===== UTILITAIRES PARTAGÉS PAR LES FORMULAIRES D'INTERVENTION =====

import type { NearbyArtisan } from "@/hooks/useNearbyArtisans"
import type { ArtisanSearchResult } from "@/lib/artisans/types"
import { parseAddressLabel } from "@/lib/geocode/address-parts"

/**
 * Formate une distance en km pour l'affichage
 */
export function formatDistanceKm(value: number): string {
  if (!Number.isFinite(value)) return "—"
  if (value < 1) return "< 1 km"
  if (value < 10) return `${value.toFixed(1)} km`
  return `${Math.round(value)} km`
}

/**
 * Convertit une couleur hexadécimale en rgba
 */
export function hexToRgba(hex: string, alpha: number): string | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return null
  const r = parseInt(result[1], 16)
  const g = parseInt(result[2], 16)
  const b = parseInt(result[3], 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/**
 * Parse une adresse française complète pour en extraire rue, code postal et ville.
 *
 * Délègue à `parseAddressLabel` (source de vérité partagée), qui gère aussi bien
 * le format virgulé que le format BAN « rue CP ville » sans séparateur.
 *
 * @see parseAddressLabel dans `@/lib/geocode/address-parts`
 */
export function parseAddress(fullAddress: string): { street: string; postalCode: string; city: string } {
  return parseAddressLabel(fullAddress)
}

// Compteur pour garantir l'unicité même si Date.now() est identique
let autoIdCounter = 0

/**
 * Génère un identifiant d'intervention automatique unique
 * Format: AUTO-{timestamp}-{random}-{counter}-{uuid}
 */
export function generateAutoInterventionId(): string {
  const timestampSegment = Date.now().toString().slice(-6)
  const randomSegment = Math.floor(Math.random() * 100000)
    .toString()
    .padStart(5, "0")
  autoIdCounter = (autoIdCounter + 1) % 100000
  const counterSegment = autoIdCounter.toString().padStart(5, "0")
  const uuidSegment = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10)
  return `AUTO-${timestampSegment}-${randomSegment}-${counterSegment}-${uuidSegment}`
}

/**
 * Construit le displayName d'un artisan à partir d'un ArtisanSearchResult
 */
export function getArtisanDisplayName(artisan: ArtisanSearchResult): string {
  return artisan.raison_sociale
    || artisan.plain_nom
    || [artisan.prenom, artisan.nom].filter(Boolean).join(" ")
    || "Artisan sans nom"
}

/**
 * Convertit un ArtisanSearchResult en NearbyArtisan format
 * Utilisé quand un artisan sélectionné via la recherche n'est pas dans la liste de proximité
 */
/**
 * Convertit un artisan issu du join intervention_artisans (DB) en NearbyArtisan format
 * Utilisé pour afficher un artisan assigné même s'il n'est pas dans la liste de proximité
 */
export function dbArtisanToNearbyArtisan(
  artisan: {
    id: string
    prenom?: string | null
    nom?: string | null
    plain_nom?: string | null
    raison_sociale?: string | null
    telephone?: string | null
    telephone2?: string | null
    email?: string | null
  } | null | undefined
): NearbyArtisan | null {
  if (!artisan) return null
  const displayName = artisan.plain_nom
    || [artisan.prenom, artisan.nom].filter(Boolean).join(" ")
    || "Artisan sans nom"
  return {
    id: artisan.id,
    displayName,
    distanceKm: 0,
    telephone: artisan.telephone || null,
    telephone2: artisan.telephone2 || null,
    email: artisan.email || null,
    adresse: null,
    ville: null,
    codePostal: null,
    lat: 0,
    lng: 0,
    prenom: artisan.prenom || null,
    nom: artisan.nom || null,
    raison_sociale: artisan.raison_sociale || null,
    statut_id: null,
    photoProfilMetadata: null,
  }
}

export function artisanSearchResultToNearbyArtisan(
  artisan: ArtisanSearchResult,
  displayName: string
): NearbyArtisan {
  return {
    id: artisan.id,
    displayName: displayName,
    distanceKm: 0,
    telephone: artisan.telephone || null,
    telephone2: artisan.telephone2 || null,
    email: artisan.email || null,
    adresse: artisan.adresse_intervention || artisan.adresse_siege_social || null,
    ville: artisan.ville_intervention || artisan.ville_siege_social || null,
    codePostal: artisan.code_postal_intervention || artisan.code_postal_siege_social || null,
    lat: 0,
    lng: 0,
    prenom: artisan.prenom || null,
    nom: artisan.nom || null,
    raison_sociale: artisan.raison_sociale || null,
    statut_id: artisan.statut_id || null,
    photoProfilMetadata: null,
  }
}
