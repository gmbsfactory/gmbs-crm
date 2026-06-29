import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

// ─── Mock du client Supabase (canal realtime) ──────────────────────────────
const mocks = vi.hoisted(() => {
  const handlers: Record<string, (payload: unknown) => void> = {}
  const mockChannel = {
    on: vi.fn((_type: string, opts: { table: string }, cb: (p: unknown) => void) => {
      handlers[opts.table] = cb
      return mockChannel
    }),
    subscribe: vi.fn(() => mockChannel),
  }
  return { handlers, mockChannel, removeChannel: vi.fn() }
})

vi.mock("@/lib/supabase-client", () => ({
  supabase: {
    channel: vi.fn(() => mocks.mockChannel),
    removeChannel: mocks.removeChannel,
  },
}))

import { useDevMonitoringRealtime } from "@/hooks/useDevMonitoringRealtime"
import { supabase } from "@/lib/supabase-client"

const DEV_KEYS = [
  "global-activity-feed",
  "team-weekly-stats",
  "team-connections",
  "top-entities",
  "activity-heatmap",
  "team-daily-overview",
  "user-daily-activity",
]

function makeWrapper(qc: QueryClient) {
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children)
}

describe("useDevMonitoringRealtime", () => {
  let qc: QueryClient
  let invalidateSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    for (const k of Object.keys(mocks.handlers)) delete mocks.handlers[k]
    qc = new QueryClient()
    invalidateSpy = vi.spyOn(qc, "invalidateQueries").mockImplementation(() => Promise.resolve())
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("s'abonne au canal monitoring-dev-audit sur les deux journaux d'audit", () => {
    renderHook(() => useDevMonitoringRealtime(true), { wrapper: makeWrapper(qc) })

    expect(supabase.channel).toHaveBeenCalledWith("monitoring-dev-audit")
    expect(mocks.mockChannel.on).toHaveBeenCalledWith(
      "postgres_changes",
      expect.objectContaining({ event: "INSERT", table: "intervention_audit_log" }),
      expect.any(Function),
    )
    expect(mocks.mockChannel.on).toHaveBeenCalledWith(
      "postgres_changes",
      expect.objectContaining({ event: "INSERT", table: "artisan_audit_log" }),
      expect.any(Function),
    )
    expect(mocks.mockChannel.subscribe).toHaveBeenCalled()
  })

  it("ne s'abonne pas quand enabled=false", () => {
    renderHook(() => useDevMonitoringRealtime(false), { wrapper: makeWrapper(qc) })
    expect(supabase.channel).not.toHaveBeenCalled()
  })

  it("invalide les requêtes du monitoring-dev (débouncé) sur un INSERT d'audit", async () => {
    renderHook(() => useDevMonitoringRealtime(true), { wrapper: makeWrapper(qc) })

    act(() => {
      mocks.handlers["intervention_audit_log"]?.({ eventType: "INSERT" })
    })
    // Rien tant que le debounce n'a pas expiré
    expect(invalidateSpy).not.toHaveBeenCalled()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(900)
    })

    // Une invalidation par clé de requête dev
    expect(invalidateSpy).toHaveBeenCalledTimes(DEV_KEYS.length)
    for (const k of DEV_KEYS) {
      expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: [k] }))
    }
  })

  it("regroupe une rafale d'événements en un seul refetch (debounce)", async () => {
    renderHook(() => useDevMonitoringRealtime(true), { wrapper: makeWrapper(qc) })

    act(() => {
      mocks.handlers["intervention_audit_log"]?.({})
      mocks.handlers["intervention_audit_log"]?.({})
      mocks.handlers["artisan_audit_log"]?.({})
    })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(900)
    })

    // Un seul tour d'invalidations malgré 3 événements
    expect(invalidateSpy).toHaveBeenCalledTimes(DEV_KEYS.length)
  })

  it("retire le canal et l'écouteur au démontage", () => {
    const { unmount } = renderHook(() => useDevMonitoringRealtime(true), { wrapper: makeWrapper(qc) })
    unmount()
    expect(mocks.removeChannel).toHaveBeenCalledWith(mocks.mockChannel)
  })
})
