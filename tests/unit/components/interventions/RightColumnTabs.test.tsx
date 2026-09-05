import React from "react"
// Vitest (legacy JSX runtime) requiert React sur le scope global
globalThis.React = React
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"

import { RightColumnTabs } from "@/components/interventions/report-panel/RightColumnTabs"

/**
 * Réplique du contexte réel : la colonne de droite descend d'un
 * `<fieldset disabled className="pointer-events-none">` dès qu'un autre
 * utilisateur est l'éditeur actif de l'intervention.
 */
function renderInReadOnlyFieldset(value: "infos" | "report" = "infos") {
  const onChange = vi.fn()
  const utils = render(
    <fieldset disabled className="pointer-events-none select-none">
      <RightColumnTabs value={value} onChange={onChange} />
    </fieldset>,
  )
  return { ...utils, onChange }
}

describe("RightColumnTabs", () => {
  it("should expose two tabs and mark the active one", () => {
    render(<RightColumnTabs value="report" onChange={vi.fn()} />)
    const tabs = screen.getAllByRole("tab")
    expect(tabs).toHaveLength(2)
    expect(tabs[0]).toHaveAttribute("aria-selected", "false")
    expect(tabs[1]).toHaveAttribute("aria-selected", "true")
  })

  it("should never use <button> for the tabs (a disabled fieldset would kill them)", () => {
    renderInReadOnlyFieldset()
    for (const tab of screen.getAllByRole("tab")) {
      expect(tab.tagName).toBe("DIV")
    }
  })

  it("should keep pointer events on the bar even under pointer-events-none", () => {
    const { container } = renderInReadOnlyFieldset()
    const bar = container.querySelector("[role='tablist']")?.parentElement
    // Le fieldset porte pointer-events-none : sans ce rappel explicite,
    // la barre serait incliquable en lecture seule.
    expect(bar?.className).toContain("pointer-events-auto")
  })

  it("should stay clickable in read-only mode", () => {
    const { onChange } = renderInReadOnlyFieldset()
    fireEvent.click(screen.getAllByRole("tab")[1])
    expect(onChange).toHaveBeenCalledWith("report")
  })

  it("should be reachable with the keyboard", () => {
    const { onChange } = renderInReadOnlyFieldset()
    const [infos, report] = screen.getAllByRole("tab")

    expect(infos).toHaveAttribute("tabindex", "0")
    fireEvent.keyDown(report, { key: "Enter" })
    expect(onChange).toHaveBeenCalledWith("report")

    fireEvent.keyDown(report, { key: "ArrowRight" })
    expect(onChange).toHaveBeenLastCalledWith("report")
    fireEvent.keyDown(report, { key: "ArrowLeft" })
    expect(onChange).toHaveBeenLastCalledWith("infos")
  })

  it("should show the pending-report dot only when a report is waiting", () => {
    const { rerender } = render(<RightColumnTabs value="infos" onChange={vi.fn()} />)
    expect(screen.queryByLabelText("Rapport à vérifier")).not.toBeInTheDocument()

    rerender(<RightColumnTabs value="infos" onChange={vi.fn()} hasPendingReport />)
    expect(screen.getByLabelText("Rapport à vérifier")).toBeInTheDocument()
  })
})
