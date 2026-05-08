// ===== USER STATS - MONTHLY =====
// Stats par semaine au sein d'un mois (jusqu'à 5 buckets) pour un utilisateur.

import type { MonthWeekStats, MonthlyStats } from "@/lib/api/common/types";
import {
  fetchUserArtisans,
  fetchUserArtisansMissionnesDeduped,
  fetchUserTransitions,
  formatDate,
  requireUserId,
} from "@/lib/api/interventions/stats/user/_shared";

const initWeekStats = (): MonthWeekStats => ({
  semaine1: 0,
  semaine2: 0,
  semaine3: 0,
  semaine4: 0,
  semaine5: 0,
  total: 0,
});

type WeekRange = { start: Date; end: Date };

/**
 * Calcule les semaines (lundi → dimanche) qui chevauchent le mois donné, plafonné à 5.
 */
function computeMonthWeeks(monthStart: Date, monthEnd: Date): WeekRange[] {
  const weeks: WeekRange[] = [];
  const current = new Date(monthStart);
  // Reculer jusqu'au lundi de la première semaine
  const firstDay = current.getDay();
  const diffToMonday = firstDay === 0 ? -6 : 1 - firstDay;
  current.setDate(current.getDate() + diffToMonday);

  while (current <= monthEnd) {
    const weekEnd = new Date(current);
    weekEnd.setDate(current.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
    weeks.push({
      start: new Date(current),
      end: weekEnd <= monthEnd ? weekEnd : monthEnd,
    });
    current.setDate(current.getDate() + 7);
  }

  return weeks;
}

/**
 * Trouve l'index de semaine (0..4) qui contient `date`, ou -1 si hors plage.
 */
function findWeekIndex(weeks: WeekRange[], date: Date): number {
  for (let i = 0; i < weeks.length && i < 5; i++) {
    if (date >= weeks[i].start && date <= weeks[i].end) return i;
  }
  return -1;
}

const weekKey = (i: number): keyof MonthWeekStats => `semaine${i + 1}` as keyof MonthWeekStats;

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

  const devisEnvoye = initWeekStats();
  const interEnCours = initWeekStats();
  const interFactures = initWeekStats();
  const nouveauxArtisans = initWeekStats();
  const artisansMissionnes = initWeekStats();

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
    const key = weekKey(idx);
    if (transition.to_status_code === "DEVIS_ENVOYE") {
      devisEnvoye[key]++;
      devisEnvoye.total++;
    } else if (transition.to_status_code === "INTER_EN_COURS") {
      interEnCours[key]++;
      interEnCours.total++;
    } else if (transition.to_status_code === "INTER_TERMINEE") {
      interFactures[key]++;
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
    if (idx !== -1) nouveauxArtisans[weekKey(idx)]++;
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
    if (idx !== -1) artisansMissionnes[weekKey(idx)]++;
    artisansMissionnes.total++;
  });

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
