// ===== INTERVENTIONS FILTERS =====
// Fonctions de comptage avec filtres et valeurs distinctes

import { supabase } from "@/lib/api/v2/common/client";
import type {
  InterventionQueryParams,
} from "@/lib/api/v2/common/types";
import {
  getReferenceCache,
  resolveMetierToId,
} from "@/lib/api/v2/common/utils";
import { isCheckStatus } from "@/lib/interventions/checkStatus";
import type { InterventionStatusKey } from "@/config/interventions";

export const interventionsFilters = {
  /**
   * Obtient le nombre total d'interventions correspondant aux filtres
   */
  async getTotalCountWithFilters(
    params?: Omit<InterventionQueryParams, "limit" | "offset" | "include">,
    signal?: AbortSignal
  ): Promise<number> {
    try {
      let query = supabase
        .from("interventions")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true);

      if (params?.statut) {
        query = query.eq("statut_id", params.statut);
      }
      if (params?.statuts && params.statuts.length > 0) {
        query = query.in("statut_id", params.statuts);
      }
      if (params?.agence) {
        query = query.eq("agence_id", params.agence);
      }
      if (params?.metier && typeof params.metier === 'string') {
        const refs = await getReferenceCache();
        query = query.eq("metier_id", resolveMetierToId(params.metier, refs.metiersById));
      }
      if (params?.metiers && params.metiers.length > 0) {
        const refs = await getReferenceCache();
        query = query.in("metier_id", params.metiers.map((c) => resolveMetierToId(c, refs.metiersById)));
      }
      if (params?.user !== undefined) {
        if (params.user === null) {
          query = query.is("assigned_user_id", null);
        } else {
          query = query.eq("assigned_user_id", params.user);
        }
      }
      if (params?.startDate) {
        query = query.gte("date", params.startDate);
      }
      if (params?.endDate) {
        query = query.lte("date", params.endDate);
      }

      if (params?.isCheck) {
        const today = new Date().toISOString().split("T")[0];
        query = query.lte("date_prevue", today);
        const refs = await getReferenceCache();
        const checkStatusIds = Array.from(refs.interventionStatusesById.values())
          .filter((s: { code?: string; id?: string }) => isCheckStatus(s.code as InterventionStatusKey, null))
          .map((s: { code?: string; id?: string }) => s.id);
        if (checkStatusIds.length > 0) {
          query = query.in("statut_id", checkStatusIds);
        }
      }

      if (signal) {
        query = query.abortSignal(signal);
      }

      const { count, error } = await query;

      if (error) {
        // Gestion des erreurs d'annulation
        if (error.message?.includes('aborted') || error.code === 'ABORT_ERR') {
          const abortError = new Error(error.message);
          abortError.name = 'AbortError';
          throw abortError;
        }

        const errorMessage = error.message || JSON.stringify(error, Object.getOwnPropertyNames(error));
        console.error(`[interventionsApi.getTotalCountWithFilters] Erreur Supabase:`, {
          error,
          errorMessage,
          params,
        });
        throw new Error(`Erreur lors du comptage des interventions: ${errorMessage}`);
      }

      return count ?? 0;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Erreur inattendue lors du comptage: ${JSON.stringify(error, Object.getOwnPropertyNames(error))}`);
    }
  },

  /**
   * Obtient le nombre d'interventions par statut
   */
  async getCountsByStatus(
    params?: Omit<InterventionQueryParams, "limit" | "offset" | "include" | "statut" | "statuts">
  ): Promise<Record<string, number>> {
    let query = supabase
      .from("interventions")
      .select("statut_id", { count: "exact", head: false })
      .eq("is_active", true);

    if (params?.agence) {
      query = query.eq("agence_id", params.agence);
    }
    if (params?.metier && typeof params.metier === 'string') {
      const refs = await getReferenceCache();
      query = query.eq("metier_id", resolveMetierToId(params.metier, refs.metiersById));
    }
    if (params?.metiers && params.metiers.length > 0) {
      const refs = await getReferenceCache();
      query = query.in("metier_id", params.metiers.map((c) => resolveMetierToId(c, refs.metiersById)));
    }
    if (params?.user !== undefined) {
      if (params.user === null) {
        query = query.is("assigned_user_id", null);
      } else {
        query = query.eq("assigned_user_id", params.user);
      }
    }
    if (params?.startDate) {
      query = query.gte("date", params.startDate);
    }
    if (params?.endDate) {
      query = query.lte("date", params.endDate);
    }

    const { data, error } = await query;
    if (error) throw error;
    if (!data) return {};

    const counts: Record<string, number> = {};
    for (const row of data) {
      const statusId = row.statut_id;
      if (statusId) {
        counts[statusId] = (counts[statusId] || 0) + 1;
      }
    }

    return counts;
  },

  /**
   * Obtient les comptages d'interventions groupés par propriété en 1 seule requête RPC.
   * Remplace N appels getCountByPropertyValue par 1 seul appel SQL GROUP BY.
   */
  async getFilterCountsGrouped(
    property: 'metier' | 'agence' | 'statut' | 'user',
    baseFilters?: Omit<InterventionQueryParams, 'limit' | 'offset' | 'include'>
  ): Promise<Record<string, number>> {
    const columnMap: Record<string, string> = {
      metier: 'metier_id',
      agence: 'agence_id',
      statut: 'statut_id',
      user: 'assigned_user_id',
    }
    const p_group_column = columnMap[property]

    // Résoudre le metier code → UUID si nécessaire (même pattern que getTotalCountWithFilters)
    let p_metier_id: string | null = null
    if (baseFilters?.metier && typeof baseFilters.metier === 'string') {
      const refs = await getReferenceCache()
      p_metier_id = resolveMetierToId(baseFilters.metier, refs.metiersById)
    }

    const { data, error } = await supabase.rpc('get_intervention_filter_counts', {
      p_group_column,
      p_statut_id: baseFilters?.statut || null,
      p_agence_id: baseFilters?.agence || null,
      p_metier_id,
      p_user_id: baseFilters?.user || null,
      p_start_date: baseFilters?.startDate || null,
      p_end_date: baseFilters?.endDate || null,
    })

    if (error) {
      console.error(`[getFilterCountsGrouped] Erreur RPC pour ${property}:`, error)
      throw new Error(`Erreur lors du comptage groupé: ${error.message}`)
    }

    const counts: Record<string, number> = {}
    if (data) {
      for (const row of data as Array<{ group_value: string; cnt: number }>) {
        counts[row.group_value] = Number(row.cnt)
      }
    }
    return counts
  },

  /**
   * Compte le nombre d'interventions pour une valeur spécifique d'une propriété
   */
  async getCountByPropertyValue(
    property: 'metier' | 'agence' | 'statut' | 'user',
    value: string | null,
    baseFilters?: Omit<InterventionQueryParams, 'limit' | 'offset' | 'include'>
  ): Promise<number> {
    try {
      const params: InterventionQueryParams = {
        ...baseFilters,
      }

      switch (property) {
        case 'metier':
          params.metier = value || undefined
          break
        case 'agence':
          params.agence = value || undefined
          break
        case 'statut':
          params.statut = value || undefined
          break
        case 'user':
          params.user = value === null ? null : value
          break
      }

      return await this.getTotalCountWithFilters(params)
    } catch (error) {
      console.error(`[getCountByPropertyValue] Erreur pour ${property}=${value}:`, error)
      return 0
    }
  },

  /**
   * Obtient les valeurs distinctes d'une colonne d'intervention
   */
  async getDistinctValues(
    column: string,
    params?: Omit<InterventionQueryParams, "limit" | "offset" | "include">
  ): Promise<string[]> {
    const refs = await getReferenceCache();

    const normalizedColumn = column.trim().toLowerCase();

    switch (normalizedColumn) {
      case "statusvalue":
      case "statut":
      case "statut_id":
        return refs.data.interventionStatuses.map((s) => s.code || s.label);
      case "attribuea":
      case "assigned_user_id":
        return refs.data.users.map((u) => {
          const fullName = `${u.firstname ?? ""} ${u.lastname ?? ""}`.trim();
          return fullName || u.username;
        });
      case "agence":
      case "agence_id":
        return refs.data.agencies.map((a) => a.label || a.code);
      case "metier":
      case "metier_id":
        return refs.data.metiers.map((m) => m.code || m.label);
    }

    const columnMap: Record<string, string> = {
      codepostal: "code_postal",
      code_postal: "code_postal",
      ville: "ville",
    };

    const dbColumn = columnMap[normalizedColumn] || column;
    const limit = 250;

    let query = supabase
      .from("interventions")
      .select(dbColumn, { head: false })
      .eq("is_active", true)
      .order(dbColumn, { ascending: true, nullsFirst: false })
      .not(dbColumn, "is", null)
      .limit(limit);

    if (params?.statut) {
      query = query.eq("statut_id", params.statut);
    }
    if (params?.statuts && params.statuts.length > 0) {
      query = query.in("statut_id", params.statuts);
    }
    if (params?.agence) {
      query = query.eq("agence_id", params.agence);
    }
    if (params?.metier && typeof params.metier === 'string') {
      query = query.eq("metier_id", resolveMetierToId(params.metier, refs.metiersById));
    }
    if (params?.user !== undefined) {
      if (params.user === null) {
        query = query.is("assigned_user_id", null);
      } else {
        query = query.eq("assigned_user_id", params.user);
      }
    }
    if (params?.startDate) {
      query = query.gte("date", params.startDate);
    }
    if (params?.endDate) {
      query = query.lte("date", params.endDate);
    }

    const { data, error } = await query;

    if (error) {
      console.error(`Error fetching distinct values for column "${dbColumn}":`, error);
      throw error;
    }
    if (!data) return [];

    const seen = new Set<string>();
    const values: string[] = [];

    for (const row of data) {
      const raw = row[dbColumn as keyof typeof row];
      if (raw == null || raw === "") continue;
      const value = String(raw);
      if (seen.has(value)) continue;
      seen.add(value);
      values.push(value);
    }

    return values;
  },

  /**
   * Alias pour getTotalCountWithFilters
   */
  async getCountWithFilters(
    params?: Omit<InterventionQueryParams, "limit" | "offset" | "include">
  ): Promise<number> {
    return this.getTotalCountWithFilters(params);
  },
};
