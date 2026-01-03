import { beforeEach, describe, expect, it, vi } from "vitest"

import { interventionsApi } from "@/lib/api/v2"

// Wrapper pour compatibilité avec les tests existants
const getInterventionTotalCount = interventionsApi.getTotalCountWithFilters.bind(interventionsApi)
import { supabase } from "@/lib/supabase-client"

vi.mock("@/lib/supabase-client", () => ({
  supabase: {
    from: vi.fn(),
  },
}))

type QueryResult = {
  count: number | null
  error: Error | null
}

const buildQuery = (result: QueryResult) => {
  const execute = vi.fn().mockResolvedValue(result)

  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    then: (onFulfilled: (value: QueryResult) => void, onRejected?: (reason: unknown) => void) =>
      execute().then(onFulfilled, onRejected),
  }

  return { query, execute }
}

describe("getInterventionTotalCount", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns total count without filters", async () => {
    const { query } = buildQuery({ count: 128, error: null })
    vi.mocked(supabase.from).mockReturnValue(query as any)

    const count = await getInterventionTotalCount()

    expect(count).toBe(128)
    expect(query.select).toHaveBeenCalledWith("id", { count: "exact", head: true })
  })

  it("applies filters before counting", async () => {
    const { query } = buildQuery({ count: 42, error: null })
    vi.mocked(supabase.from).mockReturnValue(query as any)

    const filters = {
      statut: ["status-1", "status-2"],
      agence: "agency-1",
      user: "user-uuid",
      startDate: "2024-01-01T00:00:00.000Z",
      endDate: "2024-02-01T00:00:00.000Z",
      search: "Andrea",
    }

    const total = await getInterventionTotalCount(filters)

    expect(total).toBe(42)
    expect(query.in).toHaveBeenCalledWith("statut_id", filters.statut)
    expect(query.eq).toHaveBeenCalledWith("agence_id", filters.agence)
    expect(query.eq).toHaveBeenCalledWith("assigned_user_id", filters.user)
    expect(query.gte).toHaveBeenCalledWith("date", filters.startDate)
    expect(query.lte).toHaveBeenCalledWith("date", filters.endDate)
    expect(query.ilike).toHaveBeenCalledWith("contexte_intervention", "%Andrea%")
  })

  it("throws when supabase returns an error", async () => {
    const error = new Error("Database error")
    const { query } = buildQuery({ count: null, error })
    vi.mocked(supabase.from).mockReturnValue(query as any)

    await expect(getInterventionTotalCount()).rejects.toThrow("Database error")
  })

  it("filters interventions without assigned user (Market view)", async () => {
    const { query } = buildQuery({ count: 52, error: null })
    vi.mocked(supabase.from).mockReturnValue(query as any)

    const filters = {
      statut: "status-demande-uuid",
      user: null, // ⭐ Interventions sans assignation
    }

    const total = await getInterventionTotalCount(filters)

    expect(total).toBe(52)
    expect(query.eq).toHaveBeenCalledWith("statut_id", filters.statut)
    expect(query.is).toHaveBeenCalledWith("assigned_user_id", null)
  })
})
