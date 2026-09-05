// ===== INTERVENTIONS FILTERS =====
// Fonctions de comptage avec filtres et valeurs distinctes

import { supabase } from "@/lib/api/common/client";
import type {
  InterventionQueryParams,
} from "@/lib/api/common/types";
import {
  getReferenceCache,
  resolveMetierToId,
} from "@/lib/api/common/utils";
import { isCheckStatus } from "@/lib/interventions/checkStatus";
import { PORTAL_REPORT_REVIEW_STATUSES } from "@/lib/interventions/portal-report-status";
import type { InterventionStatusKey } from "@/config/interventions";

/**
 * Résout les statuts « À vérifier » en UUID depuis le cache de référence.
 * Filet de sécurité : la page envoie déjà `portalReportStatuts` (résolu par
 * filter-converter) ; on ne recalcule que si l'appelant ne l'a pas fait.
 */
async function resolvePortalReportStatusIds(): Promise<string[]> {
  const refs = await getReferenceCache();
  const codes = PORTAL_REPORT_REVIEW_STATUSES as readonly string[];
  return Array.from(refs.interventionStatusesById.values())
    .filter((s: { code?: string; id?: string }) => Boolean(s.code) && codes.includes(s.code as string))
    .map((s: { id?: string }) => s.id)
    .filter((id): id is string => Boolean(id));
}

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
      if (params?.agences && params.agences.length > 0) {
        query = query.in("agence_id", params.agences);
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

      // Vue « Mes vérifications » : même critère que la liste (Edge Function) —
      // le drapeau `has_portal_report` ET les statuts de revue. Sans cette
      // branche, le compteur de la puce compterait avant filtrage.
      if (params?.hasPortalReport !== undefined) {
        query = query.eq("has_portal_report", params.hasPortalReport);
        if (params.hasPortalReport) {
          const statusIds = params.portalReportStatuts?.length
            ? params.portalReportStatuts
            : await resolvePortalReportStatusIds();
          if (statusIds.length > 0) {
            query = query.in("statut_id", statusIds);
          }
        }
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
    if (params?.agences && params.agences.length > 0) {
      query = query.in("agence_id", params.agences);
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

    // La vue Market pose baseFilters.user = null pour « non-assignée ». On le
    // route via p_user_is_null (booléen dédié) car p_user_id = NULL signifie
    // « pas de filtre utilisateur » côté RPC — sans ce flag, la contrainte est
    // silencieusement ignorée et le compteur est gonflé (voir migration 99067).
    const rpcParams: Record<string, unknown> = {
      p_group_column,
      p_statut_id: baseFilters?.statut || null,
      p_agence_id: baseFilters?.agence || null,
      p_metier_id,
      p_user_id: typeof baseFilters?.user === 'string' ? baseFilters.user : null,
      p_user_is_null: baseFilters?.user === null,
      p_start_date: baseFilters?.startDate || null,
      p_end_date: baseFilters?.endDate || null,
    }

    // Vue « Mes vérifications » : le RPC ne sait pas exprimer
    // « has_portal_report + statuts de revue » sans drapeau dédié. Sans lui,
    // les puces de statut/agence/métier de cette vue compteraient toutes les
    // interventions de l'utilisateur (voir migration 99086, même piège que
    // p_user_is_null en 99067).
    //
    // Le drapeau n'est ajouté au payload QUE lorsqu'il vaut true : PostgREST
    // résout une RPC par son jeu de noms d'arguments. L'envoyer toujours
    // couplerait le front à la migration 99086 — tant qu'elle n'est pas
    // appliquée, l'appel échouerait en PGRST202 et ce sont TOUTES les puces
    // (statut, agence, métier) de la page qui disparaîtraient, quelle que soit
    // la vue. Omis, l'ancienne signature reste compatible.
    if (baseFilters?.hasPortalReport === true) {
      rpcParams.p_has_portal_report = true
    }

    const { data, error } = await supabase.rpc('get_intervention_filter_counts', rpcParams)

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
        return refs.data.agencies.filter((a) => a.is_active).map((a) => a.label || a.code);
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
    if (params?.agences && params.agences.length > 0) {
      query = query.in("agence_id", params.agences);
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
