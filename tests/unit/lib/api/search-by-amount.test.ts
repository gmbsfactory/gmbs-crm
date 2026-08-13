import { describe, it, expect, vi, beforeEach } from "vitest"

// Le client Supabase est mocké au niveau du module : on n'observe que les
// appels RPC, ce qui suffit à valider l'aiguillage montant / plein-texte.
const rpc = vi.fn()
vi.mock("@/lib/api/common/client", () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpc(...args),
    from: () => {
      throw new Error("supabase.from ne doit pas être appelé dans ces scénarios")
    },
  },
}))

// Hydratation des interventions trouvées : renvoie un enregistrement minimal.
vi.mock("@/lib/api/interventions", () => ({
  interventionsApi: {
    getById: vi.fn(async (id: string) => ({ id })),
  },
}))
vi.mock("@/lib/api/search-utils", () => ({
  convertInterventionToSearchRecord: (intervention: { id: string }) => intervention,
}))

import { universalSearch } from "@/lib/api/searchApi"

const AMOUNT_RPC = "search_interventions_by_amount"
const GLOBAL_RPC = "search_global"

/** Retrouve les arguments du dernier appel à un RPC donné. */
const callArgsFor = (name: string) =>
  rpc.mock.calls.find((call) => call[0] === name)?.[1] as Record<string, unknown> | undefined

const wasCalled = (name: string) => rpc.mock.calls.some((call) => call[0] === name)

describe("universalSearch — recherche par montant", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rpc.mockImplementation(async () => ({ data: [], error: null }))
  })

  it("should query amounts AND full-text for a bare amount", async () => {
    await universalSearch("387,78")

    expect(wasCalled(GLOBAL_RPC)).toBe(true)
    expect(callArgsFor(AMOUNT_RPC)).toMatchObject({
      p_amount: 387.78,
      p_payment_types: ["acompte_sst", "acompte_client"],
      p_cost_types: ["sst", "intervention", "materiel"],
    })
  })

  it("should skip the full-text search for an explicitly scoped query", async () => {
    await universalSearch("sst:387")

    expect(wasCalled(GLOBAL_RPC)).toBe(false)
    expect(callArgsFor(AMOUNT_RPC)).toMatchObject({
      p_amount: 387,
      p_payment_types: [],
      p_cost_types: ["sst"],
    })
  })

  it("should narrow the scope to the client deposit", async () => {
    await universalSearch("acompte client:387,78")

    expect(callArgsFor(AMOUNT_RPC)).toMatchObject({
      p_payment_types: ["acompte_client"],
      p_cost_types: [],
    })
  })

  it("should NOT query amounts for a plain text search", async () => {
    await universalSearch("VENISSIEUX")

    expect(wasCalled(AMOUNT_RPC)).toBe(false)
    expect(wasCalled(GLOBAL_RPC)).toBe(true)
  })

  it("should NOT query amounts for a bare integer, ambiguous with an id_inter", async () => {
    await universalSearch("21670")

    expect(wasCalled(AMOUNT_RPC)).toBe(false)
  })

  it("should force the intervention context when an amount is detected", async () => {
    const result = await universalSearch("387,78")

    expect(result.context).toBe("intervention")
  })

  it("should rank exact amount matches ahead of full-text matches, without duplicates", async () => {
    rpc.mockImplementation(async (name: string) => {
      if (name === AMOUNT_RPC) return { data: [{ id: "int-amount" }], error: null }
      if (name === GLOBAL_RPC) {
        return {
          data: [
            { entity_type: "intervention", entity_id: "int-text", rank: 0.5 },
            // Déjà trouvée par le montant : ne doit pas apparaître deux fois.
            { entity_type: "intervention", entity_id: "int-amount", rank: 0.4 },
          ],
          error: null,
        }
      }
      return { data: [], error: null }
    })

    const result = await universalSearch("387,78")
    const ids = result.interventions.items.map((item) => item.data.id)

    expect(ids).toEqual(["int-amount", "int-text"])
  })

  it("should keep full-text results when the amount RPC fails (e.g. not deployed yet)", async () => {
    rpc.mockImplementation(async (name: string) => {
      if (name === AMOUNT_RPC) return { data: null, error: { message: "function does not exist" } }
      if (name === GLOBAL_RPC) {
        return {
          data: [{ entity_type: "intervention", entity_id: "int-text", rank: 0.5 }],
          error: null,
        }
      }
      return { data: [], error: null }
    })

    const result = await universalSearch("387,78")

    expect(result.interventions.items.map((item) => item.data.id)).toEqual(["int-text"])
  })
})
