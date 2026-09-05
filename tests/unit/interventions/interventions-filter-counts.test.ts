import { beforeEach, describe, expect, it, vi } from "vitest"

import { interventionsApi } from "@/lib/api"
import { supabase } from "@/lib/supabase-client"

// getFilterCountsGrouped appelle supabase.rpc('get_intervention_filter_counts', ...)
vi.mock("@/lib/supabase-client", () => ({
  supabase: {
    rpc: vi.fn(),
  },
}))

const mockRpc = (data: Array<{ group_value: string; cnt: number }> | null, error: Error | null = null) => {
  vi.mocked(supabase.rpc).mockResolvedValue({ data, error } as never)
}

describe("interventionsApi.getFilterCountsGrouped", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("route la contrainte « non-assignée » (Market) via p_user_is_null=true", async () => {
    // Régression : baseFilters.user === null (vue Market « attribueA is_empty »)
    // ne doit PAS être passé comme « pas de filtre » — sinon le compteur agence
    // compte aussi les interventions assignées (bug Matera 9 vs 2 affichées).
    mockRpc([{ group_value: "agence-matera", cnt: 2 }])

    const counts = await interventionsApi.getFilterCountsGrouped("agence", {
      statut: "statut-demande",
      user: null,
    })

    expect(supabase.rpc).toHaveBeenCalledWith(
      "get_intervention_filter_counts",
      expect.objectContaining({
        p_group_column: "agence_id",
        p_statut_id: "statut-demande",
        p_user_id: null,
        p_user_is_null: true,
      }),
    )
    expect(counts).toEqual({ "agence-matera": 2 })
  })

  it("filtre par utilisateur assigné quand user est un UUID (p_user_is_null=false)", async () => {
    mockRpc([{ group_value: "agence-a", cnt: 5 }])

    await interventionsApi.getFilterCountsGrouped("agence", {
      user: "user-uuid-123",
    })

    expect(supabase.rpc).toHaveBeenCalledWith(
      "get_intervention_filter_counts",
      expect.objectContaining({
        p_user_id: "user-uuid-123",
        p_user_is_null: false,
      }),
    )
  })

  it("n'applique aucun filtre utilisateur quand user est absent (p_user_is_null=false)", async () => {
    mockRpc([])

    await interventionsApi.getFilterCountsGrouped("statut", {})

    expect(supabase.rpc).toHaveBeenCalledWith(
      "get_intervention_filter_counts",
      expect.objectContaining({
        p_group_column: "statut_id",
        p_user_id: null,
        p_user_is_null: false,
      }),
    )
  })

  it("route la vue « Mes vérifications » via p_has_portal_report=true", async () => {
    // Même piège que p_user_is_null : sans drapeau dédié, le RPC ne sait pas
    // exprimer « rapport à vérifier » et compte AVANT filtrage (migration 99086).
    mockRpc([{ group_value: "statut-accepte", cnt: 1 }])

    await interventionsApi.getFilterCountsGrouped("statut", {
      user: "user-uuid-123",
      hasPortalReport: true,
    })

    expect(supabase.rpc).toHaveBeenCalledWith(
      "get_intervention_filter_counts",
      expect.objectContaining({
        p_user_id: "user-uuid-123",
        p_has_portal_report: true,
      }),
    )
  })

  it("laisse p_has_portal_report à false hors de la vue « Mes vérifications »", async () => {
    mockRpc([])

    await interventionsApi.getFilterCountsGrouped("statut", { user: "user-uuid-123" })

    expect(supabase.rpc).toHaveBeenCalledWith(
      "get_intervention_filter_counts",
      expect.objectContaining({ p_has_portal_report: false }),
    )
  })

  it("mappe les lignes du RPC en Record<group_value, cnt>", async () => {
    mockRpc([
      { group_value: "agence-1", cnt: 3 },
      { group_value: "agence-2", cnt: 7 },
    ])

    const counts = await interventionsApi.getFilterCountsGrouped("agence", {})

    expect(counts).toEqual({ "agence-1": 3, "agence-2": 7 })
  })

  it("propage une erreur RPC", async () => {
    mockRpc(null, new Error("boom"))

    await expect(interventionsApi.getFilterCountsGrouped("agence", {})).rejects.toThrow("boom")
  })
})
