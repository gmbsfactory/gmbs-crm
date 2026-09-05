import { beforeEach, describe, expect, it, vi } from "vitest"

import { interventionsApi } from "@/lib/api"
import { supabase } from "@/lib/supabase-client"

// getTotalCountWithFilters est LE chemin de comptage de la pastille des vues :
// il doit appliquer exactement les mêmes critères que la liste, sinon le nombre
// affiché sur la puce ne correspond pas au nombre de lignes.
vi.mock("@/lib/supabase-client", () => ({
  supabase: { from: vi.fn() },
}))

type Call = { method: string; args: unknown[] }

const createQueryMock = (count: number) => {
  const calls: Call[] = []
  const builder: Record<string, unknown> = {}
  const chain = (method: string) => (...args: unknown[]) => {
    calls.push({ method, args })
    return builder
  }
  for (const method of ["select", "eq", "in", "is", "gte", "lte", "abortSignal"]) {
    builder[method] = chain(method)
  }
  // `await query` : le builder est thenable, comme le PostgrestBuilder
  builder.then = (resolve: (value: unknown) => unknown) => resolve({ count, error: null })
  return { builder, calls }
}

const findCall = (calls: Call[], method: string, column: string) =>
  calls.find((call) => call.method === method && call.args[0] === column)

describe("interventionsApi.getTotalCountWithFilters — vue « Mes vérifications »", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("compte avec le drapeau ET les statuts « À vérifier »", async () => {
    const { builder, calls } = createQueryMock(3)
    vi.mocked(supabase.from).mockReturnValue(builder as never)

    const count = await interventionsApi.getTotalCountWithFilters({
      user: "user-badr",
      hasPortalReport: true,
      portalReportStatuts: ["st-accepte", "st-en-cours", "st-sav", "st-terminee"],
    })

    expect(count).toBe(3)
    expect(findCall(calls, "eq", "has_portal_report")?.args[1]).toBe(true)
    expect(findCall(calls, "in", "statut_id")?.args[1]).toEqual([
      "st-accepte",
      "st-en-cours",
      "st-sav",
      "st-terminee",
    ])
    expect(findCall(calls, "eq", "assigned_user_id")?.args[1]).toBe("user-badr")
  })

  it("n'applique aucun de ces critères hors de la vue", async () => {
    const { builder, calls } = createQueryMock(42)
    vi.mocked(supabase.from).mockReturnValue(builder as never)

    await interventionsApi.getTotalCountWithFilters({ user: "user-badr" })

    expect(findCall(calls, "eq", "has_portal_report")).toBeUndefined()
    expect(findCall(calls, "in", "statut_id")).toBeUndefined()
  })
})
