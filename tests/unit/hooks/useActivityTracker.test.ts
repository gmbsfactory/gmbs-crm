import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// ─── État capturé des appels Supabase (hoisted pour les factories vi.mock) ────
const db = vi.hoisted(() => ({
  inserts: [] as Array<Record<string, unknown>>,
  updates: [] as Array<Record<string, unknown>>,
  nextId: 0,
}))

vi.mock('@/lib/supabase-client', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: (payload: Record<string, unknown>) => {
        db.inserts.push(payload)
        const id = `sess-${++db.nextId}`
        return {
          select: () => ({
            single: () => Promise.resolve({ data: { id }, error: null }),
          }),
        }
      },
      update: (payload: Record<string, unknown>) => ({
        eq: () => {
          db.updates.push(payload)
          return Promise.resolve({ data: null, error: null })
        },
      }),
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
const MIN = 60_000

/** Flush plusieurs tours de microtâches (chaînes endSession→startSession). */
async function flush() {
  await act(async () => {
    for (let i = 0; i < 6; i++) await Promise.resolve()
  })
}

describe('useActivityTracker (intégration)', () => {
  beforeEach(() => {
    db.inserts.length = 0
    db.updates.length = 0
    db.nextId = 0
    vi.useFakeTimers()
    vi.setSystemTime(T0)
    vi.spyOn(document, 'hasFocus').mockReturnValue(true)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('crédite le temps seulement jusqu\'à la dernière activité en idle (retire la fenêtre d\'inactivité)', async () => {
    let lastActive = T0
    const getLastActiveAt = () => lastActive

    const { rerender } = renderHook(
      ({ isIdle }) => useActivityTracker('interventions', isIdle, getLastActiveAt, null),
      { initialProps: { isIdle: false } }
    )
    await flush()

    // Session démarrée à T0
    expect(db.inserts).toHaveLength(1)
    expect(db.inserts[0]).toMatchObject({
      user_id: 'user-1',
      page_name: 'interventions',
      intervention_id: null,
    })

    // Actif jusqu'à T0+20min puis absence ; idle détecté à T0+25min
    lastActive = T0 + 20 * MIN
    vi.setSystemTime(T0 + 25 * MIN)
    rerender({ isIdle: true })
    await flush()

    // Créditée 20 min (dernière activité), pas 25 min (instant de détection)
    expect(db.updates.length).toBeGreaterThanOrEqual(1)
    const last = db.updates[db.updates.length - 1]
    expect(last.duration_ms).toBe(20 * MIN)
  })

  it('exclut le temps de veille OS (gros saut d\'horloge) lors de la bascule idle', async () => {
    let lastActive = T0
    const getLastActiveAt = () => lastActive

    const { rerender } = renderHook(
      ({ isIdle }) => useActivityTracker('dashboard', isIdle, getLastActiveAt, null),
      { initialProps: { isIdle: false } }
    )
    await flush()
    expect(db.inserts).toHaveLength(1)

    // Dernière activité T0+2min, puis veille 8h, réveil → idle
    lastActive = T0 + 2 * MIN
    vi.setSystemTime(T0 + 8 * 60 * MIN)
    rerender({ isIdle: true })
    await flush()

    const last = db.updates[db.updates.length - 1]
    // Seules les 2 min réelles sont comptées, pas les 8h de sommeil
    expect(last.duration_ms).toBe(2 * MIN)
  })

  it('attribue le temps à l\'intervention ouverte et découpe la session quand elle change', async () => {
    const getLastActiveAt = () => Date.now()

    const { rerender } = renderHook(
      ({ interventionId }) =>
        useActivityTracker('interventions', false, getLastActiveAt, interventionId),
      { initialProps: { interventionId: null as string | null } }
    )
    await flush()

    expect(db.inserts).toHaveLength(1)
    expect(db.inserts[0].intervention_id).toBeNull()

    // Ouverture d'une intervention → ancienne session clôturée + nouvelle avec l'id
    rerender({ interventionId: 'inter-42' })
    await flush()

    expect(db.inserts.length).toBeGreaterThanOrEqual(2)
    expect(db.inserts[db.inserts.length - 1].intervention_id).toBe('inter-42')
    expect(db.updates.length).toBeGreaterThanOrEqual(1) // la 1re session a été fermée
  })
})
