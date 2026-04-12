import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { applyRecuToggle, todayLocalISO } from "@/lib/interventions/deposit-helpers"

describe("deposit-helpers", () => {
  describe("todayLocalISO", () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })
    afterEach(() => {
      vi.useRealTimers()
    })

    it("should format the current date as YYYY-MM-DD in local time", () => {
      // 12 avril 2026 à 23h30 heure locale — UTC tomberait au 13.
      vi.setSystemTime(new Date(2026, 3, 12, 23, 30, 0))
      expect(todayLocalISO()).toBe("2026-04-12")
    })

    it("should zero-pad month and day", () => {
      vi.setSystemTime(new Date(2026, 0, 5, 10, 0, 0))
      expect(todayLocalISO()).toBe("2026-01-05")
    })
  })

  describe("applyRecuToggle", () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date(2026, 3, 12, 10, 0, 0))
    })
    afterEach(() => {
      vi.useRealTimers()
    })

    it("should auto-fill today's date when checking with empty date", () => {
      expect(applyRecuToggle(true, "")).toEqual({
        recu: true,
        date: "2026-04-12",
      })
    })

    it("should preserve an existing date when checking", () => {
      expect(applyRecuToggle(true, "2026-03-01")).toEqual({
        recu: true,
        date: "2026-03-01",
      })
    })

    it("should clear the date when unchecking", () => {
      expect(applyRecuToggle(false, "2026-03-01")).toEqual({
        recu: false,
        date: "",
      })
    })

    it("should remain consistent when unchecking with already-empty date", () => {
      expect(applyRecuToggle(false, "")).toEqual({
        recu: false,
        date: "",
      })
    })
  })
})
