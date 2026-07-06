import { describe, expect, it, vi } from "vitest"

// Les fonctions testées (handleUpdate/handleInsert) n'utilisent que matchesFilters.
// On isole le module de ses dépendances périphériques (UI, broadcast, indicateurs)
// sans mocker filter-utils : on veut le VRAI matchesFilters dans l'assertion.
vi.mock("sonner", () => ({ toast: { error: vi.fn(), info: vi.fn(), success: vi.fn() } }))
vi.mock("@/lib/realtime/cache-sync/broadcasting", () => ({
  debouncedRefreshCounts: vi.fn(),
  getBroadcastSync: vi.fn(() => null),
}))
vi.mock("@/lib/realtime/remote-edit-indicator", () => ({
  getRemoteEditIndicatorManager: vi.fn(() => ({ removeIndicator: vi.fn() })),
}))
vi.mock("@/lib/realtime/sync-queue", () => ({
  getSyncQueue: vi.fn(() => ({ dequeueByInterventionId: vi.fn() })),
}))

import { handleInsert, handleUpdate } from "@/lib/realtime/cache-sync/event-handlers"
import type { Intervention, InterventionQueryParams, PaginatedResponse } from "@/lib/api"

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
  artisans: ["artisan-1"],
  costs: [],
  payments: [],
  attachments: [],
}

function makeIntervention(overrides: Partial<Intervention> = {}): Intervention {
  return { ...baseIntervention, ...overrides }
}

function makeList(data: Intervention[]): PaginatedResponse<Intervention> {
  return {
    data,
    pagination: { limit: 100, offset: 0, total: data.length, hasMore: false },
  }
}

describe("handleUpdate", () => {
  describe("recherche server-authoritative (filters.search)", () => {
    it("ne retire pas une intervention présente quand la recherche porte sur id_inter (champ non réévalué côté client)", () => {
      // L'utilisateur a recherché "12345" (id_inter) ; la RPC serveur a renvoyé l'intervention.
      // matchesFilters ne teste PAS id_inter → sans correctif, le CAS 4 éjecte l'intervention.
      const filters: GetAllParams = { search: "12345" }
      const record = makeIntervention({ id: "int-1", id_inter: "12345" })
      const oldData = makeList([record])
      const updated = makeIntervention({ id: "int-1", id_inter: "12345", updated_at: "2026-01-01T00:00:00Z" })

      const next = handleUpdate(oldData, record, updated, filters)

      expect(next.data).toHaveLength(1)
      expect(next.data[0].id).toBe("int-1")
      // Mise à jour en place
      expect(next.data[0].updated_at).toBe("2026-01-01T00:00:00Z")
    })

    it("ne retire pas une intervention présente quand la recherche porte sur l'agence (label absent des champs testés)", () => {
      const filters: GetAllParams = { search: "foncia" }
      const record = makeIntervention({ id: "int-2" })
      const oldData = makeList([record])
      const updated = makeIntervention({ id: "int-2", updated_at: "2026-02-02T00:00:00Z" })

      const next = handleUpdate(oldData, record, updated, filters)

      expect(next.data.map((i) => i.id)).toEqual(["int-2"])
    })

    it("n'insère pas une intervention absente dans une liste de recherche (le serveur compose)", () => {
      const filters: GetAllParams = { search: "lyon" }
      const present = makeIntervention({ id: "int-1" })
      const oldData = makeList([present])
      // incoming matcherait pourtant matchesFilters (ville Lyon) → ne doit pas être inséré ici.
      const incoming = makeIntervention({ id: "int-2", ville: "Lyon" })

      const next = handleUpdate(oldData, null, incoming, filters)

      expect(next.data.map((i) => i.id)).toEqual(["int-1"])
    })
  })

  describe("sans recherche (comportement structurel inchangé)", () => {
    it("retire une intervention qui ne matche plus un filtre de statut", () => {
      const filters: GetAllParams = { statut: "EN_COURS" }
      const record = makeIntervention({ id: "int-1", statut_id: "EN_COURS" })
      const oldData = makeList([record])
      const updated = makeIntervention({ id: "int-1", statut_id: "TERMINE" })

      const next = handleUpdate(oldData, record, updated, filters)

      expect(next.data).toHaveLength(0)
    })

    it("met à jour en place une intervention qui matche toujours le filtre", () => {
      const filters: GetAllParams = { statut: "EN_COURS" }
      const record = makeIntervention({ id: "int-1", statut_id: "EN_COURS", commentaire_agent: "avant" })
      const oldData = makeList([record])
      const updated = makeIntervention({ id: "int-1", statut_id: "EN_COURS", commentaire_agent: "après" })

      const next = handleUpdate(oldData, record, updated, filters)

      expect(next.data).toHaveLength(1)
      expect(next.data[0].commentaire_agent).toBe("après")
    })
  })
})

describe("handleUpdate — préservation de l'artisan (payload Realtime sans relations)", () => {
  // Un UPDATE Realtime de `interventions` ne porte jamais la relation intervention_artisans :
  // le record enrichi arrive donc avec artisan/deuxiemeArtisan/primaryArtisan = null et artisans = [].
  // handleUpdate doit restaurer ces champs depuis la version déjà en cache, sinon l'artisan
  // « disparaît » à l'écran à chaque commentaire/coût qui bump updated_at (ticket GMBS 06/07).
  const cached = {
    ...makeIntervention({ id: "int-1", statut_id: "EN_COURS", commentaire_agent: "avant" }),
    artisan: "Jean Plombier",
    deuxiemeArtisan: "Paul Élec",
    primaryArtisan: { id: "artisan-1", nom: "Plombier", prenom: "Jean" },
    artisans: ["artisan-1"],
  } as Intervention

  const realtimeStripped = (overrides: Partial<Intervention> = {}): Intervention =>
    ({
      ...makeIntervention({ id: "int-1", statut_id: "EN_COURS" }),
      artisan: null,
      deuxiemeArtisan: null,
      primaryArtisan: null,
      artisans: [],
      updated_at: "2026-07-06T00:00:00Z",
      ...overrides,
    }) as Intervention

  it("restaure l'artisan sur une mise à jour en place (filtre statut, CAS 3)", () => {
    const filters: GetAllParams = { statut: "EN_COURS" }
    const next = handleUpdate(makeList([cached]), cached, realtimeStripped({ commentaire_agent: "après" }), filters)

    expect(next.data).toHaveLength(1)
    const row = next.data[0] as any
    expect(row.artisan).toBe("Jean Plombier")     // préservé
    expect(row.deuxiemeArtisan).toBe("Paul Élec") // préservé
    expect(row.artisans).toEqual(["artisan-1"])   // préservé
    expect(row.commentaire_agent).toBe("après")   // la vraie donnée est bien mise à jour
    expect(row.updated_at).toBe("2026-07-06T00:00:00Z")
  })

  it("restaure l'artisan dans une liste de recherche (filters.search)", () => {
    const filters: GetAllParams = { search: "12345" }
    const cachedSearch = { ...cached, id_inter: "12345" } as Intervention
    const next = handleUpdate(makeList([cachedSearch]), cachedSearch, realtimeStripped({ id_inter: "12345" }), filters)

    expect((next.data[0] as any).artisan).toBe("Jean Plombier")
  })

  it("restaure l'artisan sans filtres (!filters)", () => {
    const next = handleUpdate(makeList([cached]), cached, realtimeStripped(), undefined)

    expect((next.data[0] as any).artisan).toBe("Jean Plombier")
  })

  it("n'écrase pas un artisan réellement porté par le record entrant", () => {
    // Cas défensif : si l'entrant porte un artisan (pas un payload realtime nu), il prime.
    const filters: GetAllParams = { statut: "EN_COURS" }
    const incoming = realtimeStripped({ artisan: "Nouvelle Entreprise", artisans: ["artisan-9"] } as Partial<Intervention>)
    const next = handleUpdate(makeList([cached]), cached, incoming, filters)

    const row = next.data[0] as any
    expect(row.artisan).toBe("Nouvelle Entreprise")
    expect(row.artisans).toEqual(["artisan-9"])
  })

  it("ne restaure rien quand l'intervention entre juste dans la liste (CAS 2, pas de version en cache)", () => {
    const filters: GetAllParams = { statut: "EN_COURS" }
    const next = handleUpdate(makeList([]), null, realtimeStripped(), filters)

    expect(next.data).toHaveLength(1)
    expect((next.data[0] as any).artisan).toBeNull()
  })
})

describe("handleInsert", () => {
  it("n'insère pas optimistiquement dans une liste de recherche", () => {
    const filters: GetAllParams = { search: "lyon" }
    const oldData = makeList([])
    const incoming = makeIntervention({ id: "int-2", ville: "Lyon" })

    const next = handleInsert(oldData, incoming, filters)

    expect(next.data).toHaveLength(0)
  })

  it("insère dans une liste filtrée structurellement (sans search)", () => {
    const filters: GetAllParams = { statut: "EN_COURS" }
    const oldData = makeList([])
    const incoming = makeIntervention({ id: "int-2", statut_id: "EN_COURS" })

    const next = handleInsert(oldData, incoming, filters)

    expect(next.data.map((i) => i.id)).toEqual(["int-2"])
  })
})
