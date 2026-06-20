import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import React from "react"

const mockRpc = vi.fn()
vi.mock("@/lib/supabase-client", () => ({
  supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
}))

import { useTeamConnections } from "@/hooks/useTeamConnections"

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

const startDate = new Date("2026-06-01T00:00:00.000Z")
const endDate = new Date("2026-06-30T23:59:59.999Z")

const mockConnections = [
  {
    user_id: "u1",
    firstname: "Jean",
    lastname: "Dupont",
    color: "#fff",
    avatar_url: null,
    code_gestionnaire: "GES-1",
    days: [
      {
        date: "2026-06-15",
        first_seen_at: "2026-06-15T08:00:00Z",
        last_seen_at: "2026-06-15T18:00:00Z",
        total_screen_time_ms: 36_000_000,
        sessions: [],
      },
    ],
  },
]

describe("useTeamConnections", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRpc.mockResolvedValue({ data: mockConnections, error: null })
  })

  it("appelle get_team_connections avec les dates (YYYY-MM-DD) et sans filtre", async () => {
    const { result } = renderHook(() => useTeamConnections(startDate, endDate), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockRpc).toHaveBeenCalledWith("get_team_connections", {
      p_date_start: "2026-06-01",
      p_date_end: "2026-06-30",
      p_user_ids: null,
    })
    expect(result.current.data).toHaveLength(1)
    expect(result.current.data?.[0].days[0].first_seen_at).toBe("2026-06-15T08:00:00Z")
  })

  it("transmet les gestionnaires sélectionnés via p_user_ids", async () => {
    const { result } = renderHook(() => useTeamConnections(startDate, endDate, ["u1"]), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockRpc).toHaveBeenCalledWith(
      "get_team_connections",
      expect.objectContaining({ p_user_ids: ["u1"] })
    )
  })

  it("ne déclenche pas la requête quand enabled est false", () => {
    renderHook(() => useTeamConnections(startDate, endDate, null, false), {
      wrapper: createWrapper(),
    })
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it("remonte les erreurs RPC", async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: "forbidden" } })

    const { result } = renderHook(() => useTeamConnections(startDate, endDate), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})
