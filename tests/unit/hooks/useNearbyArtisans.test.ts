import { renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const rpcMock = vi.fn()
vi.mock("@/lib/supabase-client", () => ({
  supabase: { rpc: (...args: unknown[]) => rpcMock(...args) },
}))

import { useNearbyArtisans } from "@/hooks/useNearbyArtisans"

const METIER_PLOMBERIE = "fbdf005e-be1d-4910-a632-37cf6358444f"

// Coordonnees reelles de l'intervention 22706 (LA BOISSELLE, 91180) qui a revele le bug.
const LAT = 48.596284
const LNG = 2.259787

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "54c76528-123b-4cc1-8a19-0be22211d349",
    prenom: "cedric",
    nom: "seveno",
    raison_sociale: "SEVENO CEDRIC",
    telephone: "0635126907",
    telephone2: null,
    email: "s.cbatiment91470@gmail.com",
    adresse_intervention: "56 RUE EMILE BERTHIER",
    code_postal_intervention: "91240",
    ville_intervention: "SAINT-MICHEL-SUR-ORGE",
    intervention_latitude: 48.640525,
    intervention_longitude: 2.307356,
    statut_id: "5449c1e2-46d5-41b8-b790-918c2dee1a4d",
    distance_km: 6.04,
    photo_url: null,
    photo_content_hash: null,
    photo_derived_sizes: null,
    photo_mime_preferred: null,
    ...overrides,
  }
}

describe("useNearbyArtisans", () => {
  beforeEach(() => {
    rpcMock.mockReset()
    rpcMock.mockResolvedValue({ data: [], error: null })
  })

  describe("garde-fous avant requete", () => {
    it("should ne rien demander quand aucun metier n'est selectionne", async () => {
      const { result } = renderHook(() =>
        useNearbyArtisans(LAT, LNG, { metier_id: null }),
      )

      await waitFor(() => expect(result.current.loading).toBe(false))
      expect(rpcMock).not.toHaveBeenCalled()
      expect(result.current.artisans).toEqual([])
    })

    it("should ne rien demander quand les coordonnees sont absentes", async () => {
      const { result } = renderHook(() =>
        useNearbyArtisans(null, null, { metier_id: METIER_PLOMBERIE }),
      )

      await waitFor(() => expect(result.current.loading).toBe(false))
      expect(rpcMock).not.toHaveBeenCalled()
      expect(result.current.artisans).toEqual([])
    })
  })

  describe("appel du RPC", () => {
    it("should deleguer filtrage et tri a find_nearby_artisans avec les parametres du formulaire", async () => {
      const { result } = renderHook(() =>
        useNearbyArtisans(LAT, LNG, {
          limit: 100,
          maxDistanceKm: 50,
          metier_id: METIER_PLOMBERIE,
        }),
      )

      await waitFor(() => expect(rpcMock).toHaveBeenCalled())
      expect(rpcMock).toHaveBeenCalledWith("find_nearby_artisans", {
        p_latitude: LAT,
        p_longitude: LNG,
        p_radius_km: 50,
        p_metier_id: METIER_PLOMBERIE,
        p_limit: 100,
      })
      await waitFor(() => expect(result.current.loading).toBe(false))
    })

    it("should ne plus tronquer l'ensemble evalue (regression 22706)", async () => {
      // 572 plombiers en base : l'ancienne implementation en chargeait 400 max
      // AVANT de calculer la moindre distance, et perdait le plus proche.
      // Desormais aucun plafond intermediaire n'est envoye a la base : seule la
      // limite d'affichage demandee est transmise.
      renderHook(() =>
        useNearbyArtisans(LAT, LNG, { limit: 100, maxDistanceKm: 50, metier_id: METIER_PLOMBERIE }),
      )

      await waitFor(() => expect(rpcMock).toHaveBeenCalled())
      const params = rpcMock.mock.calls[0][1] as Record<string, unknown>
      expect(Object.keys(params)).not.toContain("p_sample_size")
      expect(params.p_limit).toBe(100)
    })
  })

  describe("mapping des resultats", () => {
    it("should conserver l'ordre renvoye par la base sans re-trier", async () => {
      rpcMock.mockResolvedValue({
        data: [
          makeRow({ id: "a", raison_sociale: "SEVENO CEDRIC", distance_km: 6.04 }),
          makeRow({ id: "b", raison_sociale: "AK2 plomberie", distance_km: 11.7 }),
          makeRow({ id: "c", raison_sociale: "O.F PLOMBERIE", distance_km: 12.57 }),
        ],
        error: null,
      })

      const { result } = renderHook(() =>
        useNearbyArtisans(LAT, LNG, { metier_id: METIER_PLOMBERIE }),
      )

      await waitFor(() => expect(result.current.artisans).toHaveLength(3))
      expect(result.current.artisans.map((a) => a.id)).toEqual(["a", "b", "c"])
      expect(result.current.artisans[0].distanceKm).toBe(6.04)
    })

    it("should mapper les colonnes du RPC vers la forme NearbyArtisan", async () => {
      rpcMock.mockResolvedValue({ data: [makeRow()], error: null })

      const { result } = renderHook(() =>
        useNearbyArtisans(LAT, LNG, { metier_id: METIER_PLOMBERIE }),
      )

      await waitFor(() => expect(result.current.artisans).toHaveLength(1))
      expect(result.current.artisans[0]).toMatchObject({
        displayName: "SEVENO CEDRIC",
        telephone: "0635126907",
        adresse: "56 RUE EMILE BERTHIER",
        ville: "SAINT-MICHEL-SUR-ORGE",
        codePostal: "91240",
        lat: 48.640525,
        lng: 2.307356,
        distanceKm: 6.04,
        photoProfilMetadata: null,
      })
    })

    it("should composer le displayName depuis prenom/nom sans raison sociale", async () => {
      rpcMock.mockResolvedValue({ data: [makeRow({ raison_sociale: null })], error: null })

      const { result } = renderHook(() =>
        useNearbyArtisans(LAT, LNG, { metier_id: METIER_PLOMBERIE }),
      )

      await waitFor(() => expect(result.current.artisans).toHaveLength(1))
      expect(result.current.artisans[0].displayName).toBe("cedric seveno")
    })

    it("should construire les metadonnees de photo de profil quand elle existe", async () => {
      rpcMock.mockResolvedValue({
        data: [
          makeRow({
            photo_url: "https://cdn/photo.webp",
            photo_content_hash: "abc123",
            photo_derived_sizes: { "80": "https://cdn/photo-80.webp" },
            photo_mime_preferred: "image/webp",
          }),
        ],
        error: null,
      })

      const { result } = renderHook(() =>
        useNearbyArtisans(LAT, LNG, { metier_id: METIER_PLOMBERIE }),
      )

      await waitFor(() => expect(result.current.artisans).toHaveLength(1))
      expect(result.current.artisans[0].photoProfilMetadata).toEqual({
        hash: "abc123",
        sizes: { "80": "https://cdn/photo-80.webp" },
        mime_preferred: "image/webp",
        baseUrl: "https://cdn/photo.webp",
      })
    })

    it("should ecarter les lignes dont les coordonnees ou la distance sont inexploitables", async () => {
      rpcMock.mockResolvedValue({
        data: [
          makeRow({ id: "ok" }),
          makeRow({ id: "sans-coords", intervention_latitude: null, intervention_longitude: null }),
          makeRow({ id: "sans-distance", distance_km: null }),
        ],
        error: null,
      })

      const { result } = renderHook(() =>
        useNearbyArtisans(LAT, LNG, { metier_id: METIER_PLOMBERIE }),
      )

      await waitFor(() => expect(result.current.artisans).toHaveLength(1))
      expect(result.current.artisans[0].id).toBe("ok")
    })
  })

  describe("gestion d'erreur", () => {
    it("should exposer un message d'erreur et une liste vide quand le RPC echoue", async () => {
      rpcMock.mockResolvedValue({ data: null, error: new Error("boom") })

      const { result } = renderHook(() =>
        useNearbyArtisans(LAT, LNG, { metier_id: METIER_PLOMBERIE }),
      )

      await waitFor(() => expect(result.current.error).toBeTruthy())
      expect(result.current.artisans).toEqual([])
      expect(result.current.loading).toBe(false)
    })

    it("should tolerer un rejet de la promesse", async () => {
      rpcMock.mockRejectedValue(new Error("network down"))

      const { result } = renderHook(() =>
        useNearbyArtisans(LAT, LNG, { metier_id: METIER_PLOMBERIE }),
      )

      await waitFor(() => expect(result.current.error).toBeTruthy())
      expect(result.current.artisans).toEqual([])
    })
  })
})
