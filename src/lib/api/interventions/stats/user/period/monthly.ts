// ===== USER STATS - MONTHLY =====
// Stats par semaine au sein d'un mois (nombre de semaines dynamique) pour un utilisateur.

import type { MonthWeekStats, MonthlyStats } from "@/lib/api/common/types";
import {
  fetchUserArtisans,
  fetchUserArtisansMissionnesDeduped,
  fetchUserTransitions,
  formatDate,
  requireUserId,
} from "@/lib/api/interventions/stats/user/_shared";
import {
  buildMonthWeekRanges,
  computeMonthWeeks,
  findWeekIndex,
} from "@/lib/api/interventions/stats/user/period/month-weeks";

const initWeekStats = (weekCount: number): MonthWeekStats => ({
  counts: new Array(weekCount).fill(0),
  total: 0,
});

/**
 * Stats mensuelles (semaines du mois en cours par défaut).
 */
export async function getMonthlyStatsByUser(
  userId: string,
  startDate?: string,
  signal?: AbortSignal
): Promise<MonthlyStats> {
  requireUserId(userId);

  // Mois ciblé
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

  const weeks = computeMonthWeeks(monthStart, monthEnd);
  const weekCount = weeks.length;

  const devisEnvoye = initWeekStats(weekCount);
  const interEnCours = initWeekStats(weekCount);
  const interFactures = initWeekStats(weekCount);
  const nouveauxArtisans = initWeekStats(weekCount);
  const artisansMissionnes = initWeekStats(weekCount);

  // Transitions (préserve la borne historique inclusive sur la fin de mois)
  const transitions = await fetchUserTransitions({
    userId,
    startStr: monthStartStr,
    endStr: monthEndStr,
    comparator: "lte",
    signal,
  });

  transitions.forEach((transition) => {
    const idx = findWeekIndex(weeks, new Date(transition.transition_date));
    if (idx === -1) return;
    if (transition.to_status_code === "DEVIS_ENVOYE") {
      devisEnvoye.counts[idx]++;
      devisEnvoye.total++;
    } else if (transition.to_status_code === "INTER_EN_COURS") {
      interEnCours.counts[idx]++;
      interEnCours.total++;
    } else if (transition.to_status_code === "INTER_TERMINEE") {
      interFactures.counts[idx]++;
      interFactures.total++;
    }
  });

  // Artisans créés
  const artisans = await fetchUserArtisans({
    userId,
    startStr: monthStartStr,
    endStrExclusive: nextMonthStartStr,
  });
  artisans.forEach((artisan) => {
    if (!artisan.created_at) return;
    const idx = findWeekIndex(weeks, new Date(artisan.created_at));
    if (idx !== -1) nouveauxArtisans.counts[idx]++;
    nouveauxArtisans.total++;
  });

  // Artisans missionnés
  const missionnes = await fetchUserArtisansMissionnesDeduped({
    userId,
    startStr: monthStartStr,
    endStrExclusive: nextMonthStartStr,
  });
  missionnes.forEach((artisan) => {
    if (!artisan.created_at) return;
    const idx = findWeekIndex(weeks, new Date(artisan.created_at));
    if (idx !== -1) artisansMissionnes.counts[idx]++;
    artisansMissionnes.total++;
  });

  return {
    devis_envoye: devisEnvoye,
    inter_en_cours: interEnCours,
    inter_factures: interFactures,
    nouveaux_artisans: nouveauxArtisans,
    artisans_missionnes: artisansMissionnes,
    weeks: buildMonthWeekRanges(monthStart, monthEnd),
    month_start: monthStart.toISOString(),
    month_end: monthEnd.toISOString(),
    month: monthStart.getMonth() + 1,
    year: monthStart.getFullYear(),
  };
}
