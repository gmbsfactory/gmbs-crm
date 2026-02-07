import { describe, it, expect } from "vitest"
import {
  getDefaultCollapsibleState,
  createNewFormData,
  createEditFormData,
  type InterventionFormData,
  type CollapsibleSectionsState,
} from "@/lib/interventions/form-types"

describe("form-types", () => {
  describe("getDefaultCollapsibleState", () => {
    it("should return all sections closed except comments", () => {
      const state = getDefaultCollapsibleState()
      expect(state.isProprietaireOpen).toBe(false)
      expect(state.isClientOpen).toBe(false)
      expect(state.isAccompteOpen).toBe(false)
      expect(state.isDocumentsOpen).toBe(false)
      expect(state.isCommentsOpen).toBe(true)
      expect(state.isSecondArtisanOpen).toBe(false)
      expect(state.isSousStatutOpen).toBe(false)
    })

    it("should return a new object on each call", () => {
      const a = getDefaultCollapsibleState()
      const b = getDefaultCollapsibleState()
      expect(a).not.toBe(b)
      expect(a).toEqual(b)
    })
  })

  describe("createNewFormData", () => {
    it("should return object with all expected fields", () => {
      const data = createNewFormData()
      // Check key fields exist
      expect(data).toHaveProperty("statut_id")
      expect(data).toHaveProperty("id_inter")
      expect(data).toHaveProperty("agence_id")
      expect(data).toHaveProperty("latitude")
      expect(data).toHaveProperty("longitude")
      expect(data).toHaveProperty("nomPrenomClient")
      expect(data).toHaveProperty("coutSST")
      expect(data).toHaveProperty("secondArtisan")
      expect(data).toHaveProperty("sousStatutText")
    })

    it("should set default latitude/longitude to Paris", () => {
      const data = createNewFormData()
      expect(data.latitude).toBe(48.8566)
      expect(data.longitude).toBe(2.3522)
    })

    it("should set today's date", () => {
      const data = createNewFormData()
      const today = new Date().toISOString().split('T')[0]
      expect(data.date).toBe(today)
    })

    it("should set default sous-statut colors", () => {
      const data = createNewFormData()
      expect(data.sousStatutTextColor).toBe("#000000")
      expect(data.sousStatutBgColor).toBe("transparent")
    })

    it("should apply defaultValues correctly", () => {
      const data = createNewFormData({
        agence_id: "agency-1",
        metier_id: "metier-1",
        adresse: "10 Rue de la Paix",
        ville: "Paris",
        nomPrenomClient: "Jean Dupont",
        coutSST: "500",
      })

      expect(data.agence_id).toBe("agency-1")
      expect(data.metier_id).toBe("metier-1")
      expect(data.adresse).toBe("10 Rue de la Paix")
      expect(data.ville).toBe("Paris")
      expect(data.nomPrenomClient).toBe("Jean Dupont")
      expect(data.coutSST).toBe("500")
    })

    it("should build adresse_complete when adresse and ville provided", () => {
      const data = createNewFormData({
        adresse: "10 Rue de la Paix",
        ville: "Paris",
      })
      expect(data.adresse_complete).toBe("10 Rue de la Paix, Paris")
    })

    it("should leave adresse_complete empty when no ville", () => {
      const data = createNewFormData({
        adresse: "10 Rue de la Paix",
      })
      expect(data.adresse_complete).toBe("")
    })

    it("should fall back to empty strings when no defaultValues", () => {
      const data = createNewFormData()
      expect(data.agence_id).toBe("")
      expect(data.artisan).toBe("")
      expect(data.nomPrenomClient).toBe("")
      expect(data.coutSST).toBe("")
    })

    it("should initialize edit-only fields as empty strings", () => {
      const data = createNewFormData()
      expect(data.numero_sst).toBe("")
      expect(data.pourcentage_sst).toBe("")
      expect(data.commentaire_agent).toBe("")
    })
  })

  describe("createEditFormData", () => {
    const baseIntervention = {
      statut_id: "status-1",
      id_inter: "INT-001",
      agence_id: "agency-1",
      reference_agence: "REF-001",
      assigned_user_id: "user-1",
      metier_id: "metier-1",
      contexte_intervention: "Fuite d'eau",
      consigne_intervention: "Accès par le parking",
      adresse: "10 Rue de la Paix",
      code_postal: "75002",
      ville: "Paris",
      latitude: 48.8698,
      longitude: 2.3318,
      adresse_complete: "10 Rue de la Paix, 75002 Paris",
      date: "2024-01-15T10:00:00.000Z",
      date_prevue: "2024-01-20T00:00:00.000Z",
      numero_sst: "SST-001",
      pourcentage_sst: 30,
      consigne_second_artisan: "Venir le matin",
      commentaire_agent: "Client difficile",
      is_vacant: false,
      key_code: "",
      floor: "3",
      apartment_number: "12",
      vacant_housing_instructions: "",
      sous_statut_text: "En attente devis",
      sous_statut_text_color: "#ff0000",
      sous_statut_bg_color: "#f0f0f0",
      metier_second_artisan_id: "metier-2",
      owner: {
        plain_nom_facturation: "Dupont Jean",
        telephone: "0601020304",
        email: "jean@example.com",
      },
      tenants: {
        plain_nom_client: "Martin Pierre",
        telephone: "0605060708",
        email: "pierre@example.com",
      },
      intervention_artisans: [],
      intervention_costs: [],
      intervention_payments: [],
    }

    const basePrimaryArtisan = {
      prenom: "Paul",
      nom: "Lefevre",
      telephone: "0610111213",
      email: "paul@artisan.fr",
    }

    const baseSecondaryArtisan = {
      prenom: "Marie",
      nom: "Duval",
      telephone: "0620212223",
      email: "marie@artisan.fr",
    }

    const baseCosts = {
      sstCost: { amount: 600 },
      materielCost: { amount: 100 },
      interventionCost: { amount: 1000 },
      sstCostSecondArtisan: { amount: 300 },
      materielCostSecondArtisan: { amount: 50 },
    }

    const basePayments = {
      sstPayment: { amount: 200, is_received: true, payment_date: "2024-01-16T00:00:00.000Z" },
      clientPayment: { amount: 500, is_received: false, payment_date: null },
    }

    it("should correctly map intervention fields to form fields", () => {
      const data = createEditFormData(baseIntervention, basePrimaryArtisan, baseSecondaryArtisan, baseCosts, basePayments)

      expect(data.statut_id).toBe("status-1")
      expect(data.id_inter).toBe("INT-001")
      expect(data.agence_id).toBe("agency-1")
      expect(data.contexte_intervention).toBe("Fuite d'eau")
      expect(data.adresse).toBe("10 Rue de la Paix")
      expect(data.latitude).toBe(48.8698)
    })

    it("should extract date without time component", () => {
      const data = createEditFormData(baseIntervention, null, null, { sstCost: undefined, materielCost: undefined, interventionCost: undefined, sstCostSecondArtisan: undefined, materielCostSecondArtisan: undefined }, { sstPayment: undefined, clientPayment: undefined })

      expect(data.date).toBe("2024-01-15")
      expect(data.date_prevue).toBe("2024-01-20")
    })

    it("should map owner data to proprietaire fields", () => {
      const data = createEditFormData(baseIntervention, null, null, baseCosts, basePayments)

      expect(data.nomPrenomFacturation).toBe("Dupont Jean")
      expect(data.telephoneProprietaire).toBe("0601020304")
      expect(data.emailProprietaire).toBe("jean@example.com")
    })

    it("should map tenant data to client fields", () => {
      const data = createEditFormData(baseIntervention, null, null, baseCosts, basePayments)

      expect(data.nomPrenomClient).toBe("Martin Pierre")
      expect(data.telephoneClient).toBe("0605060708")
      expect(data.emailClient).toBe("pierre@example.com")
    })

    it("should handle null owner/tenant gracefully", () => {
      const intervention = { ...baseIntervention, owner: null, tenants: null }
      const data = createEditFormData(intervention, null, null, baseCosts, basePayments)

      expect(data.nomPrenomFacturation).toBe("")
      expect(data.telephoneProprietaire).toBe("")
      expect(data.nomPrenomClient).toBe("")
      expect(data.telephoneClient).toBe("")
    })

    it("should map primary artisan correctly", () => {
      const data = createEditFormData(baseIntervention, basePrimaryArtisan, null, baseCosts, basePayments)

      expect(data.artisan).toBe("Paul Lefevre")
      expect(data.artisanTelephone).toBe("0610111213")
      expect(data.artisanEmail).toBe("paul@artisan.fr")
    })

    it("should map secondary artisan correctly", () => {
      const data = createEditFormData(baseIntervention, null, baseSecondaryArtisan, baseCosts, basePayments)

      expect(data.secondArtisan).toBe("Marie Duval")
      expect(data.secondArtisanTelephone).toBe("0620212223")
      expect(data.secondArtisanEmail).toBe("marie@artisan.fr")
    })

    it("should handle null artisans", () => {
      const data = createEditFormData(baseIntervention, null, null, baseCosts, basePayments)

      expect(data.artisan).toBe("")
      expect(data.artisanTelephone).toBe("")
      expect(data.secondArtisan).toBe("")
    })

    it("should map costs correctly", () => {
      const data = createEditFormData(baseIntervention, null, null, baseCosts, basePayments)

      expect(data.coutSST).toBe("600")
      expect(data.coutMateriel).toBe("100")
      expect(data.coutIntervention).toBe("1000")
      expect(data.coutSSTSecondArtisan).toBe("300")
      expect(data.coutMaterielSecondArtisan).toBe("50")
    })

    it("should map payments correctly", () => {
      const data = createEditFormData(baseIntervention, null, null, baseCosts, basePayments)

      expect(data.accompteSST).toBe("200")
      expect(data.accompteSSTRecu).toBe(true)
      expect(data.dateAccompteSSTRecu).toBe("2024-01-16")
      expect(data.accompteClient).toBe("500")
      expect(data.accompteClientRecu).toBe(false)
      expect(data.dateAccompteClientRecu).toBe("")
    })

    it("should handle undefined costs/payments", () => {
      const emptyCosts = {
        sstCost: undefined,
        materielCost: undefined,
        interventionCost: undefined,
        sstCostSecondArtisan: undefined,
        materielCostSecondArtisan: undefined,
      }
      const emptyPayments = {
        sstPayment: undefined,
        clientPayment: undefined,
      }
      const data = createEditFormData(baseIntervention, null, null, emptyCosts, emptyPayments)

      expect(data.coutSST).toBe("")
      expect(data.coutMateriel).toBe("")
      expect(data.accompteSST).toBe("")
      expect(data.accompteSSTRecu).toBe(false)
    })

    it("should map sous-statut fields", () => {
      const data = createEditFormData(baseIntervention, null, null, baseCosts, basePayments)

      expect(data.sousStatutText).toBe("En attente devis")
      expect(data.sousStatutTextColor).toBe("#ff0000")
      expect(data.sousStatutBgColor).toBe("#f0f0f0")
    })

    it("should default to Paris coordinates when latitude/longitude missing", () => {
      const intervention = { ...baseIntervention, latitude: null, longitude: null }
      const data = createEditFormData(intervention, null, null, baseCosts, basePayments)

      expect(data.latitude).toBe(48.8566)
      expect(data.longitude).toBe(2.3522)
    })
  })
})
