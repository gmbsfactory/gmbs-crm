import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import type { Intervention } from '@/lib/api/v2/common/types'
import type { CrmEvent, SyncContext } from '@/lib/realtime/event-router/types'
import { STOP } from '@/lib/realtime/event-router/types'
import {
  enrichRecord,
  handleSpecialCases,
  updateListCaches,
  bridgeDetailCache,
  refreshCountsIfNeeded,
} from '@/lib/realtime/event-router/middleware/interventions'

// ─── Mocks ──────────────────────────────────────────────────────────────────────

const mockEnrichRealtimeRecord = vi.fn((r: Intervention) => Promise.resolve({ ...r, enriched: true }))
vi.mock('@/lib/realtime/cache-sync/enrichment', () => ({
  enrichRealtimeRecord: (...args: unknown[]) => mockEnrichRealtimeRecord(...args as [Intervention]),
  getReferenceCache: vi.fn().mockResolvedValue({
    usersById: new Map(),
    agenciesById: new Map(),
    interventionStatusesById: new Map(),
    metiersById: new Map(),
  }),
}))

const mockHandleAccessRevoked = vi.fn()
const mockHandleSoftDelete = vi.fn()
const mockUpdateInterventionQueries = vi.fn().mockReturnValue(0)
vi.mock('@/lib/realtime/cache-sync/event-handlers', () => ({
  handleAccessRevoked: (...args: unknown[]) => mockHandleAccessRevoked(...args),
  handleSoftDelete: (...args: unknown[]) => mockHandleSoftDelete(...args),
  updateInterventionQueries: (...args: unknown[]) => mockUpdateInterventionQueries(...args),
  handleInsert: vi.fn(),
  handleUpdate: vi.fn(),
  handleDelete: vi.fn(),
}))

vi.mock('@/lib/realtime/cache-sync/conflict-detection', () => ({
  detectConflict: vi.fn().mockReturnValue(false),
  showConflictNotification: vi.fn(),
}))

vi.mock('@/lib/realtime/cache-sync/broadcasting', () => ({
  debouncedRefreshCounts: vi.fn(),
}))

vi.mock('@/lib/realtime/remote-edit-indicator', () => ({
  getRemoteEditIndicatorManager: () => ({
    isLocalModification: vi.fn().mockReturnValue(false),
    getLocalUpdatedAt: vi.fn().mockReturnValue(undefined),
    addIndicator: vi.fn(),
  }),
  getUserColor: vi.fn().mockReturnValue('#ff0000'),
  getChangedFields: vi.fn().mockReturnValue([]),
}))

vi.mock('sonner', () => ({
  toast: { info: vi.fn(), warning: vi.fn(), error: vi.fn() },
}))

vi.mock('@/lib/realtime/cache-sync', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    isSoftDelete: (old: Intervention | null, newR: Intervention | null) =>
      old?.is_active === true && newR?.is_active === false,
    shouldRefreshCounts: (eventType: string) =>
      eventType === 'INSERT' || eventType === 'DELETE',
  }
})

// ─── Helpers ────────────────────────────────────────────────────────────────────

const baseIntervention: Intervention = {
  id: 'int-1',
  id_inter: null,
  agence_id: 'agency-1',
  reference_agence: null,
  tenant_id: null,
  owner_id: null,
  client_id: null,
  artisan_id: 'artisan-1',
  assigned_user_id: 'user-1',
  updated_by: 'user-2',
  statut_id: 'EN_COURS',
  metier_id: 'metier-1',
  date: '2025-01-15',
  date_termine: null,
  date_prevue: null,
  due_date: null,
  contexte_intervention: 'Test',
  consigne_intervention: null,
  consigne_second_artisan: null,
  commentaire_agent: null,
  adresse: '1 rue de Lyon',
  code_postal: '69000',
  ville: 'Lyon',
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

function makeEvent(overrides?: Partial<CrmEvent<Intervention>>): CrmEvent<Intervention> {
  return {
    table: 'interventions',
    eventType: 'UPDATE',
    record: { ...baseIntervention },
    previousRecord: { ...baseIntervention },
    meta: { isAccessRevoked: false, isSoftDelete: false, isRemote: true },
    ...overrides,
  }
}

function makeCtx(): SyncContext {
  return {
    queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
    currentUserId: 'user-1',
    options: {},
  }
}

// ─── Tests ──────────────────────────────────────────────────────────────────────

describe('enrichRecord', () => {
  beforeEach(() => vi.clearAllMocks())

  it('enriches event.record via enrichRealtimeRecord', async () => {
    const event = makeEvent({ record: { ...baseIntervention, id: 'enrich-test' } })
    await enrichRecord(event, makeCtx())

    expect(mockEnrichRealtimeRecord).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'enrich-test' })
    )
    expect(event.record).toHaveProperty('enriched', true)
  })

  it('does nothing when record is null', async () => {
    const event = makeEvent({ record: null })
    await enrichRecord(event, makeCtx())

    expect(mockEnrichRealtimeRecord).not.toHaveBeenCalled()
  })
})

describe('handleSpecialCases', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns STOP and calls handleAccessRevoked on access revoked', () => {
    const event = makeEvent({
      record: null,
      previousRecord: { ...baseIntervention, id: 'rls-test' },
      meta: { isAccessRevoked: true, isSoftDelete: false, isRemote: true },
    })
    const ctx = makeCtx()

    const result = handleSpecialCases(event, ctx)

    expect(result).toBe(STOP)
    expect(mockHandleAccessRevoked).toHaveBeenCalledWith(
      ctx.queryClient,
      expect.objectContaining({ id: 'rls-test' }),
      expect.anything()
    )
  })

  it('returns STOP and calls handleSoftDelete on soft delete', () => {
    const event = makeEvent({
      record: { ...baseIntervention, is_active: false },
      previousRecord: { ...baseIntervention, is_active: true },
      meta: { isAccessRevoked: false, isSoftDelete: true, isRemote: true },
    })
    const ctx = makeCtx()

    const result = handleSpecialCases(event, ctx)

    expect(result).toBe(STOP)
    expect(mockHandleSoftDelete).toHaveBeenCalled()
  })

  it('returns void on normal events', () => {
    const event = makeEvent()
    const result = handleSpecialCases(event, makeCtx())

    expect(result).toBeUndefined()
    expect(mockHandleAccessRevoked).not.toHaveBeenCalled()
    expect(mockHandleSoftDelete).not.toHaveBeenCalled()
  })
})

describe('updateListCaches', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls updateInterventionQueries for both lists and lightLists', () => {
    const event = makeEvent({ eventType: 'UPDATE' })
    updateListCaches(event, makeCtx())

    expect(mockUpdateInterventionQueries).toHaveBeenCalledTimes(2)
  })

  it('does nothing on DELETE when record is null but previousRecord is also null', () => {
    const event = makeEvent({ eventType: 'INSERT', record: null })
    updateListCaches(event, makeCtx())

    // Should not call because record is null and eventType is not DELETE
    expect(mockUpdateInterventionQueries).not.toHaveBeenCalled()
  })
})

describe('bridgeDetailCache', () => {
  it('invalidates detail query for INSERT/UPDATE when record exists', () => {
    const ctx = makeCtx()
    const invalidateSpy = vi.spyOn(ctx.queryClient, 'invalidateQueries')

    const event = makeEvent({ eventType: 'UPDATE', record: { ...baseIntervention, id: 'detail-test' } })
    bridgeDetailCache(event, ctx)

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: expect.arrayContaining(['interventions', 'detail', 'detail-test']),
        refetchType: 'active',
      })
    )
  })

  it('does nothing when record is null', () => {
    const ctx = makeCtx()
    const invalidateSpy = vi.spyOn(ctx.queryClient, 'invalidateQueries')

    const event = makeEvent({ record: null })
    bridgeDetailCache(event, ctx)

    expect(invalidateSpy).not.toHaveBeenCalled()
  })

  it('does nothing on DELETE events', () => {
    const ctx = makeCtx()
    const invalidateSpy = vi.spyOn(ctx.queryClient, 'invalidateQueries')

    const event = makeEvent({ eventType: 'DELETE' })
    bridgeDetailCache(event, ctx)

    expect(invalidateSpy).not.toHaveBeenCalled()
  })
})

describe('refreshCountsIfNeeded', () => {
  it('calls debouncedRefreshCounts for INSERT', async () => {
    const { debouncedRefreshCounts } = await import('@/lib/realtime/cache-sync/broadcasting')
    vi.mocked(debouncedRefreshCounts).mockClear()

    const ctx = makeCtx()
    const event = makeEvent({ eventType: 'INSERT' })
    refreshCountsIfNeeded(event, ctx)

    expect(debouncedRefreshCounts).toHaveBeenCalledWith(ctx.queryClient)
  })
})
