// ===== INTERVENTIONS STATS =====
// Statistiques, marges, dashboard admin, historiques KPI

import { supabase } from "@/lib/api/v2/common/client";
import { RevenueProjectionService } from "@/lib/services/revenueProjection";
import type {
  AdminDashboardStats,
  DashboardPeriodParams,
  GestionnaireMarginRanking,
  InterventionCost,
  InterventionStatsByStatus,
  InterventionQueryParams,
  KPIHistoryParams,
  MarginCalculation,
  MarginRankingResult,
  MarginStats,
  MonthlyStats,
  PeriodType,
  RevenueHistoryParams,
  RevenueHistoryData,
  RevenueHistoryResponse,
  InterventionsHistoryData,
  InterventionsHistoryResponse,
  TransformationRateHistoryData,
  TransformationRateHistoryResponse,
  CycleTimeHistoryData,
  CycleTimeHistoryResponse,
  MarginHistoryData,
  MarginHistoryResponse,
  StatsPeriod,
  WeeklyStats,
  WeekDayStats,
  MonthWeekStats,
  YearMonthStats,
  YearlyStats,
} from "@/lib/api/v2/common/types";
import { getReferenceCache } from "@/lib/api/v2/common/utils";
import { isCheckStatus } from "@/lib/interventions/checkStatus";
import type { InterventionStatusKey } from "@/config/interventions";

// ===== Internal types for Supabase query results =====
interface StatusQueryRow {
  statut_id: string | null;
  date_prevue: string | null;
  status: { id?: string; code?: string; label?: string } | null;
}

interface MarginQueryRow {
  id: string;
  id_inter: string | null;
  intervention_costs: Array<{ id: string; cost_type: string; amount: number; label: string | null }>;
}

interface TransitionRow {
  id: string;
  transition_date: string;
  to_status_code: string;
  interventions: Record<string, unknown> | Array<Record<string, unknown>>;
}

interface ArtisanCreatedRow {
  id: string;
  created_at: string | null;
  gestionnaire_id: string | null;
}

interface ArtisanMissionneRow {
  id: string;
  created_at: string | null;
  gestionnaire_id: string | null;
  intervention_artisans: unknown;
}

interface RpcRankingItem {
  user_id: string;
  total_margin: number;
  total_revenue: number;
  total_interventions: number;
  average_margin_percentage: number;
}

interface RpcRankingResult {
  rankings: RpcRankingItem[];
  period?: { start_date: string | null; end_date: string | null };
}

interface SparklineRow {
  date: string;
  nb_interventions_demandees?: number;
  nb_interventions_terminees?: number;
  ca_jour?: number;
  marge_jour?: number;
}

interface VolumeByStatusRow {
  date: string;
  demande?: number;
  devis_envoye?: number;
  accepte?: number;
  en_cours?: number;
  termine?: number;
}

interface StatusBreakdownRow {
  status_code: string;
  status_label: string;
  count: number;
}

interface ConversionFunnelRow {
  status_code: string;
  count: number;
}

interface PerformanceRow {
  [key: string]: unknown;
}

interface RecentInterventionQueryRow {
  id: string;
  id_inter: string | null;
  due_date: string | null;
  date_prevue: string | null;
  date: string;
  adresse: string | null;
  ville: string | null;
  status: { id?: string; code?: string; label?: string; color?: string } | null;
  intervention_costs: Array<{ cost_type: string; amount: number | null }>;
}

interface RecentInterventionByStatusRow {
  id: string;
  id_inter: string | null;
  due_date: string | null;
  date_prevue: string | null;
  date: string;
  agence_id: string | null;
  metier_id: string | null;
  status: { id?: string; code?: string; label?: string; color?: string } | null;
  agence: { id?: string; label?: string; code?: string } | null;
  metier: { id?: string; label?: string; code?: string } | null;
  intervention_costs: Array<{ cost_type: string; amount: number | null }>;
}

// Référence vers les méthodes costs — sera injectée par l'index
let _costsRef: { calculateMarginForIntervention: (costs: InterventionCost[], interventionId?: string | number) => MarginCalculation | null } | null = null;

export function _setCostsRef(ref: typeof _costsRef) {
  _costsRef = ref;
}

export const interventionsStats = {
  /**
   * Récupère les statistiques d'interventions par statut pour un utilisateur
   * @param userId - ID de l'utilisateur
   * @param startDate - Date de début (optionnelle, format ISO string)
   * @param endDate - Date de fin (optionnelle, format ISO string)
   * @returns Statistiques avec le nombre d'interventions par statut
   */
  async getStatsByUser(
    userId: string,
    startDate?: string,
    endDate?: string,
    signal?: AbortSignal
  ): Promise<InterventionStatsByStatus> {
    if (!userId) {
      throw new Error("userId is required");
    }

    // Construire la requête de base - inclure date_prevue pour détecter le statut "Check"
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
      .eq("is_active", true); // Seulement les interventions actives

    if (startDate) {
      query = query.gte("created_at", startDate);
    }
    if (endDate) {
      query = query.lte("created_at", endDate);
    }

    if (signal) {
      query = query.abortSignal(signal);
    }

    const { data, error, count } = await query;

    if (error) {
      // Si c'est une annulation intentionnelle, on relance une AbortError standard
      if (error.message?.includes('aborted') || error.code === 'ABORT_ERR') {
        const abortError = new Error(error.message);
        abortError.name = 'AbortError';
        throw abortError;
      }
      throw new Error(`Erreur lors de la récupération des statistiques: ${error.message}`);
    }

    // Initialiser les compteurs
    const byStatus: Record<string, number> = {};
    const byStatusLabel: Record<string, number> = {};
    let interventionsAChecker = 0;

    // Compter les interventions par statut
    (data as StatusQueryRow[] || []).forEach((item) => {
      const status = item.status;
      const statusCode = status?.code || null;
      const datePrevue = item.date_prevue || null;

      // Vérifier si c'est une intervention CHECK (statut virtuel)
      const isCheck = isCheckStatus(statusCode, datePrevue);
      if (isCheck) {
        interventionsAChecker++;
        // Ajouter au comptage du statut virtuel CHECK
        byStatus["CHECK"] = (byStatus["CHECK"] || 0) + 1;
        byStatusLabel["Check"] = (byStatusLabel["Check"] || 0) + 1;
      }

      // Compter aussi le statut réel (en plus du statut virtuel CHECK si applicable)
      if (status) {
        const code = status.code || "SANS_STATUT";
        const label = status.label || "Sans statut";

        byStatus[code] = (byStatus[code] || 0) + 1;
        byStatusLabel[label] = (byStatusLabel[label] || 0) + 1;
      } else {
        // Intervention sans statut
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
  },

  /**
   * Récupère les statistiques de marge pour un utilisateur
   * @param userId - ID de l'utilisateur
   * @param startDate - Date de début (optionnelle, format ISO string)
   * @param endDate - Date de fin (optionnelle, format ISO string)
   * @returns Statistiques de marge avec le pourcentage moyen
   */
  async getMarginStatsByUser(
    userId: string,
    startDate?: string,
    endDate?: string,
    signal?: AbortSignal
  ): Promise<MarginStats> {
    if (!userId) {
      throw new Error("userId is required");
    }

    // Construire la requête avec les coûts
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
      .eq("is_active", true); // Seulement les interventions actives

    // Appliquer les filtres de date si fournis
    if (startDate) {
      query = query.gte("date", startDate);
    }
    if (endDate) {
      query = query.lte("date", endDate);
    }

    if (signal) {
      query = query.abortSignal(signal);
    }

    const { data, error } = await query;

    if (error) {
      if (error.message?.includes('aborted') || error.code === 'ABORT_ERR') {
        const abortError = new Error(error.message);
        abortError.name = 'AbortError';
        throw abortError;
      }
      throw new Error(
        `Erreur lors de la récupération des statistiques de marge: ${error.message}`
      );
    }

    let totalRevenue = 0;
    let totalCosts = 0;
    let totalMargin = 0;
    let interventionsWithCosts = 0;

    // Parcourir les interventions et calculer les marges
    (data as MarginQueryRow[] || []).forEach((intervention) => {
      if (!_costsRef) throw new Error("Costs reference not initialized");
      const marginCalc = _costsRef.calculateMarginForIntervention(
        intervention.intervention_costs as unknown as InterventionCost[] || [],
        intervention.id_inter || intervention.id
      );

      if (marginCalc) {
        totalRevenue += marginCalc.revenue;
        totalCosts += marginCalc.costs;
        totalMargin += marginCalc.margin;
        interventionsWithCosts++;
      }
    });

    // Calculer le pourcentage global (pas la moyenne des pourcentages)
    let averageMarginPercentage = 0;
    if (totalRevenue > 0) {
      averageMarginPercentage = (totalMargin / totalRevenue) * 100;
    }

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
  },

  /**
   * Récupère le classement des gestionnaires par marge totale sur une période
   * @param startDate - Date de début (optionnelle, format ISO string)
   * @param endDate - Date de fin (optionnelle, format ISO string)
   * @returns Classement des gestionnaires trié par marge totale décroissante
   */
  async getMarginRankingByPeriod(
    startDate?: string,
    endDate?: string
  ): Promise<MarginRankingResult> {
    // Normaliser les dates pour correspondre au format attendu par la fonction SQL
    // La fonction SQL attend des timestamps avec heures/minutes/secondes
    // Si la date contient déjà 'T', c'est une ISO string complète, sinon on ajoute l'heure
    let periodStart: string | null = null;
    let periodEnd: string | null = null;

    if (startDate) {
      periodStart = startDate.includes('T') ? startDate : `${startDate}T00:00:00`;
    }

    if (endDate) {
      if (endDate.includes('T')) {
        periodEnd = endDate;
      } else {
        // Pour la fin de période, utiliser le début du jour suivant moins 1 seconde
        // pour être cohérent avec get_admin_dashboard_stats qui utilise date < periodEnd
        const endDateObj = new Date(endDate);
        endDateObj.setDate(endDateObj.getDate() + 1);
        endDateObj.setHours(0, 0, 0, 0);
        endDateObj.setSeconds(endDateObj.getSeconds() - 1);
        periodEnd = endDateObj.toISOString();
      }
    }

    if (!periodStart || !periodEnd) {
      return {
        rankings: [],
        period: {
          start_date: startDate || null,
          end_date: endDate || null,
        },
      };
    }

    // Appeler la fonction RPC SQL qui calcule les rankings
    const { data: rpcResult, error: rpcError } = await supabase.rpc(
      'get_podium_ranking_by_period',
      {
        p_period_start: periodStart,
        p_period_end: periodEnd,
      }
    );

    if (rpcError) {
      throw new Error(`Erreur lors de la récupération du classement: ${rpcError.message}`);
    }

    if (!rpcResult || !rpcResult.rankings || rpcResult.rankings.length === 0) {
      return {
        rankings: [],
        period: {
          start_date: startDate || null,
          end_date: endDate || null,
        },
      };
    }

    // Récupérer les informations des utilisateurs pour enrichir les résultats
    const rpcTyped = rpcResult as RpcRankingResult;
    const userIds = rpcTyped.rankings.map((r) => r.user_id);
    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("id, firstname, lastname, code_gestionnaire, color, avatar_url")
      .in("id", userIds);

    if (usersError) {
      throw new Error(`Erreur lors de la récupération des utilisateurs: ${usersError.message}`);
    }

    // Créer un map pour accéder rapidement aux infos utilisateur
    const usersMap = new Map(
      (users || []).map((u) => [u.id, u])
    );

    // Mapper les résultats SQL avec les informations utilisateur
    const rankings: GestionnaireMarginRanking[] = rpcTyped.rankings.map((item, index: number) => {
      const user = usersMap.get(item.user_id);
      const fullName = user
        ? `${user.firstname || ""} ${user.lastname || ""}`.trim() || user.code_gestionnaire || "Utilisateur"
        : "Utilisateur";

      return {
        user_id: item.user_id,
        user_name: fullName,
        user_firstname: user?.lastname || null, // Utiliser lastname car c'est le prénom dans votre système
        user_code: user?.code_gestionnaire || null,
        user_color: user?.color || null,
        user_avatar_url: user?.avatar_url || null,
        total_margin: item.total_margin || 0,
        total_revenue: item.total_revenue || 0,
        total_interventions: item.total_interventions || 0,
        average_margin_percentage: item.average_margin_percentage || 0,
        rank: index + 1, // Les rangs sont déjà triés par la fonction SQL (par marge décroissante)
      };
    });

    return {
      rankings,
      period: {
        start_date: rpcResult.period?.start_date || startDate || null,
        end_date: rpcResult.period?.end_date || endDate || null,
      },
    };
  },

  /**
   * Récupère le classement des gestionnaires par marge totale sur une période
   * Utilise get_dashboard_performance_gestionnaires_v3 (cohérent avec admin dashboard)
   * @param startDate - Date de début (optionnelle, format ISO string)
   * @param endDate - Date de fin (optionnelle, format ISO string)
   * @returns Classement des gestionnaires trié par marge totale décroissante
   */
  async getMarginRankingByPeriodV3(
    startDate?: string,
    endDate?: string
  ): Promise<MarginRankingResult> {
    // Normaliser les dates pour correspondre au format attendu par la fonction SQL
    let periodStart: string | null = null;
    let periodEnd: string | null = null;

    if (startDate) {
      periodStart = startDate.includes('T') ? startDate : `${startDate}T00:00:00`;
    }

    if (endDate) {
      if (endDate.includes('T')) {
        periodEnd = endDate;
      } else {
        // Pour la fin de période, utiliser la fin du jour
        periodEnd = `${endDate}T23:59:59`;
      }
    }

    if (!periodStart || !periodEnd) {
      return {
        rankings: [],
        period: {
          start_date: startDate || null,
          end_date: endDate || null,
        },
      };
    }

    // Appeler la fonction RPC SQL spécialisée pour le podium (basée sur la date de complétion)
    const { data: rpcResult, error: rpcError } = await supabase.rpc(
      'get_podium_ranking_by_period',
      {
        p_period_start: periodStart,
        p_period_end: periodEnd,
      }
    );

    if (rpcError) {
      throw new Error(`Erreur lors de la récupération du classement: ${rpcError.message}`);
    }

    if (!rpcResult || !rpcResult.rankings || !Array.isArray(rpcResult.rankings) || rpcResult.rankings.length === 0) {
      return {
        rankings: [],
        period: {
          start_date: startDate || null,
          end_date: endDate || null,
        },
      };
    }

    // Récupérer les informations des utilisateurs pour enrichir les résultats
    const rpcTypedV3 = rpcResult as RpcRankingResult;
    const userIds = rpcTypedV3.rankings.map((r) => r.user_id);
    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("id, firstname, lastname, code_gestionnaire, color, avatar_url")
      .in("id", userIds);

    if (usersError) {
      throw new Error(`Erreur lors de la récupération des informations utilisateurs: ${usersError.message}`);
    }

    // Créer un map pour accéder rapidement aux infos utilisateur
    const usersMap = new Map(
      (users || []).map((u) => [u.id, u])
    );

    // Mapper les résultats SQL avec les informations utilisateur
    // Note: get_podium_ranking_by_period renvoie déjà les résultats triés par marge décroissante
    const rankings: GestionnaireMarginRanking[] = rpcTypedV3.rankings.map((item, index: number) => {
      const user = usersMap.get(item.user_id);

      const firstname = user?.firstname || "";
      const lastname = user?.lastname || "";
      const fullName = [firstname, lastname].filter(Boolean).join(" ") || "Utilisateur inconnu";

      return {
        user_id: item.user_id,
        user_name: fullName,
        user_firstname: firstname || null,
        user_code: user?.code_gestionnaire || null,
        user_color: user?.color || null,
        user_avatar_url: user?.avatar_url || null,
        total_margin: Number(item.total_margin || 0),
        total_revenue: Number(item.total_revenue || 0),
        total_interventions: Number(item.total_interventions || 0),
        average_margin_percentage: Number(item.average_margin_percentage || 0),
        rank: index + 1,
      };
    });

    return {
      rankings,
      period: {
        start_date: rpcResult.period?.start_date || startDate || null,
        end_date: rpcResult.period?.end_date || endDate || null,
      },
    };
  },

  /**
   * Récupère les statistiques hebdomadaires pour un utilisateur (semaine en cours)
   * @param userId - ID de l'utilisateur
   * @param weekStartDate - Date de début de la semaine (optionnelle, lundi de la semaine en cours par défaut)
   * @returns Statistiques par jour de la semaine (Lundi à Vendredi)
   */
  async getWeeklyStatsByUser(
    userId: string,
    weekStartDate?: string,
    signal?: AbortSignal
  ): Promise<WeeklyStats> {
    if (!userId) {
      throw new Error("userId is required");
    }

    // Calculer les dates de la semaine (lundi à vendredi)
    let monday: Date;
    if (weekStartDate) {
      monday = new Date(weekStartDate);
      monday.setHours(0, 0, 0, 0);
    } else {
      // Trouver le lundi de la semaine en cours
      const now = new Date();
      const day = now.getDay(); // 0 = dimanche, 1 = lundi, ..., 6 = samedi
      // Si dimanche (0), reculer de 6 jours. Sinon, reculer de (day - 1) jours
      const daysToSubtract = day === 0 ? 6 : day - 1;
      monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysToSubtract);
      monday.setHours(0, 0, 0, 0);

    }

    const tuesday = new Date(monday);
    tuesday.setDate(monday.getDate() + 1);
    const wednesday = new Date(monday);
    wednesday.setDate(monday.getDate() + 2);
    const thursday = new Date(monday);
    thursday.setDate(monday.getDate() + 3);
    const friday = new Date(monday);
    friday.setDate(monday.getDate() + 4);
    const saturday = new Date(monday);
    saturday.setDate(monday.getDate() + 5);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const nextMonday = new Date(monday);
    nextMonday.setDate(monday.getDate() + 7);

    // Formater les dates pour les requêtes (YYYY-MM-DD) en utilisant le temps local
    const formatDate = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    const mondayStr = formatDate(monday);
    const tuesdayStr = formatDate(tuesday);
    const wednesdayStr = formatDate(wednesday);
    const thursdayStr = formatDate(thursday);
    const fridayStr = formatDate(friday);
    const saturdayStr = formatDate(saturday);
    const sundayStr = formatDate(sunday);

    // Pour la fin de période, on utilise le début du lundi suivant
    const nextMondayStr = formatDate(nextMonday);

    // Récupérer les transitions de statut pour la période
    // Fonction helper pour initialiser les stats d'un jour
    const initDayStats = (): WeekDayStats => ({
      lundi: 0,
      mardi: 0,
      mercredi: 0,
      jeudi: 0,
      vendredi: 0,
      samedi: 0,
      dimanche: 0,
      total: 0,
    });

    // Initialiser les compteurs
    const devisEnvoye = initDayStats();
    const interEnCours = initDayStats();
    const interFactures = initDayStats();
    const nouveauxArtisans = initDayStats();

    let query = supabase
      .from("intervention_status_transitions")
      .select(`
        id,
        transition_date,
        to_status_code,
        interventions!inner(assigned_user_id, is_active)
      `)
      .eq("interventions.assigned_user_id", userId)
      .eq("interventions.is_active", true)
      .in("to_status_code", ["DEVIS_ENVOYE", "INTER_EN_COURS", "INTER_TERMINEE"])
      .gte("transition_date", mondayStr)
      .lt("transition_date", nextMondayStr);

    if (signal) {
      query = query.abortSignal(signal);
    }

    const { data: transitions, error: transitionsError } = await query;

    if (transitionsError) {
      if (transitionsError.message?.includes('aborted') || transitionsError.code === 'ABORT_ERR') {
        const abortError = new Error(transitionsError.message);
        abortError.name = 'AbortError';
        throw abortError;
      }
      throw new Error(`Erreur lors de la récupération des transitions de statut: ${transitionsError.message}`);
    }

    // Compter les transitions par jour et par statut
    ((transitions as unknown as TransitionRow[]) || []).forEach((transition) => {
      const transitionDate = new Date(transition.transition_date);
      const dateStr = formatDate(transitionDate);
      const statusCode = transition.to_status_code;

      let dayKey: keyof WeekDayStats | null = null;
      if (dateStr === mondayStr) dayKey = "lundi";
      else if (dateStr === tuesdayStr) dayKey = "mardi";
      else if (dateStr === wednesdayStr) dayKey = "mercredi";
      else if (dateStr === thursdayStr) dayKey = "jeudi";
      else if (dateStr === fridayStr) dayKey = "vendredi";
      else if (dateStr === saturdayStr) dayKey = "samedi";
      else if (dateStr === sundayStr) dayKey = "dimanche";

      // Compter selon le statut (pour le total)
      if (statusCode === "DEVIS_ENVOYE") {
        if (dayKey) devisEnvoye[dayKey]++;
        devisEnvoye.total++;
      } else if (statusCode === "INTER_EN_COURS") {
        if (dayKey) interEnCours[dayKey]++;
        interEnCours.total++;
      } else if (statusCode === "INTER_TERMINEE") {
        if (dayKey) interFactures[dayKey]++;
        interFactures.total++;
      }
    });

    // Récupérer les artisans créés par l'utilisateur pour la semaine
    const { data: artisans, error: artisansError } = await supabase
      .from("artisans")
      .select("id, created_at, gestionnaire_id")
      .eq("gestionnaire_id", userId)
      .eq("is_active", true)
      .gte("created_at", mondayStr)
      .lt("created_at", nextMondayStr);

    if (artisansError) {
      throw new Error(`Erreur lors de la récupération des artisans: ${artisansError.message}`);
    }

    // Compter les artisans par jour
    (artisans as ArtisanCreatedRow[] || []).forEach((artisan) => {
      // Utiliser uniquement created_at
      const artisanDate = artisan.created_at ? new Date(artisan.created_at) : null;

      if (!artisanDate) return;

      const dateStr = formatDate(artisanDate);
      let dayKey: keyof WeekDayStats | null = null;
      if (dateStr === mondayStr) dayKey = "lundi";
      else if (dateStr === tuesdayStr) dayKey = "mardi";
      else if (dateStr === wednesdayStr) dayKey = "mercredi";
      else if (dateStr === thursdayStr) dayKey = "jeudi";
      else if (dateStr === fridayStr) dayKey = "vendredi";
      else if (dateStr === saturdayStr) dayKey = "samedi";
      else if (dateStr === sundayStr) dayKey = "dimanche";

      if (dayKey) {
        nouveauxArtisans[dayKey]++;
      }

      nouveauxArtisans.total++;
    });

    // Récupérer les artisans créés sur la période avec au moins une intervention active (artisans missionnés)
    const artisansMissionnes: WeekDayStats = {
      lundi: 0,
      mardi: 0,
      mercredi: 0,
      jeudi: 0,
      vendredi: 0,
      samedi: 0,
      dimanche: 0,
      total: 0,
    };

    // On récupère les artisans créés pendant la semaine qui ont au moins une intervention active
    const { data: artisansMissionnesData, error: artisansMissionnesError } = await supabase
      .from("artisans")
      .select(`
        id,
        created_at,
        gestionnaire_id,
        intervention_artisans!inner(
          interventions!inner(id, is_active)
        )
      `)
      .eq("gestionnaire_id", userId)
      .eq("is_active", true)
      .eq("intervention_artisans.interventions.is_active", true)
      .gte("created_at", mondayStr)
      .lt("created_at", nextMondayStr);

    if (artisansMissionnesError) {
      console.error("Erreur lors de la récupération des artisans missionnés:", artisansMissionnesError);
    } else if (artisansMissionnesData) {
      // Dédupliquer les artisans (car le JOIN peut créer plusieurs lignes par artisan)
      const uniqueArtisans = new Map<string, ArtisanMissionneRow>();
      (artisansMissionnesData as ArtisanMissionneRow[]).forEach((artisan) => {
        if (!uniqueArtisans.has(artisan.id)) {
          uniqueArtisans.set(artisan.id, artisan);
        }
      });

      // Compter les artisans missionnés par jour
      uniqueArtisans.forEach((artisan) => {
        const artisanDate = artisan.created_at ? new Date(artisan.created_at) : null;

        if (!artisanDate) return;

        const dateStr = formatDate(artisanDate);
        let dayKey: keyof WeekDayStats | null = null;
        if (dateStr === mondayStr) dayKey = "lundi";
        else if (dateStr === tuesdayStr) dayKey = "mardi";
        else if (dateStr === wednesdayStr) dayKey = "mercredi";
        else if (dateStr === thursdayStr) dayKey = "jeudi";
        else if (dateStr === fridayStr) dayKey = "vendredi";
        else if (dateStr === saturdayStr) dayKey = "samedi";
        else if (dateStr === sundayStr) dayKey = "dimanche";

        if (dayKey) {
          artisansMissionnes[dayKey]++;
        }

        artisansMissionnes.total++;
      });
    }

    return {
      devis_envoye: devisEnvoye,
      inter_en_cours: interEnCours,
      inter_factures: interFactures,
      nouveaux_artisans: nouveauxArtisans,
      artisans_missionnes: artisansMissionnes,
      week_start: monday.toISOString(),
      week_end: sunday.toISOString(),
    };
  },

  /**
   * Récupère les statistiques par période pour un utilisateur (semaine, mois ou année)
   * @param userId - ID de l'utilisateur
   * @param period - Type de période ("week", "month", "year")
   * @param startDate - Date de début (optionnelle, période en cours par défaut)
   * @returns Statistiques selon la période choisie
   */
  async getPeriodStatsByUser(
    userId: string,
    period: StatsPeriod,
    startDate?: string,
    signal?: AbortSignal
  ): Promise<WeeklyStats | MonthlyStats | YearlyStats> {
    if (!userId) {
      throw new Error("userId is required");
    }

    const formatDate = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    if (period === "week") {
      return interventionsStats.getWeeklyStatsByUser(userId, startDate, signal);
    }

    if (period === "month") {
      // Calculer le mois (mois en cours par défaut)
      let monthStart: Date;
      if (startDate) {
        monthStart = new Date(startDate);
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);
      } else {
        const now = new Date();
        monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        monthStart.setHours(0, 0, 0, 0);
      }

      const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0, 23, 59, 59);
      const nextMonthStart = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1);
      const monthStartStr = formatDate(monthStart);
      const monthEndStr = formatDate(monthEnd);
      const nextMonthStartStr = formatDate(nextMonthStart);

      // Calculer les semaines du mois
      const weeks: { start: Date; end: Date }[] = [];
      let currentWeekStart = new Date(monthStart);

      // Trouver le lundi de la première semaine
      const firstDay = currentWeekStart.getDay();
      const diffToMonday = firstDay === 0 ? -6 : 1 - firstDay;
      currentWeekStart.setDate(currentWeekStart.getDate() + diffToMonday);

      while (currentWeekStart <= monthEnd) {
        const weekEnd = new Date(currentWeekStart);
        weekEnd.setDate(currentWeekStart.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999); // S'assurer que dimanche est inclus

        if (currentWeekStart <= monthEnd) {
          weeks.push({
            start: new Date(currentWeekStart),
            end: weekEnd <= monthEnd ? weekEnd : monthEnd,
          });
        }

        currentWeekStart.setDate(currentWeekStart.getDate() + 7); // Semaine suivante
      }

      // Initialiser les stats par semaine
      const initWeekStats = (): MonthWeekStats => ({
        semaine1: 0,
        semaine2: 0,
        semaine3: 0,
        semaine4: 0,
        semaine5: 0,
        total: 0,
      });

      const devisEnvoye = initWeekStats();
      const interEnCours = initWeekStats();
      const interFactures = initWeekStats();

      // Récupérer les transitions de statut du mois
      const { data: transitions, error: transitionsError } = await supabase
        .from("intervention_status_transitions")
        .select(`
          id,
          transition_date,
          to_status_code,
          interventions!inner(assigned_user_id, is_active)
        `)
        .eq("interventions.assigned_user_id", userId)
        .eq("interventions.is_active", true)
        .in("to_status_code", ["DEVIS_ENVOYE", "INTER_EN_COURS", "INTER_TERMINEE"])
        .gte("transition_date", monthStartStr)
        .lte("transition_date", monthEndStr);

      if (transitionsError) {
        throw new Error(`Erreur lors de la récupération des transitions: ${transitionsError.message}`);
      }

      // Compter par semaine
      ((transitions as unknown as TransitionRow[]) || []).forEach((transition) => {
        const transitionDate = new Date(transition.transition_date);
        const statusCode = transition.to_status_code;

        // Trouver dans quelle semaine tombe cette transition
        for (let i = 0; i < weeks.length && i < 5; i++) {
          const week = weeks[i];
          if (transitionDate >= week.start && transitionDate <= week.end) {
            const weekKey = `semaine${i + 1}` as keyof MonthWeekStats;

            if (statusCode === "DEVIS_ENVOYE") {
              devisEnvoye[weekKey]++;
              devisEnvoye.total++;
            } else if (statusCode === "INTER_EN_COURS") {
              interEnCours[weekKey]++;
              interEnCours.total++;
            } else if (statusCode === "INTER_TERMINEE") {
              interFactures[weekKey]++;
              interFactures.total++;
            }
            break;
          }
        }
      });

      const nouveauxArtisans = initWeekStats();

      // Récupérer les artisans du mois
      const { data: artisans, error: artisansError } = await supabase
        .from("artisans")
        .select("id, created_at, gestionnaire_id")
        .eq("gestionnaire_id", userId)
        .eq("is_active", true)
        .gte("created_at", monthStartStr)
        .lt("created_at", nextMonthStartStr); // Utiliser lt pour tout le mois

      if (artisansError) {
        throw new Error(`Erreur lors de la récupération des artisans: ${artisansError.message}`);
      }

      // Compter les artisans par semaine
      (artisans as ArtisanCreatedRow[] || []).forEach((artisan) => {
        const artisanDate = artisan.created_at ? new Date(artisan.created_at) : null;

        if (!artisanDate) return;

        for (let i = 0; i < weeks.length && i < 5; i++) {
          const week = weeks[i];
          if (artisanDate >= week.start && artisanDate <= week.end) {
            const weekKey = `semaine${i + 1}` as keyof MonthWeekStats;
            nouveauxArtisans[weekKey]++;
            break;
          }
        }

        // Toujours incrémenter le total pour le mois (même si WE ou hors buckets semaine)
        nouveauxArtisans.total++;
      });

      // Récupérer les artisans créés sur la période avec au moins une intervention (artisans missionnés)
      const artisansMissionnes = initWeekStats();

      // On récupère les artisans créés pendant le mois qui ont au moins une intervention active
      const { data: artisansMissionnesData, error: artisansMissionnesError } = await supabase
        .from("artisans")
        .select(`
          id,
          created_at,
          gestionnaire_id,
          intervention_artisans!inner(
            interventions!inner(id, is_active)
          )
        `)
        .eq("gestionnaire_id", userId)
        .eq("is_active", true)
        .eq("intervention_artisans.interventions.is_active", true)
        .gte("created_at", monthStartStr)
        .lt("created_at", nextMonthStartStr);

      if (!artisansMissionnesError && artisansMissionnesData) {
        // Dédupliquer les artisans (car le JOIN peut créer plusieurs lignes par artisan)
        const uniqueArtisans = new Map<string, ArtisanMissionneRow>();
        (artisansMissionnesData as ArtisanMissionneRow[]).forEach((artisan) => {
          if (!uniqueArtisans.has(artisan.id)) {
            uniqueArtisans.set(artisan.id, artisan);
          }
        });

        // Compter les artisans missionnés par semaine
        uniqueArtisans.forEach((artisan) => {
          const artisanDate = artisan.created_at ? new Date(artisan.created_at) : null;

          if (!artisanDate) return;

          let matched = false;
          for (let i = 0; i < weeks.length && i < 5; i++) {
            const week = weeks[i];
            if (artisanDate >= week.start && artisanDate <= week.end) {
              const weekKey = `semaine${i + 1}` as keyof MonthWeekStats;
              artisansMissionnes[weekKey]++;
              matched = true;
              break;
            }
          }

          artisansMissionnes.total++;
        });
      }

      return {
        devis_envoye: devisEnvoye,
        inter_en_cours: interEnCours,
        inter_factures: interFactures,
        nouveaux_artisans: nouveauxArtisans,
        artisans_missionnes: artisansMissionnes,
        month_start: monthStart.toISOString(),
        month_end: monthEnd.toISOString(),
        month: monthStart.getMonth() + 1,
        year: monthStart.getFullYear(),
      };
    }

    if (period === "year") {
      // Calculer l'année (année en cours par défaut)
      let yearStart: Date;
      if (startDate) {
        yearStart = new Date(startDate);
        yearStart.setMonth(0, 1);
        yearStart.setHours(0, 0, 0, 0);
      } else {
        const now = new Date();
        yearStart = new Date(now.getFullYear(), 0, 1);
        yearStart.setHours(0, 0, 0, 0);
      }

      const yearEnd = new Date(yearStart.getFullYear(), 11, 31, 23, 59, 59);
      const nextYearStart = new Date(yearStart.getFullYear() + 1, 0, 1);
      const yearStartStr = formatDate(yearStart);
      const yearEndStr = formatDate(yearEnd);
      const nextYearStartStr = formatDate(nextYearStart);

      // Initialiser les stats par mois
      const initMonthStats = (): YearMonthStats => ({
        janvier: 0,
        fevrier: 0,
        mars: 0,
        avril: 0,
        mai: 0,
        juin: 0,
        juillet: 0,
        aout: 0,
        septembre: 0,
        octobre: 0,
        novembre: 0,
        decembre: 0,
        total: 0,
      });

      const devisEnvoye = initMonthStats();
      const interEnCours = initMonthStats();
      const interFactures = initMonthStats();

      const monthNames: (keyof YearMonthStats)[] = [
        "janvier", "fevrier", "mars", "avril", "mai", "juin",
        "juillet", "aout", "septembre", "octobre", "novembre", "decembre"
      ];

      // Récupérer les transitions de statut de l'année
      const { data: transitions, error: transitionsError } = await supabase
        .from("intervention_status_transitions")
        .select(`
          id,
          transition_date,
          to_status_code,
          interventions!inner(assigned_user_id, is_active)
        `)
        .eq("interventions.assigned_user_id", userId)
        .eq("interventions.is_active", true)
        .in("to_status_code", ["DEVIS_ENVOYE", "INTER_EN_COURS", "INTER_TERMINEE"])
        .gte("transition_date", yearStartStr)
        .lte("transition_date", yearEndStr);

      if (transitionsError) {
        throw new Error(`Erreur lors de la récupération des transitions: ${transitionsError.message}`);
      }

      // Compter par mois
      ((transitions as unknown as TransitionRow[]) || []).forEach((transition) => {
        const transitionDate = new Date(transition.transition_date);
        const monthIndex = transitionDate.getMonth();
        const monthKey = monthNames[monthIndex];
        const statusCode = transition.to_status_code;

        if (!monthKey) return;

        if (statusCode === "DEVIS_ENVOYE") {
          devisEnvoye[monthKey]++;
          devisEnvoye.total++;
        } else if (statusCode === "INTER_EN_COURS") {
          interEnCours[monthKey]++;
          interEnCours.total++;
        } else if (statusCode === "INTER_TERMINEE") {
          interFactures[monthKey]++;
          interFactures.total++;
        }
      });

      const nouveauxArtisans = initMonthStats();

      // Récupérer les artisans de l'année
      const { data: artisans, error: artisansError } = await supabase
        .from("artisans")
        .select("id, created_at, gestionnaire_id")
        .eq("gestionnaire_id", userId)
        .eq("is_active", true)
        .gte("created_at", yearStartStr)
        .lt("created_at", nextYearStartStr);

      if (artisansError) {
        throw new Error(`Erreur lors de la récupération des artisans: ${artisansError.message}`);
      }

      // Compter les artisans par mois
      (artisans as ArtisanCreatedRow[] || []).forEach((artisan) => {
        const artisanDate = artisan.created_at ? new Date(artisan.created_at) : null;

        if (!artisanDate) return;

        const monthIndex = artisanDate.getMonth();
        const monthKey = monthNames[monthIndex];
        if (monthKey) {
          nouveauxArtisans[monthKey]++;
          nouveauxArtisans.total++;
        }
      });

      // Récupérer les artisans créés sur l'année avec au moins une intervention (artisans missionnés)
      const artisansMissionnes = initMonthStats();

      // On récupère les artisans créés pendant l'année qui ont au moins une intervention active
      const { data: artisansMissionnesData, error: artisansMissionnesError } = await supabase
        .from("artisans")
        .select(`
          id,
          created_at,
          gestionnaire_id,
          intervention_artisans!inner(
            interventions!inner(id, is_active)
          )
        `)
        .eq("gestionnaire_id", userId)
        .eq("is_active", true)
        .eq("intervention_artisans.interventions.is_active", true)
        .gte("created_at", yearStartStr)
        .lt("created_at", nextYearStartStr);

      if (!artisansMissionnesError && artisansMissionnesData) {
        // Dédupliquer les artisans (car le JOIN peut créer plusieurs lignes par artisan)
        const uniqueArtisans = new Map<string, ArtisanMissionneRow>();
        (artisansMissionnesData as ArtisanMissionneRow[]).forEach((artisan) => {
          if (!uniqueArtisans.has(artisan.id)) {
            uniqueArtisans.set(artisan.id, artisan);
          }
        });

        // Compter les artisans missionnés par mois
        uniqueArtisans.forEach((artisan) => {
          const artisanDate = artisan.created_at ? new Date(artisan.created_at) : null;

          if (!artisanDate) return;

          const monthIndex = artisanDate.getMonth();
          const monthKey = monthNames[monthIndex];
          if (monthKey) {
            artisansMissionnes[monthKey]++;
            artisansMissionnes.total++;
          }
        });
      }

      return {
        devis_envoye: devisEnvoye,
        inter_en_cours: interEnCours,
        inter_factures: interFactures,
        nouveaux_artisans: nouveauxArtisans,
        artisans_missionnes: artisansMissionnes,
        year_start: yearStart.toISOString(),
        year_end: yearEnd.toISOString(),
        year: yearStart.getFullYear(),
      };
    }

    throw new Error(`Période non supportée: ${period}`);
  },

  /**
   * Récupère les interventions récentes pour un utilisateur, triées par due_date
   * @param userId - ID de l'utilisateur
   * @param limit - Nombre d'interventions à récupérer (défaut: 10)
   * @param startDate - Date de début (optionnelle)
   * @param endDate - Date de fin (optionnelle)
   * @returns Liste des interventions avec leurs informations de base et coûts
   */
  async getRecentInterventionsByUser(
    userId: string,
    limit: number = 10,
    startDate?: string,
    endDate?: string
  ): Promise<Array<{
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
  }>> {
    if (!userId) {
      throw new Error("userId is required");
    }

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

    // Appliquer les filtres de date si fournis
    if (startDate) {
      query = query.gte("date", startDate);
    }
    if (endDate) {
      query = query.lte("date", endDate);
    }

    // Trier par due_date (nulls en dernier), puis par date
    query = query
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("date", { ascending: true })
      .limit(limit);

    const { data, error } = await query;

    if (error) {
      throw new Error(`Erreur lors de la récupération des interventions récentes: ${error.message}`);
    }

    return (data as RecentInterventionQueryRow[] || []).map((item) => {
      // Grouper les coûts par type
      const costs: { sst?: number; materiel?: number; intervention?: number; marge?: number } = {};
      if (item.intervention_costs && Array.isArray(item.intervention_costs)) {
        item.intervention_costs.forEach((cost) => {
          const costType = cost.cost_type as "sst" | "materiel" | "intervention" | "marge";
          if (costType && cost.amount !== null && cost.amount !== undefined) {
            if (costs[costType] === undefined) {
              costs[costType] = 0;
            }
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
        status: item.status ? { label: item.status.label || "", code: item.status.code || "" } : null,
        adresse: item.adresse,
        ville: item.ville,
        costs,
      };
    });
  },

  /**
   * Récupère les 5 dernières interventions par statut pour un utilisateur, triées par due_date
   * @param userId - ID de l'utilisateur
   * @param statusLabel - Label du statut (ex: "Demandé", "Inter en cours", "Accepté", "Check")
   * @param limit - Nombre d'interventions à récupérer (défaut: 5)
   * @param startDate - Date de début (optionnelle) pour filtrer les interventions
   * @param endDate - Date de fin (optionnelle) pour filtrer les interventions
   * @returns Liste des interventions avec leurs informations de base, statut, agence et marge
   */
  async getRecentInterventionsByStatusAndUser(
    userId: string,
    statusLabel: string,
    limit: number = 5,
    startDate?: string,
    endDate?: string,
    signal?: AbortSignal
  ): Promise<Array<{
    id: string;
    id_inter: string | null;
    due_date: string | null;
    status_label: string | null;
    status_color: string | null;
    agence_label: string | null;
    metier_label: string | null;
    metier_code: string | null;
    marge: number;
  }>> {
    if (!userId) {
      throw new Error("userId is required");
    }
    if (!statusLabel) {
      throw new Error("statusLabel is required");
    }

    // Gérer le cas spécial "Check" qui n'est pas un statut réel dans la DB
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

    // Pour "Check", on filtre par date_prevue (interventions avec date_prevue passée)
    if (isCheckStatus) {
      const now = new Date().toISOString();
      query = query.not("date_prevue", "is", null).lt("date_prevue", now);
    } else {
      // Pour les autres statuts, filtrer par le label du statut
      // On doit d'abord trouver le statut_id correspondant au label
      // Pour cela, on va filtrer via la relation status
      // Note: Supabase ne permet pas de filtrer directement sur status.label dans une relation
      // On va donc récupérer toutes les interventions et filtrer côté client
    }

    // Appliquer les filtres de date si fournis
    if (startDate) {
      query = query.gte("date", startDate);
    }
    if (endDate) {
      query = query.lte("date", endDate);
    }

    // Trier par due_date (nulls en dernier)
    query = query
      .order("due_date", { ascending: false, nullsFirst: false })
      .order("date", { ascending: false })
      .limit(100); // Récupérer plus pour filtrer côté client si nécessaire

    if (signal) {
      query = query.abortSignal(signal);
    }

    const { data, error } = await query;

    if (error) {
      if (error.message?.includes('aborted') || error.code === 'ABORT_ERR') {
        const abortError = new Error(error.message);
        abortError.name = 'AbortError';
        throw abortError;
      }
      throw new Error(`Erreur lors de la récupération des interventions: ${error.message}`);
    }

    // Filtrer et mapper les interventions
    const filtered = (data as RecentInterventionByStatusRow[] || [])
      .filter((item) => {
        if (isCheckStatus) {
          // Pour Check, on a déjà filtré par date_prevue, mais on doit aussi vérifier le statut
          // Check s'applique à certaines interventions selon leur statut et date_prevue
          // Pour simplifier, on accepte toutes les interventions avec date_prevue passée
          return true;
        } else {
          // Filtrer par label du statut
          const status = item.status;
          return status && status.label === statusLabel;
        }
      })
      .map((item) => {
        // Calculer la marge (somme des coûts de type 'marge')
        let marge = 0;
        if (item.intervention_costs && Array.isArray(item.intervention_costs)) {
          item.intervention_costs.forEach((cost) => {
            if (cost.cost_type === "marge" && cost.amount !== null && cost.amount !== undefined) {
              marge += Number(cost.amount);
            }
          });
        }

        // Extraire le statut
        const status = item.status;
        const status_label = isCheckStatus ? "Check" : (status?.label || null);
        const status_color = isCheckStatus ? "#EF4444" : (status?.color || null);

        // Extraire l'agence
        const agence = item.agence;
        const agence_label = agence?.label || null;

        // Extraire le métier
        const metier = item.metier;
        const metier_label = metier?.label || null;
        const metier_code = metier?.code || null;

        return {
          id: item.id,
          id_inter: item.id_inter,
          due_date: item.due_date,
          status_label,
          status_color,
          agence_label,
          metier_label,
          metier_code,
          marge,
        };
      })
      .sort((a, b) => {
        // Trier par due_date (nulls en dernier)
        if (!a.due_date && !b.due_date) return 0;
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return new Date(b.due_date).getTime() - new Date(a.due_date).getTime();
      })
      .slice(0, limit);

    return filtered;
  },

  // ========================================
  // DASHBOARD ADMINISTRATEUR
  // ========================================

  /**
   * Récupère toutes les statistiques du dashboard administrateur
   * OPTIMISATION: Utilise une fonction SQL RPC unique pour réduire de 12-13 requêtes à 1 seule
   */
  async getAdminDashboardStats(
    params: DashboardPeriodParams
  ): Promise<AdminDashboardStats> {
    const { periodType, referenceDate, startDate, endDate, agenceIds, gestionnaireIds, metierIds } = params;

    // Calculer les dates de période
    let periodStart: string;
    let periodEnd: string;

    if (startDate && endDate) {
      periodStart = startDate;
      periodEnd = endDate;
    } else {
      const refDate = referenceDate ? new Date(referenceDate) : new Date();
      const dates = interventionsStats.calculatePeriodDates(periodType, refDate, startDate, endDate);
      periodStart = dates.start;
      periodEnd = dates.end;
    }

    const periodStartTimestamp = `${periodStart}T00:00:00`;
    const periodEndTimestamp = `${periodEnd}T23:59:59`;

    // Appeler la fonction RPC V3
    const { data: rpcResult, error: rpcError } = await supabase.rpc(
      'get_admin_dashboard_stats_v3',
      {
        p_period_start: periodStartTimestamp,
        p_period_end: periodEndTimestamp,
        p_agence_ids: agenceIds && agenceIds.length > 0 ? agenceIds : null,
        p_metier_ids: metierIds && metierIds.length > 0 ? metierIds : null,
        p_gestionnaire_ids: gestionnaireIds && gestionnaireIds.length > 0 ? gestionnaireIds : null,
        p_top_gestionnaires: 10,
        p_top_agences: 10,
      }
    );

    if (rpcError) {
      console.error('\n========================================');
      console.error('ERREUR lors de l\'appel RPC');
      console.error('========================================');
      console.error('Fonction:', 'get_admin_dashboard_stats');
      console.error('Erreur:', rpcError);
      throw rpcError;
    }

    if (!rpcResult) {
      console.error('\nAucune donnée retournée par la fonction RPC');
      throw new Error('Aucune donnée retournée par la fonction RPC');
    }

    // Parser le résultat JSON de la fonction SQL V3
    const kpiMain = rpcResult.kpi_main || {};

    // Mapper les sparklines depuis sparkline_data (v3)
    const rawSparklines = rpcResult.sparkline_data || [];
    const sparklines = Array.isArray(rawSparklines) ? rawSparklines.map((item: SparklineRow) => ({
      date: item.date,
      countDemandees: item.nb_interventions_demandees ?? 0,
      countTerminees: item.nb_interventions_terminees ?? 0,
      ca_jour: item.ca_jour ?? 0,
      marge_jour: item.marge_jour ?? 0
    })) : [];

    // Mapper les données de volume par statut depuis volume_by_status (v3)
    const rawVolumeByStatus = rpcResult.volume_by_status || [];
    const volumeByStatus = Array.isArray(rawVolumeByStatus) ? rawVolumeByStatus.map((item: VolumeByStatusRow) => ({
      date: item.date,
      demande: item.demande ?? 0,
      devis_envoye: item.devis_envoye ?? 0,
      accepte: item.accepte ?? 0,
      en_cours: item.en_cours ?? 0,
      termine: item.termine ?? 0
    })) : [];

    // Récupérer les données de funnel et status depuis la v3
    const rawConversionFunnel = rpcResult.conversion_funnel || [];
    const conversionFunnel = Array.isArray(rawConversionFunnel) ? rawConversionFunnel : [];

    const rawStatusBreakdown = rpcResult.status_breakdown || [];
    const statusBreakdown = Array.isArray(rawStatusBreakdown) ? rawStatusBreakdown : [];

    // Récupérer les données de performance depuis la v3
    const rawMetierStats = rpcResult.performance_metiers || [];
    const rawAgencyStats = rpcResult.performance_agences || [];
    const rawGestionnaireStats = rpcResult.performance_gestionnaires || [];

    // DEBUG: Données brutes reçues

    // Normaliser les codes du funnel de conversion depuis v3
    // V3 retourne déjà: { status_code: 'DEMANDE', count: X }
    // On normalise les codes si nécessaire pour le front
    const normalizedConversionFunnel = (conversionFunnel as ConversionFunnelRow[]).map((item) => ({
      statusCode: item.status_code || '',
      count: item.count || 0,
    }));

    // Récupérer les valeurs depuis kpi_main (v3)
    const nbDemandees = kpiMain.nb_interventions_demandees || 0;
    const nbTerminees = kpiMain.nb_interventions_terminees || 0;
    const tauxTransformation = kpiMain.taux_transformation || 0;
    const totalPaiements = Number(kpiMain.ca_total || 0);
    const totalCouts = Number(kpiMain.couts_total || 0);
    const margeTotal = Number(kpiMain.marge_total || 0);
    const tauxMarge = kpiMain.taux_marge || 0;

    // Log: KPIs principaux

    // Construire mainStats
    const mainStats = {
      nbInterventionsDemandees: nbDemandees,
      nbInterventionsTerminees: nbTerminees,
      nbDevis: 0, // v3 ne retourne pas ce champ
      nbValides: 0, // v3 ne retourne pas ce champ
      tauxTransformation,
      chiffreAffaires: totalPaiements,
      tauxMarge,
      couts: totalCouts,
      marge: margeTotal,
      avgCycleTime: 0,
      deltaInterventions: 0, // v3 ne calcule pas les deltas
      deltaChiffreAffaires: 0, // v3 ne calcule pas les deltas
      deltaMarge: 0, // v3 ne calcule pas les deltas
    };

    // Récupérer le cache de référence pour mapper les codes aux labels
    const refs = await getReferenceCache();

    // Récupérer les statuts pour mapper les codes aux labels
    const { data: statuses } = await supabase
      .from('intervention_statuses')
      .select('id, code, label');

    const statusMapByCode = new Map(statuses?.map((s) => [s.code, s]) || []);

    // ========================================
    // 2. STATISTIQUES DES STATUTS (V3)
    // ========================================

    // Mapper le status breakdown retourné par v3
    // V3 retourne: { status_code: 'XXX', status_label: 'Label', count: N }
    const breakdown = (statusBreakdown as StatusBreakdownRow[]).map((item) => ({
      statusCode: item.status_code || '',
      statusLabel: item.status_label || '',
      count: item.count || 0,
    }));

    // Construire statusStats depuis le breakdown
    const nbDevisEnvoye = breakdown.find((s) => s.statusCode === 'DEVIS_ENVOYE')?.count || 0;
    const nbEnCours = breakdown.find((s) => s.statusCode === 'INTER_EN_COURS')?.count || 0;
    const nbAttAcompte = breakdown.find((s) => s.statusCode === 'ATT_ACOMPTE')?.count || 0;
    const nbAccepte = breakdown.find((s) => s.statusCode === 'ACCEPTE')?.count || 0;

    const statusStats = {
      nbDemandesRecues: mainStats.nbInterventionsDemandees,
      nbDevisEnvoye,
      nbEnCours,
      nbAttAcompte,
      nbAccepte,
      nbTermine: mainStats.nbInterventionsTerminees,
      breakdown,
    };

    // Log: Statistiques par statut

    // ========================================
    // 3. STATISTIQUES PAR MÉTIER (V3)
    // ========================================

    const metierStats = (rawMetierStats as PerformanceRow[])
      .map((item) => {
        const metierId = String(item.metier_id || '');
        if (!metierId) return null;

        const ca = Number(item.ca_total || 0);
        const marge = Number(item.marge_total || 0);
        const tauxMarge = Number(item.taux_marge || 0);
        const nbInterventionsPrises = Number(item.nb_interventions_demandees || 0);
        const nbInterventionsTerminees = Number(item.nb_interventions_terminees || 0);
        const pourcentageVolume = Number(item.pourcentage_volume || 0);

        return {
          metierId,
          metierLabel: String(item.metier_nom || 'Inconnu'),
          nbInterventionsPrises,
          nbInterventionsTerminees,
          ca,
          couts: ca - marge, // Calculé depuis CA et marge
          marge,
          tauxMarge,
          percentage: pourcentageVolume,
          count: nbInterventionsPrises, // compatibilité avec les usages existants
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => (b.nbInterventionsPrises ?? 0) - (a.nbInterventionsPrises ?? 0));

    // Log: Statistiques par métier (top 5)
    metierStats.slice(0, 5).forEach((_metier, _index: number) => {
    });
    if (metierStats.length > 5) {
    }

    // ========================================
    // 4. STATISTIQUES PAR AGENCE (V3)
    // ========================================

    const agencyStats = (rawAgencyStats as PerformanceRow[]).map((item) => {
      const ca = Number(item.ca_total || 0);
      const marge = Number(item.marge_total || 0);
      const tauxMarge = Number(item.taux_marge || 0);

      return {
        agencyId: String(item.agence_id || ''),
        agencyLabel: String(item.agence_nom || 'Inconnu'),
        nbTotalInterventions: Number(item.nb_interventions_demandees || 0),
        nbInterventionsTerminees: Number(item.nb_interventions_terminees || 0),
        tauxMarge,
        ca,
        couts: ca - marge, // Calculé depuis CA et marge
        marge,
      };
    }).sort((a, b) => b.ca - a.ca);

    // DEBUG: agencyStats après mapping
    if (agencyStats.length > 0) {
    }

    // Log: Statistiques par agence (top 5)
    agencyStats.slice(0, 5).forEach((agency: typeof agencyStats[0], index: number) => {
    });
    if (agencyStats.length > 5) {
    }

    // ========================================
    // 5. STATISTIQUES PAR GESTIONNAIRE (V3)
    // ========================================

    const gestionnaireStats = (rawGestionnaireStats as PerformanceRow[]).map((item) => {
      const ca = Number(item.ca_total || 0);
      const marge = Number(item.marge_total || 0);
      const tauxMarge = Number(item.taux_marge || 0);
      const nbInterventionsPrises = Number(item.nb_interventions_prises || 0);
      const nbInterventionsTerminees = Number(item.nb_interventions_terminees || 0);
      const tauxCompletion = Number(item.taux_completion || 0);

      return {
        gestionnaireId: String(item.gestionnaire_id || ''),
        gestionnaireLabel: String(item.gestionnaire_nom || 'Inconnu'),
        nbInterventionsPrises,
        nbInterventionsTerminees,
        tauxTransformation: tauxCompletion, // V3 appelle ça taux_completion
        tauxMarge,
        ca,
        couts: ca - marge, // Calculé depuis CA et marge
        marge,
      };
    }).sort((a, b) => b.ca - a.ca);

    // DEBUG: gestionnaireStats après mapping
    if (gestionnaireStats.length > 0) {
    }

    // Log: Statistiques par gestionnaire (top 5)
    gestionnaireStats.slice(0, 5).forEach((gestionnaire: typeof gestionnaireStats[0], index: number) => {
    });
    if (gestionnaireStats.length > 5) {
    }

    return {
      mainStats,
      sparklines,
      statusBreakdown: breakdown,
      conversionFunnel: normalizedConversionFunnel,
      volumeByStatus,
      metierBreakdown: metierStats,
      metierStats,
      agencyStats,
      gestionnaireStats,
    };
  },

  /**
   * Récupère l'historique du chiffre d'affaires pour les 4 dernières périodes
   * + projection de la période suivante
   */
  async getRevenueHistory(
    params: RevenueHistoryParams
  ): Promise<RevenueHistoryResponse> {
    const {
      periodType,
      startDate,
      endDate,
      agenceIds,
      gestionnaireIds,
      metierIds,
      includeProjection = true,
    } = params;

    // Calculer les 4 dernières périodes basées sur periodType
    const periods = interventionsStats.calculateLast4Periods(periodType, startDate, endDate);

    // Récupérer les données pour chaque période
    const historical: RevenueHistoryData[] = await Promise.all(
      periods.map(async (period) => {
        const stats = await interventionsStats.getAdminDashboardStats({
          periodType,
          startDate: period.start,
          endDate: period.end,
          agenceIds,
          gestionnaireIds,
          metierIds,
        });

        return {
          period: period.key,
          periodLabel: period.label,
          revenue: stats.mainStats.chiffreAffaires,
          isProjection: false,
        };
      })
    );

    // Calculer la projection
    let projection: RevenueHistoryData | undefined;
    if (includeProjection) {
      const nextPeriod = interventionsStats.calculateNextPeriod(periodType, startDate, endDate);
      const projectedRevenue = RevenueProjectionService.calculateProjection(historical);

      projection = {
        period: nextPeriod.key,
        periodLabel: nextPeriod.label,
        revenue: projectedRevenue,
        isProjection: true,
      };
    }

    // Période actuelle (dernière période historique)
    const currentPeriod =
      historical[historical.length - 1] ||
      ({
        period: periods[periods.length - 1]?.key || "",
        periodLabel: periods[periods.length - 1]?.label || "",
        revenue: 0,
        isProjection: false,
      } as RevenueHistoryData);

    return {
      historical,
      projection,
      currentPeriod,
    };
  },

  /**
   * Calcule les 4 dernières périodes selon le type
   */
  calculateLast4Periods(
    periodType: PeriodType,
    startDate?: string,
    endDate?: string
  ): Array<{ key: string; label: string; start: string; end: string }> {
    const periods: Array<{ key: string; label: string; start: string; end: string }> = [];
    const now = new Date();

    // Si des dates sont fournies, utiliser la dernière comme référence
    const referenceDate = endDate ? new Date(endDate) : now;

    for (let i = 3; i >= 0; i--) {
      let periodStart: Date;
      let periodEnd: Date;
      let key: string;
      let label: string;

      switch (periodType) {
        case "month": {
          periodStart = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - i, 1);
          periodEnd = new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, 0);
          periodEnd.setHours(23, 59, 59, 999);
          key = `${periodStart.getFullYear()}-${String(periodStart.getMonth() + 1).padStart(2, "0")}`;
          label = periodStart.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
          // Capitaliser la première lettre
          label = label.charAt(0).toUpperCase() + label.slice(1);
          break;
        }

        case "week": {
          // Calculer le lundi de la semaine
          const day = referenceDate.getDay();
          const diff = referenceDate.getDate() - day + (day === 0 ? -6 : 1) - i * 7;
          periodStart = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), diff);
          periodStart.setHours(0, 0, 0, 0);
          periodEnd = new Date(periodStart);
          periodEnd.setDate(periodStart.getDate() + 4);
          periodEnd.setHours(23, 59, 59, 999);
          const weekNumber = interventionsStats.getWeekNumber(periodStart);
          key = `W${weekNumber}-${periodStart.getFullYear()}`;
          label = `Semaine ${weekNumber}`;
          break;
        }

        case "day": {
          periodStart = new Date(referenceDate);
          periodStart.setDate(periodStart.getDate() - i);
          periodStart.setHours(0, 0, 0, 0);
          periodEnd = new Date(periodStart);
          periodEnd.setHours(23, 59, 59, 999);
          key = periodStart.toISOString().split("T")[0];
          label = periodStart.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
          break;
        }

        case "year": {
          periodStart = new Date(referenceDate.getFullYear() - i, 0, 1);
          periodStart.setHours(0, 0, 0, 0);
          periodEnd = new Date(periodStart.getFullYear(), 11, 31);
          periodEnd.setHours(23, 59, 59, 999);
          key = String(periodStart.getFullYear());
          label = String(periodStart.getFullYear());
          break;
        }

        default:
          throw new Error(`Invalid period type: ${periodType}`);
      }

      periods.push({
        key,
        label,
        start: periodStart.toISOString().split("T")[0],
        end: periodEnd.toISOString().split("T")[0],
      });
    }

    return periods;
  },

  /**
   * Calcule la période suivante pour la projection
   */
  calculateNextPeriod(
    periodType: PeriodType,
    startDate?: string,
    endDate?: string
  ): { key: string; label: string; start: string; end: string } {
    const now = new Date();
    const referenceDate = endDate ? new Date(endDate) : now;

    let periodStart: Date;
    let periodEnd: Date;
    let key: string;
    let label: string;

    switch (periodType) {
      case "month": {
        periodStart = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 1);
        periodStart.setHours(0, 0, 0, 0);
        periodEnd = new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, 0);
        periodEnd.setHours(23, 59, 59, 999);
        key = `${periodStart.getFullYear()}-${String(periodStart.getMonth() + 1).padStart(2, "0")}`;
        label = periodStart.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
        label = label.charAt(0).toUpperCase() + label.slice(1);
        break;
      }

      case "week": {
        const day = referenceDate.getDay();
        const diff = referenceDate.getDate() - day + (day === 0 ? -6 : 1) + 7;
        periodStart = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), diff);
        periodStart.setHours(0, 0, 0, 0);
        periodEnd = new Date(periodStart);
        periodEnd.setDate(periodStart.getDate() + 4);
        periodEnd.setHours(23, 59, 59, 999);
        const weekNumber = interventionsStats.getWeekNumber(periodStart);
        key = `W${weekNumber}-${periodStart.getFullYear()}`;
        label = `Semaine ${weekNumber}`;
        break;
      }

      case "day": {
        periodStart = new Date(referenceDate);
        periodStart.setDate(periodStart.getDate() + 1);
        periodStart.setHours(0, 0, 0, 0);
        periodEnd = new Date(periodStart);
        periodEnd.setHours(23, 59, 59, 999);
        key = periodStart.toISOString().split("T")[0];
        label = periodStart.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
        break;
      }

      case "year": {
        periodStart = new Date(referenceDate.getFullYear() + 1, 0, 1);
        periodStart.setHours(0, 0, 0, 0);
        periodEnd = new Date(periodStart.getFullYear(), 11, 31);
        periodEnd.setHours(23, 59, 59, 999);
        key = String(periodStart.getFullYear());
        label = String(periodStart.getFullYear());
        break;
      }

      default:
        throw new Error(`Invalid period type: ${periodType}`);
    }

    return {
      key,
      label,
      start: periodStart.toISOString().split("T")[0],
      end: periodEnd.toISOString().split("T")[0],
    };
  },

  /**
   * Calcule le numéro de semaine ISO
   */
  getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  },

  /**
   * Récupère l'historique des interventions pour les 4 dernières périodes
   * + projection de la période suivante
   */
  async getInterventionsHistory(
    params: KPIHistoryParams
  ): Promise<InterventionsHistoryResponse> {
    const {
      periodType,
      startDate,
      endDate,
      agenceIds,
      gestionnaireIds,
      metierIds,
      includeProjection = true,
    } = params;

    const periods = interventionsStats.calculateLast4Periods(periodType, startDate, endDate);

    const historical: InterventionsHistoryData[] = await Promise.all(
      periods.map(async (period) => {
        const stats = await interventionsStats.getAdminDashboardStats({
          periodType,
          startDate: period.start,
          endDate: period.end,
          agenceIds,
          gestionnaireIds,
          metierIds,
        });

        return {
          period: period.key,
          periodLabel: period.label,
          value: {
            demandees: stats.mainStats.nbInterventionsDemandees,
            terminees: stats.mainStats.nbInterventionsTerminees,
          },
          isProjection: false,
        };
      })
    );

    let projection: InterventionsHistoryData | undefined;
    if (includeProjection) {
      const nextPeriod = interventionsStats.calculateNextPeriod(periodType, startDate, endDate);
      const projectedValues = RevenueProjectionService.calculateInterventionsProjection(historical);

      projection = {
        period: nextPeriod.key,
        periodLabel: nextPeriod.label,
        value: projectedValues,
        isProjection: true,
      };
    }

    const currentPeriod =
      historical[historical.length - 1] ||
      ({
        period: periods[periods.length - 1]?.key || "",
        periodLabel: periods[periods.length - 1]?.label || "",
        value: { demandees: 0, terminees: 0 },
        isProjection: false,
      } as InterventionsHistoryData);

    return {
      historical,
      projection,
      currentPeriod,
    };
  },

  /**
   * Récupère l'historique du taux de transformation pour les 4 dernières périodes
   * + projection de la période suivante
   */
  async getTransformationRateHistory(
    params: KPIHistoryParams
  ): Promise<TransformationRateHistoryResponse> {
    const {
      periodType,
      startDate,
      endDate,
      agenceIds,
      gestionnaireIds,
      metierIds,
      includeProjection = true,
    } = params;

    const periods = interventionsStats.calculateLast4Periods(periodType, startDate, endDate);

    const historical: TransformationRateHistoryData[] = await Promise.all(
      periods.map(async (period) => {
        const stats = await interventionsStats.getAdminDashboardStats({
          periodType,
          startDate: period.start,
          endDate: period.end,
          agenceIds,
          gestionnaireIds,
          metierIds,
        });

        return {
          period: period.key,
          periodLabel: period.label,
          value: {
            demandees: stats.mainStats.nbInterventionsDemandees,
            terminees: stats.mainStats.nbInterventionsTerminees,
          },
          isProjection: false,
        };
      })
    );

    let projection: TransformationRateHistoryData | undefined;
    if (includeProjection) {
      const nextPeriod = interventionsStats.calculateNextPeriod(periodType, startDate, endDate);
      const projectedValues = RevenueProjectionService.calculateTransformationRateProjection(historical);

      projection = {
        period: nextPeriod.key,
        periodLabel: nextPeriod.label,
        value: projectedValues,
        isProjection: true,
      };
    }

    const currentPeriod =
      historical[historical.length - 1] ||
      ({
        period: periods[periods.length - 1]?.key || "",
        periodLabel: periods[periods.length - 1]?.label || "",
        value: { demandees: 0, terminees: 0 },
        isProjection: false,
      } as TransformationRateHistoryData);

    return {
      historical,
      projection,
      currentPeriod,
    };
  },

  /**
   * Récupère l'historique du cycle moyen pour les 4 dernières périodes
   * + projection de la période suivante
   */
  async getCycleTimeHistory(
    params: KPIHistoryParams
  ): Promise<CycleTimeHistoryResponse> {
    const {
      periodType,
      startDate,
      endDate,
      agenceIds,
      gestionnaireIds,
      metierIds,
      includeProjection = true,
    } = params;

    const periods = interventionsStats.calculateLast4Periods(periodType, startDate, endDate);

    const historical: CycleTimeHistoryData[] = await Promise.all(
      periods.map(async (period) => {
        const stats = await interventionsStats.getAdminDashboardStats({
          periodType,
          startDate: period.start,
          endDate: period.end,
          agenceIds,
          gestionnaireIds,
          metierIds,
        });

        return {
          period: period.key,
          periodLabel: period.label,
          value: stats.mainStats.avgCycleTime,
          isProjection: false,
        };
      })
    );

    let projection: CycleTimeHistoryData | undefined;
    if (includeProjection) {
      const nextPeriod = interventionsStats.calculateNextPeriod(periodType, startDate, endDate);
      const projectedValue = RevenueProjectionService.calculateCycleTimeProjection(historical);

      projection = {
        period: nextPeriod.key,
        periodLabel: nextPeriod.label,
        value: projectedValue,
        isProjection: true,
      };
    }

    const currentPeriod =
      historical[historical.length - 1] ||
      ({
        period: periods[periods.length - 1]?.key || "",
        periodLabel: periods[periods.length - 1]?.label || "",
        value: 0,
        isProjection: false,
      } as CycleTimeHistoryData);

    return {
      historical,
      projection,
      currentPeriod,
    };
  },

  /**
   * Récupère l'historique de la marge pour les 4 dernières périodes
   * + projection de la période suivante
   */
  async getMarginHistory(
    params: KPIHistoryParams
  ): Promise<MarginHistoryResponse> {
    const {
      periodType,
      startDate,
      endDate,
      agenceIds,
      gestionnaireIds,
      metierIds,
      includeProjection = true,
    } = params;

    const periods = interventionsStats.calculateLast4Periods(periodType, startDate, endDate);

    const historical: MarginHistoryData[] = await Promise.all(
      periods.map(async (period) => {
        const stats = await interventionsStats.getAdminDashboardStats({
          periodType,
          startDate: period.start,
          endDate: period.end,
          agenceIds,
          gestionnaireIds,
          metierIds,
        });

        return {
          period: period.key,
          periodLabel: period.label,
          value: stats.mainStats.marge,
          isProjection: false,
        };
      })
    );

    let projection: MarginHistoryData | undefined;
    if (includeProjection) {
      const nextPeriod = interventionsStats.calculateNextPeriod(periodType, startDate, endDate);
      const projectedValue = RevenueProjectionService.calculateMarginProjection(historical);

      projection = {
        period: nextPeriod.key,
        periodLabel: nextPeriod.label,
        value: projectedValue,
        isProjection: true,
      };
    }

    const currentPeriod =
      historical[historical.length - 1] ||
      ({
        period: periods[periods.length - 1]?.key || "",
        periodLabel: periods[periods.length - 1]?.label || "",
        value: 0,
        isProjection: false,
      } as MarginHistoryData);

    return {
      historical,
      projection,
      currentPeriod,
    };
  },

  /**
   * Helper pour calculer les dates de période
   */
  calculatePeriodDates(
    periodType: PeriodType,
    referenceDate: Date,
    startDate?: string,
    endDate?: string
  ): { start: string; end: string } {
    // Si des dates spécifiques sont fournies, les utiliser
    if (startDate && endDate) {
      return { start: startDate, end: endDate };
    }

    const date = new Date(referenceDate);
    let start: Date;
    let end: Date;

    switch (periodType) {
      case 'day':
        start = new Date(date);
        end = new Date(date);
        break;

      case 'week':
        // Semaine du lundi au vendredi
        const day = date.getDay();
        const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Lundi
        start = new Date(date.getFullYear(), date.getMonth(), diff);
        start.setHours(0, 0, 0, 0);
        end = new Date(start);
        end.setDate(start.getDate() + 4); // Vendredi
        end.setHours(23, 59, 59, 999);
        break;

      case 'month':
        start = new Date(date.getFullYear(), date.getMonth(), 1);
        end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
        break;

      case 'year':
        start = new Date(date.getFullYear(), 0, 1);
        end = new Date(date.getFullYear(), 11, 31);
        break;

      default:
        throw new Error(`Invalid period type: ${periodType}`);
    }

    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    };
  },
};
