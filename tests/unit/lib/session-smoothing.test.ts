import { describe, it, expect } from "vitest"
import { smoothSessions, totalInactivityMs, BREAK_MS } from "@/lib/monitoring/session-smoothing"
import type { ConnectionSession } from "@/types/monitoring"

const MIN = 60_000

/** Fabrique une session à partir d'heures/minutes (jour de référence). */
function s(page: string, startMin: number, endMin: number): ConnectionSession {
  const base = new Date("2026-06-21T00:00:00")
  const started = new Date(base.getTime() + startMin * MIN)
  const ended = new Date(base.getTime() + endMin * MIN)
  return {
    page_name: page,
    started_at: started.toISOString(),
    ended_at: ended.toISOString(),
    duration_ms: (endMin - startMin) * MIN,
  }
}

describe("session-smoothing", () => {
  describe("smoothSessions", () => {
    it("should return empty when no sessions", () => {
      expect(smoothSessions([], 5 * MIN)).toEqual({ segs: [], inactivities: [], breaks: [] })
      expect(smoothSessions(undefined, 5 * MIN)).toEqual({ segs: [], inactivities: [], breaks: [] })
    })

    it("should keep a single session untouched", () => {
      const r = smoothSessions([s("interventions", 540, 600)], 5 * MIN)
      expect(r.segs).toHaveLength(1)
      expect(r.inactivities).toHaveLength(0)
      expect(r.breaks).toHaveLength(0)
    })

    it("should classify a 30 min gap as inactivity (threshold < gap < 1h)", () => {
      const r = smoothSessions([s("interventions", 540, 600), s("artisans", 630, 660)], 5 * MIN)
      expect(r.segs).toHaveLength(2)
      expect(r.inactivities).toHaveLength(1)
      expect(r.breaks).toHaveLength(0)
      expect(r.inactivities[0].durationMs).toBe(30 * MIN)
    })

    it("should classify a >= 1h gap as a break (timeline disconnection)", () => {
      // 9h00–10h00 puis 11h30–12h00 → trou de 90 min >= 1h → déconnexion
      const r = smoothSessions([s("interventions", 540, 600), s("interventions", 690, 720)], 5 * MIN)
      expect(r.segs).toHaveLength(2)
      expect(r.breaks).toHaveLength(1)
      expect(r.inactivities).toHaveLength(0)
      expect(r.breaks[0].durationMs).toBe(90 * MIN)
      expect(r.breaks[0].durationMs).toBeGreaterThanOrEqual(BREAK_MS)
    })

    it("should absorb a micro-cut on the same page (one segment, no gap)", () => {
      const r = smoothSessions([s("interventions", 540, 600), s("interventions", 602, 660)], 5 * MIN)
      expect(r.segs).toHaveLength(1)
      expect(r.inactivities).toHaveLength(0)
      expect(r.breaks).toHaveLength(0)
    })

    it("should glue adjacent segments of different pages without a gap", () => {
      const r = smoothSessions([s("interventions", 540, 600), s("artisans", 603, 660)], 5 * MIN)
      expect(r.segs).toHaveLength(2)
      expect(r.inactivities).toHaveLength(0)
      expect(r.breaks).toHaveLength(0)
      expect(r.segs[1].started_at).toBe(r.segs[0].ended_at)
    })

    it("should split inactivity and break in the same day", () => {
      // inactivité 30 min, puis déconnexion 90 min
      const r = smoothSessions(
        [s("a", 540, 600), s("b", 630, 660), s("c", 750, 780)],
        5 * MIN
      )
      expect(r.segs).toHaveLength(3)
      expect(r.inactivities).toHaveLength(1)
      expect(r.breaks).toHaveLength(1)
    })

    it("should treat every gap as inactivity when threshold is 0 (Aucun), until 1h", () => {
      const r = smoothSessions([s("interventions", 540, 600), s("interventions", 602, 660)], 0)
      expect(r.inactivities).toHaveLength(1)
      expect(r.breaks).toHaveLength(0)
      expect(r.inactivities[0].durationMs).toBe(2 * MIN)
    })
  })

  describe("totalInactivityMs", () => {
    it("should sum inactivity durations and ignore breaks", () => {
      const r = smoothSessions([s("a", 540, 600), s("b", 630, 660), s("c", 750, 780)], 5 * MIN)
      expect(totalInactivityMs(r.inactivities)).toBe(30 * MIN)
      expect(totalInactivityMs([])).toBe(0)
    })
  })
})
