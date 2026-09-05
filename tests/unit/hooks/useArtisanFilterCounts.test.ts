import { renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Compteur des puces de la page Artisans.
 *
 * Piège connu du projet : le nombre affiché sur une puce ne vient PAS de la
 * liste, mais d'un appel de comptage distinct. Une propriété de filtre que ce
 * chemin de comptage ne sait pas traduire est silencieusement ignorée — la
 * liste paraît juste, le compteur est faux (il compte avant filtrage).
 *
 * Ces tests verrouillent la traduction de `pieces_a_verifier` sur le chemin de
 * comptage, et l'absence totale de contact avec `statut_dossier`.
 */
const getCountWithFiltersMock = vi.fn(async () => 0)
vi.mock("@/lib/api", () => ({
  artisansApi: {
    getCountWithFilters: (...args: unknown[]) => getCountWithFiltersMock(...(args as [])),
  },
}))

import { useArtisanFilterCounts } from "../../../app/artisans/_lib/useArtisanFilterCounts"

const VUE_A_VERIFIER = {
  id: "artisans-a-verifier",
  filters: [{ property: "pieces_a_verifier", operator: "is_not_empty" }],
}

const VUE_MES_A_VERIFIER = {
  id: "mes-artisans-a-verifier",
  filters: [
    { property: "gestionnaire_id", operator: "eq", value: "__CURRENT_USER__" },
    { property: "pieces_a_verifier", operator: "is_not_empty" },
  ],
}

const VUE_A_COMPLETER = {
  id: "artisans-a-completer",
  filters: [{ property: "statut_dossier", operator: "eq", value: "À compléter" }],
}

// Références STABLES : le hook garde `artisanStatuses` / `metiers` dans les
// dépendances de ses effets, donc un littéral recréé à chaque rendu relancerait
// le comptage en boucle. La page, elle, passe des valeurs mémoïsées.
const AUCUN_STATUT: never[] = []
const AUCUN_METIER: never[] = []

function renderCounts(views: Array<{ id: string; filters: unknown[] }>) {
  return renderHook(() =>
    useArtisanFilterCounts({
      isReady: true,
      views: views as never,
      activeView: null,
      currentUserId: "user-badr",
      // null : neutralise le second effet (compteurs statuts/métiers) pour
      // n'observer que les appels de comptage des puces.
      referenceData: null,
      artisanStatuses: AUCUN_STATUT,
      metiers: AUCUN_METIER,
      searchTerm: "",
      selectedStatuses: AUCUN_STATUT,
      selectedMetiers: AUCUN_METIER,
    }),
  )
}

/** Paramètres de comptage envoyés pour une puce donnée, dans l'ordre des vues. */
function paramsDeLaVue(index: number) {
  return getCountWithFiltersMock.mock.calls[index]?.[0] as Record<string, unknown> | undefined
}

describe("useArtisanFilterCounts", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getCountWithFiltersMock.mockResolvedValue(0)
  })

  describe("puce « Artisans à vérifier »", () => {
    it("should compter avec le drapeau serveur pieces_a_verifier", async () => {
      renderCounts([VUE_A_VERIFIER])

      await waitFor(() => expect(getCountWithFiltersMock).toHaveBeenCalled())
      expect(paramsDeLaVue(0)).toEqual({ pieces_a_verifier: true })
    })

    it("should ne PAS compter tous les artisans (filtre ignoré = compteur faux)", async () => {
      renderCounts([VUE_A_VERIFIER])

      await waitFor(() => expect(getCountWithFiltersMock).toHaveBeenCalled())
      expect(paramsDeLaVue(0)).not.toEqual({})
    })

    it("should n'envoyer NI statut_dossier NI exclude_statuts", async () => {
      renderCounts([VUE_A_VERIFIER])

      await waitFor(() => expect(getCountWithFiltersMock).toHaveBeenCalled())
      const params = paramsDeLaVue(0) ?? {}
      expect(params.statut_dossier).toBeUndefined()
      expect(params.exclude_statuts).toBeUndefined()
    })
  })

  describe("puce « Mes artisans à vérifier »", () => {
    it("should combiner le gestionnaire connecté et le drapeau", async () => {
      renderCounts([VUE_MES_A_VERIFIER])

      await waitFor(() => expect(getCountWithFiltersMock).toHaveBeenCalled())
      expect(paramsDeLaVue(0)).toEqual({
        gestionnaire: "user-badr",
        pieces_a_verifier: true,
      })
    })
  })

  describe("étanchéité avec la puce « à compléter »", () => {
    it("should laisser le comptage de statut_dossier strictement inchangé", async () => {
      renderCounts([VUE_A_COMPLETER, VUE_A_VERIFIER])

      await waitFor(() => expect(getCountWithFiltersMock).toHaveBeenCalledTimes(2))

      // La puce « à compléter » compte exactement comme avant le lot : son
      // paramétrage ne gagne aucun drapeau pieces_a_verifier.
      const aCompleter = paramsDeLaVue(0) ?? {}
      expect(aCompleter.statut_dossier).toBe("À compléter")
      expect(aCompleter.pieces_a_verifier).toBeUndefined()
    })
  })

  describe("exposition des compteurs", () => {
    it("should renvoyer le nombre reçu du serveur pour chaque puce", async () => {
      getCountWithFiltersMock.mockImplementation(async (params: Record<string, unknown>) =>
        params?.pieces_a_verifier ? 2 : 7,
      )

      const { result } = renderCounts([VUE_A_COMPLETER, VUE_A_VERIFIER])

      await waitFor(() => {
        expect(result.current.viewCounts["artisans-a-verifier"]).toBe(2)
        expect(result.current.viewCounts["artisans-a-completer"]).toBe(7)
      })
    })
  })
})
