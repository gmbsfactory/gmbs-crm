/**
 * Règles de transition automatiques pour les statuts d'artisans
 *
 * Règles de progression automatique (basées sur le nombre d'interventions terminées) :
 * - potentiel/candidat/one_shot → novice : 1 intervention terminée
 * - novice → formation : 3 interventions terminées
 * - formation → confirmé : 6 interventions terminées
 * - confirmé → expert : 10+ interventions terminées
 *
 * Transitions manuelles autorisées :
 * - potentiel ↔ candidat (bidirectionnel)
 * - potentiel/candidat → one_shot (attribution manuelle)
 * - one_shot → potentiel/candidat (pour réintégrer dans le workflow automatique)
 * - tout statut → archive (archivage avec raison requise)
 *
 * Statut par défaut pour nouveaux artisans : POTENTIEL
 *
 * Statut gelé (pas de progression automatique) :
 * - archive : reste archivé définitivement
 */

export type ArtisanStatusCode = 
  | "CANDIDAT"
  | "NOVICE"
  | "FORMATION"
  | "CONFIRME"
  | "EXPERT"
  | "POTENTIEL"
  | "ONE_SHOT"
  | "ARCHIVE"

/**
 * Seuils d'interventions terminées pour chaque statut
 */
export const STATUS_THRESHOLDS: Record<ArtisanStatusCode, number> = {
  CANDIDAT: 0,
  NOVICE: 1,
  FORMATION: 3,
  CONFIRME: 6,
  EXPERT: 10,
  POTENTIEL: 0, // Statut initial, progression à 1 intervention
  ONE_SHOT: 0, // Peut progresser automatiquement (non gelé)
  ARCHIVE: -1, // Statut terminal gelé, pas de seuil
}

/**
 * Statuts qui peuvent être attribués automatiquement
 */
export const AUTO_ASSIGNABLE_STATUSES = new Set<ArtisanStatusCode>([
  "NOVICE",
  "FORMATION",
  "CONFIRME",
  "EXPERT",
])

/**
 * Statuts qui nécessitent une attribution manuelle (ne peuvent pas être atteints automatiquement)
 * Note: POTENTIEL et ONE_SHOT peuvent progresser automatiquement, mais ne sont pas des cibles automatiques
 */
export const MANUAL_ONLY_STATUSES = new Set<ArtisanStatusCode>([
  "ARCHIVE", // Seul statut réellement gelé
])

/**
 * Calcule le nouveau statut d'artisan basé sur le nombre d'interventions terminées
 *
 * @param currentStatus - Statut actuel de l'artisan
 * @param completedInterventionsCount - Nombre d'interventions terminées
 * @returns Le nouveau statut ou null si pas de changement
 */
export function calculateNewArtisanStatus(
  currentStatus: ArtisanStatusCode | null | undefined,
  completedInterventionsCount: number
): ArtisanStatusCode | null {
  if (!currentStatus) {
    // Si pas de statut, retourner POTENTIEL par défaut (nouveau workflow)
    return "POTENTIEL"
  }

  // ARCHIVE est le seul statut gelé (pas de changement automatique)
  if (currentStatus === "ARCHIVE") {
    return null
  }

  // Calculer le statut approprié selon le nombre d'interventions
  let newStatus: ArtisanStatusCode | null = null

  if (completedInterventionsCount >= STATUS_THRESHOLDS.EXPERT) {
    newStatus = "EXPERT"
  } else if (completedInterventionsCount >= STATUS_THRESHOLDS.CONFIRME) {
    newStatus = "CONFIRME"
  } else if (completedInterventionsCount >= STATUS_THRESHOLDS.FORMATION) {
    newStatus = "FORMATION"
  } else if (completedInterventionsCount >= STATUS_THRESHOLDS.NOVICE) {
    // POTENTIEL, CANDIDAT et ONE_SHOT passent tous à NOVICE après 1 intervention
    newStatus = "NOVICE"
  } else {
    // Moins de 1 intervention → reste au statut actuel
    newStatus = currentStatus
  }

  // Retourner le nouveau statut seulement s'il est différent de l'actuel
  return newStatus !== currentStatus ? newStatus : null
}

/**
 * Vérifie si une transition de statut est autorisée
 *
 * @param fromStatus - Statut actuel
 * @param toStatus - Statut cible
 * @returns true si la transition est autorisée
 */
export function isTransitionAllowed(
  fromStatus: ArtisanStatusCode | null | undefined,
  toStatus: ArtisanStatusCode
): boolean {
  if (!fromStatus) {
    // À la création, seul POTENTIEL est autorisé (nouveau statut par défaut)
    return toStatus === "POTENTIEL"
  }

  // ARCHIVE peut être atteint depuis n'importe quel statut (avec raison)
  if (toStatus === "ARCHIVE") {
    return true
  }

  // Transitions manuelles bidirectionnelles POTENTIEL ↔ CANDIDAT
  if (toStatus === "POTENTIEL" && fromStatus === "CANDIDAT") {
    return true
  }
  if (toStatus === "CANDIDAT" && fromStatus === "POTENTIEL") {
    return true
  }

  // ONE_SHOT peut être atteint depuis POTENTIEL ou CANDIDAT
  if (toStatus === "ONE_SHOT") {
    return fromStatus === "POTENTIEL" || fromStatus === "CANDIDAT"
  }

  // Retour de ONE_SHOT vers POTENTIEL ou CANDIDAT (pour réintégrer le workflow)
  if (fromStatus === "ONE_SHOT" && (toStatus === "POTENTIEL" || toStatus === "CANDIDAT")) {
    return true
  }

  // Les autres transitions sont gérées automatiquement par calculateNewArtisanStatus
  // mais on peut permettre les transitions manuelles vers les statuts auto-assignables
  if (AUTO_ASSIGNABLE_STATUSES.has(toStatus)) {
    return true
  }

  return false
}

/**
 * Obtient le statut par défaut pour un nouvel artisan
 */
export function getDefaultArtisanStatus(): ArtisanStatusCode {
  return "POTENTIEL"
}

