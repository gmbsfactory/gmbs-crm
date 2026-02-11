// ===== INTERVENTIONS FILTERS =====
// Fonctions de comptage avec filtres et valeurs distinctes

import { supabase } from "@/lib/api/v2/common/client";
import type {
  InterventionQueryParams,
} from "@/lib/api/v2/common/types";
import {
  getReferenceCache,
} from "@/lib/api/v2/common/utils";
import { isCheckStatus } from "@/lib/interventions/checkStatus";
import type { InterventionStatusKey } from "@/config/interventions";

export const interventionsFilters = {
  /**
   * Obtient le nombre total d'interventions correspondant aux filtres
   */
  async getTotalCountWithFilters(
    params?: Omit<InterventionQueryParams, "limit" | "offset" | "include">
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
        const metierObj = Array.from(refs.metiersById.values()).find(
          (m: { code?: string; id?: string }) =>
            m.code?.toUpperCase() === params.metier?.toUpperCase() ||
            m.id === params.metier
        );
        const metierId = metierObj?.id || params.metier;
        query = query.eq("metier_id", metierId);
      }
      if (params?.metiers && params.metiers.length > 0) {
        const refs = await getReferenceCache();
        const metierIds = params.metiers.map((metierCodeOrId) => {
          const metierObj = Array.from(refs.metiersById.values()).find(
            (m: { code?: string; id?: string }) =>
              m.code?.toUpperCase() === metierCodeOrId?.toUpperCase() ||
              m.id === metierCodeOrId
          );
          return metierObj?.id || metierCodeOrId;
        });
        query = query.in("metier_id", metierIds);
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

      const { count, error } = await query;

      if (error) {
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
      const metierObj = Array.from(refs.metiersById.values()).find(
        (m: { code?: string; id?: string }) =>
          m.code?.toUpperCase() === params.metier?.toUpperCase() ||
          m.id === params.metier
      );
      const metierId = metierObj?.id || params.metier;
      query = query.eq("metier_id", metierId);
    }
    if (params?.metiers && params.metiers.length > 0) {
      const refs = await getReferenceCache();
      const metierIds = params.metiers.map((metierCodeOrId) => {
        const metierObj = Array.from(refs.metiersById.values()).find(
          (m: { code?: string; id?: string }) =>
            m.code?.toUpperCase() === metierCodeOrId?.toUpperCase() ||
            m.id === metierCodeOrId
        );
        return metierObj?.id || metierCodeOrId;
      });
      query = query.in("metier_id", metierIds);
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
      const metierObj = Array.from(refs.metiersById.values()).find(
        (m: { code?: string; id?: string }) =>
          m.code?.toUpperCase() === params.metier?.toUpperCase() ||
          m.id === params.metier
      );
      const metierId = metierObj?.id || params.metier;
      query = query.eq("metier_id", metierId);
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
