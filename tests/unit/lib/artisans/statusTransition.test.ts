import { describe, it, expect } from "vitest"
import {
  calculateArtisanStatusTransition,
  shouldUpdateStatusOnInterventionCompletion,
  type ArtisanStatusTransitionParams,
} from "@/lib/artisans/statusTransition"

describe("statusTransition", () => {
  describe("calculateArtisanStatusTransition", () => {
    describe("basic status progression", () => {
      it("should progress POTENTIEL to NOVICE after 1 intervention", () => {
        const params: ArtisanStatusTransitionParams = {
          currentStatus: "POTENTIEL",
          currentDossierStatus: "INCOMPLET",
          attachments: [],
          completedInterventionsCount: 1,
          hasCompletedIntervention: true,
        }

        const result = calculateArtisanStatusTransition(params)

        expect(result.newStatus).toBe("NOVICE")
        expect(result.shouldUpdate).toBe(true)
      })

      it("should progress CANDIDAT to NOVICE after 1 intervention", () => {
        const params: ArtisanStatusTransitionParams = {
          currentStatus: "CANDIDAT",
          currentDossierStatus: "INCOMPLET",
          attachments: [],
          completedInterventionsCount: 1,
          hasCompletedIntervention: true,
        }

        const result = calculateArtisanStatusTransition(params)

        expect(result.newStatus).toBe("NOVICE")
        expect(result.shouldUpdate).toBe(true)
      })

      it("should progress NOVICE to FORMATION after 3 interventions", () => {
        const params: ArtisanStatusTransitionParams = {
          currentStatus: "NOVICE",
          currentDossierStatus: "À compléter",
          attachments: [],
          completedInterventionsCount: 3,
          hasCompletedIntervention: true,
        }

        const result = calculateArtisanStatusTransition(params)

        expect(result.newStatus).toBe("FORMATION")
        expect(result.shouldUpdate).toBe(true)
      })

      it("should progress FORMATION to CONFIRME after 6 interventions", () => {
        const params: ArtisanStatusTransitionParams = {
          currentStatus: "FORMATION",
          currentDossierStatus: "COMPLET",
          attachments: [],
          completedInterventionsCount: 6,
          hasCompletedIntervention: true,
        }

        const result = calculateArtisanStatusTransition(params)

        expect(result.newStatus).toBe("CONFIRME")
        expect(result.shouldUpdate).toBe(true)
      })

      it("should progress CONFIRME to EXPERT after 10 interventions", () => {
        const params: ArtisanStatusTransitionParams = {
          currentStatus: "CONFIRME",
          currentDossierStatus: "COMPLET",
          attachments: [],
          completedInterventionsCount: 10,
          hasCompletedIntervention: true,
        }

        const result = calculateArtisanStatusTransition(params)

        expect(result.newStatus).toBe("EXPERT")
        expect(result.shouldUpdate).toBe(true)
      })
    })

    describe("rule ARC-002: INCOMPLET -> À compléter on NOVICE transition", () => {
      it("should change dossier status to 'À compléter' when transitioning to NOVICE with INCOMPLET dossier", () => {
        const params: ArtisanStatusTransitionParams = {
          currentStatus: "POTENTIEL",
          currentDossierStatus: "INCOMPLET",
          attachments: [],
          completedInterventionsCount: 1,
          hasCompletedIntervention: true,
        }

        const result = calculateArtisanStatusTransition(params)

        expect(result.newStatus).toBe("NOVICE")
        expect(result.newDossierStatus).toBe("À compléter")
        expect(result.shouldUpdate).toBe(true)
      })

      it("should NOT apply ARC-002 when already NOVICE", () => {
        const params: ArtisanStatusTransitionParams = {
          currentStatus: "NOVICE",
          currentDossierStatus: "INCOMPLET",
          attachments: [],
          completedInterventionsCount: 1,
          hasCompletedIntervention: true,
        }

        const result = calculateArtisanStatusTransition(params)

        // Status doesn't change (already NOVICE with 1 intervention)
        expect(result.newStatus).toBe(null)
        // Dossier status should be recalculated normally, not forced to "À compléter"
      })

      it("should NOT apply ARC-002 when dossier is COMPLET", () => {
        const params: ArtisanStatusTransitionParams = {
          currentStatus: "POTENTIEL",
          currentDossierStatus: "COMPLET",
          attachments: [
            { kind: "kbis" },
            { kind: "assurance" },
            { kind: "cni_recto_verso" },
            { kind: "iban" },
            { kind: "decharge_partenariat" },
          ],
          completedInterventionsCount: 1,
          hasCompletedIntervention: true,
        }

        const result = calculateArtisanStatusTransition(params)

        expect(result.newStatus).toBe("NOVICE")
        // Dossier should stay COMPLET, not change to "À compléter"
        expect(result.newDossierStatus).not.toBe("À compléter")
      })

      it("should NOT apply ARC-002 when transitioning to FORMATION (not NOVICE)", () => {
        // Note: ARC-002 only forces "À compléter" on NOVICE transition
        // But calculateDossierStatus can independently return "À compléter"
        // if hasCompletedIntervention is true and documents are missing
        const params: ArtisanStatusTransitionParams = {
          currentStatus: "NOVICE",
          currentDossierStatus: "À compléter", // Already "À compléter" from NOVICE transition
          attachments: [],
          completedInterventionsCount: 3,
          hasCompletedIntervention: true,
        }

        const result = calculateArtisanStatusTransition(params)

        expect(result.newStatus).toBe("FORMATION")
        // ARC-002 doesn't apply here (not NOVICE transition)
        // But dossier stays "À compléter" because of missing documents + completed intervention
      })
    })

    describe("no update scenarios", () => {
      it("should not update when no status change and no dossier change", () => {
        const params: ArtisanStatusTransitionParams = {
          currentStatus: "NOVICE",
          currentDossierStatus: "INCOMPLET",
          attachments: [],
          completedInterventionsCount: 2,
          hasCompletedIntervention: true,
        }

        const result = calculateArtisanStatusTransition(params)

        // 2 interventions = stay NOVICE (need 3 for FORMATION)
        expect(result.newStatus).toBe(null)
      })

      it("should not progress ARCHIVE status", () => {
        const params: ArtisanStatusTransitionParams = {
          currentStatus: "ARCHIVE",
          currentDossierStatus: "INCOMPLET",
          attachments: [],
          completedInterventionsCount: 10,
          hasCompletedIntervention: true,
        }

        const result = calculateArtisanStatusTransition(params)

        expect(result.newStatus).toBe(null)
      })

      it("should not progress EXPERT (already at max)", () => {
        const params: ArtisanStatusTransitionParams = {
          currentStatus: "EXPERT",
          currentDossierStatus: "COMPLET",
          attachments: [],
          completedInterventionsCount: 20,
          hasCompletedIntervention: true,
        }

        const result = calculateArtisanStatusTransition(params)

        expect(result.newStatus).toBe(null)
      })
    })
  })

  describe("shouldUpdateStatusOnInterventionCompletion", () => {
    it("should return true when status would change", () => {
      expect(shouldUpdateStatusOnInterventionCompletion("POTENTIEL", 1)).toBe(true)
      expect(shouldUpdateStatusOnInterventionCompletion("CANDIDAT", 1)).toBe(true)
      expect(shouldUpdateStatusOnInterventionCompletion("NOVICE", 3)).toBe(true)
      expect(shouldUpdateStatusOnInterventionCompletion("FORMATION", 6)).toBe(true)
      expect(shouldUpdateStatusOnInterventionCompletion("CONFIRME", 10)).toBe(true)
    })

    it("should return false when status would not change", () => {
      expect(shouldUpdateStatusOnInterventionCompletion("POTENTIEL", 0)).toBe(false)
      expect(shouldUpdateStatusOnInterventionCompletion("NOVICE", 1)).toBe(false)
      expect(shouldUpdateStatusOnInterventionCompletion("NOVICE", 2)).toBe(false)
      expect(shouldUpdateStatusOnInterventionCompletion("FORMATION", 4)).toBe(false)
      expect(shouldUpdateStatusOnInterventionCompletion("EXPERT", 15)).toBe(false)
    })

    it("should return false for ARCHIVE (frozen)", () => {
      expect(shouldUpdateStatusOnInterventionCompletion("ARCHIVE", 1)).toBe(false)
      expect(shouldUpdateStatusOnInterventionCompletion("ARCHIVE", 10)).toBe(false)
    })
  })
})
