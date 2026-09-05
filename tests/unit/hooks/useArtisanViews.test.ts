import { renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

// Les puces de la page Artisans sont des presets figés dans le hook. On mocke
// l'utilisateur courant pour vérifier la substitution du placeholder.
const useCurrentUserMock = vi.fn(() => ({ data: { id: "user-badr" } }))
vi.mock("@/hooks/useCurrentUser", () => ({
  useCurrentUser: () => useCurrentUserMock(),
}))

import { useArtisanViews } from "@/hooks/useArtisanViews"

describe("useArtisanViews", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useCurrentUserMock.mockReturnValue({ data: { id: "user-badr" } })
    localStorage.clear()
  })

  describe("presets par défaut", () => {
    it("should exposer les six puces dans l'ordre attendu", () => {
      const { result } = renderHook(() => useArtisanViews())

      expect(result.current.views.map((view) => view.id)).toEqual([
        "liste-generale",
        "ma-liste-artisans",
        "artisans-a-completer",
        "mes-artisans-a-completer",
        "artisans-a-verifier",
        "mes-artisans-a-verifier",
      ])
    })

    it("should intituler les deux nouvelles puces « à vérifier »", () => {
      const { result } = renderHook(() => useArtisanViews())
      const titres = new Map(result.current.views.map((view) => [view.id, view.title]))

      expect(titres.get("artisans-a-verifier")).toBe("Artisans à vérifier")
      expect(titres.get("mes-artisans-a-verifier")).toBe("Mes artisans à vérifier")
    })
  })

  describe("filtres des puces « à vérifier »", () => {
    const findView = (views: Array<{ id: string }>, id: string) =>
      views.find((view) => view.id === id) as {
        id: string
        filters: Array<{ property: string; operator: string; value?: string | null }>
      }

    it("should filtrer « Artisans à vérifier » sur pieces_a_verifier is_not_empty", () => {
      const { result } = renderHook(() => useArtisanViews())
      const view = findView(result.current.views, "artisans-a-verifier")

      expect(view.filters).toEqual([{ property: "pieces_a_verifier", operator: "is_not_empty" }])
    })

    it("should restreindre « Mes artisans à vérifier » au gestionnaire connecté", () => {
      const { result } = renderHook(() => useArtisanViews())
      const view = findView(result.current.views, "mes-artisans-a-verifier")

      expect(view.filters).toEqual([
        { property: "gestionnaire_id", operator: "eq", value: "__CURRENT_USER__" },
        { property: "pieces_a_verifier", operator: "is_not_empty" },
      ])
    })

    it("should n'employer AUCUN filtre statut_dossier (indépendance de la puce « à compléter »)", () => {
      const { result } = renderHook(() => useArtisanViews())

      for (const id of ["artisans-a-verifier", "mes-artisans-a-verifier"]) {
        const view = findView(result.current.views, id)
        expect(view.filters.some((filter) => filter.property === "statut_dossier")).toBe(false)
      }
    })
  })

  describe("vue active", () => {
    it("should remplacer le placeholder par l'utilisateur connecté", async () => {
      const { result } = renderHook(() => useArtisanViews())

      await waitFor(() => expect(result.current.isReady).toBe(true))
      result.current.setActiveView("mes-artisans-a-verifier")

      await waitFor(() => {
        expect(result.current.activeView.filters).toEqual([
          { property: "gestionnaire_id", operator: "eq", value: "user-badr" },
          { property: "pieces_a_verifier", operator: "is_not_empty" },
        ])
      })
    })

    it("should laisser le placeholder tant que l'utilisateur n'est pas connu", async () => {
      useCurrentUserMock.mockReturnValue({ data: undefined } as never)
      const { result } = renderHook(() => useArtisanViews())

      await waitFor(() => expect(result.current.isReady).toBe(true))
      result.current.setActiveView("mes-artisans-a-verifier")

      await waitFor(() => {
        expect(result.current.activeView.filters[0].value).toBe("__CURRENT_USER__")
      })
    })
  })

  describe("fusion avec le localStorage", () => {
    it("should ajouter les nouvelles puces à un stockage antérieur au lot", async () => {
      // Stockage écrit AVANT l'ajout des puces « à vérifier » : les presets par
      // défaut doivent primer, sinon les deux nouvelles puces n'apparaîtraient
      // jamais pour les utilisateurs existants.
      localStorage.setItem(
        "crm:artisans:views",
        JSON.stringify({
          views: [{ id: "liste-generale", title: "Liste générale", description: "", filters: [], isDefault: true }],
          activeViewId: "liste-generale",
        }),
      )

      const { result } = renderHook(() => useArtisanViews())

      await waitFor(() => expect(result.current.isReady).toBe(true))
      expect(result.current.views.map((view) => view.id)).toContain("artisans-a-verifier")
      expect(result.current.views.map((view) => view.id)).toContain("mes-artisans-a-verifier")
    })
  })
})
