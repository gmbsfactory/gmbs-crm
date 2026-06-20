import { describe, it, expect } from "vitest"
import {
  computePresetRange,
  formatRangeLabel,
  PERIOD_PRESETS,
} from "@/lib/monitoring/period-presets"

describe("period-presets", () => {
  // 15 juin 2026, 14h30 (heure locale)
  const now = new Date(2026, 5, 15, 14, 30, 0)

  describe("computePresetRange", () => {
    it("today → début et fin du jour courant", () => {
      const r = computePresetRange("today", now)
      expect(r.from.getDate()).toBe(15)
      expect(r.from.getHours()).toBe(0)
      expect(r.from.getMinutes()).toBe(0)
      expect(r.to.getDate()).toBe(15)
      expect(r.to.getHours()).toBe(23)
      expect(r.to.getMinutes()).toBe(59)
    })

    it("yesterday → jour précédent complet", () => {
      const r = computePresetRange("yesterday", now)
      expect(r.from.getDate()).toBe(14)
      expect(r.from.getHours()).toBe(0)
      expect(r.to.getDate()).toBe(14)
      expect(r.to.getHours()).toBe(23)
    })

    it("week → du lundi au dimanche", () => {
      const r = computePresetRange("week", now)
      expect(r.from.getDay()).toBe(1) // lundi
      expect(r.to.getDay()).toBe(0) // dimanche
      expect(r.from.getHours()).toBe(0)
      expect(r.from.getTime()).toBeLessThanOrEqual(now.getTime())
      expect(r.to.getTime()).toBeGreaterThanOrEqual(now.getTime())
    })

    it("last7 → fenêtre de 7 jours se terminant aujourd'hui", () => {
      const r = computePresetRange("last7", now)
      expect(r.from.getDate()).toBe(9) // 15 - 6
      expect(r.from.getHours()).toBe(0)
      expect(r.to.getDate()).toBe(15)
    })

    it("month → premier au dernier jour du mois", () => {
      const r = computePresetRange("month", now)
      expect(r.from.getDate()).toBe(1)
      expect(r.from.getMonth()).toBe(5) // juin
      expect(r.to.getMonth()).toBe(5)
      expect(r.to.getDate()).toBe(30) // juin = 30 jours
    })

    it("last30 → fenêtre de 30 jours", () => {
      const r = computePresetRange("last30", now)
      expect(r.from.getMonth()).toBe(4) // mai
      expect(r.from.getDate()).toBe(17) // 15 juin - 29 jours = 17 mai
      expect(r.to.getDate()).toBe(15)
    })
  })

  describe("formatRangeLabel", () => {
    it("joint les deux dates avec un tiret cadratin", () => {
      const label = formatRangeLabel({
        from: new Date(2026, 5, 1),
        to: new Date(2026, 5, 30),
      })
      expect(label).toContain("—")
      expect(label).toMatch(/2026/)
    })
  })

  it("expose 6 presets fixes incluant 'week'", () => {
    expect(PERIOD_PRESETS).toHaveLength(6)
    expect(PERIOD_PRESETS.map((p) => p.value)).toContain("week")
  })
})
