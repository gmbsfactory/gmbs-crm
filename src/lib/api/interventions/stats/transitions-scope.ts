// ===== STATS - PÉRIMÈTRE DES TRANSITIONS =====
// Règles décidées le 02/07/2026 avec le client (améliorations post-import) :
//
// 1. Les vraies données commencent au go-live équipe complète, lundi
//    29/06/2026 00:00 (Paris). L'import des 28-29/06 a recréé tout
//    l'historique et généré ~6 500 transitions sans acteur (source
//    « trigger »/« import », ex. 600+ « Devis envoyé » datés du week-end et
//    mappés sur un gestionnaire) : elles polluaient tableaux de stats,
//    marges (« vs période précédente ») et compteurs.
// 2. Seules les transitions portées par un ACTEUR HUMAIN comptent dans les
//    stats gestionnaires (changed_by_user_id non nul) — vérifié en base :
//    depuis le go-live, toute transition réelle porte un acteur ; celles
//    sans acteur sont exclusivement des cascades d'import.
// 3. Une intervention ne compte qu'UNE fois par statut sur une période :
//    un dossier qui repasse 4 fois en « Devis envoyé » = 1 devis envoyé
//    (attribué à son premier passage de la période).

/** Go-live équipe complète : lundi 29/06/2026 00:00 Paris. */
export const REAL_DATA_START_ISO = "2026-06-28T22:00:00Z";

export type TransitionLike = {
  intervention_id: string;
  transition_date: string;
  to_status_code: string;
};

/**
 * Déduplique les transitions : une intervention ne compte qu'une fois par
 * statut atteint, attribuée à son PREMIER passage de la période (tri
 * chronologique). Règle n°3 ci-dessus.
 */
export function dedupeFirstTransitionPerIntervention<T extends TransitionLike>(rows: T[]): T[] {
  const sorted = [...rows].sort(
    (a, b) => Date.parse(a.transition_date) - Date.parse(b.transition_date)
  );
  const seen = new Set<string>();
  const result: T[] = [];
  for (const row of sorted) {
    const key = `${row.intervention_id}|${row.to_status_code}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(row);
  }
  return result;
}
