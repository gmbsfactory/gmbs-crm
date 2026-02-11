import { describe, it, expect } from "vitest"
import {
  calculateNewArtisanStatus,
  isTransitionAllowed,
  getDefaultArtisanStatus,
  STATUS_THRESHOLDS,
  AUTO_ASSIGNABLE_STATUSES,
  MANUAL_ONLY_STATUSES,
  type ArtisanStatusCode,
} from "@/lib/artisans/statusRules"

describe("statusRules", () => {
  describe("STATUS_THRESHOLDS", () => {
    it("should have correct threshold values", () => {
      expect(STATUS_THRESHOLDS.CANDIDAT).toBe(0)
      expect(STATUS_THRESHOLDS.POTENTIEL).toBe(0)
      expect(STATUS_THRESHOLDS.ONE_SHOT).toBe(0)
      expect(STATUS_THRESHOLDS.NOVICE).toBe(1)
      expect(STATUS_THRESHOLDS.FORMATION).toBe(3)
      expect(STATUS_THRESHOLDS.CONFIRME).toBe(6)
      expect(STATUS_THRESHOLDS.EXPERT).toBe(10)
      expect(STATUS_THRESHOLDS.ARCHIVE).toBe(-1) // Statut gelé
    })
  })

  describe("AUTO_ASSIGNABLE_STATUSES", () => {
    it("should include progression statuses", () => {
      expect(AUTO_ASSIGNABLE_STATUSES.has("NOVICE")).toBe(true)
      expect(AUTO_ASSIGNABLE_STATUSES.has("FORMATION")).toBe(true)
      expect(AUTO_ASSIGNABLE_STATUSES.has("CONFIRME")).toBe(true)
      expect(AUTO_ASSIGNABLE_STATUSES.has("EXPERT")).toBe(true)
    })

    it("should not include initial or special statuses", () => {
      expect(AUTO_ASSIGNABLE_STATUSES.has("CANDIDAT")).toBe(false)
      expect(AUTO_ASSIGNABLE_STATUSES.has("POTENTIEL")).toBe(false)
      expect(AUTO_ASSIGNABLE_STATUSES.has("ONE_SHOT")).toBe(false)
      expect(AUTO_ASSIGNABLE_STATUSES.has("ARCHIVE")).toBe(false)
    })
  })

  describe("MANUAL_ONLY_STATUSES", () => {
    it("should only include ARCHIVE", () => {
      expect(MANUAL_ONLY_STATUSES.has("ARCHIVE")).toBe(true)
      expect(MANUAL_ONLY_STATUSES.size).toBe(1)
    })
  })

  describe("calculateNewArtisanStatus", () => {
    describe("progression from POTENTIEL", () => {
      it("should return NOVICE after 1 completed intervention", () => {
        expect(calculateNewArtisanStatus("POTENTIEL", 1)).toBe("NOVICE")
      })

      it("should return FORMATION after 3 completed interventions", () => {
        expect(calculateNewArtisanStatus("POTENTIEL", 3)).toBe("FORMATION")
      })

      it("should return CONFIRME after 6 completed interventions", () => {
        expect(calculateNewArtisanStatus("POTENTIEL", 6)).toBe("CONFIRME")
      })

      it("should return EXPERT after 10 completed interventions", () => {
        expect(calculateNewArtisanStatus("POTENTIEL", 10)).toBe("EXPERT")
      })

      it("should return EXPERT after 15+ completed interventions", () => {
        expect(calculateNewArtisanStatus("POTENTIEL", 15)).toBe("EXPERT")
      })

      it("should return null with 0 interventions (no change)", () => {
        expect(calculateNewArtisanStatus("POTENTIEL", 0)).toBe(null)
      })
    })

    describe("progression from CANDIDAT", () => {
      it("should return NOVICE after 1 completed intervention", () => {
        expect(calculateNewArtisanStatus("CANDIDAT", 1)).toBe("NOVICE")
      })

      it("should return FORMATION after 3 completed interventions", () => {
        expect(calculateNewArtisanStatus("CANDIDAT", 3)).toBe("FORMATION")
      })

      it("should return CONFIRME after 6 completed interventions", () => {
        expect(calculateNewArtisanStatus("CANDIDAT", 6)).toBe("CONFIRME")
      })

      it("should return EXPERT after 10+ completed interventions", () => {
        expect(calculateNewArtisanStatus("CANDIDAT", 10)).toBe("EXPERT")
      })
    })

    describe("progression from NOVICE", () => {
      it("should return null with 1-2 interventions (stay NOVICE)", () => {
        expect(calculateNewArtisanStatus("NOVICE", 1)).toBe(null)
        expect(calculateNewArtisanStatus("NOVICE", 2)).toBe(null)
      })

      it("should return FORMATION after 3 completed interventions", () => {
        expect(calculateNewArtisanStatus("NOVICE", 3)).toBe("FORMATION")
      })

      it("should return CONFIRME after 6 completed interventions", () => {
        expect(calculateNewArtisanStatus("NOVICE", 6)).toBe("CONFIRME")
      })

      it("should return EXPERT after 10+ completed interventions", () => {
        expect(calculateNewArtisanStatus("NOVICE", 10)).toBe("EXPERT")
      })
    })

    describe("progression from FORMATION", () => {
      it("should return null with 3-5 interventions (stay FORMATION)", () => {
        expect(calculateNewArtisanStatus("FORMATION", 3)).toBe(null)
        expect(calculateNewArtisanStatus("FORMATION", 4)).toBe(null)
        expect(calculateNewArtisanStatus("FORMATION", 5)).toBe(null)
      })

      it("should return CONFIRME after 6 completed interventions", () => {
        expect(calculateNewArtisanStatus("FORMATION", 6)).toBe("CONFIRME")
      })

      it("should return EXPERT after 10+ completed interventions", () => {
        expect(calculateNewArtisanStatus("FORMATION", 10)).toBe("EXPERT")
      })
    })

    describe("progression from CONFIRME", () => {
      it("should return null with 6-9 interventions (stay CONFIRME)", () => {
        expect(calculateNewArtisanStatus("CONFIRME", 6)).toBe(null)
        expect(calculateNewArtisanStatus("CONFIRME", 7)).toBe(null)
        expect(calculateNewArtisanStatus("CONFIRME", 9)).toBe(null)
      })

      it("should return EXPERT after 10+ completed interventions", () => {
        expect(calculateNewArtisanStatus("CONFIRME", 10)).toBe("EXPERT")
        expect(calculateNewArtisanStatus("CONFIRME", 15)).toBe("EXPERT")
      })
    })

    describe("EXPERT status", () => {
      it("should return null once EXPERT (already at max)", () => {
        expect(calculateNewArtisanStatus("EXPERT", 10)).toBe(null)
        expect(calculateNewArtisanStatus("EXPERT", 15)).toBe(null)
        expect(calculateNewArtisanStatus("EXPERT", 100)).toBe(null)
      })
    })

    describe("frozen status: ARCHIVE", () => {
      it("should always return null regardless of interventions count", () => {
        expect(calculateNewArtisanStatus("ARCHIVE", 0)).toBe(null)
        expect(calculateNewArtisanStatus("ARCHIVE", 1)).toBe(null)
        expect(calculateNewArtisanStatus("ARCHIVE", 10)).toBe(null)
        expect(calculateNewArtisanStatus("ARCHIVE", 100)).toBe(null)
      })
    })

    describe("ONE_SHOT progression", () => {
      // ONE_SHOT can progress automatically (not frozen like ARCHIVE)
      it("should return NOVICE after 1 completed intervention", () => {
        expect(calculateNewArtisanStatus("ONE_SHOT", 1)).toBe("NOVICE")
      })

      it("should return FORMATION after 3 completed interventions", () => {
        expect(calculateNewArtisanStatus("ONE_SHOT", 3)).toBe("FORMATION")
      })
    })

    describe("null/undefined status", () => {
      it("should return POTENTIEL when status is null", () => {
        expect(calculateNewArtisanStatus(null, 0)).toBe("POTENTIEL")
      })

      it("should return POTENTIEL when status is undefined", () => {
        expect(calculateNewArtisanStatus(undefined, 0)).toBe("POTENTIEL")
      })
    })

    describe("edge cases", () => {
      it("should handle exactly threshold values", () => {
        // Exactly at thresholds
        expect(calculateNewArtisanStatus("POTENTIEL", 1)).toBe("NOVICE")
        expect(calculateNewArtisanStatus("POTENTIEL", 3)).toBe("FORMATION")
        expect(calculateNewArtisanStatus("POTENTIEL", 6)).toBe("CONFIRME")
        expect(calculateNewArtisanStatus("POTENTIEL", 10)).toBe("EXPERT")
      })

      it("should handle negative intervention counts gracefully", () => {
        // Should stay at current status
        expect(calculateNewArtisanStatus("NOVICE", -1)).toBe(null)
      })
    })
  })

  describe("isTransitionAllowed", () => {
    describe("from null (creation)", () => {
      it("should only allow POTENTIEL at creation", () => {
        expect(isTransitionAllowed(null, "POTENTIEL")).toBe(true)
        expect(isTransitionAllowed(null, "CANDIDAT")).toBe(false)
        expect(isTransitionAllowed(null, "NOVICE")).toBe(false)
      })
    })

    describe("to ARCHIVE", () => {
      it("should allow transition to ARCHIVE from any status", () => {
        const statuses: ArtisanStatusCode[] = [
          "POTENTIEL", "CANDIDAT", "NOVICE", "FORMATION",
          "CONFIRME", "EXPERT", "ONE_SHOT"
        ]
        statuses.forEach(status => {
          expect(isTransitionAllowed(status, "ARCHIVE")).toBe(true)
        })
      })
    })

    describe("POTENTIEL <-> CANDIDAT bidirectional", () => {
      it("should allow POTENTIEL to CANDIDAT", () => {
        expect(isTransitionAllowed("POTENTIEL", "CANDIDAT")).toBe(true)
      })

      it("should allow CANDIDAT to POTENTIEL", () => {
        expect(isTransitionAllowed("CANDIDAT", "POTENTIEL")).toBe(true)
      })
    })

    describe("to ONE_SHOT", () => {
      it("should allow from POTENTIEL", () => {
        expect(isTransitionAllowed("POTENTIEL", "ONE_SHOT")).toBe(true)
      })

      it("should allow from CANDIDAT", () => {
        expect(isTransitionAllowed("CANDIDAT", "ONE_SHOT")).toBe(true)
      })

      it("should not allow from other statuses", () => {
        expect(isTransitionAllowed("NOVICE", "ONE_SHOT")).toBe(false)
        expect(isTransitionAllowed("FORMATION", "ONE_SHOT")).toBe(false)
        expect(isTransitionAllowed("CONFIRME", "ONE_SHOT")).toBe(false)
        expect(isTransitionAllowed("EXPERT", "ONE_SHOT")).toBe(false)
      })
    })

    describe("from ONE_SHOT", () => {
      it("should allow return to POTENTIEL", () => {
        expect(isTransitionAllowed("ONE_SHOT", "POTENTIEL")).toBe(true)
      })

      it("should allow return to CANDIDAT", () => {
        expect(isTransitionAllowed("ONE_SHOT", "CANDIDAT")).toBe(true)
      })
    })

    describe("to auto-assignable statuses", () => {
      it("should allow manual transition to NOVICE", () => {
        expect(isTransitionAllowed("POTENTIEL", "NOVICE")).toBe(true)
        expect(isTransitionAllowed("CANDIDAT", "NOVICE")).toBe(true)
      })

      it("should allow manual transition to FORMATION", () => {
        expect(isTransitionAllowed("NOVICE", "FORMATION")).toBe(true)
      })

      it("should allow manual transition to CONFIRME", () => {
        expect(isTransitionAllowed("FORMATION", "CONFIRME")).toBe(true)
      })

      it("should allow manual transition to EXPERT", () => {
        expect(isTransitionAllowed("CONFIRME", "EXPERT")).toBe(true)
      })
    })
  })

  describe("getDefaultArtisanStatus", () => {
    it("should return POTENTIEL as default status", () => {
      expect(getDefaultArtisanStatus()).toBe("POTENTIEL")
    })
  })
})
