import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { act, renderHook } from "@testing-library/react"
import { useRef } from "react"
import { useScrollFades } from "@/components/interventions/views/table/hooks/useScrollFades"

const makeScroller = (overrides: Partial<{ scrollTop: number; scrollHeight: number; clientHeight: number }> = {}) => {
  const el = {
    scrollTop: 0,
    scrollHeight: 1000,
    clientHeight: 400,
    ...overrides,
  } as unknown as HTMLElement
  return { current: el }
}

describe("useScrollFades", () => {
  let rafCallbacks: Array<FrameRequestCallback> = []
  let rafId = 0

  beforeEach(() => {
    rafCallbacks = []
    rafId = 0
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      rafCallbacks.push(cb)
      return ++rafId
    })
    vi.stubGlobal("cancelAnimationFrame", () => {
      rafCallbacks = []
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const flush = () => {
    const cbs = rafCallbacks
    rafCallbacks = []
    cbs.forEach((cb) => cb(0))
  }

  it("computes initial fades on mount (top false, bottom true when content overflows)", () => {
    const scrollerRef = makeScroller({ scrollTop: 0, scrollHeight: 2000, clientHeight: 400 })
    const { result } = renderHook(() =>
      useScrollFades({ scrollerRef, rowHeight: 40, recomputeDeps: [10, null] }),
    )
    expect(result.current.showTopFade).toBe(false)
    expect(result.current.showBottomFade).toBe(true)
  })

  it("hides bottom fade when scrolled to the end", () => {
    const scrollerRef = makeScroller({ scrollTop: 1600, scrollHeight: 2000, clientHeight: 400 })
    const { result } = renderHook(() =>
      useScrollFades({ scrollerRef, rowHeight: 40, recomputeDeps: [50, null] }),
    )
    expect(result.current.showTopFade).toBe(true)
    expect(result.current.showBottomFade).toBe(false)
  })

  it("debounces handleScrollWithFades via requestAnimationFrame", () => {
    const scrollerRef = makeScroller({ scrollTop: 0, scrollHeight: 2000, clientHeight: 400 })
    const { result } = renderHook(() =>
      useScrollFades({ scrollerRef, rowHeight: 40, recomputeDeps: [10, null] }),
    )
    flush()

    act(() => {
      result.current.handleScrollWithFades()
      result.current.handleScrollWithFades()
      result.current.handleScrollWithFades()
    })
    expect(rafCallbacks.length).toBe(1)

    ;(scrollerRef.current as any).scrollTop = 500
    act(() => flush())
    expect(result.current.showTopFade).toBe(true)
  })

  it("recomputes when recomputeDeps change", () => {
    const scrollerRef = makeScroller({ scrollTop: 0, scrollHeight: 2000, clientHeight: 400 })
    const { result, rerender } = renderHook(
      ({ deps }) => useScrollFades({ scrollerRef, rowHeight: 40, recomputeDeps: deps }),
      { initialProps: { deps: [10, null] as ReadonlyArray<unknown> } },
    )
    expect(result.current.showTopFade).toBe(false)

    ;(scrollerRef.current as any).scrollTop = 800
    rerender({ deps: [20, "row-1"] })
    expect(result.current.showTopFade).toBe(true)
  })
})
