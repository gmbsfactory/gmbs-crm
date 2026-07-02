import { describe, expect, it } from "vitest"
import {
  dedupeFirstTransitionPerIntervention,
  REAL_DATA_START_ISO,
} from "@/lib/api/interventions/stats/transitions-scope"

const t = (intervention_id: string, to_status_code: string, transition_date: string) => ({
  intervention_id,
  to_status_code,
  transition_date,
})

describe("stats/transitions-scope", () => {
  it("should pin the real-data start to the go-live (lun 29/06/2026 00:00 Paris)", () => {
    expect(REAL_DATA_START_ISO).toBe("2026-06-28T22:00:00Z")
  })

  describe("dedupeFirstTransitionPerIntervention", () => {
    it("should count an intervention once per status, on its first transition", () => {
      // Une inter qui passe 4 fois en Devis envoyé = 1 devis envoyé
      const rows = [
        t("a", "DEVIS_ENVOYE", "2026-06-30T10:00:00Z"),
        t("a", "DEVIS_ENVOYE", "2026-06-29T08:00:00Z"), // premier passage (désordonné)
        t("a", "DEVIS_ENVOYE", "2026-07-01T09:00:00Z"),
        t("a", "DEVIS_ENVOYE", "2026-07-02T11:00:00Z"),
      ]
      const deduped = dedupeFirstTransitionPerIntervention(rows)
      expect(deduped).toHaveLength(1)
      expect(deduped[0].transition_date).toBe("2026-06-29T08:00:00Z")
    })

    it("should keep one entry per status for the same intervention", () => {
      // La même inter peut compter 1 fois en Devis envoyé ET 1 fois en Terminée
      const rows = [
        t("a", "DEVIS_ENVOYE", "2026-06-29T08:00:00Z"),
        t("a", "INTER_TERMINEE", "2026-06-30T17:00:00Z"),
        t("a", "INTER_TERMINEE", "2026-07-01T09:00:00Z"), // réouverture puis re-clôture
      ]
      const deduped = dedupeFirstTransitionPerIntervention(rows)
      expect(deduped).toHaveLength(2)
      expect(deduped.map((r) => r.to_status_code).sort()).toEqual(["DEVIS_ENVOYE", "INTER_TERMINEE"])
    })

    it("should keep distinct interventions separate", () => {
      const rows = [
        t("a", "DEVIS_ENVOYE", "2026-06-29T08:00:00Z"),
        t("b", "DEVIS_ENVOYE", "2026-06-29T09:00:00Z"),
      ]
      expect(dedupeFirstTransitionPerIntervention(rows)).toHaveLength(2)
    })

    it("should not mutate the input array", () => {
      const rows = [
        t("a", "DEVIS_ENVOYE", "2026-06-30T10:00:00Z"),
        t("a", "DEVIS_ENVOYE", "2026-06-29T08:00:00Z"),
      ]
      const copy = [...rows]
      dedupeFirstTransitionPerIntervention(rows)
      expect(rows).toEqual(copy)
    })

    it("should return an empty array for empty input", () => {
      expect(dedupeFirstTransitionPerIntervention([])).toEqual([])
    })
  })
})
