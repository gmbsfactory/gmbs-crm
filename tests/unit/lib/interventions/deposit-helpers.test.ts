import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
  applyRecuToggle,
  canEditDeposits,
  canMarkDepositReceived,
  getDepositValidationError,
  isDepositSpecified,
  resolveDeletedPaymentTypes,
  resolveDepositStatusCode,
  todayLocalISO,
} from "@/lib/interventions/deposit-helpers"

describe("deposit-helpers", () => {
  describe("canEditDeposits", () => {
    it.each(["DEVIS_ENVOYE", "ACCEPTE", "ATT_ACOMPTE"])("autorise la saisie en %s", (code) => {
      expect(canEditDeposits(code)).toBe(true)
    })

    it.each(["DEMANDE", "VISITE_TECHNIQUE", "INTER_EN_COURS", "INTER_TERMINEE", "", undefined])(
      "bloque la saisie en %s",
      (code) => {
        expect(canEditDeposits(code)).toBe(false)
      },
    )
  })

  describe("isDepositSpecified", () => {
    it("considère 0 comme saisi (acompte nul acté)", () => {
      expect(isDepositSpecified("0")).toBe(true)
    })

    it("ne considère pas le champ vide comme saisi", () => {
      expect(isDepositSpecified("")).toBe(false)
      expect(isDepositSpecified("   ")).toBe(false)
      expect(isDepositSpecified(null)).toBe(false)
      expect(isDepositSpecified(undefined)).toBe(false)
    })
  })

  describe("canMarkDepositReceived", () => {
    it.each(["ACCEPTE", "ATT_ACOMPTE"])("autorise « Reçu » en %s avec un montant", (code) => {
      expect(canMarkDepositReceived(code, "500")).toBe(true)
    })

    it("autorise « Reçu » sur un acompte saisi à 0", () => {
      expect(canMarkDepositReceived("ATT_ACOMPTE", "0")).toBe(true)
    })

    it("verrouille « Reçu » tant qu'aucun montant n'est saisi", () => {
      expect(canMarkDepositReceived("ATT_ACOMPTE", "")).toBe(false)
      expect(canMarkDepositReceived("ACCEPTE", undefined)).toBe(false)
    })

    it("interdit « Reçu » depuis DEVIS_ENVOYE (ATT_ACOMPTE d'abord)", () => {
      expect(canMarkDepositReceived("DEVIS_ENVOYE", "500")).toBe(false)
    })
  })

  describe("resolveDepositStatusCode", () => {
    it("passe en ATT_ACOMPTE quand un montant est saisi sans « Reçu »", () => {
      expect(
        resolveDepositStatusCode({ currentStatusCode: "DEVIS_ENVOYE", amount: "500", recu: false }),
      ).toBe("ATT_ACOMPTE")
    })

    it("traite un acompte à 0 comme saisi", () => {
      expect(
        resolveDepositStatusCode({ currentStatusCode: "DEVIS_ENVOYE", amount: "0", recu: false }),
      ).toBe("ATT_ACOMPTE")
      expect(
        resolveDepositStatusCode({ currentStatusCode: "ATT_ACOMPTE", amount: "0", recu: true }),
      ).toBe("ACCEPTE")
    })

    it("repasse en ATT_ACOMPTE depuis ACCEPTE si l'acompte n'est plus reçu", () => {
      expect(
        resolveDepositStatusCode({ currentStatusCode: "ACCEPTE", amount: "500", recu: false }),
      ).toBe("ATT_ACOMPTE")
    })

    it("passe en ACCEPTE quand « Reçu » est coché", () => {
      expect(
        resolveDepositStatusCode({ currentStatusCode: "ATT_ACOMPTE", amount: "500", recu: true }),
      ).toBe("ACCEPTE")
    })

    it("n'impose rien tant que le montant n'est pas saisi", () => {
      expect(
        resolveDepositStatusCode({ currentStatusCode: "DEVIS_ENVOYE", amount: "", recu: false }),
      ).toBeNull()
      expect(
        resolveDepositStatusCode({ currentStatusCode: "ACCEPTE", amount: null, recu: true }),
      ).toBeNull()
    })

    it("débloque ATT_ACOMPTE vers ACCEPTE quand un acompte existant est retiré", () => {
      expect(
        resolveDepositStatusCode({
          currentStatusCode: "ATT_ACOMPTE",
          amount: "",
          recu: false,
          hadDeposit: true,
        }),
      ).toBe("ACCEPTE")
    })

    it("n'impose rien en ATT_ACOMPTE si aucun acompte n'a jamais existé", () => {
      expect(
        resolveDepositStatusCode({ currentStatusCode: "ATT_ACOMPTE", amount: "", recu: false }),
      ).toBeNull()
    })

    it("ne débloque pas depuis un autre statut éditable, même après suppression", () => {
      expect(
        resolveDepositStatusCode({
          currentStatusCode: "DEVIS_ENVOYE",
          amount: "",
          recu: false,
          hadDeposit: true,
        }),
      ).toBeNull()
    })

    it("n'impose rien hors des statuts où l'acompte est éditable", () => {
      expect(
        resolveDepositStatusCode({ currentStatusCode: "INTER_EN_COURS", amount: "500", recu: true }),
      ).toBeNull()
    })
  })

  describe("getDepositValidationError", () => {
    it("bloque « Reçu » coché sans date", () => {
      expect(getDepositValidationError({ recu: true, date: "" })).toMatch(/date de réception/i)
      expect(getDepositValidationError({ recu: true, date: "   " })).not.toBeNull()
    })

    it("laisse passer « Reçu » coché avec date", () => {
      expect(getDepositValidationError({ recu: true, date: "2026-04-12" })).toBeNull()
    })

    it("laisse passer un acompte non reçu sans date", () => {
      expect(getDepositValidationError({ recu: false, date: "" })).toBeNull()
    })
  })

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

  describe('resolveDeletedPaymentTypes', () => {
    it('should delete both types when no deposit is filled in an editable status', () => {
      expect(
        resolveDeletedPaymentTypes({ currentStatusCode: 'ATT_ACOMPTE', upsertedPaymentTypes: [] })
      ).toEqual(['acompte_sst', 'acompte_client'])
    })

    it('should delete only the complement of the upserted types', () => {
      expect(
        resolveDeletedPaymentTypes({ currentStatusCode: 'ACCEPTE', upsertedPaymentTypes: ['acompte_client'] })
      ).toEqual(['acompte_sst'])
    })

    it('should delete nothing when both types are upserted', () => {
      expect(
        resolveDeletedPaymentTypes({
          currentStatusCode: 'ACCEPTE',
          upsertedPaymentTypes: ['acompte_sst', 'acompte_client'],
        })
      ).toEqual([])
    })

    it('should delete nothing outside an editable status (champ vide = non modifiable ici)', () => {
      expect(
        resolveDeletedPaymentTypes({ currentStatusCode: 'TERMINE', upsertedPaymentTypes: [] })
      ).toEqual([])
      expect(
        resolveDeletedPaymentTypes({ currentStatusCode: undefined, upsertedPaymentTypes: [] })
      ).toEqual([])
    })
  })
})
