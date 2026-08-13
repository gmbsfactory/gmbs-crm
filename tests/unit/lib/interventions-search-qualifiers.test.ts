import { describe, it, expect } from "vitest"
import {
  ANY_AMOUNT_SCOPE,
  parseAmountInput,
  parseSearch,
} from "@/lib/api/interventions/search-qualifiers"

const ACOMPTES = ["acompte_sst", "acompte_client"]

describe("search-qualifiers", () => {
  describe("parseAmountInput", () => {
    it("should parse a plain integer amount", () => {
      expect(parseAmountInput("387")).toBe(387)
    })

    it("should parse a French decimal amount with a comma", () => {
      expect(parseAmountInput("387,78")).toBe(387.78)
    })

    it("should parse an amount already using a dot separator", () => {
      expect(parseAmountInput("387.78")).toBe(387.78)
    })

    it("should strip spaces used as thousands separators", () => {
      expect(parseAmountInput("1 500,50")).toBe(1500.5)
    })

    it("should strip non-breaking spaces", () => {
      expect(parseAmountInput("1 500,50")).toBe(1500.5)
    })

    it("should strip a currency suffix", () => {
      expect(parseAmountInput("387,78 €")).toBe(387.78)
      expect(parseAmountInput("387,78 EUR")).toBe(387.78)
    })

    it("should treat the dot as a thousands separator when a comma follows", () => {
      expect(parseAmountInput("1.500,50")).toBe(1500.5)
    })

    it("should treat the comma as a thousands separator when a dot follows", () => {
      expect(parseAmountInput("1,500.50")).toBe(1500.5)
    })

    it("should return null for an empty input", () => {
      expect(parseAmountInput("")).toBeNull()
      expect(parseAmountInput("   ")).toBeNull()
    })

    it("should return null for a non-numeric input", () => {
      expect(parseAmountInput("abc")).toBeNull()
      expect(parseAmountInput("387,78,90")).toBeNull()
    })

    it("should return null beyond two decimals (amounts are numeric(12,2))", () => {
      expect(parseAmountInput("387,789")).toBeNull()
    })

    it("should return null for a negative amount", () => {
      expect(parseAmountInput("-387,78")).toBeNull()
    })
  })

  describe("parseSearch — montant sec (usage réel)", () => {
    it("should detect a bare two-decimal amount, search every amount column, and keep the full-text search", () => {
      // Le cas de Badr : il tape le montant seul, sans préfixe.
      expect(parseSearch("387,78")).toEqual({
        text: "387,78",
        amount: { value: 387.78, ...ANY_AMOUNT_SCOPE },
      })
    })

    it("should cover both acomptes and costs by default", () => {
      expect(ANY_AMOUNT_SCOPE.paymentTypes).toEqual(ACOMPTES)
      expect(ANY_AMOUNT_SCOPE.costTypes).toEqual(["sst", "intervention", "materiel"])
    })

    it("should detect a bare amount written with a dot", () => {
      expect(parseSearch("387.78").amount?.value).toBe(387.78)
    })

    it("should detect a bare amount with a thousands separator", () => {
      expect(parseSearch("1 500,50").amount?.value).toBe(1500.5)
    })

    it("should tolerate surrounding whitespace", () => {
      expect(parseSearch("  387,78  ").amount?.value).toBe(387.78)
    })

    it("should detect an amount pasted with its currency suffix", () => {
      // Copier-coller depuis un relevé bancaire.
      expect(parseSearch("387,78 €").amount?.value).toBe(387.78)
      expect(parseSearch("387,78€").amount?.value).toBe(387.78)
      expect(parseSearch("387,78 EUR").amount?.value).toBe(387.78)
    })

    it("should NOT auto-detect a bare integer, which is ambiguous with an id_inter", () => {
      expect(parseSearch("21670")).toEqual({ text: "21670", amount: null })
      expect(parseSearch("120")).toEqual({ text: "120", amount: null })
    })

    it("should NOT auto-detect a postal code or a street number", () => {
      expect(parseSearch("69200")).toEqual({ text: "69200", amount: null })
      expect(parseSearch("91 AVENUE FRANCIS DE PRESSENSE")).toEqual({
        text: "91 AVENUE FRANCIS DE PRESSENSE",
        amount: null,
      })
    })

    it("should NOT auto-detect a value with three decimals", () => {
      expect(parseSearch("387,789")).toEqual({ text: "387,789", amount: null })
    })
  })

  describe("parseSearch — qualificateurs de portée", () => {
    it("should scope 'acompte:' to both acompte payment types and drop the full-text search", () => {
      expect(parseSearch("acompte:387,78")).toEqual({
        text: null,
        amount: { value: 387.78, paymentTypes: ACOMPTES, costTypes: [] },
      })
    })

    it("should scope 'acompte client:' to the client deposit only", () => {
      expect(parseSearch("acompte client:387,78")).toEqual({
        text: null,
        amount: { value: 387.78, paymentTypes: ["acompte_client"], costTypes: [] },
      })
    })

    it("should scope 'acompte sst:' and its 'artisan' synonym to the SST deposit only", () => {
      const expected = {
        text: null,
        amount: { value: 387.78, paymentTypes: ["acompte_sst"], costTypes: [] },
      }
      expect(parseSearch("acompte sst:387,78")).toEqual(expected)
      expect(parseSearch("acompte_sst:387,78")).toEqual(expected)
      expect(parseSearch("acompte artisan:387,78")).toEqual(expected)
    })

    it("should scope 'sst:' to the SST cost, not the SST deposit", () => {
      expect(parseSearch("sst:387,78")).toEqual({
        text: null,
        amount: { value: 387.78, paymentTypes: [], costTypes: ["sst"] },
      })
    })

    it("should scope 'inter:' and 'client:' to the intervention cost", () => {
      const expected = {
        text: null,
        amount: { value: 387.78, paymentTypes: [], costTypes: ["intervention"] },
      }
      expect(parseSearch("inter:387,78")).toEqual(expected)
      expect(parseSearch("client:387,78")).toEqual(expected)
    })

    it("should scope 'materiel:' to the material cost, accented or not", () => {
      const expected = {
        text: null,
        amount: { value: 387.78, paymentTypes: [], costTypes: ["materiel"] },
      }
      expect(parseSearch("materiel:387,78")).toEqual(expected)
      expect(parseSearch("matériel:387,78")).toEqual(expected)
    })

    it("should let a qualifier reach integer amounts, which are not auto-detected", () => {
      expect(parseSearch("sst:387").amount).toEqual({
        value: 387,
        paymentTypes: [],
        costTypes: ["sst"],
      })
    })

    it("should accept the common misspelling 'accompte'", () => {
      expect(parseSearch("accompte:387,78").amount?.paymentTypes).toEqual(ACOMPTES)
    })

    it("should be case-insensitive and tolerate spacing around the colon", () => {
      expect(parseSearch("  ACOMPTE : 387,78 ")).toEqual({
        text: null,
        amount: { value: 387.78, paymentTypes: ACOMPTES, costTypes: [] },
      })
    })

    it("should fall back to full-text when the qualified amount is invalid", () => {
      expect(parseSearch("sst:abc")).toEqual({ text: "sst:abc", amount: null })
      expect(parseSearch("acompte:")).toEqual({ text: "acompte:", amount: null })
    })
  })

  describe("parseSearch — recherche textuelle ordinaire", () => {
    it("should leave a plain text search untouched", () => {
      expect(parseSearch("VENISSIEUX")).toEqual({ text: "VENISSIEUX", amount: null })
    })

    it("should not treat an unknown qualifier as an amount", () => {
      expect(parseSearch("montant:387,78")).toEqual({
        text: "montant:387,78",
        amount: null,
      })
    })
  })
})
