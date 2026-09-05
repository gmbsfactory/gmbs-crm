import { describe, it, expect } from "vitest"
import {
  MAX_REVIEW_COMMENT_LENGTH,
  estVerifiee,
  isCalendarDate,
  mergeValidUntil,
  parseReviewBody,
  reviewLabel,
} from "@/lib/artisans/document-review"

describe("document-review", () => {
  describe("parseReviewBody", () => {
    it("should accepter une validation sans motif", () => {
      const result = parseReviewBody({ decision: "approved" })
      expect(result).toEqual({ ok: true, decision: "approved", comment: null, validUntil: null })
    })

    it("should refuser une décision inconnue", () => {
      expect(parseReviewBody({ decision: "maybe" })).toMatchObject({ ok: false, status: 400 })
      expect(parseReviewBody({})).toMatchObject({ ok: false, status: 400 })
      expect(parseReviewBody(null)).toMatchObject({ ok: false, status: 400 })
    })

    it("should exiger un motif au refus", () => {
      const result = parseReviewBody({ decision: "rejected" })
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.status).toBe(400)
        expect(result.error).toContain("motif")
      }
    })

    it("should traiter un motif fait d'espaces comme absent", () => {
      expect(parseReviewBody({ decision: "rejected", comment: "   \n  " })).toMatchObject({
        ok: false,
        status: 400,
      })
    })

    it("should accepter un refus motivé, motif détouré", () => {
      const result = parseReviewBody({ decision: "rejected", comment: "  Kbis trop ancien  " })
      expect(result).toEqual({
        ok: true,
        decision: "rejected",
        comment: "Kbis trop ancien",
        validUntil: null,
      })
    })

    it("should tronquer un motif trop long", () => {
      const result = parseReviewBody({ decision: "rejected", comment: "a".repeat(5000) })
      expect(result.ok).toBe(true)
      if (result.ok) expect(result.comment).toHaveLength(MAX_REVIEW_COMMENT_LENGTH)
    })

    it("should accepter une date de validité valide", () => {
      const result = parseReviewBody({ decision: "approved", valid_until: "2027-03-31" })
      expect(result).toMatchObject({ ok: true, validUntil: "2027-03-31" })
    })

    it("should refuser une date de validité invalide", () => {
      expect(parseReviewBody({ decision: "approved", valid_until: "31/03/2027" })).toMatchObject({
        ok: false,
        status: 400,
      })
      expect(parseReviewBody({ decision: "approved", valid_until: "2027-02-30" })).toMatchObject({
        ok: false,
        status: 400,
      })
    })

    it("should ignorer une date de validité vide", () => {
      expect(parseReviewBody({ decision: "approved", valid_until: "" })).toMatchObject({
        ok: true,
        validUntil: null,
      })
    })
  })

  describe("isCalendarDate", () => {
    it("should accepter une date existante et refuser une date inventée", () => {
      expect(isCalendarDate("2026-02-28")).toBe(true)
      expect(isCalendarDate("2026-02-29")).toBe(false)
      expect(isCalendarDate("2024-02-29")).toBe(true)
      expect(isCalendarDate("2026-13-01")).toBe(false)
      expect(isCalendarDate("hier")).toBe(false)
    })
  })

  describe("reviewLabel", () => {
    it("should lire null et approved comme « Validée » (DEFAULT approved de 99076)", () => {
      expect(reviewLabel(null)).toBe("Validée")
      expect(reviewLabel(undefined)).toBe("Validée")
      expect(reviewLabel("approved")).toBe("Validée")
    })

    it("should distinguer les pièces en attente et refusées", () => {
      expect(reviewLabel("pending")).toBe("À vérifier")
      expect(reviewLabel("rejected")).toBe("Refusée")
    })
  })

  describe("estVerifiee", () => {
    it("should ne considérer vérifiée qu'une pièce portant reviewed_at", () => {
      expect(estVerifiee(null)).toBe(false)
      expect(estVerifiee(undefined)).toBe(false)
      expect(estVerifiee("2026-09-05T10:00:00.000Z")).toBe(true)
    })
  })

  describe("mergeValidUntil", () => {
    it("should conserver metadata.source lors de l'ajout de la validité", () => {
      expect(mergeValidUntil({ source: "portal" }, "2027-01-01")).toEqual({
        source: "portal",
        valid_until: "2027-01-01",
      })
    })

    it("should retirer la validité quand elle est vidée, sans perdre le reste", () => {
      expect(mergeValidUntil({ source: "portal", valid_until: "2026-01-01" }, null)).toEqual({
        source: "portal",
      })
    })

    it("should tolérer des métadonnées absentes", () => {
      expect(mergeValidUntil(null, null)).toEqual({})
    })
  })
})
