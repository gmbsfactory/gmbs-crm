import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import * as React from 'react'

// Mock supabase channel
const mockSubscribe = vi.fn().mockReturnThis()
const mockOn = vi.fn().mockReturnThis()
const mockRemoveChannel = vi.fn()
const mockChannel = {
  on: mockOn,
  subscribe: mockSubscribe,
}

vi.mock('@/lib/supabase-client', () => ({
  supabase: {
    channel: vi.fn(() => mockChannel),
    removeChannel: mockRemoveChannel,
  },
}))

// Mock query client
const mockInvalidateQueries = vi.fn()
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    invalidateQueries: mockInvalidateQueries,
  }),
}))

vi.mock('@/lib/react-query/queryKeys', () => ({
  updateKeys: {
    all: ['app-updates'],
    unseen: () => ['app-updates', 'unseen'],
    journal: () => ['app-updates', 'journal'],
    admin: () => ['app-updates', 'admin'],
    adminWithViews: () => ['app-updates', 'admin', 'with-views'],
  },
}))

describe('useUpdateViewsRealtime', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should subscribe to postgres_changes on mount', async () => {
    const { useUpdateViewsRealtime } = await import('@/hooks/useUpdateViewsRealtime')

    renderHook(() => useUpdateViewsRealtime())

    const { supabase } = await import('@/lib/supabase-client')
    expect(supabase.channel).toHaveBeenCalledWith('update-views-rt')
    expect(mockOn).toHaveBeenCalledWith(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'app_update_views' },
      expect.any(Function)
    )
    expect(mockSubscribe).toHaveBeenCalled()
  })

  it('should remove channel on unmount', async () => {
    const { useUpdateViewsRealtime } = await import('@/hooks/useUpdateViewsRealtime')

    const { unmount } = renderHook(() => useUpdateViewsRealtime())
    unmount()

    expect(mockRemoveChannel).toHaveBeenCalledWith(mockChannel)
  })

  it('should invalidate adminWithViews on event', async () => {
    const { useUpdateViewsRealtime } = await import('@/hooks/useUpdateViewsRealtime')

    renderHook(() => useUpdateViewsRealtime())

    // Get the callback passed to .on()
    const onCallback = mockOn.mock.calls[0][2]
    onCallback()

    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['app-updates', 'admin', 'with-views'],
    })
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['app-updates', 'unseen'],
    })
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['app-updates', 'journal'],
    })
  })
})
