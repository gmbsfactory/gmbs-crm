import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import type { InterventionArtisanRow } from '@/lib/realtime/realtime-client'
import type { CrmEvent, SyncContext } from '@/lib/realtime/event-router/types'
import {
  invalidateLinkedIntervention,
  invalidateInterventionLists,
} from '@/lib/realtime/event-router/middleware/junction'

// Mock broadcasting
const mockDebouncedRefreshCounts = vi.fn()
vi.mock('@/lib/realtime/cache-sync/broadcasting', () => ({
  getBroadcastSync: vi.fn().mockReturnValue(null),
  debouncedRefreshCounts: (...args: unknown[]) => mockDebouncedRefreshCounts(...args),
}))

function makeJunctionRecord(overrides?: Partial<InterventionArtisanRow>): InterventionArtisanRow {
  return {
    id: 'ja-1',
    intervention_id: 'int-1',
    artisan_id: 'art-1',
    role: 'primary',
    is_primary: true,
    assigned_at: '2025-01-01',
    created_at: '2025-01-01',
    ...overrides,
  }
}

function makeEvent(overrides?: Partial<CrmEvent<InterventionArtisanRow>>): CrmEvent<InterventionArtisanRow> {
  return {
    table: 'intervention_artisans',
    eventType: 'INSERT',
    record: makeJunctionRecord(),
    previousRecord: null,
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

describe('junction middleware', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('invalidateLinkedIntervention', () => {
    it('invalidates the detail query for the linked intervention', () => {
      const ctx = makeCtx()
      const spy = vi.spyOn(ctx.queryClient, 'invalidateQueries')

      invalidateLinkedIntervention(makeEvent(), ctx)

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          queryKey: expect.arrayContaining(['interventions', 'detail', 'int-1']),
          refetchType: 'active',
        })
      )
    })

    it('does nothing when no intervention_id', () => {
      const ctx = makeCtx()
      const spy = vi.spyOn(ctx.queryClient, 'invalidateQueries')

      const event = makeEvent({
        record: makeJunctionRecord({ intervention_id: '' }),
        previousRecord: null,
      })
      // Override to make intervention_id falsy
      event.record!.intervention_id = ''

      invalidateLinkedIntervention(event, ctx)

      // Should not invalidate because intervention_id is empty string (falsy)
      expect(spy).not.toHaveBeenCalled()
    })
  })

  describe('invalidateInterventionLists', () => {
    it('invalidates both intervention list and light list queries', () => {
      const ctx = makeCtx()
      const spy = vi.spyOn(ctx.queryClient, 'invalidateQueries')

      invalidateInterventionLists(makeEvent(), ctx)

      expect(spy).toHaveBeenCalledTimes(2)
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          queryKey: expect.arrayContaining(['interventions', 'list']),
        })
      )
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          queryKey: expect.arrayContaining(['interventions', 'light']),
        })
      )
    })
  })
})
