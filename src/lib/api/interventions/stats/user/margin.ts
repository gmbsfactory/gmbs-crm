// ===== USER STATS - MARGIN =====
// Statistiques de marge agrégées pour un utilisateur, calculées via
// interventionsCosts.calculateMarginForIntervention.
//
// Périmètre (signalement n°17 du 02/07/2026) : on facture le jour où
// l'intervention passe en Terminée. La marge d'une période ne compte donc
// que les interventions TERMINÉES pendant cette période (date de la
// transition vers INTER_TERMINEE), pas les dossiers simplement « datés »
// dedans — une inter En cours avec des coûts saisis gonflait la marge alors
// que rien n'était facturé. Logique propre aux cartes marge du dashboard,
// indépendante du podium.

import { supabase } from "@/lib/api/common/client";
import type { InterventionCost, MarginStats } from "@/lib/api/common/types";
import { interventionsCosts } from "@/lib/api/interventions/interventions-costs";
import { requireUserId, throwSupabaseError } from "./_shared";

export type MarginTransitionRow = {
  intervention_id: string;
  interventions: {
    id: string;
    id_inter: string | null;
    intervention_costs: InterventionCost[] | null;
  } | null;
};

/**
 * Agrège la marge depuis les lignes de transition vers Terminée.
 * Une intervention repassée plusieurs fois en Terminée sur la période
 * (réouverture puis re-clôture) n'est comptée qu'une fois.
 */
export function aggregateMarginFromTransitions(
  rows: MarginTransitionRow[],
  startDate?: string,
  endDate?: string
): MarginStats {
  let totalRevenue = 0;
  let totalCosts = 0;
  let totalMargin = 0;
  let interventionsWithCosts = 0;
  const seen = new Set<string>();

  for (const row of rows) {
    const intervention = row.interventions;
    if (!intervention) continue;
    if (seen.has(intervention.id)) continue;
    seen.add(intervention.id);

    const marginCalc = interventionsCosts.calculateMarginForIntervention(
      intervention.intervention_costs || [],
      intervention.id_inter || intervention.id
    );

    if (marginCalc) {
      totalRevenue += marginCalc.revenue;
      totalCosts += marginCalc.costs;
      totalMargin += marginCalc.margin;
      interventionsWithCosts++;
    }
  }

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

/** Borne de début : « YYYY-MM-DD » → minuit inclus (convention du podium). */
export function normalizeStartBound(startDate: string): string {
  return startDate.includes("T") ? startDate : `${startDate}T00:00:00`;
}

/** Borne de fin : « YYYY-MM-DD » → lendemain minuit EXCLUSIF (couvre toute la journée). */
export function normalizeEndBoundExclusive(endDate: string): string {
  if (endDate.includes("T")) return endDate;
  const end = new Date(`${endDate}T00:00:00`);
  end.setDate(end.getDate() + 1);
  const y = end.getFullYear();
  const m = String(end.getMonth() + 1).padStart(2, "0");
  const d = String(end.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}T00:00:00`;
}

export async function getMarginStatsByUser(
  userId: string,
  startDate?: string,
  endDate?: string,
  signal?: AbortSignal
): Promise<MarginStats> {
  requireUserId(userId);

  let query = supabase
    .from("intervention_status_transitions")
    .select(
      `
      intervention_id,
      interventions!inner (
        id,
        id_inter,
        intervention_costs (
          id,
          cost_type,
          amount,
          label
        )
      )
      `
    )
    .eq("to_status_code", "INTER_TERMINEE")
    // Ignore les « transitions » sans changement réel de statut
    .or("from_status_code.is.null,from_status_code.neq.INTER_TERMINEE")
    .eq("interventions.assigned_user_id", userId)
    .eq("interventions.is_active", true);

  if (startDate) query = query.gte("transition_date", normalizeStartBound(startDate));
  if (endDate) query = query.lt("transition_date", normalizeEndBoundExclusive(endDate));
  if (signal) query = query.abortSignal(signal);

  const { data, error } = await query;

  if (error) {
    throwSupabaseError(error, "Erreur lors de la récupération des statistiques de marge");
  }

  return aggregateMarginFromTransitions(
    (data as unknown as MarginTransitionRow[]) || [],
    startDate,
    endDate
  );
}
