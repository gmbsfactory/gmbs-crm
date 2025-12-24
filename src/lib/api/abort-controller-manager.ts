/**
 * Global AbortController manager to cancel all pending requests on logout
 * Tracks all fetch requests and provides centralized cancellation
 */

type RequestMetadata = {
  controller: AbortController
  url: string
  startedAt: number
}

class AbortControllerManager {
  private controllers = new Map<string, RequestMetadata>()
  private requestIdCounter = 0

  /**
   * Create a new AbortController for a fetch request
   * @returns { signal, requestId } - signal for fetch, requestId for cleanup
   */
  createController(url: string): { signal: AbortSignal; requestId: string } {
    const requestId = `req-${Date.now()}-${this.requestIdCounter++}`
    const controller = new AbortController()

    this.controllers.set(requestId, {
      controller,
      url,
      startedAt: Date.now(),
    })

    return { signal: controller.signal, requestId }
  }

  /**
   * Remove controller after request completes
   */
  removeController(requestId: string): void {
    this.controllers.delete(requestId)
  }

  /**
   * Cancel all pending requests (called on logout)
   */
  cancelAll(reason: string = 'Logout initiated'): void {
    console.log(`[AbortControllerManager] Canceling ${this.controllers.size} pending requests`)

    for (const [requestId, metadata] of this.controllers.entries()) {
      try {
        metadata.controller.abort(reason)
        console.log(`[AbortControllerManager] Aborted: ${metadata.url}`)
      } catch (error) {
        console.warn(`[AbortControllerManager] Failed to abort ${requestId}:`, error)
      }
    }

    this.controllers.clear()
  }

  /**
   * Get count of pending requests (for debugging)
   */
  getPendingCount(): number {
    return this.controllers.size
  }

  /**
   * Clean up stale controllers (requests older than 5 minutes)
   */
  cleanupStale(): void {
    const now = Date.now()
    const STALE_THRESHOLD = 5 * 60 * 1000 // 5 minutes

    for (const [requestId, metadata] of this.controllers.entries()) {
      if (now - metadata.startedAt > STALE_THRESHOLD) {
        this.controllers.delete(requestId)
      }
    }
  }
}

// Singleton instance
let instance: AbortControllerManager | null = null

export function getAbortControllerManager(): AbortControllerManager {
  if (!instance) {
    instance = new AbortControllerManager()

    // Cleanup stale controllers every minute
    if (typeof window !== 'undefined') {
      setInterval(() => instance?.cleanupStale(), 60 * 1000)
    }
  }

  return instance
}

/**
 * Wrapper for fetch that auto-registers with AbortControllerManager
 * Use this instead of raw fetch for automatic cancellation on logout
 */
export async function managedFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  if (typeof window === 'undefined') {
    // Server-side: use regular fetch
    return fetch(url, options)
  }

  const manager = getAbortControllerManager()
  const { signal, requestId } = manager.createController(url)

  try {
    // Merge our signal with any existing signal
    const mergedSignal = options.signal
      ? anySignal([signal, options.signal])
      : signal

    const response = await fetch(url, { ...options, signal: mergedSignal })
    return response
  } finally {
    manager.removeController(requestId)
  }
}

/**
 * Combine multiple AbortSignals (helper for merging signals)
 */
function anySignal(signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController()

  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort(signal.reason)
      break
    }
    signal.addEventListener('abort', () => {
      controller.abort(signal.reason)
    }, { once: true })
  }

  return controller.signal
}
