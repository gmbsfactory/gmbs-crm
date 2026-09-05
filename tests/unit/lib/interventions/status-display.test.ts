import { describe, it, expect } from "vitest"

import { getStatusDisplay } from "@/lib/interventions/status-display"
import {
  PORTAL_REPORT_REVIEW_COLOR,
  PORTAL_REPORT_REVIEW_LABEL,
  PORTAL_REPORT_REVIEW_STATUSES,
  isPortalReportToReview,
} from "@/lib/interventions/portal-report-status"

const statusFromDb = (code: string, label: string, color = "#123456") => ({ code, label, color })

describe("portal-report-status", () => {
  describe("isPortalReportToReview", () => {
    it.each(PORTAL_REPORT_REVIEW_STATUSES)("should be true for %s when a report is pending", (code) => {
      expect(isPortalReportToReview(code, true)).toBe(true)
    })

    it.each(["DEMANDE", "DEVIS_ENVOYE", "REFUSE", "ANNULE"])(
      "should be false for %s even with a pending report",
      (code) => {
        expect(isPortalReportToReview(code, true)).toBe(false)
      },
    )

    it("should be false without a pending report", () => {
      expect(isPortalReportToReview("INTER_EN_COURS", false)).toBe(false)
      expect(isPortalReportToReview("INTER_EN_COURS", null)).toBe(false)
      expect(isPortalReportToReview("INTER_EN_COURS", undefined)).toBe(false)
    })

    // L2 : un rapport en attente sur une intervention terminée doit rester visible.
    it("should be true for INTER_TERMINEE when a report is pending", () => {
      expect(isPortalReportToReview("INTER_TERMINEE", true)).toBe(true)
    })

    it("should be false without a status code", () => {
      expect(isPortalReportToReview(null, true)).toBe(false)
      expect(isPortalReportToReview("", true)).toBe(false)
    })
  })
})

describe("getStatusDisplay — option hasPortalReport", () => {
  it.each(PORTAL_REPORT_REVIEW_STATUSES)(
    "should display « À vérifier » in purple for %s when hasPortalReport is true",
    (code) => {
      const display = getStatusDisplay(code, {
        statusFromDb: statusFromDb(code, "Libellé DB"),
        hasPortalReport: true,
      })
      expect(display.label).toBe(PORTAL_REPORT_REVIEW_LABEL)
      expect(display.label).toBe("À vérifier")
      expect(display.color).toBe(PORTAL_REPORT_REVIEW_COLOR)
      expect(display.color).toBe("#9333EA")
    },
  )

  it("should keep the DB label and color when hasPortalReport is false", () => {
    const display = getStatusDisplay("INTER_EN_COURS", {
      statusFromDb: statusFromDb("INTER_EN_COURS", "Inter en cours", "#F59E0B"),
      hasPortalReport: false,
    })
    expect(display.label).toBe("Inter en cours")
    expect(display.color).toBe("#F59E0B")
  })

  it("should keep the DB label and color when the option is omitted", () => {
    const display = getStatusDisplay("ACCEPTE", {
      statusFromDb: statusFromDb("ACCEPTE", "Accepté", "#22C55E"),
    })
    expect(display.label).toBe("Accepté")
    expect(display.color).toBe("#22C55E")
  })

  it.each(["DEMANDE", "DEVIS_ENVOYE", "REFUSE"])(
    "should ignore hasPortalReport for %s (status not allowed)",
    (code) => {
      const display = getStatusDisplay(code, {
        statusFromDb: statusFromDb(code, `Libellé ${code}`, "#0EA5E9"),
        hasPortalReport: true,
      })
      expect(display.label).toBe(`Libellé ${code}`)
      expect(display.color).toBe("#0EA5E9")
    },
  )

  it("should override the workflow label too when a report is pending", () => {
    const workflow = {
      statuses: [{ key: "SAV", label: "SAV custom", color: "#000000" }],
    } as unknown as NonNullable<Parameters<typeof getStatusDisplay>[1]>["workflow"]
    const display = getStatusDisplay("SAV", { workflow, hasPortalReport: true })
    expect(display.label).toBe("À vérifier")
    expect(display.color).toBe("#9333EA")
  })

  it("should keep an icon for the underlying status", () => {
    const display = getStatusDisplay("INTER_EN_COURS", { hasPortalReport: true })
    expect(display.icon).not.toBeNull()
  })

  it("should not be affected by hasPortalReport when code is missing", () => {
    const display = getStatusDisplay(null, { hasPortalReport: true })
    expect(display.label).not.toBe("À vérifier")
  })
})
