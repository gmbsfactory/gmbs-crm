/**
 * Présentation des rapports du portail côté CRM.
 *
 * Ce module rassemble ce qui décrit **l'affichage** des rapports artisans dans
 * le CRM — l'ordre des versions et la clé des photos orphelines — pour que la
 * route `app/api/interventions/[id]/portal-report/route.ts` n'ait plus à les
 * exporter : un `route.ts` d'App Router n'autorise que les handlers HTTP et
 * quelques constantes de configuration (`runtime`, `dynamic`, …), tout autre
 * export fait échouer le typecheck et le build.
 *
 * Volontairement pur (aucun React, aucun accès base) pour être partagé entre la
 * route, le hook `usePortalReport` et les tests.
 */

/** Clé de `photosByReport` regroupant les photos rattachées à aucune version. */
export const PHOTOS_HORS_RAPPORT = "_hors_rapport"

/** Forme minimale d'un rapport suffisante pour l'ordonner. */
export interface PortalReportSortable {
  status: string
  submitted_at: string | null
  version: number
}

/** Horodatage exploitable, `0` si la date est absente ou illisible. */
function timeOf(value: string | null | undefined): number {
  if (!value) return 0
  const time = new Date(value).getTime()
  return Number.isNaN(time) ? 0 : time
}

/**
 * Ordre d'affichage des rapports : le(s) rapport(s) **en attente** d'abord
 * (même règle que `pickPortalReport`, promue de l'API vers l'UI), puis par
 * date d'envoi décroissante, la version la plus haute départageant.
 */
export function sortPortalReports<T extends PortalReportSortable>(reports: readonly T[]): T[] {
  return [...reports].sort((a, b) => {
    const pending = Number(b.status === "submitted") - Number(a.status === "submitted")
    if (pending !== 0) return pending
    const submitted = timeOf(b.submitted_at) - timeOf(a.submitted_at)
    if (submitted !== 0) return submitted
    return (b.version ?? 0) - (a.version ?? 0)
  })
}
