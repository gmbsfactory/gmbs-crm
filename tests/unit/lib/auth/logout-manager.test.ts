import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { getLogoutManager } from '@/lib/auth/logout-manager'

describe('LogoutManager', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
    global.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('attend le PATCH offline avant de signer Supabase', async () => {
    const order: string[] = []
    global.fetch = vi.fn(async () => {
      order.push('offline')
      return new Response(JSON.stringify({ success: true }), { status: 200 })
    }) as typeof fetch

    const queryClient = {
      removeQueries: vi.fn(),
      invalidateQueries: vi.fn(),
      clear: vi.fn(),
    }
    const supabase = {
      auth: {
        signOut: vi.fn(async () => {
          order.push('signOut')
        }),
      },
    }

    await getLogoutManager().executeLogout(queryClient as any, supabase as any, 'user-1', {
      broadcastToOtherTabs: false,
    })

    expect(order).toEqual(['offline', 'signOut'])
    expect(global.fetch).toHaveBeenCalledWith('/api/auth/status', expect.objectContaining({
      method: 'PATCH',
      body: JSON.stringify({ status: 'offline', authEvent: 'SIGNED_OUT' }),
    }))
  })
})
