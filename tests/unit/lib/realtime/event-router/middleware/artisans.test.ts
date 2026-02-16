import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import type { Artisan } from '@/lib/api/v2/common/types'
import type { CrmEvent, SyncContext } from '@/lib/realtime/event-router/types'
import {
  invalidateArtisanLists,
  invalidateArtisanDetails,
} from '@/lib/realtime/event-router/middleware/artisans'

// Mock broadcasting (shared middleware uses it)
vi.mock('@/lib/realtime/cache-sync/broadcasting', () => ({
  getBroadcastSync: vi.fn().mockReturnValue(null),
  debouncedRefreshCounts: vi.fn(),
}))

function makeEvent(overrides?: Partial<CrmEvent<Artisan>>): CrmEvent<Artisan> {
  return {
    table: 'artisans',
    eventType: 'UPDATE',
    record: { id: 'art-1' } as Artisan,
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

describe('artisan middleware', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('invalidateArtisanLists', () => {
    it('invalidates artisan list queries with refetchType active', () => {
      const ctx = makeCtx()
      const spy = vi.spyOn(ctx.queryClient, 'invalidateQueries')

      invalidateArtisanLists(makeEvent(), ctx)

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          queryKey: expect.arrayContaining(['artisans', 'list']),
          refetchType: 'active',
        })
      )
    })
  })

  describe('invalidateArtisanDetails', () => {
    it('invalidates artisan detail queries with refetchType active', () => {
      const ctx = makeCtx()
      const spy = vi.spyOn(ctx.queryClient, 'invalidateQueries')

      invalidateArtisanDetails(makeEvent(), ctx)

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          queryKey: expect.arrayContaining(['artisans', 'detail']),
          refetchType: 'active',
        })
      )
    })
  })
})
