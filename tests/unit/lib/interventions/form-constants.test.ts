import { describe, it, expect } from "vitest"
import {
  INTERVENTION_DOCUMENT_KINDS,
  STATUS_SORT_ORDER,
  MAX_RADIUS_KM,
  STATUSES_REQUIRING_DATE_PREVUE,
  STATUSES_REQUIRING_DEFINITIVE_ID,
  STATUSES_REQUIRING_NOM_FACTURATION,
  STATUSES_REQUIRING_ASSIGNED_USER,
  STATUSES_REQUIRING_COUTS,
  STATUSES_REQUIRING_CONSIGNE_ARTISAN,
  STATUSES_REQUIRING_CLIENT_INFO,
  ARTISAN_REQUIRED_STATUS_CODES,
} from "@/lib/interventions/form-constants"

describe("form-constants", () => {
  describe("INTERVENTION_DOCUMENT_KINDS", () => {
    it("should have exactly 5 document kinds", () => {
      expect(INTERVENTION_DOCUMENT_KINDS).toHaveLength(5)
    })

    it("should contain all expected document kinds", () => {
      const kinds = INTERVENTION_DOCUMENT_KINDS.map(d => d.kind)
      expect(kinds).toEqual(["devis", "facturesGMBS", "facturesMateriel", "photos", "facturesArtisans"])
    })

    it("should have labels for every kind", () => {
      for (const doc of INTERVENTION_DOCUMENT_KINDS) {
        expect(doc.label).toBeTruthy()
      }
    })
  })

  describe("STATUS_SORT_ORDER", () => {
    it("should have 11 status entries", () => {
      expect(Object.keys(STATUS_SORT_ORDER)).toHaveLength(11)
    })

    it("should order DEMANDE first", () => {
      expect(STATUS_SORT_ORDER.DEMANDE).toBe(1)
    })

    it("should contain all expected status codes", () => {
      const codes = Object.keys(STATUS_SORT_ORDER)
      expect(codes).toContain("DEMANDE")
      expect(codes).toContain("DEVIS_ENVOYE")
      expect(codes).toContain("ACCEPTE")
      expect(codes).toContain("INTER_EN_COURS")
      expect(codes).toContain("ATT_ACOMPTE")
      expect(codes).toContain("INTER_TERMINEE")
      expect(codes).toContain("VISITE_TECHNIQUE")
      expect(codes).toContain("STAND_BY")
      expect(codes).toContain("ANNULE")
      expect(codes).toContain("REFUSE")
      expect(codes).toContain("SAV")
    })

    it("should have unique sort values", () => {
      const values = Object.values(STATUS_SORT_ORDER)
      const uniqueValues = new Set(values)
      expect(uniqueValues.size).toBe(values.length)
    })
  })

  describe("MAX_RADIUS_KM", () => {
    it("should be 10000", () => {
      expect(MAX_RADIUS_KM).toBe(10000)
    })
  })

  describe("STATUSES_REQUIRING_DATE_PREVUE", () => {
    it("should require date for VISITE_TECHNIQUE and INTER_EN_COURS", () => {
      expect(STATUSES_REQUIRING_DATE_PREVUE.has("VISITE_TECHNIQUE")).toBe(true)
      expect(STATUSES_REQUIRING_DATE_PREVUE.has("INTER_EN_COURS")).toBe(true)
    })

    it("should have exactly 2 entries", () => {
      expect(STATUSES_REQUIRING_DATE_PREVUE.size).toBe(2)
    })

    it("should not require date for DEMANDE", () => {
      expect(STATUSES_REQUIRING_DATE_PREVUE.has("DEMANDE")).toBe(false)
    })
  })

  describe("STATUSES_REQUIRING_DEFINITIVE_ID", () => {
    it("should contain the 6 expected status codes", () => {
      expect(STATUSES_REQUIRING_DEFINITIVE_ID.size).toBe(6)
      expect(STATUSES_REQUIRING_DEFINITIVE_ID.has("DEVIS_ENVOYE")).toBe(true)
      expect(STATUSES_REQUIRING_DEFINITIVE_ID.has("VISITE_TECHNIQUE")).toBe(true)
      expect(STATUSES_REQUIRING_DEFINITIVE_ID.has("ACCEPTE")).toBe(true)
      expect(STATUSES_REQUIRING_DEFINITIVE_ID.has("INTER_EN_COURS")).toBe(true)
      expect(STATUSES_REQUIRING_DEFINITIVE_ID.has("INTER_TERMINEE")).toBe(true)
      expect(STATUSES_REQUIRING_DEFINITIVE_ID.has("STAND_BY")).toBe(true)
    })

    it("should not require definitive ID for DEMANDE", () => {
      expect(STATUSES_REQUIRING_DEFINITIVE_ID.has("DEMANDE")).toBe(false)
    })
  })

  describe("Edit-form validation constants", () => {
    it("STATUSES_REQUIRING_NOM_FACTURATION should contain DEVIS_ENVOYE", () => {
      expect(STATUSES_REQUIRING_NOM_FACTURATION.has("DEVIS_ENVOYE")).toBe(true)
      expect(STATUSES_REQUIRING_NOM_FACTURATION.size).toBe(1)
    })

    it("STATUSES_REQUIRING_ASSIGNED_USER should contain DEVIS_ENVOYE", () => {
      expect(STATUSES_REQUIRING_ASSIGNED_USER.has("DEVIS_ENVOYE")).toBe(true)
      expect(STATUSES_REQUIRING_ASSIGNED_USER.size).toBe(1)
    })

    it("STATUSES_REQUIRING_COUTS should contain INTER_EN_COURS", () => {
      expect(STATUSES_REQUIRING_COUTS.has("INTER_EN_COURS")).toBe(true)
      expect(STATUSES_REQUIRING_COUTS.size).toBe(1)
    })

    it("STATUSES_REQUIRING_CONSIGNE_ARTISAN should contain INTER_EN_COURS", () => {
      expect(STATUSES_REQUIRING_CONSIGNE_ARTISAN.has("INTER_EN_COURS")).toBe(true)
      expect(STATUSES_REQUIRING_CONSIGNE_ARTISAN.size).toBe(1)
    })

    it("STATUSES_REQUIRING_CLIENT_INFO should contain INTER_EN_COURS", () => {
      expect(STATUSES_REQUIRING_CLIENT_INFO.has("INTER_EN_COURS")).toBe(true)
      expect(STATUSES_REQUIRING_CLIENT_INFO.size).toBe(1)
    })
  })

  describe("ARTISAN_REQUIRED_STATUS_CODES", () => {
    it("should contain 4 status codes", () => {
      expect(ARTISAN_REQUIRED_STATUS_CODES).toHaveLength(4)
    })

    it("should contain the expected codes", () => {
      expect(ARTISAN_REQUIRED_STATUS_CODES).toContain("VISITE_TECHNIQUE")
      expect(ARTISAN_REQUIRED_STATUS_CODES).toContain("INTER_EN_COURS")
      expect(ARTISAN_REQUIRED_STATUS_CODES).toContain("INTER_TERMINEE")
      expect(ARTISAN_REQUIRED_STATUS_CODES).toContain("ATT_ACOMPTE")
    })
  })
})
