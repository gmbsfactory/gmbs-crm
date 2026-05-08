// ===== INTERVENTIONS STATS - PERIOD HELPERS =====
// Fonctions pures de calcul de périodes (jour, semaine, mois, année).
// Utilisées par les méthodes d'historique et d'agrégation dashboard.

import type { PeriodType } from "@/lib/api/common/types";

/**
 * Calcule le numéro de semaine ISO
 */
export function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/**
 * Calcule les 4 dernières périodes selon le type
 */
export function calculateLast4Periods(
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
        label = label.charAt(0).toUpperCase() + label.slice(1);
        break;
      }

      case "week": {
        const day = referenceDate.getDay();
        const diff = referenceDate.getDate() - day + (day === 0 ? -6 : 1) - i * 7;
        periodStart = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), diff);
        periodStart.setHours(0, 0, 0, 0);
        periodEnd = new Date(periodStart);
        periodEnd.setDate(periodStart.getDate() + 4);
        periodEnd.setHours(23, 59, 59, 999);
        const weekNumber = getWeekNumber(periodStart);
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
}

/**
 * Calcule la période suivante pour la projection
 */
export function calculateNextPeriod(
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
      const weekNumber = getWeekNumber(periodStart);
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
}

/**
 * Helper pour calculer les dates de période
 */
export function calculatePeriodDates(
  periodType: PeriodType,
  referenceDate: Date,
  startDate?: string,
  endDate?: string
): { start: string; end: string } {
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

    case 'week': {
      const day = date.getDay();
      const diff = date.getDate() - day + (day === 0 ? -6 : 1);
      start = new Date(date.getFullYear(), date.getMonth(), diff);
      start.setHours(0, 0, 0, 0);
      end = new Date(start);
      end.setDate(start.getDate() + 4);
      end.setHours(23, 59, 59, 999);
      break;
    }

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
}
