// ===== FILTRE GESTIONNAIRE ASSIGNÉ (chemins Supabase directs) =====
// Pendant client de `applyUserFilter` de l'Edge Function
// (`supabase/functions/interventions-v2/_lib/helpers.ts`) : les deux doivent
// rester alignés, sinon un comptage diverge de la liste qu'il compte.

import type { InterventionQueryParams } from "@/lib/api/common/types";

type UserFilterParams = Pick<InterventionQueryParams, "user" | "users">;

interface UserFilterableQuery {
  in: (column: string, values: readonly string[]) => unknown;
  is: (column: string, value: null) => unknown;
  eq: (column: string, value: string) => unknown;
  or: (filters: string) => unknown;
}

/**
 * Applique le filtre « gestionnaire assigné » à une requête Supabase.
 *
 * `users` porte la multi-sélection de la table interventions et peut contenir
 * `null` pour « Non assigné », éventuellement **mélangé** à des gestionnaires
 * nommés. PostgREST ne sait pas exprimer ce mélange avec `.in()` — `in.(null,…)`
 * traite `null` comme la chaîne littérale et ne matche pas un vrai NULL SQL —
 * d'où le `.or()`. `user` (scalaire) reste le chemin mono-sélection / vue Market.
 */
export function applyUserFilter<Q extends UserFilterableQuery>(
  query: Q,
  params?: UserFilterParams,
): Q {
  const selection = params?.users;

  if (selection && selection.length > 0) {
    const ids = selection.filter((value): value is string => typeof value === "string");
    const includesUnassigned = selection.some((value) => value === null);

    if (ids.length > 0 && includesUnassigned) {
      return query.or(`assigned_user_id.is.null,assigned_user_id.in.(${ids.join(",")})`) as Q;
    }
    if (ids.length > 0) {
      return query.in("assigned_user_id", ids) as Q;
    }
    if (includesUnassigned) {
      return query.is("assigned_user_id", null) as Q;
    }
    return query;
  }

  if (params?.user === undefined) return query;
  if (params.user === null) return query.is("assigned_user_id", null) as Q;
  return query.eq("assigned_user_id", params.user) as Q;
}
