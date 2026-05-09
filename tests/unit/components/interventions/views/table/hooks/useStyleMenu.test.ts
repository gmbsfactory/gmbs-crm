import { describe, it, expect, vi, beforeEach } from "vitest"
import { act, renderHook } from "@testing-library/react"
import { useStyleMenu } from "@/components/interventions/views/table/hooks/useStyleMenu"

const makeEvent = (clientX = 100, clientY = 100) =>
  ({
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    clientX,
    clientY,
  }) as unknown as React.MouseEvent

describe("useStyleMenu", () => {
  beforeEach(() => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1280 })
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 })
  })

  it("starts closed", () => {
    const { result } = renderHook(() => useStyleMenu("view-1"))
    expect(result.current.styleMenu).toBeNull()
  })

  it("opens at the clamped event position", () => {
    const { result } = renderHook(() => useStyleMenu("view-1"))
    act(() => result.current.openStyleMenu(makeEvent(500, 200), "agence"))
    expect(result.current.styleMenu).toEqual({ property: "agence", x: 500, y: 200 })
  })

  it("clamps x/y so the panel stays inside the viewport", () => {
    const { result } = renderHook(() => useStyleMenu("view-1"))
    act(() => result.current.openStyleMenu(makeEvent(2000, 2000), "agence"))
    const menu = result.current.styleMenu!
    expect(menu.x).toBeLessThanOrEqual(1280 - 420 - 12)
    expect(menu.y).toBeLessThanOrEqual(800 - 120 - 12)
  })

  it("does nothing when disabled", () => {
    const { result } = renderHook(() => useStyleMenu("view-1", false))
    act(() => result.current.openStyleMenu(makeEvent(), "agence"))
    expect(result.current.styleMenu).toBeNull()
  })

  it("closes via closeStyleMenu()", () => {
    const { result } = renderHook(() => useStyleMenu("view-1"))
    act(() => result.current.openStyleMenu(makeEvent(), "agence"))
    act(() => result.current.closeStyleMenu())
    expect(result.current.styleMenu).toBeNull()
  })

  it("closes on Escape", () => {
    const { result } = renderHook(() => useStyleMenu("view-1"))
    act(() => result.current.openStyleMenu(makeEvent(), "agence"))
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }))
    })
    expect(result.current.styleMenu).toBeNull()
  })

  it("resets when viewId changes", () => {
    const { result, rerender } = renderHook(({ id }) => useStyleMenu(id), {
      initialProps: { id: "view-1" },
    })
    act(() => result.current.openStyleMenu(makeEvent(), "agence"))
    expect(result.current.styleMenu).not.toBeNull()
    rerender({ id: "view-2" })
    expect(result.current.styleMenu).toBeNull()
  })
})
