import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock device-capabilities before importing freshness-tiers
let mockIsLowEnd = false
vi.mock('@/lib/device-capabilities', () => ({
  detectDeviceCapabilities: () => ({
    isLowEnd: mockIsLowEnd,
    cores: mockIsLowEnd ? 2 : 8,
    memory: mockIsLowEnd ? 2 : 16,
    supportsIdleCallback: true,
  }),
}))

describe('config/freshness-tiers', () => {
  beforeEach(() => {
    // Reset the cached config between tests by re-importing
    vi.resetModules()
    mockIsLowEnd = false
  })

  describe('getFreshnessTiers', () => {
    it('should return all 4 tiers', async () => {
      const { getFreshnessTiers } = await import('@/config/freshness-tiers')
      const tiers = getFreshnessTiers()

      expect(Object.keys(tiers)).toEqual(['T1', 'T2', 'T3', 'T4'])
    })

    it('should configure T1 with no polling (Realtime)', async () => {
      const { getFreshnessTiers } = await import('@/config/freshness-tiers')
      const t1 = getFreshnessTiers().T1

      expect(t1.tier).toBe('T1')
      expect(t1.pollingInterval).toBe(false)
      expect(t1.staleTime).toBe(5 * 60 * 1000) // 5 min
      expect(t1.gcTime).toBe(15 * 60 * 1000)   // 15 min
    })

    it('should configure T2 with 5s polling for modals', async () => {
      const { getFreshnessTiers } = await import('@/config/freshness-tiers')
      const t2 = getFreshnessTiers().T2

      expect(t2.tier).toBe('T2')
      expect(t2.pollingInterval).toBe(5_000)
      expect(t2.staleTime).toBe(3_000)
      expect(t2.gcTime).toBe(2 * 60 * 1000) // 2 min
    })

    it('should configure T3 with 30s background polling', async () => {
      const { getFreshnessTiers } = await import('@/config/freshness-tiers')
      const t3 = getFreshnessTiers().T3

      expect(t3.tier).toBe('T3')
      expect(t3.pollingInterval).toBe(30_000)
      expect(t3.staleTime).toBe(15_000)
      expect(t3.gcTime).toBe(5 * 60 * 1000)
    })

    it('should configure T4 with no polling (on-demand)', async () => {
      const { getFreshnessTiers } = await import('@/config/freshness-tiers')
      const t4 = getFreshnessTiers().T4

      expect(t4.tier).toBe('T4')
      expect(t4.pollingInterval).toBe(false)
      expect(t4.staleTime).toBe(10 * 60 * 1000)
      expect(t4.gcTime).toBe(30 * 60 * 1000)
    })
  })

  describe('low-end device adaptations', () => {
    it('should increase T2 polling interval to 8s on low-end devices', async () => {
      mockIsLowEnd = true
      const { getFreshnessTiers } = await import('@/config/freshness-tiers')
      const t2 = getFreshnessTiers().T2

      expect(t2.pollingInterval).toBe(8_000)
      expect(t2.staleTime).toBe(5_000)
    })

    it('should increase T3 polling interval to 60s on low-end devices', async () => {
      mockIsLowEnd = true
      const { getFreshnessTiers } = await import('@/config/freshness-tiers')
      const t3 = getFreshnessTiers().T3

      expect(t3.pollingInterval).toBe(60_000)
      expect(t3.staleTime).toBe(30_000)
    })

    it('should increase T4 cache times on low-end devices', async () => {
      mockIsLowEnd = true
      const { getFreshnessTiers } = await import('@/config/freshness-tiers')
      const t4 = getFreshnessTiers().T4

      expect(t4.staleTime).toBe(15 * 60 * 1000) // 15 min vs 10 min
      expect(t4.gcTime).toBe(45 * 60 * 1000)    // 45 min vs 30 min
    })

    it('should not change T1 on low-end devices (Realtime is always instant)', async () => {
      mockIsLowEnd = true
      const { getFreshnessTiers } = await import('@/config/freshness-tiers')
      const t1 = getFreshnessTiers().T1

      expect(t1.pollingInterval).toBe(false)
      expect(t1.staleTime).toBe(5 * 60 * 1000) // Same as normal
    })
  })

  describe('getTierConfig', () => {
    it('should return config for a specific tier', async () => {
      const { getTierConfig } = await import('@/config/freshness-tiers')
      const config = getTierConfig('T2')

      expect(config.tier).toBe('T2')
      expect(config.pollingInterval).toBe(5_000)
    })
  })

  describe('getTierQueryOptions', () => {
    it('should return TanStack Query-compatible options for T2', async () => {
      const { getTierQueryOptions } = await import('@/config/freshness-tiers')
      const options = getTierQueryOptions('T2')

      expect(options.staleTime).toBe(3_000)
      expect(options.gcTime).toBe(2 * 60 * 1000)
      expect(options.refetchInterval).toBe(5_000)
      expect(options.refetchIntervalInBackground).toBe(false)
      expect(options.refetchOnWindowFocus).toBe(false) // Only T3 refetches on focus
      expect(options.refetchOnMount).toBe(true)
    })

    it('should enable refetchOnWindowFocus only for T3', async () => {
      const { getTierQueryOptions } = await import('@/config/freshness-tiers')

      expect(getTierQueryOptions('T1').refetchOnWindowFocus).toBe(false)
      expect(getTierQueryOptions('T2').refetchOnWindowFocus).toBe(false)
      expect(getTierQueryOptions('T3').refetchOnWindowFocus).toBe(true)
      expect(getTierQueryOptions('T4').refetchOnWindowFocus).toBe(false)
    })

    it('should disable refetchOnMount for T1 (Realtime pushes updates)', async () => {
      const { getTierQueryOptions } = await import('@/config/freshness-tiers')

      expect(getTierQueryOptions('T1').refetchOnMount).toBe(false)
      expect(getTierQueryOptions('T2').refetchOnMount).toBe(true)
      expect(getTierQueryOptions('T3').refetchOnMount).toBe(true)
      expect(getTierQueryOptions('T4').refetchOnMount).toBe(true)
    })

    it('should set refetchInterval to false for T1 and T4 (no polling)', async () => {
      const { getTierQueryOptions } = await import('@/config/freshness-tiers')

      expect(getTierQueryOptions('T1').refetchInterval).toBe(false)
      expect(getTierQueryOptions('T4').refetchInterval).toBe(false)
    })

    it('should always disable refetchIntervalInBackground', async () => {
      const { getTierQueryOptions } = await import('@/config/freshness-tiers')

      expect(getTierQueryOptions('T1').refetchIntervalInBackground).toBe(false)
      expect(getTierQueryOptions('T2').refetchIntervalInBackground).toBe(false)
      expect(getTierQueryOptions('T3').refetchIntervalInBackground).toBe(false)
      expect(getTierQueryOptions('T4').refetchIntervalInBackground).toBe(false)
    })
  })
})
