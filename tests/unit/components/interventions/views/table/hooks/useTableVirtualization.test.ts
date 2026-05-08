import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook } from "@testing-library/react"
import { useRef } from "react"
import { useTableVirtualization } from "@/components/interventions/views/table/hooks/useTableVirtualization"

vi.mock("@tanstack/react-virtual", () => {
  const measure = vi.fn()
  const scrollToIndex = vi.fn()
  return {
    useVirtualizer: (opts: { count: number; estimateSize: () => number }) => {
      const size = opts.estimateSize()
      const items = Array.from({ length: opts.count }, (_, i) => ({
        index: i,
        key: i,
        start: i * size,
        size,
        end: (i + 1) * size,
        lane: 0,
      }))
      return {
        getVirtualItems: () => items,
        getTotalSize: () => opts.count * size,
        measure,
        scrollToIndex,
      }
    },
  }
})

vi.mock("@/config/interventions", () => ({
  SCROLL_CONFIG: { OVERSCAN: 5 },
}))

const makeScrollerRef = (clientHeight = 200, scrollTop = 0) => {
  const el = { scrollTop, clientHeight } as unknown as HTMLDivElement
  return { current: el }
}

describe("useTableVirtualization", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("builds a stable datasetSignature from page + first/last id + length", () => {
    const scrollerRef = makeScrollerRef()
    const dataset = [{ id: "a" }, { id: "b" }, { id: "c" }]
    const { result } = renderHook(() =>
      useTableVirtualization({ scrollerRef, dataset, rowHeight: 40, currentPage: 2 }),
    )
    expect(result.current.datasetSignature).toBe("2-3-a-c")
  })

  it("falls back to empty signature when dataset is empty", () => {
    const scrollerRef = makeScrollerRef()
    const { result } = renderHook(() =>
      useTableVirtualization({ scrollerRef, dataset: [], rowHeight: 40, currentPage: 7 }),
    )
    expect(result.current.datasetSignature).toBe("empty-7")
  })

  it("returns virtualItems and totalHeight from the virtualizer", () => {
    const scrollerRef = makeScrollerRef()
    const dataset = Array.from({ length: 5 }, (_, i) => ({ id: `id-${i}` }))
    const { result } = renderHook(() =>
      useTableVirtualization({ scrollerRef, dataset, rowHeight: 40, currentPage: 1 }),
    )
    expect(result.current.virtualItems).toHaveLength(5)
    expect(result.current.totalHeight).toBe(200)
  })

  it("computes firstVisible/lastVisible from the viewport", () => {
    const scrollerRef = makeScrollerRef(80, 80) // viewport = 80..160
    const dataset = Array.from({ length: 5 }, (_, i) => ({ id: `id-${i}` }))
    const { result } = renderHook(() =>
      useTableVirtualization({ scrollerRef, dataset, rowHeight: 40, currentPage: 1 }),
    )
    expect(result.current.firstVisible).toBe(2)
    expect(result.current.lastVisible).toBe(3)
  })

  it("calls measure when rowHeight changes", () => {
    const scrollerRef = makeScrollerRef()
    const dataset = [{ id: "a" }]
    const { result, rerender } = renderHook(
      ({ rh }) => useTableVirtualization({ scrollerRef, dataset, rowHeight: rh, currentPage: 1 }),
      { initialProps: { rh: 40 } },
    )
    const measure = result.current.rowVirtualizer.measure as ReturnType<typeof vi.fn>
    measure.mockClear()
    rerender({ rh: 48 })
    expect(measure).toHaveBeenCalledTimes(1)
  })

  it("calls scrollToIndex(0) when currentPage changes", () => {
    const scrollerRef = makeScrollerRef()
    const dataset = [{ id: "a" }, { id: "b" }]
    const rafSpy = vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb: any) => {
      cb(0)
      return 1
    })
    const { result, rerender } = renderHook(
      ({ p }) => useTableVirtualization({ scrollerRef, dataset, rowHeight: 40, currentPage: p }),
      { initialProps: { p: 1 } },
    )
    const scrollToIndex = result.current.rowVirtualizer.scrollToIndex as ReturnType<typeof vi.fn>
    scrollToIndex.mockClear()
    rerender({ p: 2 })
    expect(scrollToIndex).toHaveBeenCalledWith(0, { align: "start" })
    rafSpy.mockRestore()
  })
})
