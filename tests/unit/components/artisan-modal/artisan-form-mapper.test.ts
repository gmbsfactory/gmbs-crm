import { describe, it, expect } from "vitest"
import {
  buildUpdatePayload,
  mapArtisanToForm,
  type ArtisanFormValues,
} from "@/components/ui/artisan-modal/_lib/artisan-form-mapper"

const emptyForm: ArtisanFormValues = {
  raison_sociale: "",
  prenom: "",
  nom: "",
  telephone: "",
  telephone2: "",
  email: "",
  adresse_intervention: "",
  code_postal_intervention: "",
  ville_intervention: "",
  adresse_siege_social: "",
  code_postal_siege_social: "",
  ville_siege_social: "",
  statut_juridique: "",
  siret: "",
  iban: "",
  metiers: [],
  zone_intervention: "",
  gestionnaire_id: "",
  statut_id: "",
  numero_associe: "",
  intervention_latitude: null,
  intervention_longitude: null,
}

describe("artisan-form-mapper", () => {
  describe("mapArtisanToForm", () => {
    it("should return empty defaults when artisan has no data", () => {
      const result = mapArtisanToForm({})
      expect(result).toEqual(emptyForm)
    })

    it("should normalize iban to uppercase", () => {
      const result = mapArtisanToForm({ iban: "fr7630006000011234567890189" })
      expect(result.iban).toBe("FR7630006000011234567890189")
    })

    it("should preserve null lat/long", () => {
      const result = mapArtisanToForm({})
      expect(result.intervention_latitude).toBeNull()
      expect(result.intervention_longitude).toBeNull()
    })

    describe("metiers extraction", () => {
      it("should prefer metier_id from artisan_metiers", () => {
        const result = mapArtisanToForm({
          artisan_metiers: [
            { metier_id: "uuid-1", metiers: { id: "other", code: "PLU", label: "Plombier" } },
          ],
        })
        expect(result.metiers).toEqual(["uuid-1"])
      })

      it("should fall back to metiers.id then code then label", () => {
        const result = mapArtisanToForm({
          artisan_metiers: [
            { metier_id: null, metiers: { id: "id-1", code: "PLU", label: "Plombier" } },
            { metier_id: null, metiers: { id: null, code: "ELE", label: "Electricien" } },
            { metier_id: null, metiers: { id: null, code: null, label: "Maçon" } },
          ],
        })
        expect(result.metiers).toEqual(["id-1", "ELE", "Maçon"])
      })

      it("should filter out empty entries", () => {
        const result = mapArtisanToForm({
          artisan_metiers: [
            { metier_id: "uuid-1" },
            { metier_id: null, metiers: null },
          ],
        })
        expect(result.metiers).toEqual(["uuid-1"])
      })

      it("should fall back to flat metiers array of strings", () => {
        const result = mapArtisanToForm({ metiers: ["a", "b", "", null] })
        expect(result.metiers).toEqual(["a", "b"])
      })
    })

    describe("zone_intervention extraction", () => {
      it("should prefer zones.code over label and zone_id", () => {
        const result = mapArtisanToForm({
          artisan_zones: [
            { zone_id: "uuid-z", zones: { id: "z", code: "20", label: "0 à 20 km" } },
          ],
        })
        expect(result.zone_intervention).toBe("20")
      })

      it("should fall back to zones.label when code missing", () => {
        const result = mapArtisanToForm({
          artisan_zones: [{ zone_id: "uuid-z", zones: { id: "z", code: null, label: "Régionale" } }],
        })
        expect(result.zone_intervention).toBe("Régionale")
      })

      it("should fall back to zone_id when code and label missing", () => {
        const result = mapArtisanToForm({
          artisan_zones: [{ zone_id: "uuid-z", zones: { id: "z", code: null, label: null } }],
        })
        expect(result.zone_intervention).toBe("uuid-z")
      })

      it("should fall back to flat zones array", () => {
        const result = mapArtisanToForm({ zones: ["50"] })
        expect(result.zone_intervention).toBe("50")
      })

      it("should fall back to zoneIntervention scalar", () => {
        const result = mapArtisanToForm({ zoneIntervention: 35 })
        expect(result.zone_intervention).toBe("35")
      })

      it("should return empty string when no zone info", () => {
        const result = mapArtisanToForm({})
        expect(result.zone_intervention).toBe("")
      })
    })
  })

  describe("buildUpdatePayload", () => {
    it("should map empty form to undefineds and empty arrays", () => {
      const result = buildUpdatePayload(emptyForm)
      expect(result).toEqual({
        raison_sociale: undefined,
        prenom: undefined,
        nom: undefined,
        telephone: undefined,
        telephone2: undefined,
        email: undefined,
        adresse_intervention: undefined,
        code_postal_intervention: undefined,
        ville_intervention: undefined,
        adresse_siege_social: undefined,
        code_postal_siege_social: undefined,
        ville_siege_social: undefined,
        statut_juridique: undefined,
        siret: undefined,
        iban: undefined,
        zones: [],
        metiers: [],
        gestionnaire_id: undefined,
        statut_id: undefined,
        numero_associe: undefined,
        intervention_latitude: undefined,
        intervention_longitude: undefined,
      })
    })

    describe("siret normalization", () => {
      it("should pass through 14-digit siret", () => {
        const result = buildUpdatePayload({ ...emptyForm, siret: "12345678901234" })
        expect(result.siret).toBe("12345678901234")
      })

      it("should drop partial siret", () => {
        const result = buildUpdatePayload({ ...emptyForm, siret: "1234567" })
        expect(result.siret).toBeUndefined()
      })

      it("should drop non-numeric siret", () => {
        const result = buildUpdatePayload({ ...emptyForm, siret: "1234567890123A" })
        expect(result.siret).toBeUndefined()
      })

      it("should trim whitespace before validating", () => {
        const result = buildUpdatePayload({ ...emptyForm, siret: "   " })
        expect(result.siret).toBeUndefined()
      })
    })

    describe("iban normalization", () => {
      it("should strip spaces and uppercase a valid 27-char iban", () => {
        const result = buildUpdatePayload({
          ...emptyForm,
          iban: "fr76 3000 6000 0112 3456 7890 189",
        })
        expect(result.iban).toBe("FR7630006000011234567890189")
      })

      it("should drop iban with wrong length", () => {
        const result = buildUpdatePayload({ ...emptyForm, iban: "FR7630006000" })
        expect(result.iban).toBeUndefined()
      })

      it("should drop iban with invalid characters", () => {
        const result = buildUpdatePayload({
          ...emptyForm,
          iban: "FR76-3000-6000-0112-3456-7890-189",
        })
        expect(result.iban).toBeUndefined()
      })
    })

    it("should wrap zone_intervention into a single-element zones array", () => {
      const result = buildUpdatePayload({ ...emptyForm, zone_intervention: "20" })
      expect(result.zones).toEqual(["20"])
    })

    it("should preserve metiers array", () => {
      const result = buildUpdatePayload({ ...emptyForm, metiers: ["a", "b"] })
      expect(result.metiers).toEqual(["a", "b"])
    })

    it("should pass through lat/long when set, undefined when null", () => {
      const withCoords = buildUpdatePayload({
        ...emptyForm,
        intervention_latitude: 48.85,
        intervention_longitude: 2.35,
      })
      expect(withCoords.intervention_latitude).toBe(48.85)
      expect(withCoords.intervention_longitude).toBe(2.35)

      const withoutCoords = buildUpdatePayload(emptyForm)
      expect(withoutCoords.intervention_latitude).toBeUndefined()
      expect(withoutCoords.intervention_longitude).toBeUndefined()
    })
  })
})
