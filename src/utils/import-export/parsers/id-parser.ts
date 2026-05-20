/**
 * Normalise un identifiant d'intervention provenant d'un CSV.
 *
 * Règle : trim + uppercase. La valeur brute est conservée (suffixes,
 * tirets, préfixes non-numériques inclus) pour éviter les collisions
 * silencieuses lors du rapprochement create-or-update via `id_inter`.
 *
 * Retourne `null` uniquement si la valeur est vide après trim.
 */
export function extractInterventionId(idValue: string | null | undefined): string | null {
  const trimmed = idValue?.trim();
  if (!trimmed) return null;
  return trimmed.toUpperCase();
}
