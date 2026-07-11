import { renderHook, act } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { useInterventionAccomptes } from "@/hooks/useInterventionAccomptes"
import type { InterventionFormData } from "@/lib/interventions/form-types"

const STATUSES = [
  { id: "s-accepte", code: "ACCEPTE", label: "Accepté" },
  { id: "s-att", code: "ATT_ACOMPTE", label: "Attente acompte" },
  { id: "s-devis", code: "DEVIS_ENVOYE", label: "Devis envoyé" },
  { id: "s-demande", code: "DEMANDE", label: "Demande" },
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

  describe("gating par statut", () => {
    it.each([
      ["s-devis", true, false],
      ["s-att", true, true],
      ["s-accepte", true, true],
      ["s-demande", false, false],
    ])("statut %s → édition=%s, « Reçu » cochable=%s", (statutId, editable, receivable) => {
      const { hook } = setup(
        makeFormData({ statut_id: statutId as string, accompteClient: "500" }),
      )

      expect(hook.result.current.canEditAccomptes).toBe(editable)
      expect(hook.result.current.canMarkAccompteClientRecu).toBe(receivable)
    })
  })

  describe("gating par montant", () => {
    it("verrouille « Reçu » tant qu'aucun montant client n'est saisi", () => {
      const { hook } = setup(makeFormData({ statut_id: "s-att", accompteClient: "" }))

      expect(hook.result.current.canEditAccomptes).toBe(true)
      expect(hook.result.current.canMarkAccompteClientRecu).toBe(false)
    })

    it("déverrouille « Reçu » sur un acompte saisi à 0", () => {
      const { hook } = setup(makeFormData({ statut_id: "s-att", accompteClient: "0" }))

      expect(hook.result.current.canMarkAccompteClientRecu).toBe(true)
    })

    it("vider le montant décoche « Reçu » et efface sa date", () => {
      const { hook, handleInputChange } = setup(
        makeFormData({
          statut_id: "s-accepte",
          accompteClient: "500",
          accompteClientRecu: true,
          dateAccompteClientRecu: "2026-04-12",
        }),
      )

      act(() => {
        hook.result.current.handleAccompteClientChange("")
      })

      expect(handleInputChange).toHaveBeenCalledWith("accompteClient", "")
      expect(handleInputChange).toHaveBeenCalledWith("accompteClientRecu", false)
      expect(handleInputChange).toHaveBeenCalledWith("dateAccompteClientRecu", "")
    })

    it("passer le montant à 0 ne décoche pas « Reçu »", () => {
      const { hook, handleInputChange } = setup(
        makeFormData({
          statut_id: "s-accepte",
          accompteClient: "500",
          accompteClientRecu: true,
          dateAccompteClientRecu: "2026-04-12",
        }),
      )

      act(() => {
        hook.result.current.handleAccompteClientChange("0")
      })

      expect(handleInputChange).not.toHaveBeenCalledWith("accompteClientRecu", false)
    })
  })

  describe("handleAccompteClientRecuChange", () => {
    it("auto-fills today's date and transitions statut_id to ACCEPTE", () => {
      const { hook, handleInputChange } = setup(
        makeFormData({ statut_id: "s-att", dateAccompteClientRecu: "" }),
      )

      act(() => {
        hook.result.current.handleAccompteClientRecuChange(true)
      })

      expect(handleInputChange).toHaveBeenCalledWith("accompteClientRecu", true)
      expect(handleInputChange).toHaveBeenCalledWith("dateAccompteClientRecu", "2026-04-12")
      expect(handleInputChange).toHaveBeenCalledWith("statut_id", "s-accepte")
    })

    it("preserves an existing date when checking", () => {
      const { hook, handleInputChange } = setup(
        makeFormData({ statut_id: "s-att", dateAccompteClientRecu: "2026-03-01" }),
      )

      act(() => {
        hook.result.current.handleAccompteClientRecuChange(true)
      })

      expect(handleInputChange).not.toHaveBeenCalledWith(
        "dateAccompteClientRecu",
        expect.anything(),
      )
    })

    it("clears the date when unchecking", () => {
      const { hook, handleInputChange } = setup(
        makeFormData({ statut_id: "s-accepte", accompteClientRecu: true, dateAccompteClientRecu: "2026-03-01" }),
      )

      act(() => {
        hook.result.current.handleAccompteClientRecuChange(false)
      })

      expect(handleInputChange).toHaveBeenCalledWith("dateAccompteClientRecu", "")
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
