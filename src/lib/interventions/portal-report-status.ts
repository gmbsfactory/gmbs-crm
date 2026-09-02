/**
 * Affichage « À vérifier » (portail artisans).
 *
 * Quand l'artisan a envoyé un rapport depuis le portail (`has_portal_report`),
 * l'intervention est affichée « À vérifier » en violet dans tout le CRM,
 * sans que son statut en base ne change. Ce module est volontairement pur
 * (aucun React) pour être partagé entre la couche API (`mapInterventionRecord`)
 * et l'affichage (`getStatusDisplay`, kanban, modal).
 */

/** Statuts pour lesquels un rapport portail soumis est affiché « À vérifier ». */
export const PORTAL_REPORT_REVIEW_STATUSES = ["ACCEPTE", "INTER_EN_COURS", "SAV"] as const

/** Libellé affiché à la place du libellé du statut. */
export const PORTAL_REPORT_REVIEW_LABEL = "À vérifier"

/** Couleur (violet) de l'affichage « À vérifier ». */
export const PORTAL_REPORT_REVIEW_COLOR = "#9333EA"

/**
 * Indique si l'intervention doit être affichée « À vérifier ».
 *
 * @param statusCode - Code du statut de l'intervention (ex. "ACCEPTE")
 * @param hasPortalReport - Valeur de `interventions.has_portal_report`
 */
export function isPortalReportToReview(
  statusCode: string | null | undefined,
  hasPortalReport: boolean | null | undefined,
): boolean {
  if (!hasPortalReport || !statusCode) return false
  return (PORTAL_REPORT_REVIEW_STATUSES as readonly string[]).includes(statusCode)
}
