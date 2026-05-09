// ===== USER STATS - STATUS COUNTS =====
// Compteurs d'interventions par statut pour un utilisateur (incluant le
// statut virtuel "Check" calculé côté client).

import { supabase } from "@/lib/api/common/client";
import type { InterventionStatsByStatus } from "@/lib/api/common/types";
import { isCheckStatus } from "@/lib/interventions/checkStatus";
import type { StatusQueryRow } from "@/lib/api/interventions/stats/types";
import { requireUserId, throwSupabaseError } from "./_shared";

/**
 * Récupère les statistiques d'interventions par statut pour un utilisateur.
 */
export async function getStatsByUser(
  userId: string,
  startDate?: string,
  endDate?: string,
  signal?: AbortSignal
): Promise<InterventionStatsByStatus> {
  requireUserId(userId);

  let query = supabase
    .from("interventions")
    .select(
      `
      statut_id,
      date_prevue,
      status:intervention_statuses(id, code, label)
      `,
      { count: "exact" }
    )
    .eq("assigned_user_id", userId)
    .eq("is_active", true);

  if (startDate) query = query.gte("created_at", startDate);
  if (endDate) query = query.lte("created_at", endDate);
  if (signal) query = query.abortSignal(signal);

  const { data, error, count } = await query;

  if (error) {
    throwSupabaseError(error, "Erreur lors de la récupération des statistiques");
  }

  const byStatus: Record<string, number> = {};
  const byStatusLabel: Record<string, number> = {};
  let interventionsAChecker = 0;

  ((data as StatusQueryRow[]) || []).forEach((item) => {
    const status = item.status;
    const statusCode = status?.code || null;
    const datePrevue = item.date_prevue || null;

    if (isCheckStatus(statusCode, datePrevue)) {
      interventionsAChecker++;
      byStatus["CHECK"] = (byStatus["CHECK"] || 0) + 1;
      byStatusLabel["Check"] = (byStatusLabel["Check"] || 0) + 1;
    }

    if (status) {
      const code = status.code || "SANS_STATUT";
      const label = status.label || "Sans statut";
      byStatus[code] = (byStatus[code] || 0) + 1;
      byStatusLabel[label] = (byStatusLabel[label] || 0) + 1;
    } else {
      byStatus["SANS_STATUT"] = (byStatus["SANS_STATUT"] || 0) + 1;
      byStatusLabel["Sans statut"] = (byStatusLabel["Sans statut"] || 0) + 1;
    }
  });

  return {
    total: count || 0,
    by_status: byStatus,
    by_status_label: byStatusLabel,
    interventions_a_checker: interventionsAChecker,
    period: {
      start_date: startDate || null,
      end_date: endDate || null,
    },
  };
}
