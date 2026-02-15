import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createRealtimeRelay } from '@/lib/realtime/realtime-relay'
import type { RelayHandlers, RealtimeRelay } from '@/lib/realtime/realtime-relay'

// ─── BroadcastChannel Mock ───────────────────────────────────────────────

/**
 * Mock BroadcastChannel that simulates cross-tab messaging.
 * Messages posted on one instance are delivered to all OTHER instances
 * with the same channel name (per the BroadcastChannel spec).
 */
const channelInstances = new Map<string, Set<MockBroadcastChannel>>()

class MockBroadcastChannel {
  name: string
  onmessage: ((event: MessageEvent) => void) | null = null

  constructor(name: string) {
    this.name = name
    if (!channelInstances.has(name)) {
      channelInstances.set(name, new Set())
    }
    channelInstances.get(name)!.add(this)
  }

  postMessage(data: unknown) {
    const instances = channelInstances.get(this.name)
    if (!instances) return

    // Deliver to all OTHER instances (not the sender — per spec)
    for (const instance of instances) {
      if (instance !== this && instance.onmessage) {
        instance.onmessage(new MessageEvent('message', { data }))
      }
    }
  }

  close() {
    channelInstances.get(this.name)?.delete(this)
  }
}

describe('createRealtimeRelay', () => {
  let originalBroadcastChannel: typeof globalThis.BroadcastChannel | undefined

  beforeEach(() => {
    vi.clearAllMocks()
    channelInstances.clear()

    // Save and set mock
    originalBroadcastChannel = globalThis.BroadcastChannel
    // @ts-expect-error — mock implementation
    globalThis.BroadcastChannel = MockBroadcastChannel
  })

  afterEach(() => {
    // Restore
    if (originalBroadcastChannel) {
      globalThis.BroadcastChannel = originalBroadcastChannel
    } else {
      // @ts-expect-error — cleanup
      delete globalThis.BroadcastChannel
    }
    channelInstances.clear()
  })

  function createMockHandlers(): RelayHandlers {
    return {
      onInterventionPayload: vi.fn(),
      onArtisanPayload: vi.fn(),
      onJunctionPayload: vi.fn(),
      onLeaderStatus: vi.fn(),
    }
  }

  // ─── Availability ──────────────────────────────────────────────────────

  describe('availability', () => {
    it('should return null when BroadcastChannel is not available', () => {
      // @ts-expect-error — testing unavailable
      delete globalThis.BroadcastChannel

      const relay = createRealtimeRelay(createMockHandlers())
      expect(relay).toBeNull()
    })

    it('should return a relay object when BroadcastChannel is available', () => {
      const relay = createRealtimeRelay(createMockHandlers())
      expect(relay).not.toBeNull()
      expect(relay).toHaveProperty('relayPayload')
      expect(relay).toHaveProperty('relayStatus')
      expect(relay).toHaveProperty('close')
      relay?.close()
    })
  })

  // ─── Leader→Follower payload relay ─────────────────────────────────────

  describe('payload relay', () => {
    it('should relay intervention payloads to follower handlers', () => {
      const leaderHandlers = createMockHandlers()
      const followerHandlers = createMockHandlers()

      const leader = createRealtimeRelay(leaderHandlers)!
      const follower = createRealtimeRelay(followerHandlers)!

      const mockPayload = {
        eventType: 'INSERT' as const,
        new: { id: 'int-1', numero: 'INT-001' },
        old: {},
        schema: 'public',
        table: 'interventions',
        commit_timestamp: '2025-02-14T12:00:00Z',
        errors: null,
      }

      leader.relayPayload('interventions', mockPayload as any)

      // Follower should receive the payload
      expect(followerHandlers.onInterventionPayload).toHaveBeenCalledOnce()
      expect(followerHandlers.onInterventionPayload).toHaveBeenCalledWith(mockPayload)

      // Leader should NOT receive its own message (BroadcastChannel spec)
      expect(leaderHandlers.onInterventionPayload).not.toHaveBeenCalled()

      leader.close()
      follower.close()
    })

    it('should relay artisan payloads to the correct handler', () => {
      const leaderHandlers = createMockHandlers()
      const followerHandlers = createMockHandlers()

      const leader = createRealtimeRelay(leaderHandlers)!
      const follower = createRealtimeRelay(followerHandlers)!

      const mockPayload = {
        eventType: 'UPDATE' as const,
        new: { id: 'art-1', nom: 'Dupont' },
        old: { id: 'art-1', nom: 'Dupond' },
        schema: 'public',
        table: 'artisans',
        commit_timestamp: '2025-02-14T12:00:00Z',
        errors: null,
      }

      leader.relayPayload('artisans', mockPayload as any)

      expect(followerHandlers.onArtisanPayload).toHaveBeenCalledOnce()
      expect(followerHandlers.onInterventionPayload).not.toHaveBeenCalled()
      expect(followerHandlers.onJunctionPayload).not.toHaveBeenCalled()

      leader.close()
      follower.close()
    })

    it('should relay junction payloads to the correct handler', () => {
      const leaderHandlers = createMockHandlers()
      const followerHandlers = createMockHandlers()

      const leader = createRealtimeRelay(leaderHandlers)!
      const follower = createRealtimeRelay(followerHandlers)!

      const mockPayload = {
        eventType: 'INSERT' as const,
        new: { id: 'ja-1', intervention_id: 'int-1', artisan_id: 'art-1' },
        old: {},
        schema: 'public',
        table: 'intervention_artisans',
        commit_timestamp: '2025-02-14T12:00:00Z',
        errors: null,
      }

      leader.relayPayload('intervention_artisans', mockPayload as any)

      expect(followerHandlers.onJunctionPayload).toHaveBeenCalledOnce()
      expect(followerHandlers.onInterventionPayload).not.toHaveBeenCalled()
      expect(followerHandlers.onArtisanPayload).not.toHaveBeenCalled()

      leader.close()
      follower.close()
    })
  })

  // ─── Leader→Follower status relay ──────────────────────────────────────

  describe('status relay', () => {
    it('should relay connection status to followers', () => {
      const leaderHandlers = createMockHandlers()
      const followerHandlers = createMockHandlers()

      const leader = createRealtimeRelay(leaderHandlers)!
      const follower = createRealtimeRelay(followerHandlers)!

      leader.relayStatus('realtime')

      expect(followerHandlers.onLeaderStatus).toHaveBeenCalledOnce()
      expect(followerHandlers.onLeaderStatus).toHaveBeenCalledWith('realtime')

      // Leader should NOT receive its own status
      expect(leaderHandlers.onLeaderStatus).not.toHaveBeenCalled()

      leader.close()
      follower.close()
    })

    it('should relay polling status when leader loses WebSocket', () => {
      const followerHandlers = createMockHandlers()

      const leader = createRealtimeRelay(createMockHandlers())!
      const follower = createRealtimeRelay(followerHandlers)!

      leader.relayStatus('polling')

      expect(followerHandlers.onLeaderStatus).toHaveBeenCalledWith('polling')

      leader.close()
      follower.close()
    })
  })

  // ─── Multi-follower ────────────────────────────────────────────────────

  describe('multi-follower', () => {
    it('should deliver events to all followers', () => {
      const leaderHandlers = createMockHandlers()
      const follower1Handlers = createMockHandlers()
      const follower2Handlers = createMockHandlers()

      const leader = createRealtimeRelay(leaderHandlers)!
      const follower1 = createRealtimeRelay(follower1Handlers)!
      const follower2 = createRealtimeRelay(follower2Handlers)!

      leader.relayStatus('realtime')

      expect(follower1Handlers.onLeaderStatus).toHaveBeenCalledOnce()
      expect(follower2Handlers.onLeaderStatus).toHaveBeenCalledOnce()
      expect(leaderHandlers.onLeaderStatus).not.toHaveBeenCalled()

      leader.close()
      follower1.close()
      follower2.close()
    })
  })

  // ─── Cleanup ───────────────────────────────────────────────────────────

  describe('cleanup', () => {
    it('should stop receiving messages after close()', () => {
      const leaderHandlers = createMockHandlers()
      const followerHandlers = createMockHandlers()

      const leader = createRealtimeRelay(leaderHandlers)!
      const follower = createRealtimeRelay(followerHandlers)!

      // Close the follower
      follower.close()

      // Send a message — follower should not receive it
      leader.relayStatus('realtime')

      expect(followerHandlers.onLeaderStatus).not.toHaveBeenCalled()

      leader.close()
    })
  })

  // ─── Error handling ────────────────────────────────────────────────────

  describe('error handling', () => {
    it('should not crash when handler throws', () => {
      const followerHandlers = createMockHandlers()
      followerHandlers.onInterventionPayload = vi.fn(() => {
        throw new Error('Handler error')
      })

      const leader = createRealtimeRelay(createMockHandlers())!
      const follower = createRealtimeRelay(followerHandlers)!

      const mockPayload = {
        eventType: 'INSERT' as const,
        new: { id: 'int-1' },
        old: {},
        schema: 'public',
        table: 'interventions',
        commit_timestamp: '2025-02-14T12:00:00Z',
        errors: null,
      }

      // Should not throw
      expect(() => {
        leader.relayPayload('interventions', mockPayload as any)
      }).not.toThrow()

      leader.close()
      follower.close()
    })

    it('should ignore malformed messages', () => {
      const followerHandlers = createMockHandlers()

      const leader = createRealtimeRelay(createMockHandlers())!
      const follower = createRealtimeRelay(followerHandlers)!

      // Send a message with no type — should be ignored
      // Access the underlying channel to send a raw message
      const channels = channelInstances.get('crm-realtime-relay')!
      const leaderChannel = Array.from(channels).find(
        (ch) => ch.onmessage === null || ch === Array.from(channels)[0]
      )

      // Simulate a malformed message from another source
      if (leaderChannel) {
        leaderChannel.postMessage({ garbage: true })
      }

      expect(followerHandlers.onInterventionPayload).not.toHaveBeenCalled()
      expect(followerHandlers.onArtisanPayload).not.toHaveBeenCalled()
      expect(followerHandlers.onJunctionPayload).not.toHaveBeenCalled()
      expect(followerHandlers.onLeaderStatus).not.toHaveBeenCalled()

      leader.close()
      follower.close()
    })
  })
})
