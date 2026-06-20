import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// ─── Capture des événements insérés dans user_activity_events ────────────────
const journal = vi.hoisted(() => ({ events: [] as Array<Record<string, unknown>> }))

vi.mock('@/lib/supabase-client', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: (payload: Record<string, unknown>) => {
        journal.events.push(payload)
        return { then: (ok: () => void) => { ok?.(); return Promise.resolve() } }
      },
    })),
    auth: {
      getSession: vi.fn(() =>
        Promise.resolve({ data: { session: { access_token: 'tok' } }, error: null })
      ),
    },
  },
}))

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: vi.fn(() => ({ data: { id: 'user-1' } })),
}))

import { useActivityTracker } from '@/hooks/useActivityTracker'

const T0 = 1_700_000_000_000
const kinds = () => journal.events.map((e) => e.kind)

describe('useActivityTracker (émetteur de journal)', () => {
  beforeEach(() => {
    journal.events.length = 0
    vi.useFakeTimers()
    vi.setSystemTime(T0)
    vi.spyOn(document, 'hasFocus').mockReturnValue(true)
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('émet "connect" au montage avec session_id et page', async () => {
    renderHook(() => useActivityTracker('interventions', false, () => Date.now(), null))
    await act(async () => { await Promise.resolve() })

    expect(journal.events).toHaveLength(1)
    expect(journal.events[0]).toMatchObject({
      user_id: 'user-1',
      kind: 'connect',
      page_name: 'interventions',
      intervention_id: null,
    })
    expect(journal.events[0].session_id).toBeTruthy()
  })

  it('émet "page" sur changement de page et d\'intervention ouverte', async () => {
    const { rerender } = renderHook(
      ({ page, inter }) => useActivityTracker(page, false, () => Date.now(), inter),
      { initialProps: { page: 'interventions', inter: null as string | null } }
    )
    await act(async () => { await Promise.resolve() })

    rerender({ page: 'interventions', inter: 'inter-42' })
    await act(async () => { await Promise.resolve() })

    const pageEvents = journal.events.filter((e) => e.kind === 'page')
    expect(pageEvents).toHaveLength(1)
    expect(pageEvents[0]).toMatchObject({ page_name: 'interventions', intervention_id: 'inter-42' })
  })

  it('émet "idle" en inactivité puis "heartbeat" à la reprise', async () => {
    const { rerender } = renderHook(
      ({ isIdle }) => useActivityTracker('dashboard', isIdle, () => Date.now(), null),
      { initialProps: { isIdle: false } }
    )
    await act(async () => { await Promise.resolve() })

    rerender({ isIdle: true })
    await act(async () => { await Promise.resolve() })
    expect(kinds()).toContain('idle')

    rerender({ isIdle: false })
    await act(async () => { await Promise.resolve() })
    // reprise = marqueur actif
    expect(kinds().filter((k) => k === 'heartbeat').length).toBeGreaterThanOrEqual(1)
  })

  it('ne bat le heartbeat QUE s\'il y a eu une vraie activité', async () => {
    let lastActive = T0
    renderHook(() => useActivityTracker('dashboard', false, () => lastActive, null))
    await act(async () => { await Promise.resolve() })
    journal.events.length = 0 // on ignore le connect

    // 60s sans nouvelle activité → pas de heartbeat
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000) })
    expect(kinds()).not.toContain('heartbeat')

    // Nouvelle activité puis 60s → heartbeat
    lastActive = T0 + 90_000
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000) })
    expect(kinds()).toContain('heartbeat')
  })

  it('émet "disconnect" au démontage', async () => {
    const { unmount } = renderHook(() => useActivityTracker('dashboard', false, () => Date.now(), null))
    await act(async () => { await Promise.resolve() })
    unmount()
    await act(async () => { await Promise.resolve() })
    expect(kinds()).toContain('disconnect')
  })
})
