// ===== INTERVENTIONS STATS - ADMIN DASHBOARD =====
// Orchestration des stats du dashboard administrateur.
// Un unique appel RPC `get_admin_dashboard_stats_v3` renvoie un payload JSON
// que l'on dispatche dans des mappers purs (un par "tranche" : KPI principaux,
// breakdown statuts, perf métier / agence / gestionnaire, séries sparkline,
// volume par statut, funnel de conversion).

import { supabase } from "@/lib/api/common/client";
import { getReferenceCache } from "@/lib/api/common/utils";
import type {
  AdminDashboardStats,
  DashboardPeriodParams,
} from "@/lib/api/common/types";
import { calculatePeriodDates } from "./_period-helpers";
import type {
  ConversionFunnelRow,
  PerformanceRow,
  SparklineRow,
  StatusBreakdownRow,
  VolumeByStatusRow,
} from "./types";

// ---------- Helpers de période ----------

function resolvePeriodWindow(params: DashboardPeriodParams): { start: string; end: string } {
  const { periodType, referenceDate, startDate, endDate } = params;
  if (startDate && endDate) return { start: startDate, end: endDate };
  const refDate = referenceDate ? new Date(referenceDate) : new Date();
  return calculatePeriodDates(periodType, refDate, startDate, endDate);
}

// ---------- Mappers purs (rpcResult -> tranche du payload final) ----------

function mapMainStats(kpiMain: Record<string, unknown>): AdminDashboardStats["mainStats"] {
  const num = (k: string) => Number((kpiMain as Record<string, unknown>)[k] ?? 0);
  return {
    nbInterventionsDemandees: num("nb_interventions_demandees"),
    nbInterventionsTerminees: num("nb_interventions_terminees"),
    nbDevis: 0, // v3 ne retourne pas ce champ
    nbValides: 0, // v3 ne retourne pas ce champ
    tauxTransformation: num("taux_transformation"),
    chiffreAffaires: num("ca_total"),
    tauxMarge: num("taux_marge"),
    couts: num("couts_total"),
    marge: num("marge_total"),
    avgCycleTime: 0,
    deltaInterventions: 0, // v3 ne calcule pas les deltas
    deltaChiffreAffaires: 0,
    deltaMarge: 0,
  };
}

function mapSparklines(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  return (raw as SparklineRow[]).map((item) => ({
    date: item.date,
    countDemandees: item.nb_interventions_demandees ?? 0,
    countTerminees: item.nb_interventions_terminees ?? 0,
    ca_jour: item.ca_jour ?? 0,
    marge_jour: item.marge_jour ?? 0,
  }));
}

function mapVolumeByStatus(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  return (raw as VolumeByStatusRow[]).map((item) => ({
    date: item.date,
    demande: item.demande ?? 0,
    devis_envoye: item.devis_envoye ?? 0,
    accepte: item.accepte ?? 0,
    en_cours: item.en_cours ?? 0,
    termine: item.termine ?? 0,
  }));
}

function mapConversionFunnel(raw: unknown) {
  const arr = Array.isArray(raw) ? (raw as ConversionFunnelRow[]) : [];
  return arr.map((item) => ({
    statusCode: item.status_code || "",
    count: item.count || 0,
  }));
}

function mapStatusBreakdown(raw: unknown) {
  const arr = Array.isArray(raw) ? (raw as StatusBreakdownRow[]) : [];
  return arr.map((item) => ({
    statusCode: item.status_code || "",
    statusLabel: item.status_label || "",
    count: item.count || 0,
  }));
}

function mapMetierStats(raw: unknown) {
  const arr = Array.isArray(raw) ? (raw as PerformanceRow[]) : [];
  return arr
    .map((item) => {
      const metierId = String(item.metier_id || "");
      if (!metierId) return null;

      const ca = Number(item.ca_total || 0);
      const marge = Number(item.marge_total || 0);
      const nbInterventionsPrises = Number(item.nb_interventions_demandees || 0);

      return {
        metierId,
        metierLabel: String(item.metier_nom || "Inconnu"),
        nbInterventionsPrises,
        nbInterventionsTerminees: Number(item.nb_interventions_terminees || 0),
        ca,
        couts: ca - marge,
        marge,
        tauxMarge: Number(item.taux_marge || 0),
        percentage: Number(item.pourcentage_volume || 0),
        count: nbInterventionsPrises,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => (b.nbInterventionsPrises ?? 0) - (a.nbInterventionsPrises ?? 0));
}

function mapAgencyStats(raw: unknown) {
  const arr = Array.isArray(raw) ? (raw as PerformanceRow[]) : [];
  return arr
    .map((item) => {
      const ca = Number(item.ca_total || 0);
      const marge = Number(item.marge_total || 0);
      return {
        agencyId: String(item.agence_id || ""),
        agencyLabel: String(item.agence_nom || "Inconnu"),
        nbTotalInterventions: Number(item.nb_interventions_demandees || 0),
        nbInterventionsTerminees: Number(item.nb_interventions_terminees || 0),
        tauxMarge: Number(item.taux_marge || 0),
        ca,
        couts: ca - marge,
        marge,
      };
    })
    .sort((a, b) => b.ca - a.ca);
}

function mapGestionnaireStats(raw: unknown) {
  const arr = Array.isArray(raw) ? (raw as PerformanceRow[]) : [];
  return arr
    .map((item) => {
      const ca = Number(item.ca_total || 0);
      const marge = Number(item.marge_total || 0);
      return {
        gestionnaireId: String(item.gestionnaire_id || ""),
        gestionnaireLabel: String(item.gestionnaire_nom || "Inconnu"),
        nbInterventionsPrises: Number(item.nb_interventions_prises || 0),
        nbInterventionsTerminees: Number(item.nb_interventions_terminees || 0),
        tauxTransformation: Number(item.taux_completion || 0),
        tauxMarge: Number(item.taux_marge || 0),
        ca,
        couts: ca - marge,
        marge,
      };
    })
    .sort((a, b) => b.ca - a.ca);
}

// ---------- Orchestrateur ----------

/**
 * Récupère toutes les statistiques du dashboard administrateur.
 * OPTIMISATION : un unique appel RPC `get_admin_dashboard_stats_v3`.
 */
export async function getAdminDashboardStats(
  params: DashboardPeriodParams
): Promise<AdminDashboardStats> {
  const { agenceIds, gestionnaireIds, metierIds } = params;
  const { start: periodStart, end: periodEnd } = resolvePeriodWindow(params);

  const { data: rpcResult, error: rpcError } = await supabase.rpc(
    "get_admin_dashboard_stats_v3",
    {
      p_period_start: `${periodStart}T00:00:00`,
      p_period_end: `${periodEnd}T23:59:59`,
      p_agence_ids: agenceIds && agenceIds.length > 0 ? agenceIds : null,
      p_metier_ids: metierIds && metierIds.length > 0 ? metierIds : null,
      p_gestionnaire_ids: gestionnaireIds && gestionnaireIds.length > 0 ? gestionnaireIds : null,
      p_top_gestionnaires: 10,
      p_top_agences: 10,
    }
  );

  if (rpcError) {
    console.error("Erreur RPC get_admin_dashboard_stats_v3:", rpcError);
    throw rpcError;
  }
  if (!rpcResult) {
    throw new Error("Aucune donnée retournée par la fonction RPC");
  }

  // Préchauffe le cache de référence + fetch statuses en parallèle
  // (résultats non utilisés ici, mais préservent le comportement existant :
  // remplit les caches partagés pour les appels suivants).
  await Promise.all([
    getReferenceCache(),
    supabase.from("intervention_statuses").select("id, code, label"),
  ]);

  const mainStats = mapMainStats(rpcResult.kpi_main || {});
  const breakdown = mapStatusBreakdown(rpcResult.status_breakdown);
  const metierStats = mapMetierStats(rpcResult.performance_metiers);
  const agencyStats = mapAgencyStats(rpcResult.performance_agences);
  const gestionnaireStats = mapGestionnaireStats(rpcResult.performance_gestionnaires);
  const sparklines = mapSparklines(rpcResult.sparkline_data);
  const volumeByStatus = mapVolumeByStatus(rpcResult.volume_by_status);
  const conversionFunnel = mapConversionFunnel(rpcResult.conversion_funnel);

  return {
    mainStats,
    sparklines,
    statusBreakdown: breakdown,
    conversionFunnel,
    volumeByStatus,
    metierBreakdown: metierStats,
    metierStats,
    agencyStats,
    gestionnaireStats,
  };
}
