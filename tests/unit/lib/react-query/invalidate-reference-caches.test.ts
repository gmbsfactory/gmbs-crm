import { describe, it, expect, vi, beforeEach } from "vitest"
import type { QueryClient } from "@tanstack/react-query"
import { invalidateReferenceCaches } from "@/lib/react-query/invalidate-reference-caches"
import { referenceKeys } from "@/lib/react-query/queryKeys"

describe("invalidateReferenceCaches", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should invalidate the shared reference cache and legacy filter keys", async () => {
    const invalidateQueries = vi.fn().mockResolvedValue(undefined)
    const queryClient = { invalidateQueries } as unknown as QueryClient

    await invalidateReferenceCaches(queryClient)

    // Cache partagé (useReferenceDataQuery) : artisans, formulaires, modals…
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: referenceKeys.invalidateAll(),
      refetchType: "all",
    })
    // Clés legacy isolées du FilterBar admin
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["metiers"],
      refetchType: "all",
    })
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["agences"],
      refetchType: "all",
    })
    expect(invalidateQueries).toHaveBeenCalledTimes(3)
  })

  it("should force refetchType 'all' on every key (bypasses refetchOnMount:false)", async () => {
    const invalidateQueries = vi.fn().mockResolvedValue(undefined)
    const queryClient = { invalidateQueries } as unknown as QueryClient

    await invalidateReferenceCaches(queryClient)

    for (const call of invalidateQueries.mock.calls) {
      expect(call[0]).toMatchObject({ refetchType: "all" })
    }
  })

  it("should propagate an error if an invalidation fails", async () => {
    const invalidateQueries = vi.fn().mockRejectedValue(new Error("boom"))
    const queryClient = { invalidateQueries } as unknown as QueryClient

    await expect(invalidateReferenceCaches(queryClient)).rejects.toThrow("boom")
  })
})
