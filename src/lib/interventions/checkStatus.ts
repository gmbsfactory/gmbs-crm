/**
 * Utilitaires pour détecter le statut "Check" (due date dépassée)
 * DAT-001 : Si la due date est dépassée et le statut est "Visite technique" ou "Intervention en cours",
 * le statut passe visuellement à "Check" (affichage rouge avec clignotement)
 */

export type InterventionStatusCode = 
  | "VISITE_TECHNIQUE" 
  | "INTER_EN_COURS"
  | string

/**
 * Codes de statut qui nécessitent une date prévue et peuvent passer en "Check"
 */
export const CHECK_STATUS_CODES = new Set<InterventionStatusCode>([
  "VISITE_TECHNIQUE",
  "INTER_EN_COURS",
])

/**
 * Vérifie si une intervention doit afficher le statut "Check"
 * 
 * @param statusCode - Code du statut de l'intervention
 * @param datePrevue - Date prévue (due date) au format ISO string ou null
 * @returns true si l'intervention doit afficher "Check" (date prévue <= aujourd'hui)
 */
export function isCheckStatus(
  statusCode: InterventionStatusCode | null | undefined,
  datePrevue: string | null | undefined
): boolean {
  // Si pas de statut ou statut non concerné, pas de Check
  if (!statusCode || !CHECK_STATUS_CODES.has(statusCode)) {
    return false
  }

  // Si pas de date prévue, pas de Check (mais devrait être bloqué par validation)
  if (!datePrevue) {
    return false
  }

  // Vérifier si la date prévue est dépassée ou égale à aujourd'hui
  try {
    const datePrevueObj = new Date(datePrevue)
    const today = new Date()
    // Réinitialiser les heures pour comparer uniquement les dates
    today.setHours(0, 0, 0, 0)
    datePrevueObj.setHours(0, 0, 0, 0)

    // Si la date prévue est avant ou égale à aujourd'hui, c'est un Check
    return datePrevueObj <= today
  } catch (error) {
    // En cas d'erreur de parsing, pas de Check
    console.warn("Erreur lors du parsing de la date prévue:", datePrevue, error)
    return false
  }
}
