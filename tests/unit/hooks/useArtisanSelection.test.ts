import { renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

// La regle metier : on ne propose des artisans QUE si (adresse geolocalisee) ET (metier).
// On mocke useNearbyArtisans pour espionner les coordonnees qui lui sont passees : null = pas de requete.
const useNearbyArtisansMock = vi.fn(() => ({ artisans: [], loading: false, error: null }))
vi.mock("@/hooks/useNearbyArtisans", () => ({
  useNearbyArtisans: (...args: unknown[]) => useNearbyArtisansMock(...args),
}))
vi.mock("@/hooks/useArtisanAbsences", () => ({
  useArtisanAbsences: () => new Set<string>(),
}))

import { useArtisanSelection } from "@/hooks/useArtisanSelection"

const baseForm = {
  metier_id: "",
  metierSecondArtisanId: "",
  latitude: 48.8566, // valeur par defaut Paris presente meme sans adresse saisie
  longitude: 2.3522,
  adresse_complete: "",
}

function renderSelection(formOverrides: Record<string, unknown>) {
  const formData = { ...baseForm, ...formOverrides } as any
  return renderHook(() =>
    useArtisanSelection({ formData, perimeterKmValue: 30, onFormDataChange: vi.fn() }),
  )
}

// Retrouve l'appel useNearbyArtisans par le metier_id passe dans les options (3e argument).
function callFor(metierId: string | null) {
  return useNearbyArtisansMock.mock.calls.find(
    (c) => ((c[2] as { metier_id?: string | null })?.metier_id ?? null) === metierId,
  )
}

describe("useArtisanSelection — gating de la proposition d'artisans", () => {
  beforeEach(() => useNearbyArtisansMock.mockClear())

  it("ne declenche aucune recherche sans metier (adresse seule)", () => {
    renderSelection({ adresse_complete: "1 rue de Lyon, 69000 Lyon", metier_id: "" })
    for (const call of useNearbyArtisansMock.mock.calls) {
      expect(call[0]).toBeNull()
      expect(call[1]).toBeNull()
    }
  })

  it("ne declenche aucune recherche sans adresse geolocalisee (metier seul)", () => {
    renderSelection({ adresse_complete: "", metier_id: "metier-1" })
    for (const call of useNearbyArtisansMock.mock.calls) {
      expect(call[0]).toBeNull()
      expect(call[1]).toBeNull()
    }
  })

  it("declenche la recherche du metier principal quand metier + adresse sont presents", () => {
    renderSelection({
      adresse_complete: "1 rue de Lyon, 69000 Lyon",
      metier_id: "metier-1",
      latitude: 45.75,
      longitude: 4.85,
    })
    const primary = callFor("metier-1")
    expect(primary?.[0]).toBe(45.75)
    expect(primary?.[1]).toBe(4.85)
  })

  it("ne declenche pas la recherche du 2e artisan si son metier n'est pas selectionne", () => {
    renderSelection({
      adresse_complete: "1 rue de Lyon, 69000 Lyon",
      metier_id: "metier-1",
      metierSecondArtisanId: "",
      latitude: 45.75,
      longitude: 4.85,
    })
    // Le 2e appel (metier_id null) doit recevoir des coordonnees nulles, le 1er non.
    const second = callFor(null)
    expect(second?.[0]).toBeNull()
    expect(second?.[1]).toBeNull()
    expect(callFor("metier-1")?.[0]).toBe(45.75)
  })
})
