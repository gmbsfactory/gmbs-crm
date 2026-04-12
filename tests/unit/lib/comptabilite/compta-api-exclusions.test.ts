import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock supabase-client before importing comptaApi
const mockFrom = vi.fn()
vi.mock("@/lib/supabase-client", () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}))

import { comptaApi } from "@/lib/api/v2/comptaApi"

// Helper to build a chainable query mock
function chainable(resolvedValue: { data: unknown; error: unknown }) {
  const obj: Record<string, unknown> = {}
  const self = () => obj
  for (const method of [
    "select", "insert", "update", "delete", "upsert",
    "eq", "neq", "gte", "lte", "in", "order",
  ]) {
    obj[method] = vi.fn(self)
  }
  // single() resolves directly (used for .single() queries)
  obj.single = vi.fn(() => Promise.resolve(resolvedValue))
  // The last method in any chain resolves as a promise
  obj.then = (resolve: (v: unknown) => void) => resolve(resolvedValue)
  return obj
}

describe("comptaApi exclusions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("exclude", () => {
    it("should upsert into intervention_compta_exclusions", async () => {
      const chain = chainable({ data: {}, error: null })
      mockFrom.mockReturnValue(chain)

      const result = await comptaApi.exclude("intervention-1")

      expect(result).toBe(true)
      expect(mockFrom).toHaveBeenCalledWith("intervention_compta_exclusions")
      expect(chain.upsert).toHaveBeenCalledWith(
        { intervention_id: "intervention-1" },
        { onConflict: "intervention_id" }
      )
    })

    it("should return false on error", async () => {
      const chain = chainable({ data: null, error: new Error("RLS") })
      mockFrom.mockReturnValue(chain)

      const result = await comptaApi.exclude("intervention-1")

      expect(result).toBe(false)
    })
  })

  describe("restore", () => {
    it("should delete from intervention_compta_exclusions", async () => {
      const chain = chainable({ data: {}, error: null })
      mockFrom.mockReturnValue(chain)

      const result = await comptaApi.restore("intervention-1")

      expect(result).toBe(true)
      expect(mockFrom).toHaveBeenCalledWith("intervention_compta_exclusions")
      expect(chain.delete).toHaveBeenCalled()
      expect(chain.eq).toHaveBeenCalledWith("intervention_id", "intervention-1")
    })

    it("should return false on error", async () => {
      const chain = chainable({ data: null, error: new Error("RLS") })
      mockFrom.mockReturnValue(chain)

      const result = await comptaApi.restore("intervention-1")

      expect(result).toBe(false)
    })
  })

  describe("getAllFacturationEntries", () => {
    it("should only return interventions whose CURRENT status is INTER_TERMINEE, excluding exclusions", async () => {
      const statusChain = chainable({
        data: { id: "status-uuid" },
        error: null,
      })
      // Interventions actuellement au statut INTER_TERMINEE
      const interventionsChain = chainable({
        data: [{ id: "id-1" }, { id: "id-2" }, { id: "id-3" }],
        error: null,
      })
      // Transitions: id-4 a une transition mais n'est plus INTER_TERMINEE → doit être ignoré
      const transitionsChain = chainable({
        data: [
          { intervention_id: "id-1", transition_date: "2026-01-15T00:00:00Z" },
          { intervention_id: "id-2", transition_date: "2026-01-14T00:00:00Z" },
          { intervention_id: "id-3", transition_date: "2026-01-13T00:00:00Z" },
          { intervention_id: "id-4", transition_date: "2026-01-12T00:00:00Z" },
        ],
        error: null,
      })
      const exclusionsChain = chainable({
        data: [{ intervention_id: "id-2" }],
        error: null,
      })

      let interventionsCallCount = 0
      mockFrom.mockImplementation((table: string) => {
        if (table === "intervention_statuses") return statusChain
        if (table === "interventions") {
          interventionsCallCount++
          return interventionsChain
        }
        if (table === "intervention_status_transitions") return transitionsChain
        if (table === "intervention_compta_exclusions") return exclusionsChain
        throw new Error(`Unexpected table: ${table}`)
      })

      const result = await comptaApi.getAllFacturationEntries(null)

      // id-1 et id-3 : statut actuel INTER_TERMINEE, non exclus
      // id-2 : exclu
      // id-4 : a une transition mais n'est plus INTER_TERMINEE
      expect(result.sortedIds).toEqual(["id-1", "id-3"])
      expect(result.total).toBe(2)
      expect(result.dateMap.has("id-2")).toBe(false)
      expect(result.dateMap.has("id-4")).toBe(false)
      expect(interventionsCallCount).toBe(1)
    })
  })
})
