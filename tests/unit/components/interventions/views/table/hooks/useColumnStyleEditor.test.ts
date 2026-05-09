import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook } from "@testing-library/react"
import { useColumnStyleEditor } from "@/components/interventions/views/table/hooks/useColumnStyleEditor"

vi.mock("@/lib/interventions/column-style", () => ({
  // Identity: returns the input unless it has __empty marker (used to test deletion path).
  normalizeColumnStyle: (_property: string, style: any) =>
    style && Object.keys(style).length > 0 && !style.__empty ? style : null,
}))

const setup = (
  columnStyles: Record<string, any> = {},
  columnAlignment: Record<string, any> = {},
) => {
  const onLayoutOptionsChange = vi.fn()
  const { result, rerender } = renderHook(
    ({ s, a }) =>
      useColumnStyleEditor({
        columnStyles: s,
        columnAlignment: a,
        onLayoutOptionsChange,
      }),
    { initialProps: { s: columnStyles, a: columnAlignment } },
  )
  return { result, rerender, onLayoutOptionsChange }
}

describe("useColumnStyleEditor", () => {
  beforeEach(() => vi.clearAllMocks())

  describe("applyColumnStyle", () => {
    it("writes the normalized style under the property key", () => {
      const { result, onLayoutOptionsChange } = setup({})
      result.current.applyColumnStyle("agence", () => ({ bold: true }))
      expect(onLayoutOptionsChange).toHaveBeenCalledWith({
        columnStyles: { agence: { bold: true } },
      })
    })

    it("removes the entry when normalize returns null", () => {
      const { result, onLayoutOptionsChange } = setup({ agence: { bold: true } })
      result.current.applyColumnStyle("agence", () => ({ __empty: true } as any))
      expect(onLayoutOptionsChange).toHaveBeenCalledWith({ columnStyles: {} })
    })

    it("no-ops when onLayoutOptionsChange is undefined", () => {
      const { result } = renderHook(() =>
        useColumnStyleEditor({
          columnStyles: {},
          columnAlignment: {},
          onLayoutOptionsChange: undefined,
        }),
      )
      expect(() => result.current.applyColumnStyle("agence", (p) => p)).not.toThrow()
    })
  })

  describe("applyColumnAlignment", () => {
    it("sets a non-default alignment explicitly", () => {
      const { result, onLayoutOptionsChange } = setup({}, {})
      result.current.applyColumnAlignment("agence", "left")
      expect(onLayoutOptionsChange).toHaveBeenCalledWith({
        columnAlignment: { agence: "left" },
      })
    })

    it("ignores re-selecting the current non-default alignment", () => {
      const { result, onLayoutOptionsChange } = setup({}, { agence: "left" })
      result.current.applyColumnAlignment("agence", "left")
      expect(onLayoutOptionsChange).not.toHaveBeenCalled()
    })

    it("sets center explicitly when previously implicit", () => {
      const { result, onLayoutOptionsChange } = setup({}, {})
      result.current.applyColumnAlignment("agence", "center")
      expect(onLayoutOptionsChange).toHaveBeenCalledWith({
        columnAlignment: { agence: "center" },
      })
    })

    it("toggles off explicit center back to implicit default", () => {
      const { result, onLayoutOptionsChange } = setup({}, { agence: "center" })
      result.current.applyColumnAlignment("agence", "center")
      expect(onLayoutOptionsChange).toHaveBeenCalledWith({ columnAlignment: {} })
    })

    it("switches from one explicit alignment to another", () => {
      const { result, onLayoutOptionsChange } = setup({}, { agence: "left" })
      result.current.applyColumnAlignment("agence", "right")
      expect(onLayoutOptionsChange).toHaveBeenCalledWith({
        columnAlignment: { agence: "right" },
      })
    })
  })
})
