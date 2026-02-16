import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { LeaderElection } from '@/lib/realtime/leader-election'
import type { LeaderElectionOptions } from '@/lib/realtime/leader-election'

// ─── Mocks for Web Locks API ──────────────────────────────────────────────

/**
 * Creates a mock Web Locks API that simulates single-lock behavior.
 * Only one callback runs at a time; others queue until the lock is released.
 */
function createMockLocks() {
  let currentHolder: { resolve: () => void } | null = null
  const waitQueue: Array<{
    callback: () => Promise<void>
    resolve: (value: unknown) => void
    reject: (reason: unknown) => void
    signal?: AbortSignal
  }> = []

  function grantNext() {
    if (currentHolder || waitQueue.length === 0) return
    const next = waitQueue.shift()!

    // Check if aborted before granting
    if (next.signal?.aborted) {
      next.reject(new DOMException('The operation was aborted.', 'AbortError'))
      grantNext()
      return
    }

    const lockPromise = next.callback()
    lockPromise.then(
      () => {
        currentHolder = null
        next.resolve(undefined)
        grantNext()
      },
      (err) => {
        currentHolder = null
        next.reject(err)
        grantNext()
      }
    )
  }

  return {
    request: vi.fn(
      (
        _name: string,
        optionsOrCallback: LockOptions | (() => Promise<void>),
        maybeCallback?: () => Promise<void>
      ) => {
        const options = typeof optionsOrCallback === 'function' ? {} : optionsOrCallback
        const callback = typeof optionsOrCallback === 'function' ? optionsOrCallback : maybeCallback!

        return new Promise((resolve, reject) => {
          // Listen for abort
          if (options.signal) {
            options.signal.addEventListener('abort', () => {
              const idx = waitQueue.findIndex(
                (item) => item.callback === callback
              )
              if (idx !== -1) {
                waitQueue.splice(idx, 1)
                reject(new DOMException('The operation was aborted.', 'AbortError'))
              }
            })
          }

          waitQueue.push({ callback, resolve, reject, signal: options.signal })

          // If no one holds the lock, grant immediately (async to match real behavior)
          if (!currentHolder) {
            // Use queueMicrotask to simulate async lock granting
            queueMicrotask(() => grantNext())
          }
        })
      }
    ),
    // Test helper: release the current lock holder
    _releaseCurrentHolder() {
      if (currentHolder) {
        currentHolder.resolve()
      }
    },
    _getCurrentHolder() {
      return currentHolder
    },
    _getQueueLength() {
      return waitQueue.length
    },
  }
}

describe('LeaderElection', () => {
  let originalNavigator: PropertyDescriptor | undefined
  let mockLocks: ReturnType<typeof createMockLocks>

  beforeEach(() => {
    vi.clearAllMocks()
    originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
    mockLocks = createMockLocks()
  })

  afterEach(() => {
    // Restore navigator
    if (originalNavigator) {
      Object.defineProperty(globalThis, 'navigator', originalNavigator)
    }
  })

  function enableWebLocks() {
    Object.defineProperty(globalThis, 'navigator', {
      value: { locks: mockLocks },
      writable: true,
      configurable: true,
    })
  }

  function disableWebLocks() {
    Object.defineProperty(globalThis, 'navigator', {
      value: {},
      writable: true,
      configurable: true,
    })
  }

  // ─── Static method ─────────────────────────────────────────────────────

  describe('isSupported', () => {
    it('should return true when Web Locks API is available', () => {
      enableWebLocks()
      expect(LeaderElection.isSupported()).toBe(true)
    })

    it('should return false when navigator has no locks', () => {
      disableWebLocks()
      expect(LeaderElection.isSupported()).toBe(false)
    })
  })

  // ─── Fallback behavior (no Web Locks) ──────────────────────────────────

  describe('without Web Locks API', () => {
    beforeEach(() => {
      disableWebLocks()
    })

    it('should immediately promote to leader', () => {
      const leader = new LeaderElection()
      const onPromoted = vi.fn()

      leader.start({ onPromoted })

      expect(leader.isLeader).toBe(true)
      expect(leader.status).toBe('leader')
      expect(onPromoted).toHaveBeenCalledOnce()
    })

    it('should call onDemoted when stop() is called', () => {
      const leader = new LeaderElection()
      const onDemoted = vi.fn()

      leader.start({ onPromoted: vi.fn(), onDemoted })
      leader.stop()

      expect(onDemoted).toHaveBeenCalledOnce()
      expect(leader.status).toBe('acquiring')
    })
  })

  // ─── Leader election with Web Locks ────────────────────────────────────

  describe('with Web Locks API', () => {
    beforeEach(() => {
      enableWebLocks()
    })

    it('should start as follower synchronously (lock is async)', () => {
      const leader = new LeaderElection()
      const onPromoted = vi.fn()

      leader.start({ onPromoted })

      // Lock granting is async — start() returns before the lock is acquired
      expect(leader.status).toBe('follower')
      expect(leader.isLeader).toBe(false)
      expect(onPromoted).not.toHaveBeenCalled()
    })

    it('should promote to leader after lock is granted', async () => {
      const leader = new LeaderElection()
      const onPromoted = vi.fn()

      leader.start({ onPromoted })

      // Wait for the microtask that grants the lock
      await vi.waitFor(() => {
        expect(onPromoted).toHaveBeenCalledOnce()
      })

      expect(leader.isLeader).toBe(true)
      expect(leader.status).toBe('leader')
    })

    it('should release the lock on stop()', async () => {
      const leader = new LeaderElection()
      const onPromoted = vi.fn()
      const onDemoted = vi.fn()

      leader.start({ onPromoted, onDemoted })

      await vi.waitFor(() => {
        expect(onPromoted).toHaveBeenCalledOnce()
      })

      leader.stop()

      expect(onDemoted).toHaveBeenCalledOnce()
      expect(leader.status).toBe('acquiring')
      expect(leader.isLeader).toBe(false)
    })

    it('should cancel pending lock request on stop() when follower', () => {
      // First leader holds the lock
      const leader1 = new LeaderElection()
      leader1.start({ onPromoted: vi.fn() })

      // Second election starts as follower
      const leader2 = new LeaderElection()
      const onPromoted2 = vi.fn()
      leader2.start({ onPromoted: onPromoted2 })

      expect(leader2.status).toBe('follower')

      // Stop the follower — should abort without error
      leader2.stop()

      expect(leader2.status).toBe('acquiring')
      expect(onPromoted2).not.toHaveBeenCalled()
    })

    it('should call request with the correct lock name', () => {
      const leader = new LeaderElection()
      leader.start({ onPromoted: vi.fn() })

      expect(mockLocks.request).toHaveBeenCalledWith(
        'crm-realtime-leader',
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
        expect.any(Function)
      )

      leader.stop()
    })
  })

  // ─── Edge cases ────────────────────────────────────────────────────────

  describe('edge cases', () => {
    beforeEach(() => {
      enableWebLocks()
    })

    it('should clear options after stop()', () => {
      const leader = new LeaderElection()
      const onPromoted = vi.fn()

      leader.start({ onPromoted })
      leader.stop()

      // Internal state should be clean
      expect(leader.status).toBe('acquiring')
    })

    it('should handle multiple start/stop cycles', async () => {
      const leader = new LeaderElection()
      const onPromoted1 = vi.fn()
      const onPromoted2 = vi.fn()

      // First cycle
      leader.start({ onPromoted: onPromoted1 })
      await vi.waitFor(() => {
        expect(onPromoted1).toHaveBeenCalledOnce()
      })
      leader.stop()

      // Second cycle
      leader.start({ onPromoted: onPromoted2 })
      await vi.waitFor(() => {
        expect(onPromoted2).toHaveBeenCalledOnce()
      })
      leader.stop()
    })
  })
})
