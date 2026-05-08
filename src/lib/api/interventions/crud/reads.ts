// ===== INTERVENTIONS CRUD - READS =====
// Lectures d'interventions. getAll/getAllLight/getByArtisan utilisent l'Edge
// Function ou requêtent directement Supabase ; getById/getByIds embarquent
// le SELECT complet partagé.

import type {
  Intervention,
  InterventionQueryParams,
  PaginatedResponse,
} from "@/lib/api/common/types";
import {
  getSupabaseFunctionsUrl,
  getHeaders,
  handleResponse,
  mapInterventionRecord,
  getReferenceCache,
  resolveMetierToId,
} from "@/lib/api/common/utils";
import type { InterventionWithStatus } from "@/types/intervention";
import { supabaseClient } from "./_auth";
import { buildBaseSearchParams, type FilterValue } from "./_search-params";
import { FULL_INTERVENTION_SELECT } from "./_select-clauses";

export async function getAll(
  params?: InterventionQueryParams,
): Promise<PaginatedResponse<InterventionWithStatus>> {
  // Convertir les codes métier en IDs si nécessaire
  let metierValue: FilterValue = params?.metier;

  if (params?.metier || params?.metiers) {
    const refs = await getReferenceCache();

    if (params?.metiers && params.metiers.length > 0) {
      metierValue = params.metiers.map((code) => resolveMetierToId(code, refs.metiersById));
    } else if (params?.metier && typeof params.metier === "string") {
      metierValue = resolveMetierToId(params.metier, refs.metiersById);
    }
  }

  const searchParams = buildBaseSearchParams(params, metierValue);

  // Spécifique à getAll : include / sort / cache-buster
  if (params?.include && Array.isArray(params.include) && params.include.length > 0) {
    params.include.forEach((relation) => {
      searchParams.append("include", relation);
    });
  }
  if (params?.sortBy) searchParams.set("sort_by", params.sortBy);
  if (params?.sortDir) searchParams.set("sort_dir", params.sortDir);
  if (process.env.NODE_ENV === "production") {
    searchParams.set("_ts", Date.now().toString());
  }

  const queryString = searchParams.toString();
  const functionsUrl = getSupabaseFunctionsUrl();
  const url = `${functionsUrl}/interventions-v2/interventions${queryString ? `?${queryString}` : ""}`;

  const response = await fetch(url, { headers: await getHeaders() });
  const raw = await handleResponse(response);

  const refs = await getReferenceCache();

  const transformedData = Array.isArray(raw?.data)
    ? raw.data.map((item: Record<string, unknown>) => mapInterventionRecord(item, refs) as InterventionWithStatus)
    : [];

  const total =
    typeof raw?.pagination?.total === "number"
      ? raw.pagination.total
      : transformedData.length;

  const limit = Math.max(1, params?.limit ?? 100);
  const offset = params?.offset ?? 0;

  return {
    data: transformedData,
    pagination: { total, limit, offset, hasMore: offset + limit < total },
  };
}

/**
 * Récupère toutes les interventions en version légère (via Edge Function).
 * Version optimisée pour le warm-up avec moins de données.
 */
export async function getAllLight(
  params?: InterventionQueryParams,
): Promise<PaginatedResponse<InterventionWithStatus>> {
  const searchParams = buildBaseSearchParams(params, params?.metier);

  const queryString = searchParams.toString();
  const functionsUrl = getSupabaseFunctionsUrl();
  const url = `${functionsUrl}/interventions-v2/interventions/light${queryString ? `?${queryString}` : ""}`;

  const response = await fetch(url, { headers: await getHeaders() });
  const raw = await handleResponse(response);

  const refs = await getReferenceCache();

  const transformedData = Array.isArray(raw?.data)
    ? raw.data.map((item: Record<string, unknown>) => mapInterventionRecord(item, refs) as InterventionWithStatus)
    : [];

  const total =
    typeof raw?.pagination?.total === "number"
      ? raw.pagination.total
      : transformedData.length;

  const lightLimit = Math.max(1, params?.limit ?? 100);
  const offset = params?.offset ?? 0;

  return {
    data: transformedData,
    pagination: { total, limit: lightLimit, offset, hasMore: offset + lightLimit < total },
  };
}

/** Obtient le nombre total d'interventions (sans les charger). */
export async function getTotalCount(): Promise<number> {
  const { count, error } = await supabaseClient
    .from("interventions")
    .select("*", { count: "exact", head: true });

  if (error) {
    console.error("Erreur lors du comptage des interventions:", error);
    return 0;
  }

  return count || 0;
}

export async function getById(id: string, _include?: string[]): Promise<InterventionWithStatus> {
  const { data, error } = await supabaseClient
    .from("interventions")
    .select(FULL_INTERVENTION_SELECT)
    .eq("id", id)
    .single();

  if (error) throw error;
  if (!data) throw new Error("Intervention introuvable");

  const refs = await getReferenceCache();
  return mapInterventionRecord(data, refs) as InterventionWithStatus;
}

/** Récupère plusieurs interventions par leurs IDs (pour la pagination comptabilité). */
export async function getByIds(ids: string[]): Promise<InterventionWithStatus[]> {
  if (ids.length === 0) return [];

  const { data, error } = await supabaseClient
    .from("interventions")
    .select(FULL_INTERVENTION_SELECT)
    .in("id", ids);

  if (error) throw error;

  const refs = await getReferenceCache();
  return (data || []).map((item: any) => mapInterventionRecord(item, refs) as InterventionWithStatus);
}

/** Récupère les interventions liées à un artisan via la table de jointure. */
export async function getByArtisan(
  artisanId: string,
  params?: Omit<InterventionQueryParams, "artisan">,
): Promise<PaginatedResponse<InterventionWithStatus>> {
  const { data: interventionArtisans, error: joinError } = await supabaseClient
    .from("intervention_artisans")
    .select("intervention_id")
    .eq("artisan_id", artisanId);

  if (joinError) throw joinError;

  const interventionIds = (interventionArtisans || [])
    .map((ia: any) => ia.intervention_id)
    .filter(Boolean);

  if (interventionIds.length === 0) {
    return {
      data: [],
      pagination: {
        total: 0,
        limit: params?.limit || 5000,
        offset: params?.offset || 0,
        hasMore: false,
      },
    };
  }

  let query = supabaseClient
    .from("interventions")
    .select(
      `
        *,
        status:intervention_statuses(id,code,label,color,sort_order),
        intervention_artisans (
          artisan_id,
          is_primary,
          role
        ),
        intervention_costs (
          id,
          cost_type,
          label,
          amount,
          currency,
          metadata,
          artisan_order
        )
      `,
      { count: "exact" },
    )
    .in("id", interventionIds)
    .order("created_at", { ascending: false });

  if (params?.statut) query = query.eq("statut_id", params.statut);
  if (params?.agence) query = query.eq("agence_id", params.agence);
  if (params?.user) query = query.eq("assigned_user_id", params.user);
  if (params?.startDate) query = query.gte("date", params.startDate);
  if (params?.endDate) query = query.lte("date", params.endDate);

  const limit = params?.limit || 5000;
  const offset = params?.offset || 0;
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) throw error;

  const refs = await getReferenceCache();
  const transformedData = (data || []).map((item: any) =>
    mapInterventionRecord(item, refs) as InterventionWithStatus,
  );

  return {
    data: transformedData,
    pagination: {
      total: count || 0,
      limit,
      offset,
      hasMore: offset + limit < (count || 0),
    },
  };
}
