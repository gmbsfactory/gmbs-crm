import { describe, it, expect } from "vitest"
import {
  PORTAL_WORK_STARTED_COLOR,
  PORTAL_WORK_STARTED_FALLBACK_LABEL,
  isPortalWorkStartedToShow,
  portalWorkStartedLabel,
} from "@/lib/interventions/portal-work-status"
import { PORTAL_REPORT_REVIEW_COLOR } from "@/lib/interventions/portal-report-status"

const DEMARRE = "2026-09-12T08:40:00.000Z"

describe("portal-work-status", () => {
  describe("isPortalWorkStartedToShow", () => {
    it("should signal a start declared while the status stayed ACCEPTE", () => {
      expect(isPortalWorkStartedToShow("ACCEPTE", DEMARRE)).toBe(true)
    })

    it("should stay silent once the status has followed", () => {
      // Le statut a suivi : plus aucun écart à signaler.
      expect(isPortalWorkStartedToShow("INTER_EN_COURS", DEMARRE)).toBe(false)
      expect(isPortalWorkStartedToShow("SAV", DEMARRE)).toBe(false)
      expect(isPortalWorkStartedToShow("INTER_TERMINEE", DEMARRE)).toBe(false)
    })

    it("should stay silent when no start was declared", () => {
      expect(isPortalWorkStartedToShow("ACCEPTE", null)).toBe(false)
      expect(isPortalWorkStartedToShow("ACCEPTE", undefined)).toBe(false)
      expect(isPortalWorkStartedToShow(null, DEMARRE)).toBe(false)
    })
  })

  describe("portalWorkStartedLabel", () => {
    it("should agree in number", () => {
      expect(portalWorkStartedLabel(1)).toBe("Démarré · 1 champ manquant")
      expect(portalWorkStartedLabel(3)).toBe("Démarré · 3 champs manquants")
    })

    it("should fall back when the count is unknown or nil", () => {
      // NULL = démarrage antérieur à la migration 99084.
      expect(portalWorkStartedLabel(null)).toBe(PORTAL_WORK_STARTED_FALLBACK_LABEL)
      expect(portalWorkStartedLabel(undefined)).toBe(PORTAL_WORK_STARTED_FALLBACK_LABEL)
      // Zéro : le statut aurait dû avancer, on le dit sans inventer de champ.
      expect(portalWorkStartedLabel(0)).toBe(PORTAL_WORK_STARTED_FALLBACK_LABEL)
    })
  })

  it("should not reuse the « À vérifier » colour: the two badges say different things", () => {
    expect(PORTAL_WORK_STARTED_COLOR).not.toBe(PORTAL_REPORT_REVIEW_COLOR)
  })
})
