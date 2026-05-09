// ===== USER STATS - MARGIN =====
// Statistiques de marge agrégées pour un utilisateur, calculées via
// interventionsCosts.calculateMarginForIntervention.

import { supabase } from "@/lib/api/common/client";
import type { InterventionCost, MarginStats } from "@/lib/api/common/types";
import { interventionsCosts } from "@/lib/api/interventions/interventions-costs";
import type { MarginQueryRow } from "@/lib/api/interventions/stats/types";
import { requireUserId, throwSupabaseError } from "./_shared";

export async function getMarginStatsByUser(
  userId: string,
  startDate?: string,
  endDate?: string,
  signal?: AbortSignal
): Promise<MarginStats> {
  requireUserId(userId);

  let query = supabase
    .from("interventions")
    .select(
      `
      id,
      id_inter,
      intervention_costs (
        id,
        cost_type,
        amount,
        label
      )
      `
    )
    .eq("assigned_user_id", userId)
    .eq("is_active", true);

  if (startDate) query = query.gte("date", startDate);
  if (endDate) query = query.lte("date", endDate);
  if (signal) query = query.abortSignal(signal);

  const { data, error } = await query;

  if (error) {
    throwSupabaseError(error, "Erreur lors de la récupération des statistiques de marge");
  }

  let totalRevenue = 0;
  let totalCosts = 0;
  let totalMargin = 0;
  let interventionsWithCosts = 0;

  ((data as MarginQueryRow[]) || []).forEach((intervention) => {
    const marginCalc = interventionsCosts.calculateMarginForIntervention(
      (intervention.intervention_costs as unknown as InterventionCost[]) || [],
      intervention.id_inter || intervention.id
    );

    if (marginCalc) {
      totalRevenue += marginCalc.revenue;
      totalCosts += marginCalc.costs;
      totalMargin += marginCalc.margin;
      interventionsWithCosts++;
    }
  });

  // Pourcentage global (pas la moyenne des pourcentages)
  const averageMarginPercentage = totalRevenue > 0 ? (totalMargin / totalRevenue) * 100 : 0;

  return {
    average_margin_percentage: Math.round(averageMarginPercentage * 100) / 100,
    total_interventions: interventionsWithCosts,
    total_revenue: Math.round(totalRevenue * 100) / 100,
    total_costs: Math.round(totalCosts * 100) / 100,
    total_margin: Math.round(totalMargin * 100) / 100,
    period: {
      start_date: startDate || null,
      end_date: endDate || null,
    },
  };
}
