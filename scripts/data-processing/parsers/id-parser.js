'use strict';

/**
 * Normalise un identifiant d'intervention provenant d'un CSV.
 * Trim + uppercase. La valeur brute est conservée pour éviter les
 * collisions silencieuses lors du rapprochement create-or-update via id_inter.
 * Retourne null uniquement si la valeur est vide après trim.
 */
function extractInterventionId(idValue) {
  if (idValue === null || idValue === undefined) return null;
  const trimmed = String(idValue).trim();
  if (trimmed === '') return null;
  return trimmed.toUpperCase();
}

module.exports = { extractInterventionId };
