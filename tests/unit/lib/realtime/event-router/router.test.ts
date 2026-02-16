import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { routeRealtimeEvent } from '@/lib/realtime/event-router/router'
import type { SyncContext } from '@/lib/realtime/event-router/types'

// Mock all pipelines to isolate router logic
vi.mock('@/lib/realtime/event-router/middleware/interventions', () => ({
  interventionPipeline: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/lib/realtime/event-router/middleware/artisans', () => ({
  artisanPipeline: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/lib/realtime/event-router/middleware/junction', () => ({
  junctionPipeline: vi.fn().mockResolvedValue(undefined),
}))

// Mock normalize to return a predictable event
vi.mock('@/lib/realtime/event-router/normalize', () => ({
  normalizePayload: vi.fn((_table: string, _payload: unknown) => ({
    table: _table,
    eventType: 'UPDATE',
    record: { id: '1' },
    previousRecord: null,
    meta: { isAccessRevoked: false, isSoftDelete: false, isRemote: true },
  })),
}))

// Mock remote-edit-indicator (required by normalize in case it's not fully mocked)
vi.mock('@/lib/realtime/remote-edit-indicator', () => ({
  getRemoteEditIndicatorManager: () => ({
    isLocalModification: () => false,
  }),
}))

function makePayload(): RealtimePostgresChangesPayload<{ id: string }> {
  return {
    commit_timestamp: '2025-01-01T00:00:00Z',
    errors: null,
    schema: 'public',
    table: 'test',
    eventType: 'UPDATE',
    new: { id: '1' },
    old: { id: '1' },
  } as RealtimePostgresChangesPayload<{ id: string }>
}

function makeCtx(): SyncContext {
  return {
    queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
    currentUserId: 'user-1',
    options: {},
  }
}

describe('routeRealtimeEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('routes interventions to the intervention pipeline', async () => {
    const { interventionPipeline } = await import('@/lib/realtime/event-router/middleware/interventions')

    await routeRealtimeEvent('interventions', makePayload(), makeCtx())

    expect(interventionPipeline).toHaveBeenCalledTimes(1)
  })

  it('routes artisans to the artisan pipeline', async () => {
    const { artisanPipeline } = await import('@/lib/realtime/event-router/middleware/artisans')

    await routeRealtimeEvent('artisans', makePayload(), makeCtx())

    expect(artisanPipeline).toHaveBeenCalledTimes(1)
  })

  it('routes intervention_artisans to the junction pipeline', async () => {
    const { junctionPipeline } = await import('@/lib/realtime/event-router/middleware/junction')

    await routeRealtimeEvent('intervention_artisans', makePayload(), makeCtx())

    expect(junctionPipeline).toHaveBeenCalledTimes(1)
  })

  it('warns and returns for unknown table', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    await routeRealtimeEvent('unknown_table', makePayload(), makeCtx())

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('No pipeline registered for table: unknown_table')
    )
    warnSpy.mockRestore()
  })
})
