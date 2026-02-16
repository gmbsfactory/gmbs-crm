import { describe, it, expect, vi, beforeEach } from 'vitest'
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

import { useModalFreshness } from '@/hooks/useModalFreshness'

describe('useModalFreshness', () => {
  describe('when modal is open (isActive = true)', () => {
    it('should enable polling at T2 interval (5s)', () => {
      const { result } = renderHook(() => useModalFreshness(true))

      expect(result.current.isPolling).toBe(true)
      expect(result.current.pollingInterval).toBe(5_000)
    })

    it('should return T2 query options', () => {
      const { result } = renderHook(() => useModalFreshness(true))
      const { queryOptions } = result.current

      expect(queryOptions.staleTime).toBe(3_000)
      expect(queryOptions.gcTime).toBe(2 * 60 * 1000)
      expect(queryOptions.refetchInterval).toBe(5_000)
      expect(queryOptions.refetchIntervalInBackground).toBe(false)
    })
  })

  describe('when modal is closed (isActive = false)', () => {
    it('should disable polling', () => {
      const { result } = renderHook(() => useModalFreshness(false))

      expect(result.current.isPolling).toBe(false)
      expect(result.current.pollingInterval).toBe(false)
    })

    it('should set refetchInterval to false in queryOptions', () => {
      const { result } = renderHook(() => useModalFreshness(false))

      expect(result.current.queryOptions.refetchInterval).toBe(false)
    })

    it('should still return staleTime and gcTime (cache configuration persists)', () => {
      const { result } = renderHook(() => useModalFreshness(false))

      expect(result.current.queryOptions.staleTime).toBe(3_000)
      expect(result.current.queryOptions.gcTime).toBe(2 * 60 * 1000)
    })
  })

  describe('when toggling isActive', () => {
    it('should switch from polling to not polling when modal closes', () => {
      const { result, rerender } = renderHook(
        ({ isActive }) => useModalFreshness(isActive),
        { initialProps: { isActive: true } }
      )

      expect(result.current.isPolling).toBe(true)

      rerender({ isActive: false })

      expect(result.current.isPolling).toBe(false)
      expect(result.current.pollingInterval).toBe(false)
    })

    it('should re-enable polling when modal reopens', () => {
      const { result, rerender } = renderHook(
        ({ isActive }) => useModalFreshness(isActive),
        { initialProps: { isActive: false } }
      )

      expect(result.current.isPolling).toBe(false)

      rerender({ isActive: true })

      expect(result.current.isPolling).toBe(true)
      expect(result.current.pollingInterval).toBe(5_000)
    })
  })

  describe('custom tier', () => {
    it('should use T3 config when specified', () => {
      const { result } = renderHook(() =>
        useModalFreshness(true, { tier: 'T3' })
      )

      expect(result.current.pollingInterval).toBe(30_000)
      expect(result.current.queryOptions.staleTime).toBe(15_000)
    })

    it('should disable polling for T1 and T4 even when active', () => {
      const { result: t1 } = renderHook(() =>
        useModalFreshness(true, { tier: 'T1' })
      )
      const { result: t4 } = renderHook(() =>
        useModalFreshness(true, { tier: 'T4' })
      )

      expect(t1.current.isPolling).toBe(false)
      expect(t1.current.pollingInterval).toBe(false)
      expect(t4.current.isPolling).toBe(false)
      expect(t4.current.pollingInterval).toBe(false)
    })
  })

  describe('forcePolling', () => {
    it('should enable polling even when isActive is false', () => {
      const { result } = renderHook(() =>
        useModalFreshness(false, { forcePolling: true })
      )

      expect(result.current.isPolling).toBe(true)
      expect(result.current.pollingInterval).toBe(5_000)
    })
  })
})
