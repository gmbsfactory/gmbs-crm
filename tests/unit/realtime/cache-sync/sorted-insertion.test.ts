import { describe, expect, it } from "vitest"
import {
  resolveSort,
  compareInterventions,
  findInsertIndex,
  insertSorted,
} from "@/lib/realtime/cache-sync/sorted-insertion"
import type { Intervention, InterventionQueryParams } from "@/lib/api"

type GetAllParams = InterventionQueryParams

// Fabrique minimale : seuls les champs de tri nous interessent ici.
function mk(overrides: Partial<Intervention> & { id: string }): Intervention {
  return {
    id: overrides.id,
    created_at: null,
    updated_at: null,
    date: "2025-01-01",
    date_prevue: null,
    ...overrides,
  } as Intervention
}

const ids = (list: Intervention[]) => list.map((i) => i.id)

describe("sorted-insertion", () => {
  describe("resolveSort", () => {
    it("should default to created_at DESC when no sortBy", () => {
      expect(resolveSort(undefined)).toEqual({ field: "created_at", dir: "desc" })
      expect(resolveSort({})).toEqual({ field: "created_at", dir: "desc" })
    })

    it("should map client sortBy keys to intervention fields (mirror of Edge Function)", () => {
      expect(resolveSort({ sortBy: "date_prevue", sortDir: "asc" })).toEqual({
        field: "date_prevue",
        dir: "asc",
      })
      expect(resolveSort({ sortBy: "datePrevue" })).toEqual({ field: "date_prevue", dir: "desc" })
      // quirk serveur : 'date' -> created_at
      expect(resolveSort({ sortBy: "date" })).toEqual({ field: "created_at", dir: "desc" })
      expect(resolveSort({ sortBy: "dateIntervention" })).toEqual({ field: "date", dir: "desc" })
    })

    it("should fall back to created_at DESC for an unknown sortBy", () => {
      expect(resolveSort({ sortBy: "unknown_col" as string })).toEqual({
        field: "created_at",
        dir: "desc",
      })
    })
  })

  describe("compareInterventions", () => {
    const sort = { field: "date_prevue", dir: "asc" } as const

    it("should order non-null values ascending", () => {
      const a = mk({ id: "a", date_prevue: "2025-01-10" })
      const b = mk({ id: "b", date_prevue: "2025-01-20" })
      expect(compareInterventions(a, b, sort)).toBeLessThan(0)
      expect(compareInterventions(b, a, sort)).toBeGreaterThan(0)
    })

    it("should always place nulls last, regardless of direction", () => {
      const withDate = mk({ id: "a", date_prevue: "2025-01-10" })
      const withoutDate = mk({ id: "b", date_prevue: null })
      expect(compareInterventions(withDate, withoutDate, sort)).toBeLessThan(0)
      expect(compareInterventions(withoutDate, withDate, sort)).toBeGreaterThan(0)
      // meme comportement en desc
      const desc = { field: "date_prevue", dir: "desc" } as const
      expect(compareInterventions(withoutDate, withDate, desc)).toBeGreaterThan(0)
    })

    it("should tie-break on created_at DESC when the primary field is equal", () => {
      const a = mk({ id: "a", date_prevue: "2025-01-10", created_at: "2025-01-05T00:00:00Z" })
      const b = mk({ id: "b", date_prevue: "2025-01-10", created_at: "2025-01-06T00:00:00Z" })
      // b cree plus recemment -> b avant a (DESC)
      expect(compareInterventions(b, a, sort)).toBeLessThan(0)
    })
  })

  describe("findInsertIndex / insertSorted (default: created_at DESC)", () => {
    it("should insert a newer created_at at the top", () => {
      const list = [
        mk({ id: "old", created_at: "2025-01-01T00:00:00Z" }),
        mk({ id: "mid", created_at: "2025-01-02T00:00:00Z" }),
      ].sort((a, b) => compareInterventions(a, b, resolveSort(undefined)))
      const fresh = mk({ id: "new", created_at: "2025-01-03T00:00:00Z" })
      expect(ids(insertSorted(list, fresh, undefined))).toEqual(["new", "mid", "old"])
    })

    it("should insert an older created_at in the middle, not at the top", () => {
      const list = [
        mk({ id: "recent", created_at: "2025-03-01T00:00:00Z" }),
        mk({ id: "oldest", created_at: "2025-01-01T00:00:00Z" }),
      ]
      const middle = mk({ id: "middle", created_at: "2025-02-01T00:00:00Z" })
      expect(ids(insertSorted(list, middle, undefined))).toEqual(["recent", "middle", "oldest"])
    })
  })

  describe("insertSorted with explicit date_prevue sort", () => {
    const filters: GetAllParams = { sortBy: "date_prevue", sortDir: "asc" }

    it("should place a modified row at its date_prevue position, NOT at the top", () => {
      const list = [
        mk({ id: "a", date_prevue: "2025-01-10" }),
        mk({ id: "b", date_prevue: "2025-01-20" }),
        mk({ id: "c", date_prevue: "2025-01-30" }),
      ]
      // Scenario Badr : sous-statut change (date_prevue inchangee) -> reste a sa place.
      const updatedB = mk({ id: "b", date_prevue: "2025-01-20" })
      expect(ids(insertSorted(list, updatedB, filters))).toEqual(["a", "b", "c"])
    })

    it("should reposition a row when its date_prevue actually changes", () => {
      const list = [
        mk({ id: "a", date_prevue: "2025-01-10" }),
        mk({ id: "b", date_prevue: "2025-01-20" }),
        mk({ id: "c", date_prevue: "2025-01-30" }),
      ]
      const movedA = mk({ id: "a", date_prevue: "2025-01-25" })
      expect(ids(insertSorted(list, movedA, filters))).toEqual(["b", "a", "c"])
    })

    it("should push a row with a null date_prevue to the bottom", () => {
      const list = [
        mk({ id: "a", date_prevue: "2025-01-10" }),
        mk({ id: "b", date_prevue: "2025-01-20" }),
      ]
      const noDate = mk({ id: "c", date_prevue: null })
      expect(ids(insertSorted(list, noDate, filters))).toEqual(["a", "b", "c"])
    })

    it("should not duplicate a record already present (remove-then-reinsert)", () => {
      const list = [mk({ id: "a", date_prevue: "2025-01-10" }), mk({ id: "b", date_prevue: "2025-01-20" })]
      const result = insertSorted(list, mk({ id: "a", date_prevue: "2025-01-10" }), filters)
      expect(result).toHaveLength(2)
      expect(ids(result)).toEqual(["a", "b"])
    })
  })
})
