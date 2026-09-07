import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { isMapViewMode, useMapViewMode } from "@/hooks/useMapViewMode"

const STORAGE_KEY = "gmbs:intervention-form:map-view-mode:user-1"

describe("useMapViewMode", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
  })

  describe("isMapViewMode", () => {
    it("should accept the supported modes", () => {
      expect(isMapViewMode("flat")).toBe(true)
      expect(isMapViewMode("relief")).toBe(true)
    })

    it("should reject anything else", () => {
      expect(isMapViewMode("3d")).toBe(false)
      expect(isMapViewMode(null)).toBe(false)
      expect(isMapViewMode(undefined)).toBe(false)
    })
  })

  it("should fall back to the default mode when nothing is stored", () => {
    const { result } = renderHook(() => useMapViewMode(STORAGE_KEY))

    expect(result.current[0]).toBe("flat")
  })

  it("should honour an explicit default mode", () => {
    const { result } = renderHook(() => useMapViewMode(STORAGE_KEY, "relief"))

    expect(result.current[0]).toBe("relief")
  })

  it("should restore the stored mode on mount", () => {
    window.localStorage.setItem(STORAGE_KEY, "relief")

    const { result } = renderHook(() => useMapViewMode(STORAGE_KEY))

    expect(result.current[0]).toBe("relief")
  })

  it("should persist the mode so it survives the next mount", () => {
    const { result, unmount } = renderHook(() => useMapViewMode(STORAGE_KEY))

    act(() => result.current[1]("relief"))
    expect(result.current[0]).toBe("relief")
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("relief")

    unmount()
    const { result: remounted } = renderHook(() => useMapViewMode(STORAGE_KEY))
    expect(remounted.current[0]).toBe("relief")
  })

  it("should keep preferences separate per storage key", () => {
    const { result } = renderHook(() => useMapViewMode(STORAGE_KEY))
    act(() => result.current[1]("relief"))

    const { result: otherUser } = renderHook(() =>
      useMapViewMode("gmbs:intervention-form:map-view-mode:user-2"),
    )

    expect(otherUser.current[0]).toBe("flat")
  })

  it("should ignore a corrupted stored value", () => {
    window.localStorage.setItem(STORAGE_KEY, "not-a-mode")

    const { result } = renderHook(() => useMapViewMode(STORAGE_KEY))

    expect(result.current[0]).toBe("flat")
  })

  it("should stay usable in memory when no storage key is given", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem")
    const { result } = renderHook(() => useMapViewMode(undefined))

    act(() => result.current[1]("relief"))

    expect(result.current[0]).toBe("relief")
    expect(setItem).not.toHaveBeenCalled()
  })

  it("should not throw when localStorage is unavailable", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("localStorage disabled")
    })
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("localStorage disabled")
    })

    const { result } = renderHook(() => useMapViewMode(STORAGE_KEY))
    expect(result.current[0]).toBe("flat")

    expect(() => act(() => result.current[1]("relief"))).not.toThrow()
    expect(result.current[0]).toBe("relief")
  })
})
