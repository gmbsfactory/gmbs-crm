import { renderHook, act } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { useInterventionAccomptes } from "@/hooks/useInterventionAccomptes"
import type { InterventionFormData } from "@/lib/interventions/form-types"

const STATUSES = [
  { id: "s-accepte", code: "ACCEPTE", label: "Accepté" },
  { id: "s-att", code: "ATT_ACOMPTE", label: "Attente acompte" },
]

function makeFormData(overrides: Partial<InterventionFormData> = {}): InterventionFormData {
  return {
    statut_id: "s-accepte",
    accompteSST: "",
    accompteClient: "",
    accompteSSTRecu: false,
    accompteClientRecu: false,
    dateAccompteSSTRecu: "",
    dateAccompteClientRecu: "",
    ...overrides,
  } as InterventionFormData
}

function setup(formData: InterventionFormData) {
  const handleInputChange = vi.fn()
  const hook = renderHook(() =>
    useInterventionAccomptes({
      formData,
      interventionStatuses: STATUSES,
      handleInputChange,
    }),
  )
  return { hook, handleInputChange }
}

describe("useInterventionAccomptes (local-only)", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 3, 12, 10, 0, 0))
    vi.clearAllMocks()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  describe("handleAccompteClientRecuChange", () => {
    it("checks without auto-filling date and transitions statut_id to ACCEPTE", () => {
      const { hook, handleInputChange } = setup(
        makeFormData({ statut_id: "s-att", dateAccompteClientRecu: "" }),
      )

      act(() => {
        hook.result.current.handleAccompteClientRecuChange(true)
      })

      expect(handleInputChange).toHaveBeenCalledWith("accompteClientRecu", true)
      expect(handleInputChange).toHaveBeenCalledWith("statut_id", "s-accepte")
      expect(handleInputChange).not.toHaveBeenCalledWith(
        "dateAccompteClientRecu",
        expect.anything(),
      )
    })

    it("unchecking from ACCEPTE transitions statut_id to ATT_ACOMPTE", () => {
      const { hook, handleInputChange } = setup(
        makeFormData({ statut_id: "s-accepte", accompteClientRecu: true }),
      )

      act(() => {
        hook.result.current.handleAccompteClientRecuChange(false)
      })

      expect(handleInputChange).toHaveBeenCalledWith("accompteClientRecu", false)
      expect(handleInputChange).toHaveBeenCalledWith("statut_id", "s-att")
    })

    it("unchecking when statut is not ACCEPTE leaves statut untouched", () => {
      const { hook, handleInputChange } = setup(
        makeFormData({ statut_id: "s-att", accompteClientRecu: true }),
      )

      act(() => {
        hook.result.current.handleAccompteClientRecuChange(false)
      })

      expect(handleInputChange).toHaveBeenCalledWith("accompteClientRecu", false)
      expect(handleInputChange).not.toHaveBeenCalledWith("statut_id", expect.anything())
    })
  })

  describe("handleAccompteSSTRecuChange", () => {
    it("auto-fills today's date when checking with empty date", () => {
      const { hook, handleInputChange } = setup(
        makeFormData({ dateAccompteSSTRecu: "" }),
      )

      act(() => {
        hook.result.current.handleAccompteSSTRecuChange(true)
      })

      expect(handleInputChange).toHaveBeenCalledWith("accompteSSTRecu", true)
      expect(handleInputChange).toHaveBeenCalledWith("dateAccompteSSTRecu", "2026-04-12")
    })

    it("preserves an existing date when checking", () => {
      const { hook, handleInputChange } = setup(
        makeFormData({ dateAccompteSSTRecu: "2026-03-01" }),
      )

      act(() => {
        hook.result.current.handleAccompteSSTRecuChange(true)
      })

      expect(handleInputChange).toHaveBeenCalledWith("accompteSSTRecu", true)
      expect(handleInputChange).not.toHaveBeenCalledWith(
        "dateAccompteSSTRecu",
        expect.anything(),
      )
    })

    it("clears the date when unchecking", () => {
      const { hook, handleInputChange } = setup(
        makeFormData({ dateAccompteSSTRecu: "2026-03-01" }),
      )

      act(() => {
        hook.result.current.handleAccompteSSTRecuChange(false)
      })

      expect(handleInputChange).toHaveBeenCalledWith("accompteSSTRecu", false)
      expect(handleInputChange).toHaveBeenCalledWith("dateAccompteSSTRecu", "")
    })

    it("never triggers a status transition", () => {
      const { hook, handleInputChange } = setup(
        makeFormData({ statut_id: "s-accepte" }),
      )

      act(() => {
        hook.result.current.handleAccompteSSTRecuChange(true)
      })

      expect(handleInputChange).not.toHaveBeenCalledWith("statut_id", expect.anything())
    })
  })
})
