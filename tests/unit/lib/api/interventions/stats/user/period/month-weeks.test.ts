import { describe, it, expect } from "vitest";

import {
  buildMonthWeekRanges,
  computeMonthWeeks,
  findWeekIndex,
} from "@/lib/api/interventions/stats/user/period/month-weeks";

// Helpers : bornes d'un mois (mois en base 1, ex. janvier = 1)
const monthStart = (year: number, month: number): Date => {
  const d = new Date(year, month - 1, 1);
  d.setHours(0, 0, 0, 0);
  return d;
};
const monthEnd = (year: number, month: number): Date =>
  new Date(year, month, 0, 23, 59, 59);

const dayOf = (iso: string): number => new Date(iso).getDate();
const monthOf = (iso: string): number => new Date(iso).getMonth() + 1;

describe("month-weeks", () => {
  describe("computeMonthWeeks", () => {
    it("découpe janvier 2025 en 5 semaines (1er = mercredi)", () => {
      const weeks = computeMonthWeeks(monthStart(2025, 1), monthEnd(2025, 1));
      expect(weeks).toHaveLength(5);
    });

    it("découpe mars 2025 en 6 semaines (1er = samedi + 31 jours)", () => {
      // Régression : l'ancien plafond à 5 perdait les évènements du 31 mars
      const weeks = computeMonthWeeks(monthStart(2025, 3), monthEnd(2025, 3));
      expect(weeks).toHaveLength(6);
    });

    it("borne la dernière semaine à la fin du mois", () => {
      const start = monthStart(2025, 1);
      const end = monthEnd(2025, 1);
      const weeks = computeMonthWeeks(start, end);
      const last = weeks[weeks.length - 1];
      expect(last.end.getTime()).toBeLessThanOrEqual(end.getTime());
    });
  });

  describe("findWeekIndex", () => {
    it("retourne l'index de la semaine contenant la date", () => {
      const weeks = computeMonthWeeks(monthStart(2025, 1), monthEnd(2025, 1));
      // 15 janvier 2025 est dans la 3e semaine (13–19) -> index 2
      expect(findWeekIndex(weeks, new Date(2025, 0, 15))).toBe(2);
    });

    it("trouve la 6e semaine pour le 31 mars 2025 (au lieu de -1 avant le fix)", () => {
      const weeks = computeMonthWeeks(monthStart(2025, 3), monthEnd(2025, 3));
      expect(findWeekIndex(weeks, new Date(2025, 2, 31))).toBe(5);
    });

    it("retourne -1 pour une date hors du mois", () => {
      const weeks = computeMonthWeeks(monthStart(2025, 1), monthEnd(2025, 1));
      expect(findWeekIndex(weeks, new Date(2025, 1, 10))).toBe(-1);
    });
  });

  describe("buildMonthWeekRanges", () => {
    it("borne la 1re semaine au 1er du mois et la dernière au dernier jour", () => {
      const ranges = buildMonthWeekRanges(monthStart(2025, 1), monthEnd(2025, 1));
      expect(ranges).toHaveLength(5);

      // 1re semaine : démarre le 1er janvier (et non le 30 décembre)
      expect(dayOf(ranges[0].start)).toBe(1);
      expect(monthOf(ranges[0].start)).toBe(1);

      // Dernière semaine : finit le 31 janvier
      expect(dayOf(ranges[4].end)).toBe(31);
      expect(monthOf(ranges[4].end)).toBe(1);
    });

    it("expose 6 plages pour un mois sur 6 semaines (mars 2025)", () => {
      const ranges = buildMonthWeekRanges(monthStart(2025, 3), monthEnd(2025, 3));
      expect(ranges).toHaveLength(6);
      // La 6e plage est le seul 31 mars
      expect(dayOf(ranges[5].start)).toBe(31);
      expect(dayOf(ranges[5].end)).toBe(31);
    });
  });
});
