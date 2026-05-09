// ===== INTERVENTIONS STATS - USER STATS (barrel) =====
// Re-export depuis les sous-modules user/* pour préserver les imports
// existants (interventions-stats.ts importe `* as userStats` depuis ce fichier).

export { getStatsByUser } from "./user/status-counts";
export { getMarginStatsByUser } from "./user/margin";
export {
  getRecentInterventionsByStatusAndUser,
  getRecentInterventionsByUser,
} from "./user/recent";
export {
  getMonthlyStatsByUser,
  getPeriodStatsByUser,
  getWeeklyStatsByUser,
  getYearlyStatsByUser,
} from "./user/period";
