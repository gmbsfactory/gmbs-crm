import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"

import { DEFAULT_WORKFLOW_CONFIG } from "@/config/interventions"
import { useWorkflowConfig } from "@/hooks/useWorkflowConfig"
import { validateTransition } from "@/lib/workflow-engine"

describe("Workflow configuration", () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it("allows admin to add a new status", () => {
    const { result } = renderHook(() => useWorkflowConfig())

    act(() => {
      result.current.addStatus({ key: "NOUVEAU_STATUT", label: "Nouveau statut", color: "#ff0000" })
    })

    expect(result.current.workflow.statuses.some((status) => status.key === "NOUVEAU_STATUT")).toBe(true)
  })

  it("validates transition requirements", () => {
    const validation = validateTransition(DEFAULT_WORKFLOW_CONFIG, "INTER_EN_COURS", "INTER_TERMINEE", {
      id: "intervention-1",
      artisanId: null,
      factureId: null,
      proprietaireId: null,
      commentaire: "",
    })

    expect(validation.canTransition).toBe(false)
    // Le status INTER_TERMINEE requiert artisan, facture et proprietaire
    expect(validation.missingRequirements).toEqual(
      expect.arrayContaining(["artisanId", "factureId", "proprietaireId"]),
    )
  })
})
