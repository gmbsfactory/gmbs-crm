// ===== CONSTANTES PARTAGÉES PAR LES FORMULAIRES D'INTERVENTION =====

/**
 * Types de documents pour les interventions
 */
export const INTERVENTION_DOCUMENT_KINDS = [
  { kind: "devis", label: "Devis GMBS" },
  { kind: "facturesGMBS", label: "Facture GMBS" },
  { kind: "facturesMateriel", label: "Facture Matériel" },
  { kind: "photos", label: "Photos" },
  { kind: "facturesArtisans", label: "Facture Artisan" },
] as const

/**
 * Ordre de tri des statuts (version canonique issue du formulaire d'édition)
 */
export const STATUS_SORT_ORDER: Record<string, number> = {
  DEMANDE: 1,
  DEVIS_ENVOYE: 2,
  ACCEPTE: 3,
  INTER_EN_COURS: 4,
  ATT_ACOMPTE: 5,
  INTER_TERMINEE: 6,
  VISITE_TECHNIQUE: 7,
  STAND_BY: 8,
  ANNULE: 9,
  REFUSE: 10,
  SAV: 11,
}

/** Rayon de recherche maximum en km */
export const MAX_RADIUS_KM = 10000

/** Statuts nécessitant une date prévue (cumulatif : INTER_EN_COURS → INTER_TERMINEE) */
export const STATUSES_REQUIRING_DATE_PREVUE = new Set(["VISITE_TECHNIQUE", "INTER_EN_COURS", "INTER_TERMINEE"])

/** Statuts nécessitant un ID définitif (pas "AUTO-xxx") */
export const STATUSES_REQUIRING_DEFINITIVE_ID = new Set([
  "DEVIS_ENVOYE",
  "ACCEPTE",
  "INTER_EN_COURS",
  "INTER_TERMINEE",
  "STAND_BY",
])

/** Statuts nécessitant un nom de facturation — cumulatif depuis DEVIS_ENVOYE */
export const STATUSES_REQUIRING_NOM_FACTURATION = new Set(["DEVIS_ENVOYE", "ACCEPTE", "INTER_EN_COURS", "INTER_TERMINEE"])

/** Statuts nécessitant un gestionnaire assigné — cumulatif depuis DEVIS_ENVOYE */
export const STATUSES_REQUIRING_ASSIGNED_USER = new Set(["DEVIS_ENVOYE", "ACCEPTE", "INTER_EN_COURS", "INTER_TERMINEE"])

/** Statuts nécessitant des coûts renseignés — cumulatif depuis INTER_EN_COURS */
export const STATUSES_REQUIRING_COUTS = new Set(["INTER_EN_COURS", "INTER_TERMINEE"])

/** Statuts nécessitant une consigne artisan — cumulatif depuis INTER_EN_COURS */
export const STATUSES_REQUIRING_CONSIGNE_ARTISAN = new Set(["INTER_EN_COURS", "INTER_TERMINEE"])

/** Statuts nécessitant les infos client — cumulatif depuis INTER_EN_COURS */
export const STATUSES_REQUIRING_CLIENT_INFO = new Set(["INTER_EN_COURS", "INTER_TERMINEE"])

/** Statuts nécessitant une agence — cumulatif depuis DEMANDE */
export const STATUSES_REQUIRING_AGENCE = new Set(["DEMANDE", "DEVIS_ENVOYE", "ACCEPTE", "INTER_EN_COURS", "INTER_TERMINEE"])

/** Statuts nécessitant un métier — cumulatif depuis DEMANDE */
export const STATUSES_REQUIRING_METIER = new Set(["DEMANDE", "DEVIS_ENVOYE", "ACCEPTE", "INTER_EN_COURS", "INTER_TERMINEE"])

/** Statuts nécessitant un devis (document kind "devis") — cumulatif depuis ACCEPTE */
export const STATUSES_REQUIRING_DEVIS = new Set(["ACCEPTE", "INTER_EN_COURS", "INTER_TERMINEE"])

/** Codes de statuts nécessitant un artisan assigné */
export const ARTISAN_REQUIRED_STATUS_CODES = [
  "VISITE_TECHNIQUE",
  "INTER_EN_COURS",
  "INTER_TERMINEE",
  "ATT_ACOMPTE",
] as const
