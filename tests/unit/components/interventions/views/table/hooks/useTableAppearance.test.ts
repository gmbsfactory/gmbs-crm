import { describe, it, expect } from "vitest"
import { renderHook } from "@testing-library/react"
import { useTableAppearance } from "@/components/interventions/views/table/hooks/useTableAppearance"
import type { TableLayoutOptions } from "@/types/intervention-views"

const baseOptions = (overrides: Partial<TableLayoutOptions> = {}): TableLayoutOptions =>
  ({ ...overrides }) as TableLayoutOptions

describe("useTableAppearance", () => {
  it("applies sensible defaults when layoutOptions is empty", () => {
    const { result } = renderHook(() => useTableAppearance(baseOptions()))
    expect(result.current.rowDensity).toBe("default")
    expect(result.current.rowHeight).toBe(48)
    expect(result.current.densityTableClass).toBe("text-sm")
    expect(result.current.densityHeaderClass).toBeUndefined()
    expect(result.current.densityCellClass).toBe("py-3")
    expect(result.current.statusBorderEnabled).toBe(false)
    expect(result.current.coloredShadow).toBe(false)
    expect(result.current.useAccentColor).toBe(false)
    expect(result.current.rowDisplayMode).toBe("stripes")
    expect(result.current.tableInlineStyle).toEqual({})
  })

  it("derives ultra-dense classes and row height", () => {
    const { result } = renderHook(() =>
      useTableAppearance(baseOptions({ rowDensity: "ultra-dense" })),
    )
    expect(result.current.rowHeight).toBe(37)
    expect(result.current.densityTableClass).toBe("text-xs")
    expect(result.current.densityHeaderClass).toBe("!h-8 !py-1.5 !pl-2.5 !pr-2.5")
    expect(result.current.densityCellClass).toBe("!py-1.5 !pl-2.5 !pr-2.5")
  })

  it("falls back to dense when only legacy `dense: true` is set", () => {
    const { result } = renderHook(() => useTableAppearance(baseOptions({ dense: true })))
    expect(result.current.rowDensity).toBe("dense")
    expect(result.current.rowHeight).toBe(40)
  })

  it("emits CSS custom properties when status border is enabled", () => {
    const { result } = renderHook(() =>
      useTableAppearance(baseOptions({ showStatusBorder: true, statusBorderSize: "m" })),
    )
    expect(result.current.statusBorderEnabled).toBe(true)
    expect(result.current.tableInlineStyle["--table-status-border-width"]).toBe(
      result.current.statusBorderWidthPx,
    )
  })

  it("emits gradient + accent custom properties when enabled", () => {
    const { result } = renderHook(() =>
      useTableAppearance(baseOptions({ rowDisplayMode: "gradient", useAccentColor: true })),
    )
    expect(result.current.tableInlineStyle["--use-gradient-mode"]).toBe("1")
    expect(result.current.tableInlineStyle["--use-accent-color"]).toBe("1")
  })

  it("emits shadow intensity custom properties when coloredShadow is on", () => {
    const { result } = renderHook(() =>
      useTableAppearance(baseOptions({ coloredShadow: true, shadowIntensity: "normal" })),
    )
    expect(result.current.tableInlineStyle["--shadow-intensity-strong"]).toMatch(/%$/)
    expect(result.current.tableInlineStyle["--shadow-intensity-soft"]).toMatch(/%$/)
  })
})
