import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { renderStatusCell } from "@/components/interventions/views/table/cells/StatusCell"
import type { InterventionView } from "@/types/intervention-view"

/**
 * Signal « Démarré · n champs manquants » en LISTE (spec §7.7, lot L2 point 7).
 *
 * Même mécanique que le badge « À vérifier » : le libellé et la couleur
 * viennent de `getStatusDisplay`, donc de `src/lib/interventions/`, et la
 * cellule ne redéclare rien.
 */
const DEMARRE = "2026-09-12T08:40:00.000Z"

function cell(over: Record<string, unknown>) {
  return renderStatusCell({
    intervention: {
      id: "i-1",
      statusValue: "ACCEPTE",
      status: { id: "s-1", code: "ACCEPTE", label: "Accepté", color: "#0EA5E9" },
      ...over,
    } as unknown as InterventionView,
    style: { appearance: "badge" },
    themeMode: "light",
  })
}

describe("renderStatusCell — démarré, statut non avancé", () => {
  it("should show the missing-fields badge in the list", () => {
    const { content } = cell({ portal_work_started_at: DEMARRE, portal_work_missing_count: 3 })
    render(<>{content}</>)
    expect(screen.getByText("Démarré · 3 champs manquants")).toBeInTheDocument()
  })

  it("should paint the badge with the shared amber, never a local colour", () => {
    const { content } = cell({ portal_work_started_at: DEMARRE, portal_work_missing_count: 1 })
    const { container } = render(<>{content}</>)
    const badge = container.querySelector("span[style]") as HTMLElement
    expect(badge.style.backgroundColor).toBe("rgb(217, 119, 6)")
  })

  it("should keep the plain status when nothing was declared", () => {
    const { content } = cell({})
    render(<>{content}</>)
    expect(screen.getByText("Accepté")).toBeInTheDocument()
  })

  it("should keep the plain status once it has advanced", () => {
    const { content } = cell({
      statusValue: "INTER_EN_COURS",
      status: { id: "s-2", code: "INTER_EN_COURS", label: "En cours", color: "#0EA5E9" },
      portal_work_started_at: DEMARRE,
      portal_work_missing_count: 3,
    })
    render(<>{content}</>)
    expect(screen.getByText("En cours")).toBeInTheDocument()
  })

  it("should let a pending report win over the start badge", () => {
    const { content } = cell({
      has_portal_report: true,
      portal_work_started_at: DEMARRE,
      portal_work_missing_count: 3,
    })
    render(<>{content}</>)
    expect(screen.getByText("À vérifier")).toBeInTheDocument()
  })
})
