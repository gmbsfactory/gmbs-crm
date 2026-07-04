import { renderHook, act } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { useInterventionRealtime } from "@/hooks/useInterventionRealtime"

// createEditFormData est mocké pour refléter le CONTENU de l'intervention : la détection
// du hook se fait désormais sur le contenu dérivé, pas sur updated_at. On projette donc
// le champ `adresse` (représentatif d'un champ de formulaire) dans le résultat.
vi.mock("@/lib/interventions/form-types", () => ({
  createEditFormData: vi.fn((source: any) => ({ adresse: source.adresse })),
}))
vi.mock("@/lib/interventions/form-utils", () => ({
  dbArtisanToNearbyArtisan: vi.fn((a: any) => a ?? null),
}))

function makeIntervention(overrides: Partial<any> = {}) {
  return {
    id: "int-1",
    updated_at: "2026-01-01T00:00:00Z",
    adresse: "10 rue de Paris",
    intervention_artisans: [],
    intervention_costs: [],
    intervention_payments: [],
    ...overrides,
  } as any
}

function makeSetters() {
  return {
    setFormData: vi.fn(),
    setSelectedArtisanId: vi.fn(),
    setSelectedSecondArtisanId: vi.fn(),
    setAssignedPrimaryArtisan: vi.fn(),
    setAssignedSecondaryArtisan: vi.fn(),
  }
}

describe("useInterventionRealtime", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should NOT reset when a comment bumps updated_at but no form field changed", () => {
    const setters = makeSetters()
    const { rerender, result } = renderHook(
      ({ intervention }) =>
        useInterventionRealtime({ intervention, hasUnsavedChanges: false, ...setters }),
      { initialProps: { intervention: makeIntervention() } }
    )

    // Nouveau refetch : updated_at avance (trigger 00082 sur commentaire) mais les champs
    // du formulaire sont identiques → aucun reset, aucune bannière.
    rerender({ intervention: makeIntervention({ updated_at: "2026-01-01T00:05:00Z" }) })

    expect(setters.setFormData).not.toHaveBeenCalled()
    expect(result.current.pendingUpdate).toBe(false)
  })

  it("should reset the form immediately when a field changes and the form is clean", () => {
    const setters = makeSetters()
    const { rerender, result } = renderHook(
      ({ intervention }) =>
        useInterventionRealtime({ intervention, hasUnsavedChanges: false, ...setters }),
      { initialProps: { intervention: makeIntervention() } }
    )

    rerender({
      intervention: makeIntervention({ updated_at: "2026-01-02T00:00:00Z", adresse: "99 avenue neuve" }),
    })

    expect(setters.setFormData).toHaveBeenCalledTimes(1)
    expect(result.current.pendingUpdate).toBe(false)
  })

  it("should NOT overwrite unsaved edits — defers via pendingUpdate when a field changes and form is dirty", () => {
    const setters = makeSetters()
    const { rerender, result } = renderHook(
      ({ intervention, hasUnsavedChanges }) =>
        useInterventionRealtime({ intervention, hasUnsavedChanges, ...setters }),
      { initialProps: { intervention: makeIntervention(), hasUnsavedChanges: true } }
    )

    rerender({
      intervention: makeIntervention({ updated_at: "2026-01-02T00:00:00Z", adresse: "99 avenue neuve" }),
      hasUnsavedChanges: true,
    })

    expect(setters.setFormData).not.toHaveBeenCalled()
    expect(result.current.pendingUpdate).toBe(true)
  })

  it("should still ignore comment-only bumps even while the form is dirty", () => {
    const setters = makeSetters()
    const { rerender, result } = renderHook(
      ({ intervention, hasUnsavedChanges }) =>
        useInterventionRealtime({ intervention, hasUnsavedChanges, ...setters }),
      { initialProps: { intervention: makeIntervention(), hasUnsavedChanges: true } }
    )

    // Un collègue ajoute un commentaire pendant l'édition : contenu inchangé → pas de bannière.
    rerender({
      intervention: makeIntervention({ updated_at: "2026-01-01T00:05:00Z" }),
      hasUnsavedChanges: true,
    })

    expect(setters.setFormData).not.toHaveBeenCalled()
    expect(result.current.pendingUpdate).toBe(false)
  })

  it("should apply the latest server data on applyPendingUpdate() and clear the pending flag", () => {
    const setters = makeSetters()
    const { rerender, result } = renderHook(
      ({ intervention, hasUnsavedChanges }) =>
        useInterventionRealtime({ intervention, hasUnsavedChanges, ...setters }),
      { initialProps: { intervention: makeIntervention(), hasUnsavedChanges: true } }
    )

    rerender({
      intervention: makeIntervention({ updated_at: "2026-01-02T00:00:00Z", adresse: "99 avenue neuve" }),
      hasUnsavedChanges: true,
    })
    expect(result.current.pendingUpdate).toBe(true)

    act(() => {
      result.current.applyPendingUpdate()
    })

    expect(setters.setFormData).toHaveBeenCalledTimes(1)
    expect(setters.setSelectedArtisanId).toHaveBeenCalled()
    expect(result.current.pendingUpdate).toBe(false)
  })
})
