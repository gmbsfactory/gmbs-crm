// ===== INTERVENTIONS CRUD - NORMALISATION DES CHAMPS UUID =====
// Défense en profondeur côté API : un formulaire peut transmettre une chaîne
// vide "" pour un champ UUID nullable (ex. aucun gestionnaire assigné, aucun
// propriétaire). PostgreSQL refuse "" comme uuid et renvoie une erreur 22P02
// (« invalid input syntax for type uuid: "" »), ce qui fait échouer tout le PATCH.
// On convertit donc ces chaînes vides en NULL avant l'envoi, quel que soit
// l'appelant.

import type { UpdateInterventionData } from "@/lib/api/common/types";

/** Champs UUID nullable de `interventions` : "" doit devenir NULL, pas être envoyé tel quel. */
export const NULLABLE_UUID_FIELDS = [
  "owner_id",
  "tenant_id",
  "client_id",
  "assigned_user_id",
  "metier_second_artisan_id",
] as const satisfies readonly (keyof UpdateInterventionData)[];

/**
 * Convertit en `null` les champs UUID nullable reçus sous forme de chaîne vide
 * ou ne contenant que des espaces. Retourne une nouvelle référence (non mutante).
 */
export function normalizeNullableUuidFields(
  payload: UpdateInterventionData,
): UpdateInterventionData {
  const normalized: UpdateInterventionData = { ...payload };

  for (const field of NULLABLE_UUID_FIELDS) {
    const value = normalized[field];
    if (typeof value === "string" && value.trim() === "") {
      normalized[field] = null;
    }
  }

  return normalized;
}
