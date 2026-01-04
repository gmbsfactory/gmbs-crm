// ===== CONSTANTES PARTAGÉES POUR L'API V2 =====
// Toutes les constantes métier centralisées

/**
 * Statuts d'intervention disponibles
 * @deprecated Préférer l'utilisation des statuts depuis la base de données
 */
export const INTERVENTION_STATUS = [
  "Demandé",
  "Devis_Envoyé",
  "Accepté",
  "En_cours",
  "Visite_Technique",
  "Terminé",
  "Annulé",
  "Refusé",
  "STAND_BY",
  "SAV",
] as const;

export type InterventionStatusCode = (typeof INTERVENTION_STATUS)[number];

/**
 * Métiers d'intervention disponibles
 * @deprecated Préférer l'utilisation des métiers depuis la base de données
 */
export const INTERVENTION_METIERS = [
  "Vitrerie",
  "Bricolage",
  "Plomberie",
  "Électricité",
  "Couvreur",
  "Menuiserie",
  "Chauffage",
  "Dépannage",
] as const;

export type InterventionMetierCode = (typeof INTERVENTION_METIERS)[number];

/**
 * Types de documents par entité
 */
export const DOCUMENT_TYPES = {
  intervention: [
    "devis",
    "photos",
    "facturesGMBS",
    "facturesArtisans",
    "facturesMateriel",
    "rapport_intervention",
    "plan",
    "schema",
    "autre",
    "a_classe",
  ],
  artisan: [
    "certificat",
    "assurance",
    "siret",
    "kbis",
    "photo_profil",
    "portfolio",
    "autre",
    "a_classe",
  ],
} as const;

export type InterventionDocumentType = (typeof DOCUMENT_TYPES.intervention)[number];
export type ArtisanDocumentType = (typeof DOCUMENT_TYPES.artisan)[number];

/**
 * Types de commentaires disponibles
 */
export const COMMENT_TYPES = [
  "general",
  "technique",
  "commercial",
  "interne",
  "client",
  "artisan",
  "urgent",
  "suivi",
] as const;

export type CommentType = (typeof COMMENT_TYPES)[number];

/**
 * Types de coûts pour les interventions
 */
export const COST_TYPES = [
  "sst",
  "materiel",
  "intervention",
  "marge",
] as const;

export type CostType = (typeof COST_TYPES)[number];

/**
 * Types d'entités pour les commentaires
 */
export const ENTITY_TYPES = [
  "intervention",
  "artisan",
  "client",
] as const;

export type EntityType = (typeof ENTITY_TYPES)[number];

/**
 * Statuts utilisateur pour la présence
 */
export const USER_STATUS = [
  "connected",
  "dnd",
  "busy",
  "offline",
] as const;

export type UserStatus = (typeof USER_STATUS)[number];

/**
 * Taille maximale des lots pour les requêtes .in()
 * Évite les erreurs de longueur d'URL
 */
export const MAX_BATCH_SIZE = 100;

/**
 * Durée de validité du cache de référence (5 minutes)
 */
export const REFERENCE_CACHE_DURATION = 5 * 60 * 1000;

/**
 * URL par défaut des Edge Functions Supabase
 */
export const DEFAULT_FUNCTIONS_URL = "http://localhost:54321/functions/v1";

/**
 * Maximum number of nearby artisans to load per page in infinite scroll
 */
export const NEARBY_ARTISANS_PAGE_SIZE = 30;

/**
 * Maximum distance in kilometers for nearby artisan search
 */
export const NEARBY_ARTISANS_MAX_DISTANCE_KM = 100;

/**
 * Maximum number of artisan search results to display
 */
export const ARTISAN_SEARCH_LIMIT = 50;

