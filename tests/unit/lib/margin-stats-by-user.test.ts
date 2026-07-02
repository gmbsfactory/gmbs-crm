import { describe, expect, it, vi } from "vitest"

// Le module importe le client Supabase navigateur à des fins de requête ;
// on ne teste ici que l'agrégation pure — client factice suffisant.
vi.mock("@/lib/api/common/client", () => ({ supabase: {} }))

import {
  aggregateMarginFromTransitions,
  normalizeEndBoundExclusive,
  normalizeStartBound,
  type MarginTransitionRow,
} from "@/lib/api/interventions/stats/user/margin"
import type { InterventionCost } from "@/lib/api/common/types"

const cost = (cost_type: InterventionCost["cost_type"], amount: number): InterventionCost =>
  ({ id: `c-${cost_type}-${amount}`, cost_type, amount, label: "" }) as InterventionCost

const row = (
  id: string,
  costs: InterventionCost[] | null,
  idInter: string | null = null
): MarginTransitionRow => ({
  intervention_id: id,
  interventions: { id, id_inter: idInter, intervention_costs: costs },
})

describe("stats/user/margin (périmètre facturé = passage en Terminée)", () => {
  describe("aggregateMarginFromTransitions", () => {
    it("should return zeroed stats when no intervention was completed in the period", () => {
      // Cas du signalement n°17 : Yazid, semaine 29/06→05/07, aucune Terminée
      const stats = aggregateMarginFromTransitions([], "2026-06-29", "2026-07-05")
      expect(stats).toEqual({
        average_margin_percentage: 0,
        total_interventions: 0,
        total_revenue: 0,
        total_costs: 0,
        total_margin: 0,
        period: { start_date: "2026-06-29", end_date: "2026-07-05" },
      })
    })

    it("should compute the global margin percentage from completed interventions", () => {
      const rows = [
        row("a", [cost("intervention", 165), cost("sst", 100)]), // marge 65
        row("b", [cost("intervention", 200), cost("sst", 50), cost("materiel", 50)]), // marge 100
      ]
      const stats = aggregateMarginFromTransitions(rows)
      expect(stats.total_revenue).toBe(365)
      expect(stats.total_costs).toBe(200)
      expect(stats.total_margin).toBe(165)
      expect(stats.total_interventions).toBe(2)
      // Pourcentage global : 165/365, pas la moyenne des pourcentages
      expect(stats.average_margin_percentage).toBe(45.21)
    })

    it("should count an intervention once even with several Terminée transitions (réouverture)", () => {
      const rows = [
        row("a", [cost("intervention", 100), cost("sst", 40)]),
        row("a", [cost("intervention", 100), cost("sst", 40)]),
      ]
      const stats = aggregateMarginFromTransitions(rows)
      expect(stats.total_interventions).toBe(1)
      expect(stats.total_margin).toBe(60)
    })

    it("should skip interventions without cost lines or without revenue", () => {
      const rows = [
        row("a", []), // aucune ligne de coût
        row("b", [cost("sst", 80)]), // pas de coût d'intervention → pas de CA
        row("c", null),
        { intervention_id: "d", interventions: null },
      ]
      const stats = aggregateMarginFromTransitions(rows)
      expect(stats.total_interventions).toBe(0)
      expect(stats.total_margin).toBe(0)
    })
  })

  describe("bornes de période (sélecteur de dates du dashboard)", () => {
    it("should turn a plain start date into an inclusive midnight bound", () => {
      expect(normalizeStartBound("2026-06-29")).toBe("2026-06-29T00:00:00")
      expect(normalizeStartBound("2026-06-29T08:30:00")).toBe("2026-06-29T08:30:00")
    })

    it("should turn a plain end date into an exclusive next-day bound (covers the whole day)", () => {
      expect(normalizeEndBoundExclusive("2026-07-05")).toBe("2026-07-06T00:00:00")
      expect(normalizeEndBoundExclusive("2026-06-30")).toBe("2026-07-01T00:00:00")
      expect(normalizeEndBoundExclusive("2026-07-05T23:00:00")).toBe("2026-07-05T23:00:00")
    })
  })
})
