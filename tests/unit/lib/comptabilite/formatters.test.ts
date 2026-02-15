import { describe, it, expect } from "vitest"
import {
  formatCurrency,
  formatDate,
  formatName,
  formatClientName,
  formatAddress,
  getMetierLabel,
  getCostAmountByType,
  getPaymentInfo,
  getArtisanName,
} from "@/lib/comptabilite/formatters"

describe("comptabilite formatters", () => {
  describe("formatCurrency", () => {
    it("should format a number as EUR currency", () => {
      expect(formatCurrency(100)).toContain("100")
      expect(formatCurrency(100)).toContain("€")
    })

    it("should return — for null or undefined", () => {
      expect(formatCurrency(null)).toBe("—")
      expect(formatCurrency(undefined)).toBe("—")
    })

    it("should return — for NaN", () => {
      expect(formatCurrency(NaN)).toBe("—")
    })
  })

  describe("formatDate", () => {
    it("should format a valid date string", () => {
      const result = formatDate("2024-01-15")
      expect(result).toBe("15/01/2024")
    })

    it("should return — for null or undefined", () => {
      expect(formatDate(null)).toBe("—")
      expect(formatDate(undefined)).toBe("—")
    })

    it("should return — for invalid date", () => {
      expect(formatDate("not-a-date")).toBe("—")
    })
  })

  describe("formatName", () => {
    it("should concatenate first and last name", () => {
      expect(formatName("Jean", "Dupont")).toBe("Jean Dupont")
    })

    it("should return — when both are null", () => {
      expect(formatName(null, null)).toBe("—")
    })

    it("should handle only first name", () => {
      expect(formatName("Jean", null)).toBe("Jean")
    })

    it("should handle only last name", () => {
      expect(formatName(null, "Dupont")).toBe("Dupont")
    })
  })

  describe("formatClientName", () => {
    it("should prioritize nomPrenomFacturation (owner plain name)", () => {
      const intervention = {
        nomPrenomFacturation: "Dupont Jean",
        prenomClient: "Marie",
        nomClient: "Martin",
      }
      expect(formatClientName(intervention)).toBe("Dupont Jean")
    })

    it("should use prenomProprietaire/nomProprietaire when nomPrenomFacturation is null", () => {
      const intervention = {
        nomPrenomFacturation: null,
        prenomProprietaire: "Jean",
        nomProprietaire: "Dupont",
        prenomClient: "Marie",
        nomClient: "Martin",
      }
      expect(formatClientName(intervention)).toBe("Jean Dupont")
    })

    it("should use prenom_proprietaire/nom_proprietaire (snake_case)", () => {
      const intervention = {
        prenom_proprietaire: "Jean",
        nom_proprietaire: "Dupont",
      }
      expect(formatClientName(intervention)).toBe("Jean Dupont")
    })

    it("should fallback to client/tenant fields when no owner data", () => {
      const intervention = {
        prenomClient: "Marie",
        nomClient: "Martin",
      }
      expect(formatClientName(intervention)).toBe("Marie Martin")
    })

    it("should fallback to prenom_client/nom_client (snake_case)", () => {
      const intervention = {
        prenom_client: "Marie",
        nom_client: "Martin",
      }
      expect(formatClientName(intervention)).toBe("Marie Martin")
    })

    it("should return — when no name data available", () => {
      expect(formatClientName({})).toBe("—")
      expect(formatClientName(null)).toBe("—")
      expect(formatClientName(undefined)).toBe("—")
    })
  })

  describe("formatAddress", () => {
    it("should format a full address", () => {
      const intervention = {
        adresse: "10 rue de la Paix",
        code_postal: "75001",
        ville: "Paris",
      }
      expect(formatAddress(intervention)).toBe("10 rue de la Paix, 75001 Paris")
    })

    it("should return — when no address data", () => {
      expect(formatAddress({})).toBe("—")
    })
  })

  describe("getMetierLabel", () => {
    it("should return metierLabel", () => {
      expect(getMetierLabel({ metierLabel: "Plomberie" })).toBe("Plomberie")
    })

    it("should fallback to metier", () => {
      expect(getMetierLabel({ metier: "PLB" })).toBe("PLB")
    })

    it("should return — when no metier", () => {
      expect(getMetierLabel({})).toBe("—")
    })
  })

  describe("getCostAmountByType", () => {
    it("should sum costs from intervention_costs by type", () => {
      const intervention = {
        costs: [
          { cost_type: "sst", amount: 100 },
          { cost_type: "sst", amount: 50 },
          { cost_type: "materiel", amount: 200 },
        ],
      } as any
      expect(getCostAmountByType(intervention, "sst")).toBe(150)
      expect(getCostAmountByType(intervention, "materiel")).toBe(200)
    })

    it("should fallback to legacy fields when no costs array", () => {
      const intervention = {
        coutSST: 100,
        coutMateriel: 200,
        coutIntervention: 300,
      } as any
      expect(getCostAmountByType(intervention, "sst")).toBe(100)
      expect(getCostAmountByType(intervention, "materiel")).toBe(200)
      expect(getCostAmountByType(intervention, "intervention")).toBe(300)
    })
  })

  describe("getPaymentInfo", () => {
    it("should return payment amount and date", () => {
      const intervention = {
        payments: [
          { payment_type: "acompte_client", amount: 500, payment_date: "2024-01-15" },
        ],
      } as any
      const result = getPaymentInfo(intervention, "acompte_client")
      expect(result.amount).toBe(500)
      expect(result.date).toBe("2024-01-15")
    })

    it("should return null when no matching payment", () => {
      const intervention = { payments: [] } as any
      const result = getPaymentInfo(intervention, "acompte_client")
      expect(result.amount).toBeNull()
      expect(result.date).toBeNull()
    })
  })

  describe("getArtisanName", () => {
    it("should return primary artisan name", () => {
      const intervention = {
        intervention_artisans: [
          { is_primary: true, artisans: { prenom: "Pierre", nom: "Durand" } },
          { is_primary: false, artisans: { prenom: "Paul", nom: "Martin" } },
        ],
      } as any
      expect(getArtisanName(intervention)).toBe("Pierre Durand")
    })

    it("should fallback to first artisan when no primary", () => {
      const intervention = {
        intervention_artisans: [
          { is_primary: false, artisans: { prenom: "Paul", nom: "Martin" } },
        ],
      } as any
      expect(getArtisanName(intervention)).toBe("Paul Martin")
    })

    it("should return — when no artisans", () => {
      const intervention = { intervention_artisans: [] } as any
      expect(getArtisanName(intervention)).toBe("—")
    })
  })
})
