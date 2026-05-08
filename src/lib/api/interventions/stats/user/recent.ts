// ===== USER STATS - RECENT INTERVENTIONS =====
// Listes récentes pour un utilisateur :
//   - getRecentInterventionsByUser : par due_date ascendant (proches échéances)
//   - getRecentInterventionsByStatusAndUser : top N par statut, due_date desc
// Le statut virtuel "Check" est filtré côté client par date_prevue passée.

import { supabase } from "@/lib/api/common/client";
import type {
  RecentInterventionByStatusRow,
  RecentInterventionQueryRow,
} from "@/lib/api/interventions/stats/types";
import { requireUserId, throwSupabaseError } from "./_shared";

export type RecentInterventionItem = {
  id: string;
  id_inter: string | null;
  due_date: string | null;
  date_prevue: string | null;
  date: string;
  status: { label: string; code: string } | null;
  adresse: string | null;
  ville: string | null;
  costs: {
    sst?: number;
    materiel?: number;
    intervention?: number;
    marge?: number;
  };
};

export type RecentInterventionByStatusItem = {
  id: string;
  id_inter: string | null;
  due_date: string | null;
  status_label: string | null;
  status_color: string | null;
  agence_label: string | null;
  metier_label: string | null;
  metier_code: string | null;
  marge: number;
};

/**
 * Interventions récentes triées par due_date ascendant (nulls en dernier).
 */
export async function getRecentInterventionsByUser(
  userId: string,
  limit: number = 10,
  startDate?: string,
  endDate?: string
): Promise<RecentInterventionItem[]> {
  requireUserId(userId);

  let query = supabase
    .from("interventions")
    .select(
      `
      id,
      id_inter,
      due_date,
      date_prevue,
      date,
      adresse,
      ville,
      status:intervention_statuses(id, code, label),
      intervention_costs (
        cost_type,
        amount
      )
      `
    )
    .eq("assigned_user_id", userId)
    .eq("is_active", true);

  if (startDate) query = query.gte("date", startDate);
  if (endDate) query = query.lte("date", endDate);

  query = query
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("date", { ascending: true })
    .limit(limit);

  const { data, error } = await query;

  if (error) {
    throw new Error(`Erreur lors de la récupération des interventions récentes: ${error.message}`);
  }

  return ((data as RecentInterventionQueryRow[]) || []).map((item) => {
    const costs: RecentInterventionItem["costs"] = {};
    if (Array.isArray(item.intervention_costs)) {
      item.intervention_costs.forEach((cost) => {
        const costType = cost.cost_type as keyof RecentInterventionItem["costs"];
        if (costType && cost.amount !== null && cost.amount !== undefined) {
          costs[costType] = (costs[costType] || 0) + Number(cost.amount);
        }
      });
    }

    return {
      id: item.id,
      id_inter: item.id_inter,
      due_date: item.due_date,
      date_prevue: item.date_prevue,
      date: item.date,
      status: item.status
        ? { label: item.status.label || "", code: item.status.code || "" }
        : null,
      adresse: item.adresse,
      ville: item.ville,
      costs,
    };
  });
}

/**
 * Top N interventions d'un statut donné, triées par due_date descendant.
 * Le filtre par label est fait côté client (Supabase ne permet pas de filtrer
 * sur status.label via la relation). "Check" est un statut virtuel : on filtre
 * via date_prevue < now côté requête.
 */
export async function getRecentInterventionsByStatusAndUser(
  userId: string,
  statusLabel: string,
  limit: number = 5,
  startDate?: string,
  endDate?: string,
  signal?: AbortSignal
): Promise<RecentInterventionByStatusItem[]> {
  requireUserId(userId);
  if (!statusLabel) {
    throw new Error("statusLabel is required");
  }

  const isCheckStatus = statusLabel === "Check";

  let query = supabase
    .from("interventions")
    .select(
      `
      id,
      id_inter,
      due_date,
      date_prevue,
      date,
      agence_id,
      metier_id,
      status:intervention_statuses(id, code, label, color),
      agence:agencies(id, label, code),
      metier:metiers!metier_id(id, label, code),
      intervention_costs (
        cost_type,
        amount
      )
      `
    )
    .eq("assigned_user_id", userId)
    .eq("is_active", true);

  if (isCheckStatus) {
    const now = new Date().toISOString();
    query = query.not("date_prevue", "is", null).lt("date_prevue", now);
  }

  if (startDate) query = query.gte("date", startDate);
  if (endDate) query = query.lte("date", endDate);

  query = query
    .order("due_date", { ascending: false, nullsFirst: false })
    .order("date", { ascending: false })
    .limit(100); // sur-récupération pour filtrage côté client par label

  if (signal) query = query.abortSignal(signal);

  const { data, error } = await query;

  if (error) {
    throwSupabaseError(error, "Erreur lors de la récupération des interventions");
  }

  return ((data as RecentInterventionByStatusRow[]) || [])
    .filter((item) => isCheckStatus || item.status?.label === statusLabel)
    .map((item) => {
      let marge = 0;
      if (Array.isArray(item.intervention_costs)) {
        item.intervention_costs.forEach((cost) => {
          if (cost.cost_type === "marge" && cost.amount !== null && cost.amount !== undefined) {
            marge += Number(cost.amount);
          }
        });
      }

      const status = item.status;
      return {
        id: item.id,
        id_inter: item.id_inter,
        due_date: item.due_date,
        status_label: isCheckStatus ? "Check" : status?.label || null,
        status_color: isCheckStatus ? "#EF4444" : status?.color || null,
        agence_label: item.agence?.label || null,
        metier_label: item.metier?.label || null,
        metier_code: item.metier?.code || null,
        marge,
      };
    })
    .sort((a, b) => {
      if (!a.due_date && !b.due_date) return 0;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return new Date(b.due_date).getTime() - new Date(a.due_date).getTime();
    })
    .slice(0, limit);
}
