/**
 * Types pour l'affichage unifié des artisans dans l'application
 *
 * Ce module définit les interfaces communes pour normaliser l'affichage
 * des artisans provenant de différentes sources (NearbyArtisan, ArtisanSearchResult, etc.)
 */

import type { NearbyArtisan } from "@/lib/api/common/types"

/**
 * Résultat de recherche d'artisan (défini ici pour éviter un import circulaire
 * depuis le composant lourd ArtisanSearchModal qui charge tous les modules API)
 */
export interface ArtisanSearchResult {
  id: string
  prenom?: string | null
  nom?: string | null
  plain_nom?: string | null
  raison_sociale?: string | null
  email?: string | null
  telephone?: string | null
  telephone2?: string | null
  numero_associe?: string | null
  adresse_intervention?: string | null
  ville_intervention?: string | null
  code_postal_intervention?: string | null
  adresse_siege_social?: string | null
  ville_siege_social?: string | null
  code_postal_siege_social?: string | null
  statut_id?: string | null
  is_active?: boolean | null
  status?: {
    id: string
    code: string
    label: string
    color?: string | null
  } | null
  metiers?: Array<{
    is_primary: boolean
    metier: {
      id: string
      code: string
      label: string
    }
  }> | null
  distanceKm?: number
}

/**
 * Avatar metadata for artisan profile picture
 */
export interface AvatarMetadata {
  hash: string | null
  sizes: Record<string, string>
  mime_preferred: string
  baseUrl: string | null
}

/**
 * Union type pour toutes les sources possibles de données artisan
 */
export type ArtisanDisplaySource = NearbyArtisan | ArtisanSearchResult

/**
 * Interface normalisée pour l'affichage des données artisan
 * Tous les champs sont extraits et unifiés depuis les différentes sources
 */
export interface ArtisanDisplayData {
  // ===== Identité =====
  /** Prénom de l'artisan */
  prenom: string | null

  /** Nom de l'artisan */
  nom: string | null

  /** Nom complet formaté (ex: "DUPONT Jean") */
  plain_nom: string | null

  /** Raison sociale de l'entreprise */
  raison_sociale: string | null

  // ===== Contact =====
  /** Numéro de téléphone principal */
  telephone: string | null

  /** Numéro de téléphone secondaire */
  telephone2: string | null

  /** Adresse email */
  email: string | null

  // ===== Adresse (priorisée) =====
  /** Adresse unifiée avec priorisation intervention > siège */
  address: {
    /** Adresse complète (rue, numéro, etc.) */
    street: string | null

    /** Code postal */
    postalCode: string | null

    /** Ville */
    city: string | null

    /** Source de l'adresse utilisée ('intervention', 'siege', ou null si aucune) */
    source: 'intervention' | 'siege' | null
  }

  // ===== Métier =====
  /** Métier principal de l'artisan (extrait depuis metiers[] où is_primary = true) */
  primaryMetier: {
    id: string
    code: string
    label: string
  } | null

  // ===== Statut =====
  /** ID du statut dans la base (ex: uuid) */
  statut_id: string | null

  /** Informations de statut résolues depuis ReferenceData (label + couleur) */
  statusInfo: {
    label: string
    color: string
  } | null

  // ===== Autres =====
  /** Numéro associé à l'artisan */
  numero_associe: string | null

  /** Distance en km par rapport à un point de référence (si disponible) */
  distanceKm: number | null

  /** Métadonnées de la photo de profil */
  photoProfilMetadata: AvatarMetadata | null
}

/**
 * Modes d'affichage du nom de l'artisan
 * - "nom": Prénom + Nom (fallback: plain_nom → raison_sociale)
 * - "rs": Raison sociale (fallback: prénom + nom)
 * - "tel": Téléphone principal (fallback: téléphone2)
 */
export type DisplayMode = "nom" | "rs" | "tel"

/**
 * Options pour la normalisation des données artisan
 */
export interface NormalizeOptions {
  /**
   * Données de référence pour résoudre le statut (optionnel)
   * Si non fourni, statusInfo sera null
   */
  refData?: {
    statuts?: Array<{
      id: string
      code: string
      label: string
      color?: string | null
    }>
  }

  /**
   * Priorité pour l'adresse quand les deux sont disponibles
   * Par défaut: 'intervention'
   */
  addressPriority?: 'intervention' | 'siege'
}
