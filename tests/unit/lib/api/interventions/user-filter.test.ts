import { describe, it, expect } from "vitest"
import { applyUserFilter } from "@/lib/api/interventions/_user-filter"

type Call = { method: string; args: unknown[] }

/** Builder factice qui enregistre les appels PostgREST au lieu de les exécuter. */
const createQuery = () => {
  const calls: Call[] = []
  const query = {
    calls,
    in: (...args: unknown[]) => (calls.push({ method: "in", args }), query),
    is: (...args: unknown[]) => (calls.push({ method: "is", args }), query),
    eq: (...args: unknown[]) => (calls.push({ method: "eq", args }), query),
    or: (...args: unknown[]) => (calls.push({ method: "or", args }), query),
  }
  return query
}

describe("applyUserFilter", () => {
  it("should not touch the query when no user filter is set", () => {
    const query = createQuery()
    applyUserFilter(query as never, {})
    expect(query.calls).toEqual([])
  })

  it("should use eq for a single assigned user", () => {
    const query = createQuery()
    applyUserFilter(query as never, { user: "u-1" })
    expect(query.calls).toEqual([{ method: "eq", args: ["assigned_user_id", "u-1"] }])
  })

  it("should use is null for the unassigned (Market) filter", () => {
    const query = createQuery()
    applyUserFilter(query as never, { user: null })
    expect(query.calls).toEqual([{ method: "is", args: ["assigned_user_id", null] }])
  })

  it("should use in for a multi-selection of named gestionnaires", () => {
    const query = createQuery()
    applyUserFilter(query as never, { users: ["u-1", "u-2"] })
    expect(query.calls).toEqual([{ method: "in", args: ["assigned_user_id", ["u-1", "u-2"]] }])
  })

  it("should use is null when the multi-selection only holds Non assigné", () => {
    const query = createQuery()
    applyUserFilter(query as never, { users: [null] })
    expect(query.calls).toEqual([{ method: "is", args: ["assigned_user_id", null] }])
  })

  it("should use or() when Non assigné is combined with named gestionnaires", () => {
    // `.in()` ne peut pas exprimer ce mélange : `in.(null,uuid)` traite null
    // comme une chaîne littérale et ne matche jamais un vrai NULL SQL.
    const query = createQuery()
    applyUserFilter(query as never, { users: ["u-1", null, "u-2"] })
    expect(query.calls).toEqual([
      { method: "or", args: ["assigned_user_id.is.null,assigned_user_id.in.(u-1,u-2)"] },
    ])
  })

  it("should give `users` precedence over the scalar `user`", () => {
    const query = createQuery()
    applyUserFilter(query as never, { user: "u-9", users: ["u-1"] })
    expect(query.calls).toEqual([{ method: "in", args: ["assigned_user_id", ["u-1"]] }])
  })
})
