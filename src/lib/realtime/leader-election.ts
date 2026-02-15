/**
 * Leader Election via Web Locks API
 *
 * Ensures only ONE browser tab holds the Supabase Realtime WebSocket connection.
 * Other tabs (followers) receive events via BroadcastChannel relay.
 * When the leader tab closes, the lock auto-releases and the next waiting tab
 * is promoted automatically — zero configuration, zero race conditions.
 *
 * Fallback: if Web Locks API is unavailable (SSR, older browsers),
 * the tab defaults to leader mode (every tab has its own connection).
 *
 * Connection budget impact:
 *   Before: 1 WebSocket per tab × N tabs × 30 users = 90+ connections
 *   After:  1 WebSocket per browser × 30 users = 30 connections (3x reduction)
 */

export type LeaderStatus = 'leader' | 'follower' | 'acquiring'

export interface LeaderElectionOptions {
  /** Called when this tab becomes the leader (should subscribe to Supabase) */
  onPromoted: () => void
  /** Called when this tab loses leadership (cleanup, should not normally happen) */
  onDemoted?: () => void
}

const LOCK_NAME = 'crm-realtime-leader'

export class LeaderElection {
  private _status: LeaderStatus = 'acquiring'
  private _releaseLock: (() => void) | null = null
  private _abortController: AbortController | null = null
  private _options: LeaderElectionOptions | null = null

  /**
   * Whether the Web Locks API is available in the current environment.
   * Not available in SSR or browsers older than Chrome 69 / Firefox 96 / Safari 15.4.
   */
  static isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'locks' in navigator
  }

  get status(): LeaderStatus {
    return this._status
  }

  get isLeader(): boolean {
    return this._status === 'leader'
  }

  /**
   * Start participating in leader election.
   *
   * - If Web Locks is not supported, immediately promotes to leader (fallback).
   * - Otherwise, requests the lock. The callback fires when acquired:
   *   - First tab: acquires immediately (next microtask) → onPromoted()
   *   - Subsequent tabs: queue as followers → onPromoted() when leader closes
   *
   * Returns synchronously. The tab starts as 'follower' and transitions
   * to 'leader' asynchronously when the lock is granted.
   */
  start(options: LeaderElectionOptions): void {
    this._options = options

    if (!LeaderElection.isSupported()) {
      // No Web Locks → every tab is a leader (current behavior, safe fallback)
      this._status = 'leader'
      console.log('[LeaderElection] Web Locks API not available — defaulting to leader')
      options.onPromoted()
      return
    }

    this._status = 'acquiring'
    this._abortController = new AbortController()

    navigator.locks.request(
      LOCK_NAME,
      { signal: this._abortController.signal },
      () => {
        // Lock acquired — we are now the leader.
        this._status = 'leader'
        console.log('[LeaderElection] Promoted to leader')
        this._options?.onPromoted()

        // Hold the lock by returning a never-resolving promise.
        // When the tab closes, the browser releases the lock automatically.
        // When stop() is called, _releaseLock() resolves this promise.
        return new Promise<void>((resolve) => {
          this._releaseLock = resolve
        })
      }
    ).catch((err: unknown) => {
      // AbortError is expected when stop() is called while waiting in queue
      if (err instanceof Error && err.name === 'AbortError') {
        return
      }
      // Any other error → fall back to leader mode for resilience
      console.error('[LeaderElection] Unexpected error, falling back to leader:', err)
      this._status = 'leader'
      this._options?.onPromoted()
    })

    // navigator.locks.request() is always async — the callback fires on the next
    // microtask even for the first tab. If we're still 'acquiring' at this point,
    // another tab holds the lock and we're a follower.
    if (this._status === 'acquiring') {
      this._status = 'follower'
      console.log('[LeaderElection] Starting as follower (another tab is leader)')
    }
  }

  /**
   * Stop participating in leader election.
   * - If leader: releases the Web Lock → next queued tab gets promoted.
   * - If follower: cancels the pending lock request.
   */
  stop(): void {
    // Abort the pending lock request (no-op if already acquired or not started)
    if (this._abortController) {
      this._abortController.abort()
      this._abortController = null
    }

    // Release the lock if we're holding it
    if (this._releaseLock) {
      this._releaseLock()
      this._releaseLock = null
    }

    const wasLeader = this._status === 'leader'
    this._status = 'acquiring'

    if (wasLeader) {
      this._options?.onDemoted?.()
    }

    this._options = null
  }
}
