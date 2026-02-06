import { describe, it, expect, vi } from "vitest"
import {
  formatDistanceKm,
  hexToRgba,
  parseAddress,
  generateAutoInterventionId,
  getArtisanDisplayName,
  artisanSearchResultToNearbyArtisan,
} from "@/lib/interventions/form-utils"
import type { ArtisanSearchResult } from "@/components/artisans/ArtisanSearchModal"

describe("form-utils", () => {
  describe("formatDistanceKm", () => {
    it("should return em-dash for NaN", () => {
      expect(formatDistanceKm(NaN)).toBe("—")
    })

    it("should return em-dash for Infinity", () => {
      expect(formatDistanceKm(Infinity)).toBe("—")
    })

    it("should return em-dash for negative Infinity", () => {
      expect(formatDistanceKm(-Infinity)).toBe("—")
    })

    it('should return "< 1 km" for values under 1', () => {
      expect(formatDistanceKm(0)).toBe("< 1 km")
      expect(formatDistanceKm(0.5)).toBe("< 1 km")
      expect(formatDistanceKm(0.99)).toBe("< 1 km")
    })

    it("should return one decimal for values between 1 and 10", () => {
      expect(formatDistanceKm(1)).toBe("1.0 km")
      expect(formatDistanceKm(5.7)).toBe("5.7 km")
      expect(formatDistanceKm(9.99)).toBe("10.0 km")
    })

    it("should return rounded integer for values >= 10", () => {
      expect(formatDistanceKm(10)).toBe("10 km")
      expect(formatDistanceKm(10.4)).toBe("10 km")
      expect(formatDistanceKm(10.5)).toBe("11 km")
      expect(formatDistanceKm(100)).toBe("100 km")
    })
  })

  describe("hexToRgba", () => {
    it("should convert hex to rgba with alpha", () => {
      expect(hexToRgba("#ff0000", 0.5)).toBe("rgba(255, 0, 0, 0.5)")
    })

    it("should handle hex without # prefix", () => {
      expect(hexToRgba("00ff00", 1)).toBe("rgba(0, 255, 0, 1)")
    })

    it("should handle full white", () => {
      expect(hexToRgba("#ffffff", 0.8)).toBe("rgba(255, 255, 255, 0.8)")
    })

    it("should handle full black", () => {
      expect(hexToRgba("#000000", 0)).toBe("rgba(0, 0, 0, 0)")
    })

    it("should return null for invalid hex (too short)", () => {
      expect(hexToRgba("#fff", 0.5)).toBeNull()
    })

    it("should return null for invalid hex (non-hex chars)", () => {
      expect(hexToRgba("#gggggg", 0.5)).toBeNull()
    })

    it("should return null for empty string", () => {
      expect(hexToRgba("", 0.5)).toBeNull()
    })
  })

  describe("parseAddress", () => {
    it("should parse standard French address with postal code in same part as city", () => {
      const result = parseAddress("123 Rue de Rivoli, 75001 Paris, France")
      expect(result.street).toBe("123 Rue de Rivoli")
      expect(result.postalCode).toBe("75001")
      expect(result.city).toBe("Paris")
    })

    it("should parse address with postal code in separate part", () => {
      const result = parseAddress("10 Place de la Bourse, Bordeaux, 33000, France")
      expect(result.street).toBe("10 Place de la Bourse")
      expect(result.postalCode).toBe("33000")
      // City comes from before the postal code part
      expect(result.city).toBe("Bordeaux")
    })

    it("should handle address with no postal code", () => {
      const result = parseAddress("Rue de Rivoli, Paris, France")
      expect(result.street).toBe("Rue de Rivoli")
      expect(result.postalCode).toBe("")
      expect(result.city).toBe("Paris")
    })

    it("should handle single-part address", () => {
      const result = parseAddress("Paris")
      expect(result.street).toBe("Paris")
      expect(result.postalCode).toBe("")
      expect(result.city).toBe("")
    })

    it("should handle empty string", () => {
      const result = parseAddress("")
      expect(result.street).toBe("")
      expect(result.postalCode).toBe("")
      expect(result.city).toBe("")
    })
  })

  describe("generateAutoInterventionId", () => {
    it("should return string starting with AUTO-", () => {
      const id = generateAutoInterventionId()
      expect(id).toMatch(/^AUTO-/)
    })

    it("should return unique values on successive calls", () => {
      const ids = new Set<string>()
      for (let i = 0; i < 100; i++) {
        ids.add(generateAutoInterventionId())
      }
      expect(ids.size).toBe(100)
    })

    it("should have the expected format with 4 segments after AUTO-", () => {
      const id = generateAutoInterventionId()
      const parts = id.split("-")
      // AUTO, timestamp, random, counter, uuid (uuid may contain hyphens, so at least 5 parts)
      expect(parts.length).toBeGreaterThanOrEqual(5)
      expect(parts[0]).toBe("AUTO")
    })
  })

  describe("getArtisanDisplayName", () => {
    it("should prefer raison_sociale", () => {
      const artisan = {
        id: "1",
        raison_sociale: "Plomberie Express",
        plain_nom: "Jean Dupont",
        prenom: "Jean",
        nom: "Dupont",
      } as ArtisanSearchResult
      expect(getArtisanDisplayName(artisan)).toBe("Plomberie Express")
    })

    it("should fallback to plain_nom", () => {
      const artisan = {
        id: "1",
        raison_sociale: null,
        plain_nom: "Jean Dupont",
        prenom: "Jean",
        nom: "Dupont",
      } as ArtisanSearchResult
      expect(getArtisanDisplayName(artisan)).toBe("Jean Dupont")
    })

    it("should fallback to prenom + nom", () => {
      const artisan = {
        id: "1",
        raison_sociale: null,
        plain_nom: null,
        prenom: "Jean",
        nom: "Dupont",
      } as ArtisanSearchResult
      expect(getArtisanDisplayName(artisan)).toBe("Jean Dupont")
    })

    it("should fallback to 'Artisan sans nom' when no name info", () => {
      const artisan = {
        id: "1",
        raison_sociale: null,
        plain_nom: null,
        prenom: null,
        nom: null,
      } as ArtisanSearchResult
      expect(getArtisanDisplayName(artisan)).toBe("Artisan sans nom")
    })
  })

  describe("artisanSearchResultToNearbyArtisan", () => {
    it("should map all fields correctly", () => {
      const artisan: ArtisanSearchResult = {
        id: "abc-123",
        prenom: "Jean",
        nom: "Dupont",
        plain_nom: "Jean Dupont",
        raison_sociale: "Plomberie Express",
        email: "jean@plomberie.fr",
        telephone: "0601020304",
        telephone2: "0501020304",
        adresse_intervention: "10 Rue de la Paix",
        ville_intervention: "Paris",
        code_postal_intervention: "75002",
        adresse_siege_social: "20 Rue du Siège",
        ville_siege_social: "Lyon",
        code_postal_siege_social: "69001",
        statut_id: "status-1",
      }

      const result = artisanSearchResultToNearbyArtisan(artisan, "Plomberie Express")

      expect(result.id).toBe("abc-123")
      expect(result.displayName).toBe("Plomberie Express")
      expect(result.distanceKm).toBe(0)
      expect(result.telephone).toBe("0601020304")
      expect(result.telephone2).toBe("0501020304")
      expect(result.email).toBe("jean@plomberie.fr")
      expect(result.adresse).toBe("10 Rue de la Paix")
      expect(result.ville).toBe("Paris")
      expect(result.codePostal).toBe("75002")
      expect(result.lat).toBe(0)
      expect(result.lng).toBe(0)
      expect(result.prenom).toBe("Jean")
      expect(result.nom).toBe("Dupont")
      expect(result.raison_sociale).toBe("Plomberie Express")
      expect(result.statut_id).toBe("status-1")
      expect(result.photoProfilMetadata).toBeNull()
    })

    it("should fallback to siege social address when intervention address is missing", () => {
      const artisan: ArtisanSearchResult = {
        id: "abc-123",
        adresse_intervention: null,
        ville_intervention: null,
        code_postal_intervention: null,
        adresse_siege_social: "20 Rue du Siège",
        ville_siege_social: "Lyon",
        code_postal_siege_social: "69001",
      }

      const result = artisanSearchResultToNearbyArtisan(artisan, "Test")

      expect(result.adresse).toBe("20 Rue du Siège")
      expect(result.ville).toBe("Lyon")
      expect(result.codePostal).toBe("69001")
    })

    it("should handle null/undefined optional fields", () => {
      const artisan: ArtisanSearchResult = {
        id: "abc-123",
      }

      const result = artisanSearchResultToNearbyArtisan(artisan, "Artisan sans nom")

      expect(result.telephone).toBeNull()
      expect(result.telephone2).toBeNull()
      expect(result.email).toBeNull()
      expect(result.adresse).toBeNull()
      expect(result.ville).toBeNull()
      expect(result.codePostal).toBeNull()
      expect(result.prenom).toBeNull()
      expect(result.nom).toBeNull()
      expect(result.raison_sociale).toBeNull()
      expect(result.statut_id).toBeNull()
    })
  })
})
