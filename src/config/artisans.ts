/**
 * Configuration métier des artisans.
 *
 * Centralise les constantes et règles métier propres aux artisans
 * indépendamment de la présentation (couleurs, icônes).
 */

// ========================================
// STATUTS
// ========================================

/**
 * Codes des statuts artisans, alignés sur la table `artisan_statuses`.
 */
export type ArtisanStatusCode =
  | "CANDIDAT"
  | "ONE_SHOT"
  | "POTENTIEL"
  | "NOVICE"
  | "FORMATION"
  | "CONFIRME"
  | "EXPERT"
  | "INACTIF"
  | "ARCHIVE"

/**
 * Statuts exclus des vues "Dossier à compléter".
 *
 * Ces statuts correspondent à des artisans pour lesquels la complétude
 * du dossier n'est pas pertinente :
 * - Candidat / Potentiel : pas encore intégrés au réseau
 * - Archivé : sortis du réseau
 */
export const ARTISAN_DOSSIER_VIEW_EXCLUDED_STATUTS: ArtisanStatusCode[] = [
  "CANDIDAT",
  "POTENTIEL",
  "ARCHIVE",
]
