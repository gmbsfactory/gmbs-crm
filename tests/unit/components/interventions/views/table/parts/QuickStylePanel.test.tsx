import React, { useRef } from "react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { QuickStylePanel } from "@/components/interventions/views/table/parts/QuickStylePanel"

vi.mock("@/types/property-schema", () => ({
  getPropertyLabel: (k: string) => `LABEL:${k}`,
  getPropertySchema: (k: string) => (k === "agence" ? { sortable: true } : { sortable: false }),
}))
vi.mock("@/lib/interventions/column-style", () => ({
  STYLE_ELIGIBLE_COLUMNS: new Set(["agence"]),
  TABLE_APPEARANCE_OPTIONS: [{ value: "solid", label: "Solid" }, { value: "none", label: "None" }],
  TABLE_TEXT_SIZE_OPTIONS: [{ value: "md", label: "MD" }],
}))
vi.mock("../../../../../../src/components/interventions/views/column-alignment-options", () => ({
  TABLE_ALIGNMENT_OPTIONS: [
    { value: "left", icon: () => null, label: "Left" },
    { value: "center", icon: () => null, label: "Center" },
    { value: "right", icon: () => null, label: "Right" },
  ],
}))

const Harness = (overrides: Partial<React.ComponentProps<typeof QuickStylePanel>> = {}) => {
  const panelRef = useRef<HTMLDivElement>(null)
  const props: React.ComponentProps<typeof QuickStylePanel> = {
    panelRef,
    position: { x: 100, y: 100 },
    property: "agence",
    styleEntry: {},
    alignment: "center",
    sorts: [],
    onClose: vi.fn(),
    onApplyStyle: vi.fn(),
    onApplyAlignment: vi.fn(),
    onSortChange: vi.fn(),
    ...overrides,
  }
  return <QuickStylePanel {...props} />
}

describe("QuickStylePanel", () => {
  beforeEach(() => vi.clearAllMocks())

  it("calls onClose when the close button is clicked", () => {
    const onClose = vi.fn()
    render(<Harness onClose={onClose} />)
    fireEvent.click(screen.getByLabelText("Fermer le style rapide"))
    expect(onClose).toHaveBeenCalled()
  })

  it("toggles bold via onApplyStyle", () => {
    const onApplyStyle = vi.fn()
    render(<Harness onApplyStyle={onApplyStyle} styleEntry={{ bold: false }} />)
    fireEvent.click(screen.getByLabelText("Basculer en gras (LABEL:agence)"))
    expect(onApplyStyle).toHaveBeenCalledWith("agence", expect.any(Function))
    const updater = onApplyStyle.mock.calls[0][1]
    expect(updater({ bold: false })).toEqual({ bold: true })
  })

  it("renders sort controls only for sortable properties", () => {
    const { rerender } = render(<Harness property="agence" />)
    expect(screen.getByLabelText(/Tri croissant/)).toBeTruthy()
    rerender(<Harness property="non_sortable" />)
    expect(screen.queryByLabelText(/Tri croissant/)).toBeNull()
  })

  it("toggles sort off when re-clicking the active direction", () => {
    const onSortChange = vi.fn()
    render(
      <Harness
        sorts={[{ property: "agence", direction: "asc" }]}
        onSortChange={onSortChange}
      />,
    )
    fireEvent.click(screen.getByLabelText(/Tri croissant/))
    expect(onSortChange).toHaveBeenCalledWith([])
  })

  it("sets a new direction when clicking the inactive arrow", () => {
    const onSortChange = vi.fn()
    render(<Harness sorts={[]} onSortChange={onSortChange} />)
    fireEvent.click(screen.getByLabelText(/Tri décroissant/))
    expect(onSortChange).toHaveBeenCalledWith([{ property: "agence", direction: "desc" }])
  })
})
