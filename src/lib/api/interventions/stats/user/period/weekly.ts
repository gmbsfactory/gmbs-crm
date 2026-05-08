// ===== USER STATS - WEEKLY =====
// Stats par jour de la semaine (lundi → dimanche) pour un utilisateur.

import type { WeekDayStats, WeeklyStats } from "@/lib/api/common/types";
import {
  fetchUserArtisans,
  fetchUserArtisansMissionnesDeduped,
  fetchUserTransitions,
  formatDate,
  requireUserId,
} from "@/lib/api/interventions/stats/user/_shared";

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

/**
 * Stats hebdomadaires (semaine en cours par défaut, lundi → dimanche).
 */
export async function getWeeklyStatsByUser(
  userId: string,
  weekStartDate?: string,
  signal?: AbortSignal
): Promise<WeeklyStats> {
  requireUserId(userId);

  // Lundi de la semaine ciblée
  let monday: Date;
  if (weekStartDate) {
    monday = new Date(weekStartDate);
    monday.setHours(0, 0, 0, 0);
  } else {
    const now = new Date();
    const day = now.getDay(); // 0 = dimanche
    const daysToSubtract = day === 0 ? 6 : day - 1;
    monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysToSubtract);
    monday.setHours(0, 0, 0, 0);
  }

  // Construire les 7 jours et le lundi suivant (borne exclusive)
  const dayDates: Record<keyof Omit<WeekDayStats, "total">, string> = {
    lundi: formatDate(monday),
    mardi: formatDate(addDays(monday, 1)),
    mercredi: formatDate(addDays(monday, 2)),
    jeudi: formatDate(addDays(monday, 3)),
    vendredi: formatDate(addDays(monday, 4)),
    samedi: formatDate(addDays(monday, 5)),
    dimanche: formatDate(addDays(monday, 6)),
  };
  const sunday = addDays(monday, 6);
  const nextMondayStr = formatDate(addDays(monday, 7));
  const mondayStr = dayDates.lundi;

  const dayKeyOf = (date: Date): keyof WeekDayStats | null => {
    const dateStr = formatDate(date);
    for (const [key, value] of Object.entries(dayDates)) {
      if (value === dateStr) return key as keyof WeekDayStats;
    }
    return null;
  };

  const devisEnvoye = initDayStats();
  const interEnCours = initDayStats();
  const interFactures = initDayStats();
  const nouveauxArtisans = initDayStats();
  const artisansMissionnes = initDayStats();

  // Transitions
  const transitions = await fetchUserTransitions({
    userId,
    startStr: mondayStr,
    endStr: nextMondayStr,
    comparator: "lt",
    signal,
  });

  transitions.forEach((transition) => {
    const dayKey = dayKeyOf(new Date(transition.transition_date));
    const code = transition.to_status_code;
    if (code === "DEVIS_ENVOYE") {
      if (dayKey) devisEnvoye[dayKey]++;
      devisEnvoye.total++;
    } else if (code === "INTER_EN_COURS") {
      if (dayKey) interEnCours[dayKey]++;
      interEnCours.total++;
    } else if (code === "INTER_TERMINEE") {
      if (dayKey) interFactures[dayKey]++;
      interFactures.total++;
    }
  });

  // Artisans créés
  const artisans = await fetchUserArtisans({
    userId,
    startStr: mondayStr,
    endStrExclusive: nextMondayStr,
  });
  artisans.forEach((artisan) => {
    if (!artisan.created_at) return;
    const dayKey = dayKeyOf(new Date(artisan.created_at));
    if (dayKey) nouveauxArtisans[dayKey]++;
    nouveauxArtisans.total++;
  });

  // Artisans missionnés
  const missionnes = await fetchUserArtisansMissionnesDeduped({
    userId,
    startStr: mondayStr,
    endStrExclusive: nextMondayStr,
  });
  missionnes.forEach((artisan) => {
    if (!artisan.created_at) return;
    const dayKey = dayKeyOf(new Date(artisan.created_at));
    if (dayKey) artisansMissionnes[dayKey]++;
    artisansMissionnes.total++;
  });

  return {
    devis_envoye: devisEnvoye,
    inter_en_cours: interEnCours,
    inter_factures: interFactures,
    nouveaux_artisans: nouveauxArtisans,
    artisans_missionnes: artisansMissionnes,
    week_start: monday.toISOString(),
    week_end: sunday.toISOString(),
  };
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(date.getDate() + days);
  return next;
}
