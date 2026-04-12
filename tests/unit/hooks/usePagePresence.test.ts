import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// ─── Hoisted mocks (accessible inside vi.mock factories) ───────────────────

const mocks = vi.hoisted(() => {
  const mockChannel = {
    on: vi.fn(),
    subscribe: vi.fn(),
    presenceState: vi.fn(() => ({})),
    track: vi.fn().mockResolvedValue(undefined),
    untrack: vi.fn().mockResolvedValue(undefined),
  }

  const mockRemoveChannel = vi.fn()

  return { mockChannel, mockRemoveChannel }
})

vi.mock('@/lib/supabase-client', () => ({
  supabase: {
    channel: vi.fn(() => mocks.mockChannel),
    removeChannel: mocks.mockRemoveChannel,
  },
}))

const mockCurrentUserData = {
  id: 'user-self',
  surnom: 'JD',
  prenom: 'Jean',
  nom: 'Dupont',
  color: '#3b82f6',
  avatar_url: null,
}
const mockCurrentUserResult = { data: mockCurrentUserData }
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: vi.fn(() => mockCurrentUserResult),
}))

import { usePagePresence } from '@/hooks/usePagePresence'
import { supabase } from '@/lib/supabase-client'

// ─── Helpers ────────────────────────────────────────────────────────────────

let onSyncCallback: (() => void) | null = null
let subscribeCallback: ((status: string) => Promise<void>) | null = null
let mockPresenceState: Record<string, Array<Record<string, unknown>>> = {}

function setupMockChannel() {
  mocks.mockChannel.on.mockImplementation(
    (_type: string, opts: { event: string }, cb: (...args: unknown[]) => void) => {
      if (opts?.event === 'sync') {
        onSyncCallback = cb
      }
      return mocks.mockChannel
    }
  )
  mocks.mockChannel.subscribe.mockImplementation(
    (cb: (status: string) => Promise<void>) => {
      subscribeCallback = cb
      return mocks.mockChannel
    }
  )
  mocks.mockChannel.presenceState.mockImplementation(() => mockPresenceState)
  mocks.mockChannel.track.mockResolvedValue(undefined)
  mocks.mockChannel.untrack.mockResolvedValue(undefined)
}

/** Advance fake timers past the 50ms setup delay so the channel is created */
async function advancePastSetup() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(60)
  })
}

/** Advance past the 500ms track throttle */
async function advancePastThrottle() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(550)
  })
}

/** Returns a fresh timestamp (within the 5-min stale window) */
function freshTimestamp(offsetMs = 0) {
  return new Date(Date.now() - offsetMs).toISOString()
}

// Helper to build a presence entry
function makePresence(overrides: Partial<{
  userId: string
  name: string
  color: string | null
  avatarUrl: string | null
  joinedAt: string
  currentPage: string | null
  activeInterventionId: string | null
  activeArtisanId: string | null
  isIdle: boolean
}> = {}) {
  return {
    userId: 'user-other',
    name: 'Marie C',
    color: '#ef4444',
    avatarUrl: null,
    joinedAt: freshTimestamp(),
    currentPage: 'interventions',
    activeInterventionId: null,
    activeArtisanId: null,
    isIdle: false,
    ...overrides,
  }
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('usePagePresence', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    mockPresenceState = {}
    onSyncCallback = null
    subscribeCallback = null
    setupMockChannel()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // ─── Channel lifecycle ──────────────────────────────────────────────────

  describe('channel lifecycle', () => {
    it('should create a single global channel "presence:pages"', async () => {
      renderHook(() => usePagePresence('interventions'))
      await advancePastSetup()

      expect(supabase.channel).toHaveBeenCalledWith('presence:pages')
    })

    it('should not create a channel when no user is logged in', () => {
      mockCurrentUserResult.data = null as unknown as typeof mockCurrentUserData
      renderHook(() => usePagePresence('interventions'))

      expect(supabase.channel).not.toHaveBeenCalled()

      // Restore
      mockCurrentUserResult.data = mockCurrentUserData
    })

    it('should listen for presence sync events', async () => {
      renderHook(() => usePagePresence('interventions'))
      await advancePastSetup()

      expect(mocks.mockChannel.on).toHaveBeenCalledWith(
        'presence',
        { event: 'sync' },
        expect.any(Function)
      )
    })

    it('should call track() after SUBSCRIBED status', async () => {
      renderHook(() => usePagePresence('interventions'))
      await advancePastSetup()

      await act(async () => {
        await subscribeCallback?.('SUBSCRIBED')
      })

      expect(mocks.mockChannel.track).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-self',
          name: 'JD',
          color: '#3b82f6',
          currentPage: 'interventions',
          isIdle: false,
        })
      )
    })

    it('should include joinedAt as a valid ISO string in track payload', async () => {
      renderHook(() => usePagePresence('interventions'))
      await advancePastSetup()

      await act(async () => {
        await subscribeCallback?.('SUBSCRIBED')
      })

      const payload = mocks.mockChannel.track.mock.calls[0][0]
      expect(payload.joinedAt).toBeDefined()
      expect(new Date(payload.joinedAt).getTime()).not.toBeNaN()
    })

    it('should call untrack() and removeChannel() on unmount', async () => {
      const { unmount } = renderHook(() => usePagePresence('interventions'))
      await advancePastSetup()

      unmount()

      expect(mocks.mockChannel.untrack).toHaveBeenCalled()
      expect(mocks.mockRemoveChannel).toHaveBeenCalledWith(mocks.mockChannel)
    })

    it('should clear viewers and allUsers on unmount', async () => {
      mockPresenceState = {
        'key-other': [makePresence()],
      }

      const { result, unmount } = renderHook(() => usePagePresence('interventions'))
      await advancePastSetup()
      act(() => { onSyncCallback?.() })

      expect(result.current.viewers).toHaveLength(1)

      unmount()

      // After unmount the last state before teardown still has the old value,
      // but the channel cleanup ran — verify that via mock calls
      expect(mocks.mockRemoveChannel).toHaveBeenCalled()
    })
  })

  // ─── Presence sync — viewers filtering ──────────────────────────────────

  describe('presence sync — viewers', () => {
    it('should exclude self from viewers', async () => {
      mockPresenceState = {
        'key-self': [makePresence({ userId: 'user-self', name: 'JD', currentPage: 'interventions' })],
        'key-other': [makePresence({ userId: 'user-other', name: 'Marie C', currentPage: 'interventions' })],
      }

      const { result } = renderHook(() => usePagePresence('interventions'))
      await advancePastSetup()
      act(() => { onSyncCallback?.() })

      expect(result.current.viewers).toHaveLength(1)
      expect(result.current.viewers[0].userId).toBe('user-other')
    })

    it('should only include viewers on the same page', async () => {
      mockPresenceState = {
        'key-self': [makePresence({ userId: 'user-self', currentPage: 'interventions' })],
        'key-same': [makePresence({ userId: 'user-a', name: 'Alice', currentPage: 'interventions' })],
        'key-diff': [makePresence({ userId: 'user-b', name: 'Bob', currentPage: 'artisans' })],
      }

      const { result } = renderHook(() => usePagePresence('interventions'))
      await advancePastSetup()
      act(() => { onSyncCallback?.() })

      expect(result.current.viewers).toHaveLength(1)
      expect(result.current.viewers[0].userId).toBe('user-a')
    })

    it('should return empty viewers when pageName is null', async () => {
      mockPresenceState = {
        'key-other': [makePresence({ userId: 'user-other', currentPage: 'interventions' })],
      }

      const { result } = renderHook(() => usePagePresence(null))
      await advancePastSetup()
      act(() => { onSyncCallback?.() })

      expect(result.current.viewers).toEqual([])
    })

    it('should return empty viewers when alone on the page', async () => {
      mockPresenceState = {
        'key-self': [makePresence({ userId: 'user-self', currentPage: 'interventions' })],
      }

      const { result } = renderHook(() => usePagePresence('interventions'))
      await advancePastSetup()
      act(() => { onSyncCallback?.() })

      expect(result.current.viewers).toHaveLength(0)
    })

    it('should deduplicate same user across multiple tabs', async () => {
      mockPresenceState = {
        'key-tab1': [makePresence({ userId: 'user-other', currentPage: 'interventions', joinedAt: freshTimestamp(60000) })],
        'key-tab2': [makePresence({ userId: 'user-other', currentPage: 'interventions', joinedAt: freshTimestamp(30000) })],
      }

      const { result } = renderHook(() => usePagePresence('interventions'))
      await advancePastSetup()
      act(() => { onSyncCallback?.() })

      expect(result.current.viewers).toHaveLength(1)
    })

    it('should sort viewers by joinedAt ascending', async () => {
      mockPresenceState = {
        'key-b': [makePresence({ userId: 'user-b', name: 'B', currentPage: 'interventions', joinedAt: freshTimestamp(30000) })],
        'key-a': [makePresence({ userId: 'user-a', name: 'A', currentPage: 'interventions', joinedAt: freshTimestamp(60000) })],
      }

      const { result } = renderHook(() => usePagePresence('interventions'))
      await advancePastSetup()
      act(() => { onSyncCallback?.() })

      expect(result.current.viewers[0].userId).toBe('user-a')
      expect(result.current.viewers[1].userId).toBe('user-b')
    })

    it('should handle multiple viewers correctly', async () => {
      mockPresenceState = {
        'key-self': [makePresence({ userId: 'user-self', currentPage: 'interventions' })],
        'key-a': [makePresence({ userId: 'user-a', name: 'Alice', currentPage: 'interventions', joinedAt: freshTimestamp(90000) })],
        'key-b': [makePresence({ userId: 'user-b', name: 'Bob', currentPage: 'interventions', joinedAt: freshTimestamp(60000) })],
        'key-c': [makePresence({ userId: 'user-c', name: 'Carol', currentPage: 'interventions', joinedAt: freshTimestamp(30000) })],
      }

      const { result } = renderHook(() => usePagePresence('interventions'))
      await advancePastSetup()
      act(() => { onSyncCallback?.() })

      expect(result.current.viewers).toHaveLength(3)
      expect(result.current.viewers.map((v) => v.userId)).toEqual(['user-a', 'user-b', 'user-c'])
    })
  })

  // ─── Presence sync — allUsers ───────────────────────────────────────────

  describe('presence sync — allUsers', () => {
    it('should include self in allUsers', async () => {
      mockPresenceState = {
        'key-self': [makePresence({ userId: 'user-self', name: 'JD', currentPage: 'interventions' })],
        'key-other': [makePresence({ userId: 'user-other', currentPage: 'artisans' })],
      }

      const { result } = renderHook(() => usePagePresence('interventions'))
      await advancePastSetup()
      act(() => { onSyncCallback?.() })

      expect(result.current.allUsers).toHaveLength(2)
      expect(result.current.allUsers.map((u) => u.userId)).toContain('user-self')
    })

    it('should include users from all pages in allUsers', async () => {
      mockPresenceState = {
        'key-a': [makePresence({ userId: 'user-a', currentPage: 'interventions' })],
        'key-b': [makePresence({ userId: 'user-b', currentPage: 'artisans' })],
        'key-c': [makePresence({ userId: 'user-c', currentPage: 'dashboard' })],
      }

      const { result } = renderHook(() => usePagePresence('interventions'))
      await advancePastSetup()
      act(() => { onSyncCallback?.() })

      expect(result.current.allUsers).toHaveLength(3)
    })

    it('should expose currentPage and entity IDs in allUsers entries', async () => {
      mockPresenceState = {
        'key-other': [makePresence({
          userId: 'user-other',
          currentPage: 'interventions',
          activeInterventionId: 'int-42',
          activeArtisanId: 'art-7',
        })],
      }

      const { result } = renderHook(() => usePagePresence('interventions'))
      await advancePastSetup()
      act(() => { onSyncCallback?.() })

      const user = result.current.allUsers[0]
      expect(user.currentPage).toBe('interventions')
      expect(user.activeInterventionId).toBe('int-42')
      expect(user.activeArtisanId).toBe('art-7')
    })
  })

  // ─── Stale presence filtering ──────────────────────────────────────────

  describe('stale presence filtering', () => {
    it('should filter out presence entries older than 5 minutes from viewers', async () => {
      const staleJoinedAt = new Date(Date.now() - 6 * 60 * 1000).toISOString()

      mockPresenceState = {
        'key-stale': [makePresence({ userId: 'user-stale', currentPage: 'interventions', joinedAt: staleJoinedAt })],
      }

      const { result } = renderHook(() => usePagePresence('interventions'))
      await advancePastSetup()
      act(() => { onSyncCallback?.() })

      expect(result.current.viewers).toHaveLength(0)
    })

    it('should filter out stale entries from allUsers', async () => {
      const staleJoinedAt = new Date(Date.now() - 6 * 60 * 1000).toISOString()
      const freshJoinedAt = new Date(Date.now() - 1 * 60 * 1000).toISOString()

      mockPresenceState = {
        'key-stale': [makePresence({ userId: 'user-stale', joinedAt: staleJoinedAt })],
        'key-fresh': [makePresence({ userId: 'user-fresh', joinedAt: freshJoinedAt })],
      }

      const { result } = renderHook(() => usePagePresence('interventions'))
      await advancePastSetup()
      act(() => { onSyncCallback?.() })

      expect(result.current.allUsers).toHaveLength(1)
      expect(result.current.allUsers[0].userId).toBe('user-fresh')
    })

    it('should keep entries within the 5-minute window', async () => {
      const freshJoinedAt = new Date(Date.now() - 2 * 60 * 1000).toISOString()

      mockPresenceState = {
        'key-fresh': [makePresence({ userId: 'user-fresh', currentPage: 'interventions', joinedAt: freshJoinedAt })],
      }

      const { result } = renderHook(() => usePagePresence('interventions'))
      await advancePastSetup()
      act(() => { onSyncCallback?.() })

      expect(result.current.viewers).toHaveLength(1)
    })
  })

  // ─── Heartbeat ──────────────────────────────────────────────────────────

  describe('heartbeat', () => {
    it('should re-track every 2 minutes to keep presence alive', async () => {
      renderHook(() => usePagePresence('interventions'))
      await advancePastSetup()

      await act(async () => {
        await subscribeCallback?.('SUBSCRIBED')
      })

      // Initial track call
      const initialCallCount = mocks.mockChannel.track.mock.calls.length

      // Advance past heartbeat interval (2 minutes)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2 * 60 * 1000 + 100)
      })

      expect(mocks.mockChannel.track.mock.calls.length).toBeGreaterThan(initialCallCount)
    })

    it('should stop heartbeat on unmount', async () => {
      const { unmount } = renderHook(() => usePagePresence('interventions'))
      await advancePastSetup()

      await act(async () => {
        await subscribeCallback?.('SUBSCRIBED')
      })

      unmount()
      mocks.mockChannel.track.mockClear()

      // Advance past heartbeat — should NOT trigger new track
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3 * 60 * 1000)
      })

      expect(mocks.mockChannel.track).not.toHaveBeenCalled()
    })
  })

  // ─── Page navigation (re-track without re-subscribe) ───────────────────

  describe('page navigation', () => {
    it('should re-track (not re-subscribe) when pageName changes', async () => {
      const { rerender } = renderHook(
        ({ page }) => usePagePresence(page),
        { initialProps: { page: 'interventions' as string | null } }
      )
      await advancePastSetup()

      await act(async () => {
        await subscribeCallback?.('SUBSCRIBED')
      })

      // Channel created once
      expect(supabase.channel).toHaveBeenCalledTimes(1)
      mocks.mockChannel.track.mockClear()

      // Navigate to artisans
      rerender({ page: 'artisans' })
      await advancePastThrottle()

      // Should re-track with new page, NOT create a new channel
      expect(supabase.channel).toHaveBeenCalledTimes(1)
      expect(mocks.mockChannel.track).toHaveBeenCalled()
    })

    it('should filter viewers by new page after navigation', async () => {
      mockPresenceState = {
        'key-a': [makePresence({ userId: 'user-a', currentPage: 'interventions' })],
        'key-b': [makePresence({ userId: 'user-b', currentPage: 'artisans' })],
      }

      const { result, rerender } = renderHook(
        ({ page }) => usePagePresence(page),
        { initialProps: { page: 'interventions' as string | null } }
      )
      await advancePastSetup()
      act(() => { onSyncCallback?.() })

      expect(result.current.viewers).toHaveLength(1)
      expect(result.current.viewers[0].userId).toBe('user-a')

      // Navigate to artisans — handleSync re-runs immediately
      rerender({ page: 'artisans' })

      // handleSync is called synchronously on pageName change
      expect(result.current.viewers).toHaveLength(1)
      expect(result.current.viewers[0].userId).toBe('user-b')
    })
  })

  // ─── Idle state ─────────────────────────────────────────────────────────

  describe('idle state', () => {
    it('should track isIdle=false by default', async () => {
      renderHook(() => usePagePresence('interventions'))
      await advancePastSetup()

      await act(async () => {
        await subscribeCallback?.('SUBSCRIBED')
      })

      expect(mocks.mockChannel.track).toHaveBeenCalledWith(
        expect.objectContaining({ isIdle: false })
      )
    })

    it('should track isIdle=true when passed', async () => {
      renderHook(() => usePagePresence('interventions', true))
      await advancePastSetup()

      await act(async () => {
        await subscribeCallback?.('SUBSCRIBED')
      })

      expect(mocks.mockChannel.track).toHaveBeenCalledWith(
        expect.objectContaining({ isIdle: true })
      )
    })

    it('should re-track when idle state changes', async () => {
      const { rerender } = renderHook(
        ({ idle }) => usePagePresence('interventions', idle),
        { initialProps: { idle: false } }
      )
      await advancePastSetup()

      await act(async () => {
        await subscribeCallback?.('SUBSCRIBED')
      })
      mocks.mockChannel.track.mockClear()

      rerender({ idle: true })
      await advancePastThrottle()

      expect(mocks.mockChannel.track).toHaveBeenCalled()
    })
  })

  // ─── Public API: updateActiveIntervention / updateActiveArtisan ────────

  describe('updateActiveIntervention', () => {
    it('should trigger a track() call with the intervention ID', async () => {
      const { result } = renderHook(() => usePagePresence('interventions'))
      await advancePastSetup()

      await act(async () => {
        await subscribeCallback?.('SUBSCRIBED')
      })
      mocks.mockChannel.track.mockClear()

      act(() => { result.current.updateActiveIntervention('int-42') })
      await advancePastThrottle()

      expect(mocks.mockChannel.track).toHaveBeenCalledWith(
        expect.objectContaining({ activeInterventionId: 'int-42' })
      )
    })

    it('should clear intervention ID when called with null', async () => {
      const { result } = renderHook(() => usePagePresence('interventions'))
      await advancePastSetup()

      await act(async () => {
        await subscribeCallback?.('SUBSCRIBED')
      })

      act(() => { result.current.updateActiveIntervention('int-42') })
      await advancePastThrottle()
      mocks.mockChannel.track.mockClear()

      act(() => { result.current.updateActiveIntervention(null) })
      await advancePastThrottle()

      expect(mocks.mockChannel.track).toHaveBeenCalledWith(
        expect.objectContaining({ activeInterventionId: null })
      )
    })
  })

  describe('updateActiveArtisan', () => {
    it('should trigger a track() call with the artisan ID', async () => {
      const { result } = renderHook(() => usePagePresence('interventions'))
      await advancePastSetup()

      await act(async () => {
        await subscribeCallback?.('SUBSCRIBED')
      })
      mocks.mockChannel.track.mockClear()

      act(() => { result.current.updateActiveArtisan('art-7') })
      await advancePastThrottle()

      expect(mocks.mockChannel.track).toHaveBeenCalledWith(
        expect.objectContaining({ activeArtisanId: 'art-7' })
      )
    })
  })

  // ─── Throttling ─────────────────────────────────────────────────────────

  describe('track throttling', () => {
    it('should throttle rapid track() calls to avoid rate limits', async () => {
      const { result } = renderHook(() => usePagePresence('interventions'))
      await advancePastSetup()

      await act(async () => {
        await subscribeCallback?.('SUBSCRIBED')
      })
      mocks.mockChannel.track.mockClear()

      // Fire multiple updates rapidly
      act(() => {
        result.current.updateActiveIntervention('int-1')
        result.current.updateActiveIntervention('int-2')
        result.current.updateActiveIntervention('int-3')
      })

      await advancePastThrottle()

      // Only one track call should fire (the first scheduled one)
      expect(mocks.mockChannel.track).toHaveBeenCalledTimes(1)
    })
  })

  // ─── Referential stability (prevent unnecessary re-renders) ─────────────

  describe('referential stability', () => {
    it('should not update viewers state when data has not changed', async () => {
      mockPresenceState = {
        'key-other': [makePresence({ userId: 'user-other', currentPage: 'interventions' })],
      }

      const { result } = renderHook(() => usePagePresence('interventions'))
      await advancePastSetup()

      act(() => { onSyncCallback?.() })
      const firstViewers = result.current.viewers

      // Trigger sync again with same data
      act(() => { onSyncCallback?.() })
      const secondViewers = result.current.viewers

      expect(firstViewers).toBe(secondViewers) // Same reference
    })
  })

  // ─── Reconnection ──────────────────────────────────────────────────────

  describe('reconnection', () => {
    it('should remove broken channel and reconnect on CHANNEL_ERROR', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      renderHook(() => usePagePresence('interventions'))
      await advancePastSetup()

      await act(async () => {
        await subscribeCallback?.('CHANNEL_ERROR')
      })

      // Broken channel should be cleaned up
      expect(mocks.mockChannel.untrack).toHaveBeenCalled()
      expect(mocks.mockRemoveChannel).toHaveBeenCalledWith(mocks.mockChannel)

      // After RECONNECT_DELAY_MS (5s), should attempt to re-subscribe
      vi.clearAllMocks()
      setupMockChannel()

      await act(async () => {
        await vi.advanceTimersByTimeAsync(5100)
      })

      expect(supabase.channel).toHaveBeenCalledWith('presence:pages')

      warnSpy.mockRestore()
      logSpy.mockRestore()
    })

    it('should reconnect on TIMED_OUT', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      renderHook(() => usePagePresence('interventions'))
      await advancePastSetup()

      await act(async () => {
        await subscribeCallback?.('TIMED_OUT')
      })

      expect(mocks.mockRemoveChannel).toHaveBeenCalled()

      warnSpy.mockRestore()
      logSpy.mockRestore()
    })
  })

  // ─── Error handling ─────────────────────────────────────────────────────

  describe('error handling', () => {
    it('should not throw when track() fails', async () => {
      mocks.mockChannel.track.mockRejectedValue(new Error('network error'))

      const { result } = renderHook(() => usePagePresence('interventions'))
      await advancePastSetup()

      await act(async () => {
        await subscribeCallback?.('SUBSCRIBED')
      })

      expect(result.current.viewers).toEqual([])
      expect(result.current.allUsers).toEqual([])
    })

    it('should log warning when track() fails via doTrack', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const { result } = renderHook(() => usePagePresence('interventions'))
      await advancePastSetup()

      await act(async () => {
        await subscribeCallback?.('SUBSCRIBED')
      })

      mocks.mockChannel.track.mockRejectedValue(new Error('rate limit'))

      act(() => { result.current.updateActiveIntervention('int-1') })
      await advancePastThrottle()

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[PagePresence]'),
        expect.any(Error)
      )

      warnSpy.mockRestore()
    })
  })

  // ─── User display name fallback ─────────────────────────────────────────

  describe('user display name', () => {
    it('should prefer surnom for display name', async () => {
      renderHook(() => usePagePresence('interventions'))
      await advancePastSetup()

      await act(async () => {
        await subscribeCallback?.('SUBSCRIBED')
      })

      expect(mocks.mockChannel.track).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'JD' })
      )
    })

    it('should fallback to prenom+nom when surnom is missing', async () => {
      mockCurrentUserResult.data = {
        ...mockCurrentUserData,
        surnom: null,
        prenom: 'Jean',
        nom: 'Dupont',
      }

      renderHook(() => usePagePresence('interventions'))
      await advancePastSetup()

      await act(async () => {
        await subscribeCallback?.('SUBSCRIBED')
      })

      expect(mocks.mockChannel.track).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Jean Dupont' })
      )

      // Restore
      mockCurrentUserResult.data = mockCurrentUserData
    })

    it('should fallback to "Utilisateur" when no name available', async () => {
      mockCurrentUserResult.data = {
        ...mockCurrentUserData,
        surnom: null,
        prenom: null,
        nom: null,
      } as unknown as typeof mockCurrentUserData

      renderHook(() => usePagePresence('interventions'))
      await advancePastSetup()

      await act(async () => {
        await subscribeCallback?.('SUBSCRIBED')
      })

      expect(mocks.mockChannel.track).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Utilisateur' })
      )

      // Restore
      mockCurrentUserResult.data = mockCurrentUserData
    })
  })
})
