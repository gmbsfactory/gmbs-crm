import { renderHook, act } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { useInterventionAccomptes } from "@/hooks/useInterventionAccomptes"
import type { InterventionFormData } from "@/lib/interventions/form-types"

vi.mock("@/lib/api/v2", () => ({
  interventionsApi: {
    upsertPayment: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock("sonner", () => ({
  toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() },
}))

import { interventionsApi } from "@/lib/api/v2"

const STATUSES = [
  { id: "s-accepte", code: "ACCEPTE", label: "Accepté" },
  { id: "s-att", code: "ATT_ACOMPTE", label: "Attente acompte" },
]

const INTERVENTION_ID = "int-1"

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
      interventionId: INTERVENTION_ID,
      formData,
      interventionStatuses: STATUSES,
      handleInputChange,
    }),
  )
  return { hook, handleInputChange }
}

describe("useInterventionAccomptes", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 3, 12, 10, 0, 0))
    vi.clearAllMocks()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  describe("handleAccompteClientRecuChange", () => {
    it("auto-fills today's date and transitions to ACCEPTE when checking with empty date", async () => {
      const { hook, handleInputChange } = setup(
        makeFormData({ statut_id: "s-att", dateAccompteClientRecu: "" }),
      )

      await act(async () => {
        await hook.result.current.handleAccompteClientRecuChange(true)
      })

      // Statut transition persisted first
      expect(interventionsApi.update).toHaveBeenCalledWith(INTERVENTION_ID, {
        statut_id: "s-accepte",
      })
      // Payment upsert with auto-filled date
      expect(interventionsApi.upsertPayment).toHaveBeenCalledWith(INTERVENTION_ID, {
        payment_type: "acompte_client",
        is_received: true,
        payment_date: "2026-04-12",
      })
      // Both fields propagated to form state
      expect(handleInputChange).toHaveBeenCalledWith("accompteClientRecu", true)
      expect(handleInputChange).toHaveBeenCalledWith("dateAccompteClientRecu", "2026-04-12")
    })

    it("preserves an existing date when checking", async () => {
      const { hook, handleInputChange } = setup(
        makeFormData({ statut_id: "s-att", dateAccompteClientRecu: "2026-03-01" }),
      )

      await act(async () => {
        await hook.result.current.handleAccompteClientRecuChange(true)
      })

      expect(interventionsApi.upsertPayment).toHaveBeenCalledWith(INTERVENTION_ID, {
        payment_type: "acompte_client",
        is_received: true,
        payment_date: "2026-03-01",
      })
      // No date update needed since unchanged
      expect(handleInputChange).not.toHaveBeenCalledWith(
        "dateAccompteClientRecu",
        expect.anything(),
      )
    })

    it("clears the date and transitions to ATT_ACOMPTE when unchecking from ACCEPTE", async () => {
      const { hook, handleInputChange } = setup(
        makeFormData({ statut_id: "s-accepte", dateAccompteClientRecu: "2026-03-01" }),
      )

      await act(async () => {
        await hook.result.current.handleAccompteClientRecuChange(false)
      })

      expect(interventionsApi.update).toHaveBeenCalledWith(INTERVENTION_ID, {
        statut_id: "s-att",
      })
      expect(interventionsApi.upsertPayment).toHaveBeenCalledWith(INTERVENTION_ID, {
        payment_type: "acompte_client",
        is_received: false,
        payment_date: null,
      })
      expect(handleInputChange).toHaveBeenCalledWith("accompteClientRecu", false)
      expect(handleInputChange).toHaveBeenCalledWith("dateAccompteClientRecu", "")
    })
  })

  describe("handleAccompteSSTRecuChange", () => {
    it("auto-fills today's date when checking with empty date (no status transition)", async () => {
      const { hook, handleInputChange } = setup(
        makeFormData({ statut_id: "s-accepte", dateAccompteSSTRecu: "" }),
      )

      await act(async () => {
        await hook.result.current.handleAccompteSSTRecuChange(true)
      })

      expect(interventionsApi.update).not.toHaveBeenCalled()
      expect(interventionsApi.upsertPayment).toHaveBeenCalledWith(INTERVENTION_ID, {
        payment_type: "acompte_sst",
        is_received: true,
        payment_date: "2026-04-12",
      })
      expect(handleInputChange).toHaveBeenCalledWith("accompteSSTRecu", true)
      expect(handleInputChange).toHaveBeenCalledWith("dateAccompteSSTRecu", "2026-04-12")
    })

    it("clears the date when unchecking", async () => {
      const { hook, handleInputChange } = setup(
        makeFormData({ statut_id: "s-accepte", dateAccompteSSTRecu: "2026-03-01" }),
      )

      await act(async () => {
        await hook.result.current.handleAccompteSSTRecuChange(false)
      })

      expect(interventionsApi.upsertPayment).toHaveBeenCalledWith(INTERVENTION_ID, {
        payment_type: "acompte_sst",
        is_received: false,
        payment_date: null,
      })
      expect(handleInputChange).toHaveBeenCalledWith("dateAccompteSSTRecu", "")
    })
  })
})
