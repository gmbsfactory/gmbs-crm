/**
 * Propriétés dont le tri est géré côté serveur (Edge Function).
 *
 * Le frontend n'a pas besoin de connaître le mapping vers les colonnes DB :
 * la whitelist et le mapping sont gérés exclusivement côté serveur.
 *
 * Pour ajouter une nouvelle propriété triable :
 * 1. L'ajouter ici
 * 2. L'ajouter dans la whitelist SORTABLE_COLUMNS de l'Edge Function
 */
export const SERVER_SORTABLE_PROPERTIES = new Set([
  // Colonnes directes table interventions
  "date",
  "created_at",
  "dateIntervention",
  "datePrevue",
  "date_prevue",
  "date_termine",
  "due_date",
  "id_inter",
  "updated_at",
  // Colonnes via intervention_costs_cache (gérées par RPC serveur)
  "coutIntervention",
  "coutSST",
  "coutMateriel",
  "marge",
])

export function isServerSortable(property: string): boolean {
  return SERVER_SORTABLE_PROPERTIES.has(property)
}
