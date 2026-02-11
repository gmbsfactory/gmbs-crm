import { describe, it, expect, vi, beforeEach } from "vitest"

/**
 * Tests the non-blocking handleSuccess pattern used by NewInterventionModalContent.
 *
 * The critical behavior:
 *   1. invalidateQueries called with refetchType: 'active' (non-blocking)
 *   2. onClose() called synchronously — modal closes immediately
 *   3. After waitForExit() resolves, invalidateQueries called with refetchType: 'inactive'
 *
 * This matches the optimized pattern in InterventionModalContent (edit flow).
 */

// Reproduce the exact handleSuccess logic from NewInterventionModalContent
// so we can test the ordering without full component rendering
function createHandleSuccess({
  queryClient,
  onClose,
  waitForExit,
  interventionKeys,
}: {
  queryClient: { invalidateQueries: ReturnType<typeof vi.fn> }
  onClose: ReturnType<typeof vi.fn>
  waitForExit: () => Promise<void>
  interventionKeys: { invalidateLists: () => string[]; invalidateLightLists: () => string[] }
}) {
  return async (data: { id: string }) => {
    if (!data?.id) return

    // 1. Non-blocking invalidation of active queries
    queryClient.invalidateQueries({
      queryKey: interventionKeys.invalidateLists(),
      refetchType: "active",
    })
    queryClient.invalidateQueries({
      queryKey: interventionKeys.invalidateLightLists(),
      refetchType: "active",
    })

    // 2. Close modal immediately
    onClose()

    // 3. Wait for animation exit, then invalidate inactive queries
    await waitForExit()
    queryClient.invalidateQueries({ queryKey: interventionKeys.invalidateLists(), refetchType: "inactive" })
    queryClient.invalidateQueries({ queryKey: interventionKeys.invalidateLightLists(), refetchType: "inactive" })
  }
}

describe("NewInterventionModalContent handleSuccess", () => {
  let queryClient: { invalidateQueries: ReturnType<typeof vi.fn> }
  let onClose: ReturnType<typeof vi.fn>
  let resolveWaitForExit: () => void
  let waitForExit: () => Promise<void>
  const interventionKeys = {
    invalidateLists: () => ["interventions", "list"],
    invalidateLightLists: () => ["interventions", "light"],
  }

  beforeEach(() => {
    vi.clearAllMocks()
    queryClient = { invalidateQueries: vi.fn() }
    onClose = vi.fn()
    waitForExit = () =>
      new Promise<void>((resolve) => {
        resolveWaitForExit = resolve
      })
  })

  it("should not proceed when data has no id", async () => {
    const handleSuccess = createHandleSuccess({ queryClient, onClose, waitForExit, interventionKeys })

    await handleSuccess({ id: "" })

    expect(queryClient.invalidateQueries).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it("should call onClose synchronously before waitForExit resolves", async () => {
    const handleSuccess = createHandleSuccess({ queryClient, onClose, waitForExit, interventionKeys })

    // Start the handler (don't await — we want to inspect intermediate state)
    const promise = handleSuccess({ id: "new-1" })

    // Allow microtasks to flush (the sync part of the callback executes)
    await Promise.resolve()

    // onClose should have been called immediately
    expect(onClose).toHaveBeenCalledTimes(1)

    // Active invalidations should have been fired (non-blocking)
    expect(queryClient.invalidateQueries).toHaveBeenCalledTimes(2)
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith(
      expect.objectContaining({ refetchType: "active" }),
    )

    // Resolve the exit animation
    resolveWaitForExit()
    await promise

    // Now inactive invalidations should also have been called
    expect(queryClient.invalidateQueries).toHaveBeenCalledTimes(4)
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith(
      expect.objectContaining({ refetchType: "inactive" }),
    )
  })

  it("should call invalidateQueries for both lists and lightLists with active refetchType", async () => {
    const handleSuccess = createHandleSuccess({ queryClient, onClose, waitForExit, interventionKeys })
    const promise = handleSuccess({ id: "new-2" })
    await Promise.resolve()

    const activeCalls = queryClient.invalidateQueries.mock.calls.filter(
      (call: any[]) => call[0]?.refetchType === "active",
    )
    expect(activeCalls).toHaveLength(2)
    expect(activeCalls[0][0].queryKey).toEqual(["interventions", "list"])
    expect(activeCalls[1][0].queryKey).toEqual(["interventions", "light"])

    resolveWaitForExit()
    await promise
  })

  it("should invalidate inactive queries only after waitForExit resolves", async () => {
    const handleSuccess = createHandleSuccess({ queryClient, onClose, waitForExit, interventionKeys })
    const promise = handleSuccess({ id: "new-3" })
    await Promise.resolve()

    // Before exit resolves: only 2 active invalidations
    const inactiveCallsBefore = queryClient.invalidateQueries.mock.calls.filter(
      (call: any[]) => call[0]?.refetchType === "inactive",
    )
    expect(inactiveCallsBefore).toHaveLength(0)

    // Resolve exit
    resolveWaitForExit()
    await promise

    const inactiveCallsAfter = queryClient.invalidateQueries.mock.calls.filter(
      (call: any[]) => call[0]?.refetchType === "inactive",
    )
    expect(inactiveCallsAfter).toHaveLength(2)
    expect(inactiveCallsAfter[0][0].queryKey).toEqual(["interventions", "list"])
    expect(inactiveCallsAfter[1][0].queryKey).toEqual(["interventions", "light"])
  })

  it("should call onClose BEFORE awaiting waitForExit (ordering guarantee)", async () => {
    const callOrder: string[] = []

    const trackedOnClose = vi.fn(() => callOrder.push("onClose"))
    const trackedWaitForExit = () =>
      new Promise<void>((resolve) => {
        // Simulate animation taking time
        setTimeout(() => {
          callOrder.push("exitComplete")
          resolve()
        }, 0)
      })

    const handleSuccess = createHandleSuccess({
      queryClient,
      onClose: trackedOnClose,
      waitForExit: trackedWaitForExit,
      interventionKeys,
    })

    await handleSuccess({ id: "new-4" })

    expect(callOrder).toEqual(["onClose", "exitComplete"])
  })
})
