import { beforeEach, describe, expect, it, vi } from "vitest"
import { QueryClient } from "@tanstack/react-query"
import { artisanKeys } from "@/lib/react-query/queryKeys"
import { invalidateArtisanQueries } from "@/lib/react-query/invalidate-artisan-queries"

describe("invalidateArtisanQueries", () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    })
  })

  it("invalidates artisan detail queries for unique IDs", () => {
    const spy = vi.spyOn(queryClient, "invalidateQueries")

    invalidateArtisanQueries(queryClient, ["a1", "a2", "a1", "", null, undefined])

    expect(spy).toHaveBeenCalledWith({
      queryKey: artisanKeys.detail("a1"),
      refetchType: "active",
    })
    expect(spy).toHaveBeenCalledWith({
      queryKey: ["artisan", "a1"],
      refetchType: "active",
    })
    expect(spy).toHaveBeenCalledWith({
      queryKey: artisanKeys.detail("a2"),
      refetchType: "active",
    })
    expect(spy).toHaveBeenCalledWith({
      queryKey: ["artisan", "a2"],
      refetchType: "active",
    })
    expect(spy).toHaveBeenCalledTimes(4)
  })

  it("does nothing when no IDs are provided", () => {
    const spy = vi.spyOn(queryClient, "invalidateQueries")

    invalidateArtisanQueries(queryClient, [])

    expect(spy).not.toHaveBeenCalled()
  })
})
