// ===== USER STATS - PERIOD DISPATCHER =====
// Dispatch par type de période (week | month | year) vers le sous-module dédié.

import type {
  MonthlyStats,
  StatsPeriod,
  WeeklyStats,
  YearlyStats,
} from "@/lib/api/common/types";
import { getMonthlyStatsByUser } from "./monthly";
import { getWeeklyStatsByUser } from "./weekly";
import { getYearlyStatsByUser } from "./yearly";

export { getWeeklyStatsByUser } from "./weekly";
export { getMonthlyStatsByUser } from "./monthly";
export { getYearlyStatsByUser } from "./yearly";

export async function getPeriodStatsByUser(
  userId: string,
  period: StatsPeriod,
  startDate?: string,
  signal?: AbortSignal
): Promise<WeeklyStats | MonthlyStats | YearlyStats> {
  switch (period) {
    case "week":
      return getWeeklyStatsByUser(userId, startDate, signal);
    case "month":
      return getMonthlyStatsByUser(userId, startDate, signal);
    case "year":
      return getYearlyStatsByUser(userId, startDate, signal);
    default:
      throw new Error(`Période non supportée: ${period}`);
  }
}
