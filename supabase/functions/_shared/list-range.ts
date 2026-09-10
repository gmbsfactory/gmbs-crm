/**
 * Bornes de lecture des listes d'Edge Functions.
 *
 * Historique : la liste des documents appliquait une limite par défaut de 50
 * lignes, sans ORDER BY. Sur une entité chargée (une intervention à 96 photos),
 * les documents ajoutés ensuite tombaient hors de la fenêtre et devenaient
 * invisibles dans l'interface, sans le moindre signal.
 *
 * Règle retenue : pas de limite par défaut. L'appelant reçoit tous les
 * documents de l'entité. `limit` / `offset` restent honorés s'ils sont fournis
 * explicitement, pour les appelants qui veulent paginer.
 */

export interface ListRange {
  /** Limite demandée par l'appelant, `null` si aucune. */
  limit: number | null
  /** Décalage demandé, 0 par défaut. */
  offset: number
  /** Première ligne à lire (borne incluse) — pour `.range(from, to)`. */
  from: number
  /** Dernière ligne à lire (borne incluse) — pour `.range(from, to)`. */
  to: number
}

/**
 * Traduit les paramètres `limit` / `offset` d'une requête en bornes de lecture.
 *
 * @param rawLimit  valeur brute du paramètre `limit` (null si absent)
 * @param rawOffset valeur brute du paramètre `offset` (null si absent)
 * @param maxRows   plafond de sécurité appliqué en l'absence de `limit`
 */
export function resolveListRange(
  rawLimit: string | null,
  rawOffset: string | null,
  maxRows: number,
): ListRange {
  const parsedLimit = rawLimit === null ? Number.NaN : Number.parseInt(rawLimit, 10)
  const parsedOffset = rawOffset === null ? Number.NaN : Number.parseInt(rawOffset, 10)

  // Une limite doit être un entier strictement positif ; sinon on l'ignore et
  // on renvoie tout (une limite invalide ne doit pas masquer des documents).
  const limit =
    Number.isFinite(parsedLimit) && parsedLimit > 0
      ? Math.min(parsedLimit, maxRows)
      : null

  const offset = Number.isFinite(parsedOffset) && parsedOffset > 0 ? parsedOffset : 0

  const from = offset
  const to = limit === null ? offset + maxRows - 1 : offset + limit - 1

  return { limit, offset, from, to }
}
