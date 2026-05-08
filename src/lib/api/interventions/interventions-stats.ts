// ===== INTERVENTIONS STATS =====
// Façade publique des statistiques d'interventions.
// Toutes les méthodes sont implémentées dans les sous-modules de `./stats/` :
//
//   - user-stats         : stats par utilisateur (compteurs, marges, période, récents)
//   - rankings           : classements gestionnaires par marge (RPC podium)
//   - admin-dashboard    : agrégats du dashboard admin (RPC v3)
//   - history            : historiques KPI sur 4 périodes + projection
//   - _period-helpers    : helpers de calcul de période (jour/semaine/mois/année)
//   - types              : types internes pour les résultats Supabase
//
// Cette façade est composée par `Object.assign` pour préserver la surface
// publique (`interventionsStats.xxx`) attendue par `./index.ts`.

import { getAdminDashboardStats } from "./stats/admin-dashboard";
import { createHistoryMethods } from "./stats/history";
import {
  calculateLast4Periods,
  calculateNextPeriod,
  calculatePeriodDates,
  getWeekNumber,
} from "./stats/_period-helpers";
import * as rankings from "./stats/rankings";
import * as userStats from "./stats/user-stats";

export const interventionsStats = Object.assign(
  { getAdminDashboardStats },
  userStats,
  rankings,
  { getWeekNumber, calculateLast4Periods, calculateNextPeriod, calculatePeriodDates },
  createHistoryMethods({ getAdminDashboardStats })
);
