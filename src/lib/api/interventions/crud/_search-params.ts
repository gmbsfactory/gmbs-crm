// ===== INTERVENTIONS CRUD - URLSearchParams BUILDER =====
// Builder partagé entre getAll / getAllLight pour éviter la duplication des
// règles de filtrage côté client.

import type { InterventionQueryParams } from "@/lib/api/common/types";
import { parseSearch } from "@/lib/api/interventions/search-qualifiers";

export type FilterValue = string | string[] | null | undefined;

export function appendFilterParam(searchParams: URLSearchParams, key: string, value?: FilterValue) {
  if (key === "user" && value === null) {
    searchParams.append(key, "null");
    return;
  }
  if (value === undefined || value === null) return;
  if (Array.isArray(value)) {
    value.forEach((entry) => {
      if (entry !== null && typeof entry === "string" && entry.length > 0) {
        searchParams.append(key, entry);
      }
    });
    return;
  }
  if (typeof value === "string" && value.length > 0) {
    searchParams.append(key, value);
  }
}

export function buildBaseSearchParams(
  params: InterventionQueryParams | undefined,
  metierValue?: FilterValue,
): URLSearchParams {
  const limit = Math.max(1, params?.limit ?? 100);
  const searchParams = new URLSearchParams();
  searchParams.set("limit", limit.toString());
  if (params?.offset !== undefined) {
    searchParams.set("offset", params.offset.toString());
  }

  if (params?.statuts && params.statuts.length > 0) {
    appendFilterParam(searchParams, "statut", params.statuts);
  } else {
    appendFilterParam(searchParams, "statut", params?.statut);
  }

  if (params?.agences && params.agences.length > 0) {
    appendFilterParam(searchParams, "agence", params.agences);
  } else {
    appendFilterParam(searchParams, "agence", params?.agence);
  }
  appendFilterParam(searchParams, "artisan", params?.artisan);
  appendFilterParam(searchParams, "metier", metierValue);
  appendFilterParam(searchParams, "user", params?.user);

  if (params?.startDate) searchParams.set("startDate", params.startDate);
  if (params?.endDate) searchParams.set("endDate", params.endDate);
  if (params?.isCheck !== undefined) searchParams.set("isCheck", params.isCheck.toString());
  // Vue « Mes vérifications » : le drapeau et la liste des statuts de revue
  // voyagent ensemble (cf. filter-converter). `portalReportStatut` est répété,
  // à l'image de `statut`, et reste distinct de celui-ci.
  if (params?.hasPortalReport !== undefined) {
    searchParams.set("hasPortalReport", params.hasPortalReport.toString());
    appendFilterParam(searchParams, "portalReportStatut", params.portalReportStatuts);
  }
  if (params?.search) {
    // Les montants ne sont pas dans l'index plein-texte (cf. migration 99074) :
    // un montant détecté dans la saisie est envoyé comme filtre dédié, avec la
    // portée (acomptes et/ou coûts) résolue depuis le qualificateur éventuel.
    // `search` et `amount` peuvent coexister — l'Edge Function fusionne alors
    // les deux jeux de résultats.
    const { text, amount } = parseSearch(params.search);
    if (text) searchParams.set("search", text);
    if (amount) {
      searchParams.set("amount", amount.value.toString());
      searchParams.set("amountPaymentTypes", amount.paymentTypes.join(","));
      searchParams.set("amountCostTypes", amount.costTypes.join(","));
    }
  }

  return searchParams;
}
