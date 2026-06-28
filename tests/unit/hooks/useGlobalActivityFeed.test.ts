import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import React from "react"

const mockRpc = vi.fn()
vi.mock("@/lib/supabase-client", () => ({
  supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
}))

import { useGlobalActivityFeed } from "@/hooks/useGlobalActivityFeed"

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

const startDate = new Date("2026-06-01T00:00:00.000Z")
const endDate = new Date("2026-06-30T23:59:59.999Z")

const mockItems = [
  {
    id: "a1",
    action_type: "CREATE",
    entity_type: "intervention",
    entity_id: "i1",
    entity_label: "REF-1",
    entity_meta: null,
    occurred_at: "2026-06-15T10:00:00Z",
    changed_fields: [],
    old_values: {},
    new_values: {},
    actor: { user_id: "u1", display: "Jean", code: "GES-1", color: "#fff" },
  },
  {
    id: "a2",
    action_type: "UPDATE",
    entity_type: "artisan",
    entity_id: "ar1",
    entity_label: "ACME",
    entity_meta: null,
    occurred_at: "2026-06-14T09:00:00Z",
    changed_fields: ["nom"],
    old_values: {},
    new_values: {},
    actor: { user_id: "u2", display: "Alice", code: "GES-2", color: "#000" },
  },
]

describe("useGlobalActivityFeed", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRpc.mockResolvedValue({ data: { items: mockItems, total: 2 }, error: null })
  })

  it("appelle get_global_activity_feed avec la période et la pagination", async () => {
    const { result } = renderHook(() => useGlobalActivityFeed({ startDate, endDate }), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockRpc).toHaveBeenCalledWith(
      "get_global_activity_feed",
      expect.objectContaining({
        p_date_start: startDate.toISOString(),
        p_date_end: endDate.toISOString(),
        p_user_ids: null,
        p_limit: 100,
        p_offset: 0,
      })
    )
    expect(result.current.data?.pages[0].items).toHaveLength(2)
    expect(result.current.data?.pages[0].total).toBe(2)
  })

  it("transmet les gestionnaires sélectionnés via p_user_ids", async () => {
    const { result } = renderHook(
      () => useGlobalActivityFeed({ startDate, endDate, userIds: ["u1", "u2"] }),
      { wrapper: createWrapper() }
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockRpc).toHaveBeenCalledWith(
      "get_global_activity_feed",
      expect.objectContaining({ p_user_ids: ["u1", "u2"] })
    )
  })

  it("indique une page suivante quand le total dépasse les éléments chargés", async () => {
    mockRpc.mockResolvedValue({ data: { items: mockItems, total: 5 }, error: null })

    const { result } = renderHook(() => useGlobalActivityFeed({ startDate, endDate }), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.hasNextPage).toBe(true)
  })

  it("n'indique plus de page quand tout est chargé", async () => {
    const { result } = renderHook(() => useGlobalActivityFeed({ startDate, endDate }), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.hasNextPage).toBe(false)
  })

  it("ne déclenche pas la requête quand enabled est false", () => {
    renderHook(() => useGlobalActivityFeed({ startDate, endDate, enabled: false }), {
      wrapper: createWrapper(),
    })
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it("remonte les erreurs RPC", async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: "forbidden" } })

    const { result } = renderHook(() => useGlobalActivityFeed({ startDate, endDate }), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})
