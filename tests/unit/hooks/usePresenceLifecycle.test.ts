import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// ─── Mocks ────────────────────────────────────────────────────────────────
const mockCurrentUserResult: { data: { id: string } | null } = { data: { id: 'user-1' } }
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: vi.fn(() => mockCurrentUserResult),
}))

import { usePresenceLifecycle } from '@/hooks/usePresenceLifecycle'
import type { PresenceSettings } from '@/hooks/usePresenceSettings'

const SETTINGS: PresenceSettings = {
  idleAfterMinutes: 5,
  offlineAfterMinutes: 60,
  updatedAt: null,
  updatedBy: null,
}
const OFFLINE_MS = SETTINGS.offlineAfterMinutes * 60_000

interface PresencePayload {
  state: string
  event: string
  sessionId: string | null
  metadata: Record<string, unknown>
}

/** Événements de présence postés sur /api/auth/presence (corps JSON décodé). */
function presenceCalls(): PresencePayload[] {
  return (global.fetch as Mock).mock.calls
    .filter(([url]) => url === '/api/auth/presence')
    .map(([, opts]) => JSON.parse((opts as RequestInit).body as string) as PresencePayload)
}

function hasEvent(event: string): boolean {
  return presenceCalls().some((c) => c.event === event)
}

/** Laisse les microtasks (fetch fire-and-forget) se vider. */
async function flush() {
  await act(async () => {
    await Promise.resolve()
  })
}

function renderLifecycle(initialIdle: boolean) {
  const lastActive = Date.now()
  return renderHook(
    ({ isIdle }) =>
      usePresenceLifecycle({ isIdle, getLastActiveAt: () => lastActive, settings: SETTINGS }),
    { initialProps: { isIdle: initialIdle } },
  )
}

describe('usePresenceLifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    mockCurrentUserResult.data = { id: 'user-1' }
    ;(global.fetch as Mock).mockResolvedValue({ ok: true, status: 200, json: async () => ({ success: true }) })
    try {
      sessionStorage.clear()
    } catch {
      /* jsdom fournit sessionStorage ; no-op de sécurité */
    }
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('émet PRESENCE_START au montage (sans flag de login portail)', async () => {
    const { result } = renderLifecycle(false)
    await flush()
    expect(result.current.presenceState).toBe('active')
    expect(hasEvent('PRESENCE_START')).toBe(true)
    expect(hasEvent('AUTH_LOGIN')).toBe(false)
  })

  it('émet AUTH_LOGIN si le flag crm_auth_login est posé, puis le consomme', async () => {
    sessionStorage.setItem('crm_auth_login', '1')
    const { result } = renderLifecycle(false)
    await flush()
    expect(hasEvent('AUTH_LOGIN')).toBe(true)
    expect(hasEvent('PRESENCE_START')).toBe(false)
    expect(sessionStorage.getItem('crm_auth_login')).toBeNull()
    expect(result.current.presenceState).toBe('active')
  })

  it('passe active → idle et émet IDLE_START quand isIdle devient true', async () => {
    const { result, rerender } = renderLifecycle(false)
    await flush()
    ;(global.fetch as Mock).mockClear()

    rerender({ isIdle: true })
    await flush()

    expect(result.current.presenceState).toBe('idle')
    expect(result.current.idleSinceAt).toBeTruthy()
    expect(hasEvent('IDLE_START')).toBe(true)
  })

  it('passe idle → offline après offlineAfterMinutes et émet PRESENCE_END', async () => {
    const { result, rerender } = renderLifecycle(false)
    await flush()
    rerender({ isIdle: true })
    await flush()
    ;(global.fetch as Mock).mockClear()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(OFFLINE_MS + 1000)
    })

    expect(result.current.presenceState).toBe('offline')
    expect(presenceCalls().some((c) => c.event === 'PRESENCE_END' && c.state === 'offline')).toBe(true)
  })

  it('reprend (idle → active) sans portail et émet PRESENCE_RESUME', async () => {
    const { result, rerender } = renderLifecycle(false)
    await flush()
    rerender({ isIdle: true })
    await flush()
    ;(global.fetch as Mock).mockClear()

    rerender({ isIdle: false })
    await flush()

    expect(result.current.presenceState).toBe('active')
    expect(hasEvent('PRESENCE_RESUME')).toBe(true)
  })

  it('renouvelle le sessionId au retour depuis offline', async () => {
    const { result, rerender } = renderLifecycle(false)
    await flush()
    rerender({ isIdle: true })
    await flush()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(OFFLINE_MS + 1000)
    })
    expect(result.current.presenceState).toBe('offline')
    const sessionIdBefore = result.current.sessionId

    rerender({ isIdle: false })
    await flush()

    expect(result.current.presenceState).toBe('active')
    expect(result.current.sessionId).not.toBe(sessionIdBefore)
  })

  it('émet PRESENCE_PING toutes les 60 s en activité', async () => {
    renderLifecycle(false)
    await flush()
    ;(global.fetch as Mock).mockClear()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000 + 100)
    })

    expect(hasEvent('PRESENCE_PING')).toBe(true)
  })

  it("n'émet pas de ping en idle", async () => {
    renderLifecycle(true)
    await flush()
    ;(global.fetch as Mock).mockClear()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000 + 100)
    })

    expect(hasEvent('PRESENCE_PING')).toBe(false)
  })

  it("n'émet rien tant qu'aucun utilisateur n'est connecté", async () => {
    mockCurrentUserResult.data = null
    renderLifecycle(false)
    await flush()
    expect(presenceCalls()).toHaveLength(0)
  })
})
