import { describe, it, expect } from "vitest"
import { buildBaseSearchParams } from "@/lib/api/interventions/crud/_search-params"

describe("buildBaseSearchParams", () => {
  describe("vue « Mes vérifications »", () => {
    it("sérialise le drapeau et les statuts de revue dans des paramètres distincts", () => {
      const params = buildBaseSearchParams({
        user: "user-badr",
        statut: "st-choisi-par-la-puce",
        hasPortalReport: true,
        portalReportStatuts: ["st-accepte", "st-en-cours"],
      })

      expect(params.get("hasPortalReport")).toBe("true")
      expect(params.getAll("portalReportStatut")).toEqual(["st-accepte", "st-en-cours"])
      // `statut` reste celui de l'utilisateur : les deux se cumulent côté serveur
      expect(params.getAll("statut")).toEqual(["st-choisi-par-la-puce"])
    })

    it("n'envoie rien hors de la vue", () => {
      const params = buildBaseSearchParams({ user: "user-badr" })

      expect(params.get("hasPortalReport")).toBeNull()
      expect(params.getAll("portalReportStatut")).toEqual([])
    })
  })

  describe("routage de la recherche", () => {
    it("should send an unqualified text search as the `search` param only", () => {
      const params = buildBaseSearchParams({ search: "91 AVENUE FRANCIS DE PRESSENSE" })

      expect(params.get("search")).toBe("91 AVENUE FRANCIS DE PRESSENSE")
      expect(params.get("amount")).toBeNull()
    })

    it("should send BOTH params for a bare amount, so full-text results are kept", () => {
      const params = buildBaseSearchParams({ search: "387,78" })

      expect(params.get("search")).toBe("387,78")
      expect(params.get("amount")).toBe("387.78")
      expect(params.get("amountPaymentTypes")).toBe("acompte_sst,acompte_client")
      expect(params.get("amountCostTypes")).toBe("sst,intervention,materiel")
    })

    it("should normalize the amount to dot notation for the wire format", () => {
      const params = buildBaseSearchParams({ search: "1 500,50" })

      expect(params.get("amount")).toBe("1500.5")
    })

    it("should drop the full-text search for an explicitly scoped query", () => {
      const params = buildBaseSearchParams({ search: "sst:387,78" })

      expect(params.get("search")).toBeNull()
      expect(params.get("amount")).toBe("387.78")
      expect(params.get("amountPaymentTypes")).toBe("")
      expect(params.get("amountCostTypes")).toBe("sst")
    })

    it("should narrow the scope to a single payment type", () => {
      const params = buildBaseSearchParams({ search: "acompte client:387,78" })

      expect(params.get("amountPaymentTypes")).toBe("acompte_client")
      expect(params.get("amountCostTypes")).toBe("")
    })

    it("should not send an amount filter for a bare integer", () => {
      const params = buildBaseSearchParams({ search: "21670" })

      expect(params.get("search")).toBe("21670")
      expect(params.get("amount")).toBeNull()
    })

    it("should fall back to full-text search when a qualified amount is unparseable", () => {
      const params = buildBaseSearchParams({ search: "sst:abc" })

      expect(params.get("search")).toBe("sst:abc")
      expect(params.get("amount")).toBeNull()
    })

    it("should send no search param at all when no search is provided", () => {
      const params = buildBaseSearchParams({})

      expect(params.get("search")).toBeNull()
      expect(params.get("amount")).toBeNull()
    })
  })

  describe("non-régression sur les autres filtres", () => {
    it("should keep other filters alongside an amount search", () => {
      const params = buildBaseSearchParams({
        search: "387,78",
        statuts: ["statut-1"],
        limit: 50,
      })

      expect(params.get("amount")).toBe("387.78")
      expect(params.get("statut")).toBe("statut-1")
      expect(params.get("limit")).toBe("50")
    })
  })
})
