// ===== USER STATS - MONTH WEEKS =====
// Decoupage d'un mois en semaines (lundi -> dimanche) pour les stats mensuelles.
// Logique pure et testable, sans dependance Supabase.

import type { MonthWeekRange } from "@/lib/api/common/types";

export type WeekRange = { start: Date; end: Date };

/**
 * Calcule les semaines (lundi -> dimanche) qui chevauchent le mois donne.
 *
 * Le nombre de semaines est dynamique (4 a 6 selon le calendrier) : on ne
 * plafonne plus a 5. L'ancien plafond faisait silencieusement disparaitre les
 * evenements de la 6e semaine pour les mois qui s'etalent sur 6 semaines
 * (1er = samedi/dimanche combine a 31 jours, ex. mars 2025).
 */
export function computeMonthWeeks(monthStart: Date, monthEnd: Date): WeekRange[] {
  const weeks: WeekRange[] = [];
  const current = new Date(monthStart);
  // Reculer jusqu'au lundi de la premiere semaine
  const firstDay = current.getDay();
  const diffToMonday = firstDay === 0 ? -6 : 1 - firstDay;
  current.setDate(current.getDate() + diffToMonday);

  while (current <= monthEnd) {
    const weekEnd = new Date(current);
    weekEnd.setDate(current.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
    weeks.push({
      start: new Date(current),
      end: weekEnd <= monthEnd ? weekEnd : new Date(monthEnd),
    });
    current.setDate(current.getDate() + 7);
  }

  return weeks;
}

/**
 * Trouve l'index de la semaine qui contient `date`, ou -1 si hors plage.
 */
export function findWeekIndex(weeks: WeekRange[], date: Date): number {
  for (let i = 0; i < weeks.length; i++) {
    if (date >= weeks[i].start && date <= weeks[i].end) return i;
  }
  return -1;
}

/**
 * Construit les plages d'affichage des semaines, bornees aux limites du mois :
 * la 1re semaine demarre au plus tot le 1er du mois, la derniere finit au plus
 * tard le dernier jour. Sert a generer les libelles de colonnes ("1-4 janv.").
 */
export function buildMonthWeekRanges(monthStart: Date, monthEnd: Date): MonthWeekRange[] {
  return computeMonthWeeks(monthStart, monthEnd).map((week) => {
    const start = week.start < monthStart ? new Date(monthStart) : week.start;
    const end = week.end > monthEnd ? new Date(monthEnd) : week.end;
    return { start: start.toISOString(), end: end.toISOString() };
  });
}
