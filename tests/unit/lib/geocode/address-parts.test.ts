import { describe, it, expect } from "vitest"
import { parseAddressLabel, resolveSuggestionParts } from "@/lib/geocode/address-parts"

describe("address-parts", () => {
  describe("parseAddressLabel", () => {
    // --- Cas BAN sans virgule (le bug rapporté) ---
    it("should parse a comma-less BAN label « rue CP ville »", () => {
      const result = parseAddressLabel("7 Rue Jean Giraudoux 03300 Cusset")
      expect(result.street).toBe("7 Rue Jean Giraudoux")
      expect(result.postalCode).toBe("03300")
      expect(result.city).toBe("Cusset")
    })

    it("should not leak the full address into the city (regression)", () => {
      const result = parseAddressLabel("7 Rue Jean Giraudoux 03300 Cusset")
      expect(result.city).not.toContain("Rue")
      expect(result.city).not.toContain("03300")
    })

    it("should handle a multi-word city in a comma-less label", () => {
      const result = parseAddressLabel("12 Avenue du General Leclerc 13290 Aix-en-Provence")
      expect(result.street).toBe("12 Avenue du General Leclerc")
      expect(result.postalCode).toBe("13290")
      expect(result.city).toBe("Aix-en-Provence")
    })

    it("should handle a comma-less label with no street (commune only)", () => {
      const result = parseAddressLabel("03300 Cusset")
      expect(result.street).toBe("")
      expect(result.postalCode).toBe("03300")
      expect(result.city).toBe("Cusset")
    })

    // --- Cas virgulés (Google / Nominatim / saisie manuelle) : non-régression ---
    it("should parse standard French address with postal code in same part as city", () => {
      const result = parseAddressLabel("123 Rue de Rivoli, 75001 Paris, France")
      expect(result.street).toBe("123 Rue de Rivoli")
      expect(result.postalCode).toBe("75001")
      expect(result.city).toBe("Paris")
    })

    it("should parse address with postal code in a separate part", () => {
      const result = parseAddressLabel("10 Place de la Bourse, Bordeaux, 33000, France")
      expect(result.street).toBe("10 Place de la Bourse")
      expect(result.postalCode).toBe("33000")
      expect(result.city).toBe("Bordeaux")
    })

    it("should handle address with no postal code", () => {
      const result = parseAddressLabel("Rue de Rivoli, Paris, France")
      expect(result.street).toBe("Rue de Rivoli")
      expect(result.postalCode).toBe("")
      expect(result.city).toBe("Paris")
    })

    it("should handle single-token address", () => {
      const result = parseAddressLabel("Paris")
      expect(result.street).toBe("Paris")
      expect(result.postalCode).toBe("")
      expect(result.city).toBe("")
    })

    it("should handle empty / nullish input", () => {
      expect(parseAddressLabel("")).toEqual({ street: "", postalCode: "", city: "" })
      expect(parseAddressLabel(null)).toEqual({ street: "", postalCode: "", city: "" })
      expect(parseAddressLabel(undefined)).toEqual({ street: "", postalCode: "", city: "" })
    })
  })

  describe("resolveSuggestionParts", () => {
    it("should prefer the structured postcode/city over label parsing", () => {
      const result = resolveSuggestionParts({
        label: "7 Rue Jean Giraudoux 03300 Cusset",
        postcode: "03300",
        city: "Cusset",
      })
      expect(result.street).toBe("7 Rue Jean Giraudoux")
      expect(result.postalCode).toBe("03300")
      expect(result.city).toBe("Cusset")
    })

    it("should trust structured fields even if the label is malformed", () => {
      const result = resolveSuggestionParts({
        label: "Lieu-dit sans structure claire",
        postcode: "63000",
        city: "Clermont-Ferrand",
      })
      expect(result.postalCode).toBe("63000")
      expect(result.city).toBe("Clermont-Ferrand")
    })

    it("should fall back to label parsing when structured fields are absent", () => {
      const result = resolveSuggestionParts({
        label: "7 Rue Jean Giraudoux 03300 Cusset",
      })
      expect(result.street).toBe("7 Rue Jean Giraudoux")
      expect(result.postalCode).toBe("03300")
      expect(result.city).toBe("Cusset")
    })

    it("should derive a clean street from a comma label backed by structured fields", () => {
      const result = resolveSuggestionParts({
        label: "7 Rue Jean Giraudoux, 03300 Cusset, France",
        postcode: "03300",
        city: "Cusset",
      })
      expect(result.street).toBe("7 Rue Jean Giraudoux")
      expect(result.postalCode).toBe("03300")
      expect(result.city).toBe("Cusset")
    })

    it("should ignore empty structured fields and use the parsed label", () => {
      const result = resolveSuggestionParts({
        label: "5 Boulevard Voltaire 75011 Paris",
        postcode: "",
        city: "   ",
      })
      expect(result.postalCode).toBe("75011")
      expect(result.city).toBe("Paris")
    })
  })
})
