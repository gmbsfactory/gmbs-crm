import { renderHook, act } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { useInterventionRealtime } from "@/hooks/useInterventionRealtime"

// On isole le hook de la logique de mapping : seul le comportement de sync
// (quand réinitialiser / quand différer) nous intéresse ici.
vi.mock("@/lib/interventions/form-types", () => ({
  createEditFormData: vi.fn(() => ({ mapped: true })),
}))
vi.mock("@/lib/interventions/form-utils", () => ({
  dbArtisanToNearbyArtisan: vi.fn((a: any) => a ?? null),
}))

function makeIntervention(updatedAt: string) {
  return {
    id: "int-1",
    updated_at: updatedAt,
    intervention_artisans: [],
    intervention_costs: [],
    intervention_payments: [],
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

  it("should not reset the form when updated_at is unchanged", () => {
    const setters = makeSetters()
    const { rerender, result } = renderHook(
      ({ intervention }) =>
        useInterventionRealtime({ intervention, hasUnsavedChanges: false, ...setters }),
      { initialProps: { intervention: makeIntervention("2026-01-01T00:00:00Z") } }
    )

    // Nouvelle référence d'objet mais même updated_at (refetch sans changement réel)
    rerender({ intervention: makeIntervention("2026-01-01T00:00:00Z") })

    expect(setters.setFormData).not.toHaveBeenCalled()
    expect(result.current.pendingUpdate).toBe(false)
  })

  it("should reset the form immediately when updated_at changes and the form is clean", () => {
    const setters = makeSetters()
    const { rerender, result } = renderHook(
      ({ intervention }) =>
        useInterventionRealtime({ intervention, hasUnsavedChanges: false, ...setters }),
      { initialProps: { intervention: makeIntervention("2026-01-01T00:00:00Z") } }
    )

    rerender({ intervention: makeIntervention("2026-01-02T00:00:00Z") })

    expect(setters.setFormData).toHaveBeenCalledTimes(1)
    expect(result.current.pendingUpdate).toBe(false)
  })

  it("should NOT overwrite unsaved edits — defers via pendingUpdate when the form is dirty", () => {
    const setters = makeSetters()
    const { rerender, result } = renderHook(
      ({ intervention, hasUnsavedChanges }) =>
        useInterventionRealtime({ intervention, hasUnsavedChanges, ...setters }),
      {
        initialProps: {
          intervention: makeIntervention("2026-01-01T00:00:00Z"),
          hasUnsavedChanges: true,
        },
      }
    )

    // updated_at bumpé (ex: trigger 00082 suite à un commentaire) alors que le form est dirty
    rerender({ intervention: makeIntervention("2026-01-02T00:00:00Z"), hasUnsavedChanges: true })

    expect(setters.setFormData).not.toHaveBeenCalled()
    expect(result.current.pendingUpdate).toBe(true)
  })

  it("should apply the latest server data on applyPendingUpdate() and clear the pending flag", () => {
    const setters = makeSetters()
    const { rerender, result } = renderHook(
      ({ intervention, hasUnsavedChanges }) =>
        useInterventionRealtime({ intervention, hasUnsavedChanges, ...setters }),
      {
        initialProps: {
          intervention: makeIntervention("2026-01-01T00:00:00Z"),
          hasUnsavedChanges: true,
        },
      }
    )

    rerender({ intervention: makeIntervention("2026-01-02T00:00:00Z"), hasUnsavedChanges: true })
    expect(result.current.pendingUpdate).toBe(true)

    act(() => {
      result.current.applyPendingUpdate()
    })

    expect(setters.setFormData).toHaveBeenCalledTimes(1)
    expect(result.current.pendingUpdate).toBe(false)
  })
})
