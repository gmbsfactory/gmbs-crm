import { describe, expect, it } from "vitest"
import { matchesFilters } from "@/lib/realtime/filter-utils"
import type { Intervention, InterventionQueryParams } from "@/lib/api/v2"

// Alias pour compatibilité
type GetAllParams = InterventionQueryParams

const baseIntervention: Intervention = {
  id: "int-1",
  id_inter: null,
  agence_id: "agency-1",
  reference_agence: null,
  tenant_id: null,
  owner_id: null,
  client_id: null,
  artisan_id: "artisan-1",
  assigned_user_id: "user-1",
  updated_by: "user-2",
  statut_id: "EN_COURS",
  metier_id: "metier-1",
  date: "2025-01-15",
  date_termine: null,
  date_prevue: null,
  due_date: null,
  contexte_intervention: "Installation climatisation",
  consigne_intervention: null,
  consigne_second_artisan: null,
  commentaire_agent: "Urgent client Lyon",
  adresse: "1 rue de Lyon",
  code_postal: "69000",
  ville: "Lyon",
  latitude: null,
  longitude: null,
  numero_sst: null,
  pourcentage_sst: null,
  is_active: true,
  created_at: null,
  updated_at: null,
  artisans: [],
  costs: [],
  payments: [],
  attachments: [],
}

function makeIntervention(overrides: Partial<Intervention> = {}): Intervention {
  return {
    ...baseIntervention,
    ...overrides,
  }
}

describe("matchesFilters", () => {
  const baseFilters: GetAllParams = {
    user: "user-1",
    statut: "EN_COURS",
  }

  it("returns false when no filters are defined", () => {
    expect(matchesFilters(makeIntervention(), undefined)).toBe(false)
  })

  it("always excludes inactive interventions", () => {
    const intervention = makeIntervention({ is_active: false })
    expect(matchesFilters(intervention, baseFilters)).toBe(false)
  })

  it("matches statut filters (single and multiple)", () => {
    expect(matchesFilters(makeIntervention({ statut_id: "EN_COURS" }), baseFilters)).toBe(true)
    expect(matchesFilters(makeIntervention({ statut_id: "TERMINE" }), baseFilters)).toBe(false)

    const multiStatutFilters: GetAllParams = { ...baseFilters, statut: ["TERMINE", "EN_COURS"] }
    expect(matchesFilters(makeIntervention({ statut_id: "TERMINE" }), multiStatutFilters)).toBe(true)
  })

  it("respects user filters including Market (user === null)", () => {
    expect(matchesFilters(makeIntervention({ assigned_user_id: "user-1" }), baseFilters)).toBe(true)
    expect(matchesFilters(makeIntervention({ assigned_user_id: "user-9" }), baseFilters)).toBe(false)

    const marketFilters: GetAllParams = { ...baseFilters, user: null }
    expect(matchesFilters(makeIntervention({ assigned_user_id: null }), marketFilters)).toBe(true)
    expect(matchesFilters(makeIntervention({ assigned_user_id: "user-1" }), marketFilters)).toBe(false)

    const multiUserFilters: GetAllParams = { ...baseFilters, user: ["user-1", "user-2"] }
    expect(matchesFilters(makeIntervention({ assigned_user_id: "user-2" }), multiUserFilters)).toBe(true)
  })

  it("filters by artisan, agence et métier", () => {
    const filters: GetAllParams = {
      ...baseFilters,
      artisan: "artisan-1",
      agence: "agency-1",
      metier: "metier-1",
    }
    expect(matchesFilters(makeIntervention(), filters)).toBe(true)
    expect(matchesFilters(makeIntervention({ artisan_id: "artisan-9" }), filters)).toBe(false)

    const arrayFilters: GetAllParams = {
      ...baseFilters,
      artisan: ["artisan-1", "artisan-2"],
      agence: ["agency-1", "agency-2"],
      metier: ["metier-9", "metier-1"],
    }
    expect(matchesFilters(makeIntervention({ artisan_id: "artisan-2" }), arrayFilters)).toBe(true)
  })

  it("applies date range filters", () => {
    const filters: GetAllParams = {
      ...baseFilters,
      startDate: "2025-01-01",
      endDate: "2025-01-31",
    }
    expect(matchesFilters(makeIntervention({ date: "2025-01-15" }), filters)).toBe(true)
    expect(matchesFilters(makeIntervention({ date: "2024-12-31" }), filters)).toBe(false)
    expect(matchesFilters(makeIntervention({ date: "2025-02-01" }), filters)).toBe(false)
  })

  it("matches textual search across relevant fields", () => {
    const filters: GetAllParams = { ...baseFilters, search: "lyon" }
    expect(matchesFilters(makeIntervention(), filters)).toBe(true)
    const notMatching = makeIntervention({
      ville: "Paris",
      adresse: "5 rue de Paris",
      contexte_intervention: "Installation standard",
      commentaire_agent: "RAS",
    })
    expect(matchesFilters(notMatching, filters)).toBe(false)
  })
})
