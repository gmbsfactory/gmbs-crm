/**
 * Affichage « Démarré · n champs manquants » (portail artisans).
 *
 * L'artisan déclare le début de son chantier depuis l'application. Le fait est
 * toujours enregistré ; le statut, lui, appartient au CRM et n'avance vers
 * `INTER_EN_COURS` que si les règles d'entrée du workflow sont réunies
 * (décision client du 2026-09-05, spécification §10.1). Quand elles ne le sont
 * pas, l'intervention reste `ACCEPTE` alors que le chantier a commencé : c'est
 * précisément l'écart que ce badge rend visible, et il doit l'être partout où
 * le gestionnaire regarde ses interventions — modal, liste **et** kanban
 * (spécification §7.7, lot L2 point 7).
 *
 * Ce module est le pendant exact de `portal-report-status.ts` pour le badge
 * « À vérifier » : volontairement pur (aucun React), il est la **seule** source
 * du libellé et de la couleur, partagés par `getStatusDisplay`, la cellule de
 * liste, la carte de kanban et le panneau « Rapport ». Aucune de ces surfaces
 * ne redéclare de couleur — un précédent (couleurs de statuts figées en double)
 * a montré ce que coûte la duplication.
 *
 * Les valeurs viennent de `interventions.portal_work_started_at` et
 * `interventions.portal_work_missing_count`, projetées depuis
 * `intervention_artisans` par le trigger de la migration 99084.
 */

/**
 * Statuts pour lesquels un démarrage déclaré signale une dette de saisie.
 *
 * Uniquement `ACCEPTE` : dès que le statut a suivi (`INTER_EN_COURS`, `SAV`,
 * `INTER_TERMINEE`…), il n'y a plus d'écart à signaler, et le démarrage se lit
 * normalement dans le panneau « Rapport ».
 */
export const PORTAL_WORK_STARTED_STATUSES = ["ACCEPTE"] as const

/**
 * Couleur (ambre) du signal « démarré, statut non avancé ».
 *
 * Volontairement distincte du violet d'« À vérifier » : les deux badges peuvent
 * se succéder sur la même intervention et ne disent pas la même chose — l'un
 * réclame une vérification, l'autre une saisie.
 */
export const PORTAL_WORK_STARTED_COLOR = "#D97706"

/** Libellé de repli quand le compte de champs manquants n'est pas connu. */
export const PORTAL_WORK_STARTED_FALLBACK_LABEL = "Démarré · statut non avancé"

/**
 * Indique si l'intervention doit porter le signal « Démarré ».
 *
 * @param statusCode - Code du statut de l'intervention (ex. "ACCEPTE")
 * @param workStartedAt - Valeur de `interventions.portal_work_started_at`
 */
export function isPortalWorkStartedToShow(
  statusCode: string | null | undefined,
  workStartedAt: string | null | undefined,
): boolean {
  if (!workStartedAt || !statusCode) return false
  return (PORTAL_WORK_STARTED_STATUSES as readonly string[]).includes(statusCode)
}

/**
 * Libellé du badge : « Démarré · 3 champs manquants », « Démarré · 1 champ
 * manquant », ou le repli quand le compte est nul ou inconnu (démarrage
 * antérieur à la migration 99084).
 *
 * @param missingCount - Valeur de `interventions.portal_work_missing_count`
 */
export function portalWorkStartedLabel(missingCount: number | null | undefined): string {
  if (missingCount === null || missingCount === undefined || missingCount <= 0) {
    return PORTAL_WORK_STARTED_FALLBACK_LABEL
  }
  const pluriel = missingCount > 1 ? "s" : ""
  return `Démarré · ${missingCount} champ${pluriel} manquant${pluriel}`
}
