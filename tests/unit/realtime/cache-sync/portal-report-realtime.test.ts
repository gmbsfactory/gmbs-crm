import { describe, expect, it, vi } from "vitest"

/**
 * Portail artisans : la colonne `interventions.has_portal_report` (posée par le trigger
 * trg_artisan_reports_sync_flag) arrive dans le payload UPDATE Realtime de `interventions`.
 * Le badge « À vérifier » doit apparaître dans la liste sans rechargement : l'enrichissement
 * (mapInterventionRecord) doit produire le libellé/couleur, et handleUpdate doit conserver la
 * colonne du record entrant (preserveArtisanDisplayFields ne restaure que l'artisan).
 */
vi.mock("@/lib/supabase-client", () => ({
  getSupabaseBrowserClient: vi.fn(() => ({})),
  supabase: {},
}))
vi.mock("sonner", () => ({ toast: { error: vi.fn(), info: vi.fn(), success: vi.fn() } }))
vi.mock("@/lib/realtime/cache-sync/broadcasting", () => ({
  debouncedRefreshCounts: vi.fn(),
  getBroadcastSync: vi.fn(() => null),
}))
vi.mock("@/lib/realtime/remote-edit-indicator", () => ({
  getRemoteEditIndicatorManager: vi.fn(() => ({ removeIndicator: vi.fn() })),
}))
vi.mock("@/lib/realtime/sync-queue", () => ({
  getSyncQueue: vi.fn(() => ({ dequeueByInterventionId: vi.fn() })),
}))
vi.mock("@/lib/api/common/cache", () => ({
  getReferenceCache: vi.fn(async () => ({
    usersById: new Map(),
    agenciesById: new Map(),
    metiersById: new Map(),
    interventionStatusesById: new Map([
      ["st-en-cours", { id: "st-en-cours", code: "INTER_EN_COURS", label: "Inter en cours", color: "#F59E0B", sort_order: 3 }],
    ]),
  })),
}))

import { enrichRealtimeRecord } from "@/lib/realtime/cache-sync/enrichment"
import { handleUpdate } from "@/lib/realtime/cache-sync/event-handlers"
import { PORTAL_REPORT_REVIEW_COLOR, PORTAL_REPORT_REVIEW_LABEL } from "@/lib/interventions/portal-report-status"
import type { Intervention, PaginatedResponse } from "@/lib/api"

const rawRealtimeRecord = (overrides: Record<string, unknown> = {}) =>
  ({
    id: "int-demo-003",
    id_inter: "DEMO-003",
    agence_id: "agency-1",
    statut_id: "st-en-cours",
    metier_id: null,
    assigned_user_id: null,
    is_active: true,
    updated_at: "2026-09-02T15:00:00Z",
    ...overrides,
  }) as unknown as Intervention

function makeList(data: Intervention[]): PaginatedResponse<Intervention> {
  return { data, pagination: { limit: 100, offset: 0, total: data.length, hasMore: false } }
}

describe("Realtime UPDATE interventions → has_portal_report (badge « À vérifier »)", () => {
  it("enrichit le record avec le libellé et la couleur « À vérifier » quand has_portal_report est vrai", async () => {
    const enriched = (await enrichRealtimeRecord(rawRealtimeRecord({ has_portal_report: true }))) as Intervention & {
      statusLabel?: string | null
      statusColor?: string | null
    }
    expect(enriched.has_portal_report).toBe(true)
    expect(enriched.statusLabel).toBe(PORTAL_REPORT_REVIEW_LABEL)
    expect(enriched.statusColor).toBe(PORTAL_REPORT_REVIEW_COLOR)
  })

  it("revient au libellé du statut quand le rapport est traité (has_portal_report repasse à faux)", async () => {
    const enriched = (await enrichRealtimeRecord(rawRealtimeRecord({ has_portal_report: false }))) as Intervention & {
      statusLabel?: string | null
      statusColor?: string | null
    }
    expect(enriched.has_portal_report).toBe(false)
    expect(enriched.statusLabel).toBe("Inter en cours")
    expect(enriched.statusColor).toBe("#F59E0B")
  })

  it("normalise une colonne absente/NULL en faux (payload ancien ou colonne non migrée)", async () => {
    const enriched = await enrichRealtimeRecord(rawRealtimeRecord())
    expect(enriched.has_portal_report).toBe(false)
  })

  it("handleUpdate garde has_portal_report du record entrant, même en restaurant l'artisan du cache", async () => {
    const cached = {
      ...(await enrichRealtimeRecord(rawRealtimeRecord({ has_portal_report: false }))),
      artisan: "Karim Benali",
      primaryArtisan: { id: "artisan-karim", nom: "Benali", prenom: "Karim" },
      artisans: ["artisan-karim"],
    } as Intervention
    const incoming = await enrichRealtimeRecord(rawRealtimeRecord({ has_portal_report: true }))

    // Liste sans filtres (vue par défaut) et liste de recherche (mise à jour en place) :
    // dans les deux cas la ligne reste et porte la colonne du record entrant.
    for (const filters of [undefined, { search: "DEMO-003" }]) {
      const next = handleUpdate(makeList([cached]), cached, incoming, filters)
      const row = next.data[0] as Intervention & { statusLabel?: string | null; artisan?: string | null }

      expect(next.data).toHaveLength(1)
      expect(row.has_portal_report).toBe(true)
      expect(row.statusLabel).toBe(PORTAL_REPORT_REVIEW_LABEL)
      expect(row.artisan).toBe("Karim Benali")
    }
  })
})
