// ===== INTERVENTIONS STATS - RANKINGS =====
// Classements gestionnaires par marge sur une période (RPC podium).

import { supabase } from "@/lib/api/common/client";
import type {
  GestionnaireMarginRanking,
  MarginRankingResult,
} from "@/lib/api/common/types";
import type { RpcRankingResult } from "./types";

/**
 * Récupère le classement des gestionnaires par marge totale sur une période
 * @param startDate - Date de début (optionnelle, format ISO string)
 * @param endDate - Date de fin (optionnelle, format ISO string)
 * @returns Classement des gestionnaires trié par marge totale décroissante
 */
export async function getMarginRankingByPeriod(
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
  type UserInfo = { id: string; firstname?: string; lastname?: string; code_gestionnaire?: string; color?: string; avatar_url?: string | null };
  const usersMap = new Map<string, UserInfo>(
    (users || []).map((u: any) => [u.id, u as UserInfo])
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
}

/**
 * Récupère le classement des gestionnaires par marge totale sur une période
 * Utilise get_dashboard_performance_gestionnaires_v3 (cohérent avec admin dashboard)
 * @param startDate - Date de début (optionnelle, format ISO string)
 * @param endDate - Date de fin (optionnelle, format ISO string)
 * @returns Classement des gestionnaires trié par marge totale décroissante
 */
export async function getMarginRankingByPeriodV3(
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
  type UserInfo = { id: string; firstname?: string; lastname?: string; code_gestionnaire?: string; color?: string; avatar_url?: string | null };
  const usersMap = new Map<string, UserInfo>(
    (users || []).map((u: any) => [u.id, u as UserInfo])
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
}
