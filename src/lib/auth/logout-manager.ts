/**
 * Centralized logout manager with retry logic and multi-tab coordination
 * Handles status updates with retries and broadcasts logout to other tabs
 */

import { getAbortControllerManager } from '@/lib/api/abort-controller-manager'
import type { QueryClient } from '@tanstack/react-query'
import type { SupabaseClient } from '@supabase/supabase-js'

interface LogoutOptions {
  skipStatusUpdate?: boolean
  reason?: 'user_initiated' | 'auth_error' | 'forced' | 'remote_logout'
  broadcastToOtherTabs?: boolean
}

class LogoutManager {
  private isLoggingOut = false
  private readonly MAX_STATUS_RETRIES = 3
  private readonly STATUS_RETRY_DELAY = 500 // ms

  /**
   * Set status to offline with retry logic
   * Never blocks logout - failures are logged but ignored
   */
  private async setStatusOfflineWithRetry(): Promise<void> {
    for (let attempt = 1; attempt <= this.MAX_STATUS_RETRIES; attempt++) {
      try {

        const response = await fetch('/api/auth/status', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          keepalive: true, // Critical: ensures request completes even if page closes
          body: JSON.stringify({ status: 'offline' }),
        })

        if (response.ok) {
          return // Success
        } else {
          console.warn(`[LogoutManager] Status update failed (${response.status}), attempt ${attempt}`)
        }
      } catch (error) {
        console.warn(`[LogoutManager] Status update error (attempt ${attempt}):`, error)
      }

      // Wait before retry (except on last attempt)
      if (attempt < this.MAX_STATUS_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, this.STATUS_RETRY_DELAY))
      }
    }

    // All retries failed - log but don't block logout
    console.warn('[LogoutManager] Failed to set offline status after all retries, continuing logout anyway')
  }

  /**
   * Broadcast logout to other tabs via BroadcastChannel
   */
  private broadcastLogout(userId: string | null, reason: string): void {
    if (typeof window === 'undefined' || !window.BroadcastChannel || !userId) {
      return
    }

    try {
      const channel = new BroadcastChannel(`crm-logout-${userId}`)
      channel.postMessage({
        type: 'logout-initiated',
        timestamp: Date.now(),
        reason,
        tabId: window.name || 'unknown',
      })

      // Close channel after brief delay to ensure message is sent
      setTimeout(() => channel.close(), 100)
    } catch (error) {
      console.warn('[LogoutManager] Failed to broadcast logout:', error)
    }
  }

  /**
   * Execute logout sequence
   * 1. Set offline status (with retries, non-blocking)
   * 2. Cancel all pending requests
   * 3. Broadcast to other tabs
   * 4. Clear React Query cache
   * 5. Sign out from Supabase (cookies nettoyés automatiquement par @supabase/ssr)
   * 6. Redirect to /login
   */
  async executeLogout(
    queryClient: QueryClient,
    supabase: SupabaseClient,
    userId: string | null,
    options: LogoutOptions = {}
  ): Promise<void> {
    const {
      skipStatusUpdate = false,
      reason = 'user_initiated',
      broadcastToOtherTabs = true,
    } = options

    // Prevent concurrent logout attempts
    if (this.isLoggingOut) {
      console.warn('[LogoutManager] Logout already in progress, ignoring duplicate call')
      return
    }

    this.isLoggingOut = true

    try {

      // STEP 1: Set status to offline (with retries, non-blocking)
      if (!skipStatusUpdate) {
        // Don't await - run in background and don't block logout
        this.setStatusOfflineWithRetry().catch(error => {
          console.warn('[LogoutManager] Background status update failed:', error)
        })
      }

      // STEP 2: Cancel all pending requests immediately
      const abortManager = getAbortControllerManager()
      const pendingCount = abortManager.getPendingCount()
      if (pendingCount > 0) {
        abortManager.cancelAll('Logout initiated')
      }

      // STEP 3: Broadcast logout to other tabs
      if (broadcastToOtherTabs) {
        this.broadcastLogout(userId, reason)
      }

      // STEP 4: Clear React Query cache
      queryClient.removeQueries({ queryKey: ["currentUser"] })
      queryClient.invalidateQueries({ queryKey: ["currentUser"] })
      queryClient.clear()

      // STEP 5: Clean up sessionStorage
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('revealTransition')
      }

      // STEP 6: Sign out from Supabase (@supabase/ssr nettoie automatiquement les cookies)
      console.log('[LogoutManager] Signing out from Supabase')
      await supabase.auth.signOut()

      // STEP 7: Redirect to login
      console.log('[LogoutManager] Redirecting to /login')
      window.location.href = '/login'

    } catch (error) {
      console.error('[LogoutManager] Logout error:', error)
      // Even on error, try to redirect
      if (typeof window !== 'undefined') {
        window.location.href = '/login'
      }
    } finally {
      // Reset flag after redirect starts (will be cleared when page unloads)
      setTimeout(() => {
        this.isLoggingOut = false
      }, 1000)
    }
  }
}

// Singleton instance
let instance: LogoutManager | null = null

export function getLogoutManager(): LogoutManager {
  if (!instance) {
    instance = new LogoutManager()
  }
  return instance
}
