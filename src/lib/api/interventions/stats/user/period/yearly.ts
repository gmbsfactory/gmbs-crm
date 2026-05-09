// ===== USER STATS - YEARLY =====
// Stats par mois (janvier → décembre) sur une année pour un utilisateur.

import type { YearMonthStats, YearlyStats } from "@/lib/api/common/types";
import {
  fetchUserArtisans,
  fetchUserArtisansMissionnesDeduped,
  fetchUserTransitions,
  formatDate,
  requireUserId,
} from "@/lib/api/interventions/stats/user/_shared";

const MONTH_NAMES: (keyof YearMonthStats)[] = [
  "janvier", "fevrier", "mars", "avril", "mai", "juin",
  "juillet", "aout", "septembre", "octobre", "novembre", "decembre",
];

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

/**
 * Stats annuelles (12 mois de l'année en cours par défaut).
 */
export async function getYearlyStatsByUser(
  userId: string,
  startDate?: string,
  signal?: AbortSignal
): Promise<YearlyStats> {
  requireUserId(userId);

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

  const devisEnvoye = initMonthStats();
  const interEnCours = initMonthStats();
  const interFactures = initMonthStats();
  const nouveauxArtisans = initMonthStats();
  const artisansMissionnes = initMonthStats();

  // Transitions (borne inclusive historique sur fin d'année)
  const transitions = await fetchUserTransitions({
    userId,
    startStr: yearStartStr,
    endStr: yearEndStr,
    comparator: "lte",
    signal,
  });

  transitions.forEach((transition) => {
    const monthKey = MONTH_NAMES[new Date(transition.transition_date).getMonth()];
    if (!monthKey) return;
    if (transition.to_status_code === "DEVIS_ENVOYE") {
      devisEnvoye[monthKey]++;
      devisEnvoye.total++;
    } else if (transition.to_status_code === "INTER_EN_COURS") {
      interEnCours[monthKey]++;
      interEnCours.total++;
    } else if (transition.to_status_code === "INTER_TERMINEE") {
      interFactures[monthKey]++;
      interFactures.total++;
    }
  });

  // Artisans créés
  const artisans = await fetchUserArtisans({
    userId,
    startStr: yearStartStr,
    endStrExclusive: nextYearStartStr,
  });
  artisans.forEach((artisan) => {
    if (!artisan.created_at) return;
    const monthKey = MONTH_NAMES[new Date(artisan.created_at).getMonth()];
    if (monthKey) {
      nouveauxArtisans[monthKey]++;
      nouveauxArtisans.total++;
    }
  });

  // Artisans missionnés
  const missionnes = await fetchUserArtisansMissionnesDeduped({
    userId,
    startStr: yearStartStr,
    endStrExclusive: nextYearStartStr,
  });
  missionnes.forEach((artisan) => {
    if (!artisan.created_at) return;
    const monthKey = MONTH_NAMES[new Date(artisan.created_at).getMonth()];
    if (monthKey) {
      artisansMissionnes[monthKey]++;
      artisansMissionnes.total++;
    }
  });

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
