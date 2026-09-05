import { describe, it, expect, vi, beforeEach } from "vitest"

/**
 * Compteurs des puces de filtre de la page Artisans.
 *
 * Deux vérifications complémentaires :
 * 1. la NOUVELLE puce « Pièces à vérifier » compte via `.gt("pieces_a_verifier", 0)`
 *    — une colonne SCALAIRE d'`artisans`, jamais un embed
 *    `artisan_attachments!inner(...)` qui casserait le `count: exact` ;
 * 2. le compteur « Dossier à compléter » est INCHANGÉ : mêmes filtres, même
 *    `.in("statut_dossier", …)`. Il est affiché au client et son bug connu
 *    relève d'un chantier séparé (précédent « Matera 9 vs 2 »).
 */
vi.mock("@/lib/api/artisans/_helpers", () => {
  const calls: Array<{ table: string; filters: Array<[string, ...unknown[]]> }> = []
  let current: { data: unknown[]; error: unknown; count: number | null } = {
    data: [],
    error: null,
    count: 0,
  }

  const chainMethods = [
    "select", "insert", "update", "delete",
    "eq", "neq", "in", "not", "or", "ilike", "is",
    "gt", "gte", "lt", "lte", "order", "limit", "range", "filter", "match", "contains",
  ]

  const makeChain = (table: string) => {
    const call = { table, filters: [] as Array<[string, ...unknown[]]> }
    calls.push(call)
    const chain: Record<string, unknown> = {}
    chainMethods.forEach((m) => {
      chain[m] = vi.fn((...args: unknown[]) => {
        call.filters.push([m, ...args])
        return chain
      })
    })
    chain.single = vi.fn(() => Promise.resolve(current))
    chain.maybeSingle = vi.fn(() => Promise.resolve(current))
    chain.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(current).then(resolve, reject)
    return chain
  }

  return {
    supabaseClient: { from: vi.fn((table: string) => makeChain(table)) },
    filterArtisansByMetiers: vi.fn(async () => new Set<string>()),
    filterArtisansByMetier: vi.fn(async () => new Set<string>()),
    __calls: calls,
    __reset: () => {
      calls.length = 0
    },
    __setResult: (r: { data?: unknown[]; error?: unknown; count?: number | null }) => {
      current = { data: r.data ?? [], error: r.error ?? null, count: r.count ?? 0 }
    },
  }
})

import { artisansCounts } from "@/lib/api/artisans/artisans-counts"
import * as helpers from "@/lib/api/artisans/_helpers"

const mocked = helpers as unknown as {
  __calls: Array<{ table: string; filters: Array<[string, ...unknown[]]> }>
  __reset: () => void
  __setResult: (r: { data?: unknown[]; error?: unknown; count?: number | null }) => void
}

/** Toutes les méthodes de filtre appelées sur la première requête `artisans`. */
function filtresArtisans() {
  return mocked.__calls.filter((c) => c.table === "artisans").flatMap((c) => c.filters)
}

describe("artisansCounts.getCountWithFilters", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocked.__reset()
    mocked.__setResult({ count: 0 })
  })

  describe("puce « Pièces à vérifier » (lot L5)", () => {
    it("should compter via pieces_a_verifier > 0", async () => {
      mocked.__setResult({ count: 3 })
      const count = await artisansCounts.getCountWithFilters({ pieces_a_verifier: true })

      expect(count).toBe(3)
      expect(filtresArtisans()).toEqual(
        expect.arrayContaining([["gt", "pieces_a_verifier", 0]]),
      )
    })

    it("should ne JAMAIS passer par un embed artisan_attachments (count exact préservé)", async () => {
      await artisansCounts.getCountWithFilters({ pieces_a_verifier: true })
      const selects = filtresArtisans().filter(([m]) => m === "select")
      for (const [, colonnes] of selects) {
        expect(String(colonnes)).not.toContain("artisan_attachments")
      }
      expect(mocked.__calls.every((c) => c.table === "artisans")).toBe(true)
    })

    it("should ne pas toucher à statut_dossier", async () => {
      await artisansCounts.getCountWithFilters({ pieces_a_verifier: true })
      expect(filtresArtisans().some(([m, col]) => m === "in" && col === "statut_dossier")).toBe(false)
    })
  })

  describe("non-régression de la puce « Dossier à compléter »", () => {
    it("should garder exactement le filtre historique .in(statut_dossier, …)", async () => {
      mocked.__setResult({ count: 9 })
      const count = await artisansCounts.getCountWithFilters({ statut_dossier: "À compléter" })

      expect(count).toBe(9)
      expect(filtresArtisans()).toEqual(
        expect.arrayContaining([
          ["in", "statut_dossier", ["À compléter", "incomplet", "INCOMPLET"]],
        ]),
      )
    })

    it("should ne pas ajouter de filtre pieces_a_verifier quand il n'est pas demandé", async () => {
      await artisansCounts.getCountWithFilters({ statut_dossier: "À compléter" })
      expect(filtresArtisans().some(([m, col]) => m === "gt" && col === "pieces_a_verifier")).toBe(
        false,
      )
    })

    it("should ignorer pieces_a_verifier: false", async () => {
      await artisansCounts.getCountWithFilters({ pieces_a_verifier: false })
      expect(filtresArtisans().some(([m, col]) => m === "gt" && col === "pieces_a_verifier")).toBe(
        false,
      )
    })
  })

  it("should cumuler les deux filtres si les deux puces sont cochées", async () => {
    await artisansCounts.getCountWithFilters({
      statut_dossier: "À compléter",
      pieces_a_verifier: true,
    })
    const filtres = filtresArtisans()
    expect(filtres).toEqual(
      expect.arrayContaining([
        ["in", "statut_dossier", ["À compléter", "incomplet", "INCOMPLET"]],
        ["gt", "pieces_a_verifier", 0],
      ]),
    )
  })
})
