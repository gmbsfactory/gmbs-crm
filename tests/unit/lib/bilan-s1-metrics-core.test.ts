import { describe, expect, it } from "vitest"
import {
  aggregateAudit,
  computeScreenTimeMs,
  effectiveWindowEnd,
  msToHours,
  parisDayLabel,
  parseGitNumstat,
  type ActivityEvent,
} from "@/lib/bilan-s1/metrics-core"

describe("bilan-s1/metrics-core", () => {
  describe("parisDayLabel", () => {
    it("should format an UTC timestamp as a Paris civil day", () => {
      expect(parisDayLabel("2026-06-29T07:12:00Z")).toBe("lun 29/06")
    })

    it("should roll over to the next day for late UTC evenings (Paris = UTC+2)", () => {
      expect(parisDayLabel("2026-06-29T22:30:00Z")).toBe("mar 30/06")
    })
  })

  describe("aggregateAudit", () => {
    const days = ["lun 29/06", "mar 30/06", "mer 01/07"] as const

    it("should count actions per Paris day and zero-fill missing days", () => {
      const rows = [
        { actor_display: "Tim D", occurred_at: "2026-06-29T08:00:00Z" },
        { actor_display: "Tim D", occurred_at: "2026-06-29T09:00:00Z" },
        { actor_display: "Adam I", occurred_at: "2026-07-01T10:00:00Z" },
      ]
      const { perDay } = aggregateAudit(rows, days)
      expect(perDay).toEqual([
        { day: "lun 29/06", actions: 2 },
        { day: "mar 30/06", actions: 0 },
        { day: "mer 01/07", actions: 1 },
      ])
    })

    it("should rank users by action count descending", () => {
      const rows = [
        { actor_display: "Adam I", occurred_at: "2026-06-29T08:00:00Z" },
        { actor_display: "Tim D", occurred_at: "2026-06-29T08:05:00Z" },
        { actor_display: "Tim D", occurred_at: "2026-06-29T08:10:00Z" },
      ]
      const { perUser } = aggregateAudit(rows, days)
      expect(perUser).toEqual([
        { user: "Tim D", actions: 2 },
        { user: "Adam I", actions: 1 },
      ])
    })

    it("should bucket rows without actor_display under '?'", () => {
      const { perUser } = aggregateAudit([{ actor_display: null, occurred_at: "2026-06-29T08:00:00Z" }], days)
      expect(perUser).toEqual([{ user: "?", actions: 1 }])
    })
  })

  describe("computeScreenTimeMs", () => {
    const WINDOW_END = "2026-06-29T10:00:00Z"
    const event = (overrides: Partial<ActivityEvent>): ActivityEvent => ({
      user_id: "u1",
      session_id: "s1",
      kind: "heartbeat",
      occurred_at: "2026-06-29T08:00:00Z",
      ...overrides,
    })

    it("should credit the gap to the next event of the same session", () => {
      const events = [
        event({ occurred_at: "2026-06-29T08:00:00Z" }),
        event({ occurred_at: "2026-06-29T08:00:30Z" }),
      ]
      // 30 s vers l'événement suivant + 90 s (plafond) pour le dernier événement
      expect(computeScreenTimeMs(events, WINDOW_END).get("u1")).toBe(30_000 + 90_000)
    })

    it("should cap each interval at 90 seconds (MAX_GAP)", () => {
      const events = [
        event({ occurred_at: "2026-06-29T08:00:00Z" }),
        event({ occurred_at: "2026-06-29T08:10:00Z" }), // 10 min d'écart → 90 s max
      ]
      expect(computeScreenTimeMs(events, WINDOW_END).get("u1")).toBe(90_000 + 90_000)
    })

    it("should not credit inactive kinds but still use them as interval boundary", () => {
      const events = [
        event({ occurred_at: "2026-06-29T08:00:00Z" }),
        event({ occurred_at: "2026-06-29T08:00:20Z", kind: "idle" }),
      ]
      // heartbeat → idle : 20 s crédités ; idle lui-même ne crédite rien
      expect(computeScreenTimeMs(events, WINDOW_END).get("u1")).toBe(20_000)
    })

    it("should partition by session (events of different sessions do not chain)", () => {
      const events = [
        event({ session_id: "sA", occurred_at: "2026-06-29T08:00:00Z" }),
        event({ session_id: "sB", occurred_at: "2026-06-29T08:00:10Z" }),
      ]
      // Chaque session n'a qu'un événement → 90 s chacun (bornés par la fenêtre lointaine)
      expect(computeScreenTimeMs(events, WINDOW_END).get("u1")).toBe(90_000 + 90_000)
    })

    it("should cap the last event credit at the window end", () => {
      const events = [event({ occurred_at: "2026-06-29T09:59:30Z" })]
      expect(computeScreenTimeMs(events, WINDOW_END).get("u1")).toBe(30_000)
    })
  })

  describe("msToHours", () => {
    it("should round milliseconds to one decimal hour", () => {
      expect(msToHours(55.62 * 3_600_000)).toBe(55.6)
      expect(msToHours(0)).toBe(0)
    })
  })

  describe("parseGitNumstat", () => {
    const RAW = [
      "@@aaa111|02/07 02:10|fix(search): trouve les adresses à article élidé",
      "10\t2\tsupabase/migrations/99060.sql",
      "@@bbb222|01/07 16:44|feat(monitoring): flux temps réel",
      "100\t5\tsrc/a.ts",
      "-\t-\tpublic/logo.png",
      "@@ccc333|01/07 16:40|feat(monitoring): flux temps réel",
      "100\t5\tsrc/a.ts",
      "@@ddd444|30/06 12:00|chore: redeclenche le deploiement",
      "",
    ].join("\n")

    it("should dedupe commits sharing the same subject (cherry-picks)", () => {
      const stats = parseGitNumstat(RAW)
      expect(stats.commits).toBe(3) // ccc333 dédoublonné avec bbb222
      expect(stats.files).toBe(3)
      expect(stats.insertions).toBe(110)
      expect(stats.deletions).toBe(7)
    })

    it("should count fixes and feats by conventional prefix", () => {
      const stats = parseGitNumstat(RAW)
      expect(stats.fixes).toBe(1)
      expect(stats.feats).toBe(1)
    })

    it("should expose the most recent commit (first entry)", () => {
      expect(parseGitNumstat(RAW).lastCommit).toEqual({
        date: "02/07 02:10",
        subject: "fix(search): trouve les adresses à article élidé",
      })
    })

    it("should return zeroed stats on empty input", () => {
      expect(parseGitNumstat("")).toEqual({
        commits: 0,
        fixes: 0,
        feats: 0,
        files: 0,
        insertions: 0,
        deletions: 0,
        lastCommit: null,
      })
    })
  })

  describe("effectiveWindowEnd", () => {
    const CAP = "2026-07-03T10:00:00.000Z"

    it("should return now when before the cap", () => {
      const now = Date.parse("2026-07-02T08:00:00Z")
      expect(effectiveWindowEnd(now, CAP)).toBe("2026-07-02T08:00:00.000Z")
    })

    it("should freeze at the cap once passed (Friday noon Paris)", () => {
      const now = Date.parse("2026-07-04T09:00:00Z")
      expect(effectiveWindowEnd(now, CAP)).toBe(CAP)
    })
  })
})
