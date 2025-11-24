import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { QueryClient } from "@tanstack/react-query"
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js"
import type { Intervention, PaginatedResponse } from "@/lib/api/v2/common/types"
import { interventionKeys } from "@/lib/react-query/queryKeys"
import { syncCacheWithRealtimeEvent } from "@/lib/realtime/cache-sync"

const mockedToasts = vi.hoisted(() => ({
  toastInfo: vi.fn(),
  toastWarning: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock("sonner", () => ({
  toast: {
    info: mockedToasts.toastInfo,
    warning: mockedToasts.toastWarning,
    error: mockedToasts.toastError,
  },
}))

vi.mock("@/lib/reference-api", () => ({
  referenceApi: {
    getAll: vi.fn().mockResolvedValue({
      users: [],
      agencies: [],
      interventionStatuses: [],
      metiers: [],
    }),
  },
}))

vi.mock("@/lib/api/v2/common/utils", () => ({
  mapInterventionRecord: (record: Intervention) => record,
}))

const { toastInfo, toastWarning, toastError } = mockedToasts

describe("syncCacheWithRealtimeEvent", () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    toastInfo.mockReset()
    toastWarning.mockReset()
    toastError.mockReset()
  })

  afterEach(() => {
    queryClient.clear()
  })

  it("inserts a new intervention when it matches the active filters", async () => {
    const filters = { user: "user-1", statut: "EN_COURS", limit: 20, offset: 0 }
    const listKey = interventionKeys.list(filters)
    queryClient.setQueryData(listKey, createPaginatedResponse([]))

    const payload = createPayload("INSERT", {
      new: makeIntervention({ id: "int-insert", assigned_user_id: "user-1", statut_id: "EN_COURS" }),
    })

    await syncCacheWithRealtimeEvent(queryClient, payload, "user-1")

    const result = queryClient.getQueryData(listKey) as PaginatedResponse<Intervention>
    expect(result.data).toHaveLength(1)
    expect(result.data[0].id).toBe("int-insert")
  })

  it("retire une intervention d'une vue lorsque les filtres ne correspondent plus", async () => {
    const filters = { user: "user-1", statut: "EN_COURS", limit: 20, offset: 0 }
    const listKey = interventionKeys.list(filters)
    const record = makeIntervention({ id: "int-update", assigned_user_id: "user-1" })
    queryClient.setQueryData(listKey, createPaginatedResponse([record]))

    const payload = createPayload("UPDATE", {
      old: record,
      new: { ...record, assigned_user_id: "user-9" },
    })

    await syncCacheWithRealtimeEvent(queryClient, payload, "user-1")

    const result = queryClient.getQueryData(listKey) as PaginatedResponse<Intervention>
    expect(result.data).toHaveLength(0)
  })

  it("gère la perte d'accès (payload.new manquant) en nettoyant le cache et en affichant une notification", async () => {
    const filters = { user: "user-1", statut: "EN_COURS", limit: 20, offset: 0 }
    const listKey = interventionKeys.list(filters)
    const record = makeIntervention({ id: "int-rls" })
    queryClient.setQueryData(listKey, createPaginatedResponse([record]))
    queryClient.setQueryData(interventionKeys.detail(record.id), record)

    const payload = createPayload("UPDATE", {
      old: record,
      new: null,
    })

    await syncCacheWithRealtimeEvent(queryClient, payload, "user-1")

    const listData = queryClient.getQueryData(listKey) as PaginatedResponse<Intervention>
    expect(listData.data).toHaveLength(0)
    expect(queryClient.getQueryData(interventionKeys.detail(record.id))).toBeUndefined()

    expect(toastError).toHaveBeenCalledWith(
      "Accès retiré",
      expect.objectContaining({
        description: expect.stringContaining("Vous n'avez plus accès"),
      }),
    )
  })
})

function createPaginatedResponse(data: Intervention[]): PaginatedResponse<Intervention> {
  return {
    data,
    pagination: {
      limit: 20,
      offset: 0,
      total: data.length,
      hasMore: false,
    },
  }
}

function createPayload(
  eventType: "INSERT" | "UPDATE" | "DELETE",
  data: { new?: Intervention | null; old?: Intervention | null },
): RealtimePostgresChangesPayload<Intervention> {
  return {
    commit_timestamp: "2025-01-01T00:00:00Z",
    errors: null,
    schema: "public",
    table: "interventions",
    eventType,
    new: data.new ?? null,
    old: data.old ?? null,
  } as RealtimePostgresChangesPayload<Intervention>
}

const baseIntervention: Intervention = {
  id: "int-base",
  id_inter: null,
  agence_id: "agency-1",
  reference_agence: null,
  tenant_id: null,
  owner_id: null,
  client_id: null,
  artisan_id: "artisan-1",
  assigned_user_id: "user-1",
  updated_by: "user-2",
  statut_id: "EN_COURS",
  metier_id: "metier-1",
  date: "2025-01-15",
  date_termine: null,
  date_prevue: null,
  due_date: null,
  contexte_intervention: "Installation climatisation",
  consigne_intervention: null,
  consigne_second_artisan: null,
  commentaire_agent: "Urgent client Lyon",
  adresse: "1 rue de Lyon",
  code_postal: "69000",
  ville: "Lyon",
  latitude: null,
  longitude: null,
  numero_sst: null,
  pourcentage_sst: null,
  is_active: true,
  created_at: null,
  updated_at: null,
  artisans: [],
  costs: [],
  payments: [],
  attachments: [],
}

function makeIntervention(overrides: Partial<Intervention> = {}): Intervention {
  return {
    ...baseIntervention,
    ...overrides,
  }
}
