import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

// Mock device-capabilities to control low-end detection
vi.mock('@/lib/device-capabilities', () => ({
  detectDeviceCapabilities: () => ({
    isLowEnd: false,
    cores: 8,
    memory: 16,
    supportsIdleCallback: true,
  }),
}))

import { useDashboardFreshness } from '@/hooks/useDashboardFreshness'

describe('useDashboardFreshness', () => {
  it('should return T3 polling interval (30s)', () => {
    const { result } = renderHook(() => useDashboardFreshness())

    expect(result.current.pollingInterval).toBe(30_000)
  })

  it('should return T3 query options with correct staleTime and gcTime', () => {
    const { result } = renderHook(() => useDashboardFreshness())
    const { queryOptions } = result.current

    expect(queryOptions.staleTime).toBe(15_000)
    expect(queryOptions.gcTime).toBe(5 * 60 * 1000)
  })

  it('should set refetchInterval to match polling interval', () => {
    const { result } = renderHook(() => useDashboardFreshness())

    expect(result.current.queryOptions.refetchInterval).toBe(30_000)
  })

  it('should disable refetch in background', () => {
    const { result } = renderHook(() => useDashboardFreshness())

    expect(result.current.queryOptions.refetchIntervalInBackground).toBe(false)
  })

  it('should enable refetch on window focus', () => {
    const { result } = renderHook(() => useDashboardFreshness())

    expect(result.current.queryOptions.refetchOnWindowFocus).toBe(true)
  })

  it('should return stable reference across re-renders (useMemo)', () => {
    const { result, rerender } = renderHook(() => useDashboardFreshness())

    const first = result.current
    rerender()
    const second = result.current

    expect(first).toBe(second)
  })
})

describe('useDashboardFreshness (low-end device)', () => {
  it('should use slower polling on low-end devices', async () => {
    // Reset freshness-tiers cache by re-importing with different mock
    vi.resetModules()
    vi.doMock('@/lib/device-capabilities', () => ({
      detectDeviceCapabilities: () => ({
        isLowEnd: true,
        cores: 2,
        memory: 2,
        supportsIdleCallback: false,
      }),
    }))

    const { useDashboardFreshness: useDashboardFreshnessLowEnd } = await import(
      '@/hooks/useDashboardFreshness'
    )
    const { result } = renderHook(() => useDashboardFreshnessLowEnd())

    expect(result.current.pollingInterval).toBe(60_000)
    expect(result.current.queryOptions.staleTime).toBe(30_000)
    expect(result.current.queryOptions.refetchInterval).toBe(60_000)
  })
})
