import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, waitFor, act } from "@testing-library/react"
import React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

// ─── Mocks : client dédié realtime + session + toasts ──────────────────────
const mocks = vi.hoisted(() => {
  const handlers: Record<string, (payload: unknown) => void> = {}
  let statutRappel: ((status: string) => void) | null = null
  const canal = {
    on: vi.fn((_type: string, opts: { table: string }, cb: (p: unknown) => void) => {
      handlers[opts.table] = cb
      return canal
    }),
    subscribe: vi.fn((cb: (status: string) => void) => {
      statutRappel = cb
      cb("SUBSCRIBED")
      return canal
    }),
  }
  const clientDedie = {
    channel: vi.fn(() => canal),
    removeChannel: vi.fn(),
    realtime: { setAuth: vi.fn(), disconnect: vi.fn() },
  }
  return {
    handlers,
    canal,
    clientDedie,
    creerClient: vi.fn(() => clientDedie),
    toastInfo: vi.fn(),
    declencherStatut: (status: string) => statutRappel?.(status),
  }
})

vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.creerClient }))

vi.mock("@/lib/supabase-client", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: { access_token: "jeton-test" } } })),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
  },
}))

vi.mock("sonner", () => ({ toast: { info: mocks.toastInfo } }))

import { usePortalLiveSync } from "@/hooks/usePortalLiveSync"

const ENV_ORIGINE = { ...process.env }

function wrapper(qc: QueryClient) {
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children)
}

/** Monte le hook et attend que le canal soit abonné. */
async function monter() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const invalider = vi.spyOn(qc, "invalidateQueries")
  const vue = renderHook(() => usePortalLiveSync(), { wrapper: wrapper(qc) })
  await waitFor(() => expect(mocks.canal.subscribe).toHaveBeenCalled())
  return { qc, invalider, vue }
}

/** Clés invalidées, aplaties en chaînes comparables. */
function clesInvalidees(invalider: ReturnType<typeof vi.spyOn>) {
  return invalider.mock.calls
    .map((appel) => (appel[0] as { queryKey?: unknown[] })?.queryKey)
    .filter(Boolean)
    .map((cle) => JSON.stringify(cle))
}

const INTERVENTION = "d0000000-0000-4000-8000-000000010003"
const ARTISAN = "d0000000-0000-4000-8000-00000000a001"

describe("usePortalLiveSync", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ shouldAdvanceTime: true })
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321"
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "cle-anon-test"
  })

  afterEach(() => {
    vi.useRealTimers()
    process.env = { ...ENV_ORIGINE }
  })

  it("should s'abonner aux trois tables du portail sur un canal dédié", async () => {
    await monter()
    expect(mocks.creerClient).toHaveBeenCalled()
    expect(mocks.clientDedie.channel).toHaveBeenCalledWith("portail-live")
    const tables = mocks.canal.on.mock.calls.map((appel) => (appel[1] as { table: string }).table)
    expect(tables).toEqual([
      "intervention_attachments",
      "artisan_reports",
      "artisan_attachments",
    ])
  })

  it("should porter le jeton de l'utilisateur sur la connexion dédiée", async () => {
    await monter()
    expect(mocks.clientDedie.realtime.setAuth).toHaveBeenCalledWith("jeton-test")
  })

  it("should invalider les documents et le rapport quand une photo du portail arrive", async () => {
    const { invalider } = await monter()
    invalider.mockClear()

    act(() => {
      mocks.handlers.intervention_attachments({
        eventType: "INSERT",
        new: {
          id: "photo-1",
          intervention_id: INTERVENTION,
          metadata: { source: "portal", phase: "avant" },
        },
      })
      vi.advanceTimersByTime(700)
    })

    const cles = clesInvalidees(invalider)
    expect(cles.some((c) => c.includes("portal-report") && c.includes(INTERVENTION))).toBe(true)
    expect(cles.some((c) => c.includes("documents") && c.includes("intervention"))).toBe(true)
    expect(cles.some((c) => c.includes("list"))).toBe(true)
    expect(mocks.toastInfo).toHaveBeenCalledWith("Nouvelle photo de l'artisan")
  })

  it("should ignorer une pièce jointe déposée depuis le CRM", async () => {
    const { invalider } = await monter()
    invalider.mockClear()

    act(() => {
      mocks.handlers.intervention_attachments({
        eventType: "INSERT",
        new: { id: "doc-crm", intervention_id: INTERVENTION, metadata: { source: "crm" } },
      })
      vi.advanceTimersByTime(700)
    })

    expect(invalider).not.toHaveBeenCalled()
    expect(mocks.toastInfo).not.toHaveBeenCalled()
  })

  it("should annoncer un rapport soumis et rafraîchir les listes", async () => {
    const { invalider } = await monter()
    invalider.mockClear()

    act(() => {
      mocks.handlers.artisan_reports({
        eventType: "INSERT",
        new: {
          id: "rapport-1",
          intervention_id: INTERVENTION,
          artisan_id: ARTISAN,
          status: "submitted",
        },
      })
      vi.advanceTimersByTime(700)
    })

    expect(mocks.toastInfo).toHaveBeenCalledWith("Rapport reçu de l'artisan")
    const cles = clesInvalidees(invalider)
    expect(cles.some((c) => c.includes("portal-report") && c.includes(INTERVENTION))).toBe(true)
  })

  it("should rafraîchir sans annoncer quand le rapport est seulement validé", async () => {
    const { invalider } = await monter()
    invalider.mockClear()

    act(() => {
      mocks.handlers.artisan_reports({
        eventType: "UPDATE",
        new: { intervention_id: INTERVENTION, artisan_id: ARTISAN, status: "approved" },
        old: { status: "submitted" },
      })
      vi.advanceTimersByTime(700)
    })

    expect(mocks.toastInfo).not.toHaveBeenCalled()
    expect(clesInvalidees(invalider).length).toBeGreaterThan(0)
  })

  it("should regrouper plusieurs photos rapprochées en une seule annonce", async () => {
    const { invalider } = await monter()
    invalider.mockClear()

    act(() => {
      for (let i = 0; i < 3; i += 1) {
        mocks.handlers.intervention_attachments({
          eventType: "INSERT",
          new: { id: `photo-${i}`, intervention_id: INTERVENTION, metadata: { source: "portal" } },
        })
      }
      vi.advanceTimersByTime(700)
    })

    expect(mocks.toastInfo).toHaveBeenCalledTimes(1)
    expect(mocks.toastInfo).toHaveBeenCalledWith("3 envois de l'artisan")
  })

  it("should se réabonner après une fermeture de canal", async () => {
    await monter()
    expect(mocks.clientDedie.channel).toHaveBeenCalledTimes(1)

    act(() => {
      mocks.declencherStatut("CLOSED")
      vi.advanceTimersByTime(2100)
    })

    await waitFor(() => expect(mocks.clientDedie.channel).toHaveBeenCalledTimes(2))
    expect(mocks.clientDedie.removeChannel).toHaveBeenCalled()
  })

  it("should fermer la connexion dédiée au démontage", async () => {
    const { vue } = await monter()
    vue.unmount()
    await waitFor(() => expect(mocks.clientDedie.realtime.disconnect).toHaveBeenCalled())
  })

  it("should ne rien faire sans configuration Supabase", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    const qc = new QueryClient()
    renderHook(() => usePortalLiveSync(), { wrapper: wrapper(qc) })
    expect(mocks.clientDedie.channel).not.toHaveBeenCalled()
  })

  it("should ne pas s'abonner quand il est désactivé", async () => {
    const qc = new QueryClient()
    renderHook(() => usePortalLiveSync(false), { wrapper: wrapper(qc) })
    expect(mocks.clientDedie.channel).not.toHaveBeenCalled()
  })
})
