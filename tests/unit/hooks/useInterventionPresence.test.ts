import { describe, it, expect, vi, beforeEach } from 'vitest'
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

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: vi.fn(() => ({
    data: {
      id: 'user-self',
      surnom: 'JD',
      prenom: 'Jean',
      nom: 'Dupont',
      color: '#3b82f6',
      avatar_url: null,
    },
  })),
}))

import { useInterventionPresence } from '@/hooks/useInterventionPresence'
import { supabase } from '@/lib/supabase-client'

// ─── Helpers ────────────────────────────────────────────────────────────────

let onSyncCallback: (() => void) | null = null
let subscribeCallback: ((status: string) => Promise<void>) | null = null
let mockPresenceState: Record<string, Array<Record<string, unknown>>> = {}

function setupMockChannel() {
  mocks.mockChannel.on.mockImplementation(
    (_type: string, _opts: unknown, cb: () => void) => {
      onSyncCallback = cb
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

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('useInterventionPresence', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPresenceState = {}
    onSyncCallback = null
    subscribeCallback = null
    setupMockChannel()
  })

  describe('when interventionId is null', () => {
    it('should return empty viewers without creating a channel', () => {
      const { result } = renderHook(() => useInterventionPresence(null))

      expect(result.current.viewers).toEqual([])
      expect(supabase.channel).not.toHaveBeenCalled()
    })
  })

  describe('channel lifecycle', () => {
    it('should create a channel with the correct name', () => {
      renderHook(() => useInterventionPresence('int-123'))

      expect(supabase.channel).toHaveBeenCalledWith(
        'presence:intervention-int-123'
      )
    })

    it('should listen for presence sync events', () => {
      renderHook(() => useInterventionPresence('int-123'))

      expect(mocks.mockChannel.on).toHaveBeenCalledWith(
        'presence',
        { event: 'sync' },
        expect.any(Function)
      )
    })

    it('should call track() after SUBSCRIBED status', async () => {
      renderHook(() => useInterventionPresence('int-123'))

      await act(async () => {
        await subscribeCallback?.('SUBSCRIBED')
      })

      expect(mocks.mockChannel.track).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-self',
          name: 'JD',
          color: '#3b82f6',
          avatarUrl: null,
        })
      )
    })

    it('should include joinedAt in track payload', async () => {
      renderHook(() => useInterventionPresence('int-123'))

      await act(async () => {
        await subscribeCallback?.('SUBSCRIBED')
      })

      const trackPayload = mocks.mockChannel.track.mock.calls[0][0]
      expect(trackPayload.joinedAt).toBeDefined()
      expect(new Date(trackPayload.joinedAt).getTime()).not.toBeNaN()
    })

    it('should not call track() on non-SUBSCRIBED status', async () => {
      renderHook(() => useInterventionPresence('int-123'))

      await act(async () => {
        await subscribeCallback?.('CHANNEL_ERROR')
      })

      expect(mocks.mockChannel.track).not.toHaveBeenCalled()
    })
  })

  describe('presence sync', () => {
    it('should exclude self from viewers', () => {
      mockPresenceState = {
        'key-self': [
          {
            userId: 'user-self',
            name: 'JD',
            color: '#3b82f6',
            avatarUrl: null,
            joinedAt: '2025-01-01T10:00:00Z',
          },
        ],
        'key-other': [
          {
            userId: 'user-other',
            name: 'Marie C',
            color: '#ef4444',
            avatarUrl: null,
            joinedAt: '2025-01-01T10:01:00Z',
          },
        ],
      }

      const { result } = renderHook(() =>
        useInterventionPresence('int-123')
      )

      act(() => {
        onSyncCallback?.()
      })

      expect(result.current.viewers).toHaveLength(1)
      expect(result.current.viewers[0].userId).toBe('user-other')
      expect(result.current.viewers[0].name).toBe('Marie C')
    })

    it('should deduplicate same user in multiple tabs', () => {
      mockPresenceState = {
        'key-tab1': [
          {
            userId: 'user-other',
            name: 'Marie',
            color: null,
            avatarUrl: null,
            joinedAt: '2025-01-01T10:00:00Z',
          },
        ],
        'key-tab2': [
          {
            userId: 'user-other',
            name: 'Marie',
            color: null,
            avatarUrl: null,
            joinedAt: '2025-01-01T10:01:00Z',
          },
        ],
      }

      const { result } = renderHook(() =>
        useInterventionPresence('int-123')
      )

      act(() => {
        onSyncCallback?.()
      })

      expect(result.current.viewers).toHaveLength(1)
    })

    it('should sort viewers by joinedAt ascending', () => {
      mockPresenceState = {
        'key-b': [
          {
            userId: 'user-b',
            name: 'B',
            color: null,
            avatarUrl: null,
            joinedAt: '2025-01-01T10:02:00Z',
          },
        ],
        'key-a': [
          {
            userId: 'user-a',
            name: 'A',
            color: null,
            avatarUrl: null,
            joinedAt: '2025-01-01T10:00:00Z',
          },
        ],
      }

      const { result } = renderHook(() =>
        useInterventionPresence('int-123')
      )

      act(() => {
        onSyncCallback?.()
      })

      expect(result.current.viewers[0].userId).toBe('user-a')
      expect(result.current.viewers[1].userId).toBe('user-b')
    })

    it('should return empty viewers when alone', () => {
      mockPresenceState = {
        'key-self': [
          {
            userId: 'user-self',
            name: 'JD',
            color: '#3b82f6',
            avatarUrl: null,
            joinedAt: '2025-01-01T10:00:00Z',
          },
        ],
      }

      const { result } = renderHook(() =>
        useInterventionPresence('int-123')
      )

      act(() => {
        onSyncCallback?.()
      })

      expect(result.current.viewers).toHaveLength(0)
    })

    it('should handle multiple viewers correctly', () => {
      mockPresenceState = {
        'key-self': [
          {
            userId: 'user-self',
            name: 'JD',
            color: '#3b82f6',
            avatarUrl: null,
            joinedAt: '2025-01-01T10:00:00Z',
          },
        ],
        'key-a': [
          {
            userId: 'user-a',
            name: 'Alice',
            color: '#f00',
            avatarUrl: null,
            joinedAt: '2025-01-01T10:01:00Z',
          },
        ],
        'key-b': [
          {
            userId: 'user-b',
            name: 'Bob',
            color: '#0f0',
            avatarUrl: null,
            joinedAt: '2025-01-01T10:02:00Z',
          },
        ],
        'key-c': [
          {
            userId: 'user-c',
            name: 'Carol',
            color: '#00f',
            avatarUrl: null,
            joinedAt: '2025-01-01T10:03:00Z',
          },
        ],
      }

      const { result } = renderHook(() =>
        useInterventionPresence('int-123')
      )

      act(() => {
        onSyncCallback?.()
      })

      expect(result.current.viewers).toHaveLength(3)
      expect(result.current.viewers.map((v) => v.userId)).toEqual([
        'user-a',
        'user-b',
        'user-c',
      ])
    })
  })

  describe('cleanup', () => {
    it('should call untrack() and removeChannel() on unmount', () => {
      const { unmount } = renderHook(() =>
        useInterventionPresence('int-123')
      )

      unmount()

      expect(mocks.mockChannel.untrack).toHaveBeenCalled()
      expect(mocks.mockRemoveChannel).toHaveBeenCalledWith(mocks.mockChannel)
    })

    it('should remove old channel when interventionId changes', () => {
      const { rerender } = renderHook(
        ({ id }) => useInterventionPresence(id),
        { initialProps: { id: 'int-123' as string | null } }
      )

      expect(supabase.channel).toHaveBeenCalledTimes(1)

      rerender({ id: 'int-456' })

      // Old channel cleaned up
      expect(mocks.mockRemoveChannel).toHaveBeenCalled()
      // New channel created
      expect(supabase.channel).toHaveBeenCalledWith(
        'presence:intervention-int-456'
      )
    })

    it('should clean up when interventionId becomes null', () => {
      const { result, rerender } = renderHook(
        ({ id }) => useInterventionPresence(id),
        { initialProps: { id: 'int-123' as string | null } }
      )

      rerender({ id: null })

      expect(mocks.mockRemoveChannel).toHaveBeenCalled()
      expect(result.current.viewers).toEqual([])
    })
  })

  describe('error handling', () => {
    it('should not throw when track() fails', async () => {
      mocks.mockChannel.track.mockRejectedValue(new Error('network error'))

      const { result } = renderHook(() =>
        useInterventionPresence('int-123')
      )

      await act(async () => {
        await subscribeCallback?.('SUBSCRIBED')
      })

      // Hook still alive, viewers still empty
      expect(result.current.viewers).toEqual([])
    })

    it('should log warning on CHANNEL_ERROR', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      renderHook(() => useInterventionPresence('int-123'))

      await act(async () => {
        await subscribeCallback?.('CHANNEL_ERROR')
      })

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Presence]')
      )

      warnSpy.mockRestore()
    })

    it('should log warning on TIMED_OUT', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      renderHook(() => useInterventionPresence('int-123'))

      await act(async () => {
        await subscribeCallback?.('TIMED_OUT')
      })

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Presence]')
      )

      warnSpy.mockRestore()
    })
  })
})
