import React from 'react'
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { render, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// ─── Mocks ────────────────────────────────────────────────────────────────
const mockCurrentUserResult: { data: { id: string } | null } = { data: { id: 'user-1' } }
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: vi.fn(() => mockCurrentUserResult),
}))

/** Callback enregistre par le provider aupres de supabase.auth.onAuthStateChange */
let authCallback: ((event: string) => void | Promise<void>) | null = null
vi.mock('@/lib/supabase-client', () => ({
  supabase: {
    auth: {
      onAuthStateChange: vi.fn((cb: (event: string) => void) => {
        authCallback = cb
        return { data: { subscription: { unsubscribe: vi.fn() } } }
      }),
    },
  },
}))

vi.mock('@/lib/preload-critical-data', () => ({ preloadCriticalDataAsync: vi.fn() }))
vi.mock('@/lib/preload-flag', () => ({ resetPreloadFlag: vi.fn() }))
vi.mock('@/lib/api/remindersApi', () => ({ resetPublicUserIdCache: vi.fn() }))

import { AuthStateListenerProvider } from '@/providers/AuthStateListenerProvider'
import { getBusinessDateString } from '@/lib/utils/business-timezone'

const STORAGE_KEY = 'last_activity_check_user-1'
const EXPLICIT_SIGNIN_KEY = 'crm_explicit_signin_at'

/** Appels POST vers l'endpoint de pointage. */
function firstActivityCalls(): unknown[] {
  return (global.fetch as Mock).mock.calls.filter(([url]) => url === '/api/auth/first-activity')
}

function renderProvider() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthStateListenerProvider>
        <div>contenu</div>
      </AuthStateListenerProvider>
    </QueryClientProvider>,
  )
}

/** Laisse les microtasks (fetch) se vider. */
async function flush() {
  await act(async () => {
    await Promise.resolve()
  })
}

describe('AuthStateListenerProvider — pointage de la premiere activite', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authCallback = null
    localStorage.clear()
    sessionStorage.clear()
    mockCurrentUserResult.data = { id: 'user-1' }
    ;(global.fetch as Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, wasFirstActivity: true, latenessCount: 1 }),
    })
  })

  it('ne pointe pas au simple montage de l\'app (onglet zombie, sortie de veille)', async () => {
    renderProvider()
    await flush()

    expect(firstActivityCalls()).toHaveLength(0)
  })

  it('pointe a la premiere interaction humaine reelle', async () => {
    renderProvider()
    await flush()

    await act(async () => {
      window.dispatchEvent(new Event('pointerdown'))
    })

    await waitFor(() => expect(firstActivityCalls()).toHaveLength(1))
  })

  it('pointe aussi sur une frappe clavier', async () => {
    renderProvider()
    await flush()

    await act(async () => {
      window.dispatchEvent(new Event('keydown'))
    })

    await waitFor(() => expect(firstActivityCalls()).toHaveLength(1))
  })

  it('ne pointe qu\'une seule fois malgre des interactions repetees', async () => {
    renderProvider()
    await flush()

    await act(async () => {
      window.dispatchEvent(new Event('pointerdown'))
      window.dispatchEvent(new Event('pointerdown'))
      window.dispatchEvent(new Event('keydown'))
    })

    await waitFor(() => expect(firstActivityCalls()).toHaveLength(1))
  })

  it('memorise la journee metier pointee pour eviter un aller-retour le lendemain', async () => {
    renderProvider()
    await flush()

    await act(async () => {
      window.dispatchEvent(new Event('pointerdown'))
    })

    await waitFor(() => expect(localStorage.getItem(STORAGE_KEY)).toBe(getBusinessDateString()))
  })

  it('ne pointe plus si la journee a deja ete pointee sur cet appareil', async () => {
    localStorage.setItem(STORAGE_KEY, getBusinessDateString())

    renderProvider()
    await flush()

    await act(async () => {
      window.dispatchEvent(new Event('pointerdown'))
    })
    await flush()

    expect(firstActivityCalls()).toHaveLength(0)
  })

  it('repointe si le marqueur date d\'une journee metier anterieure', async () => {
    localStorage.setItem(STORAGE_KEY, '2020-01-01')

    renderProvider()
    await flush()

    await act(async () => {
      window.dispatchEvent(new Event('pointerdown'))
    })

    await waitFor(() => expect(firstActivityCalls()).toHaveLength(1))
  })

  it('pointe immediatement apres une connexion explicite, sans attendre d\'interaction', async () => {
    sessionStorage.setItem(EXPLICIT_SIGNIN_KEY, String(Date.now()))

    renderProvider()

    await waitFor(() => expect(firstActivityCalls()).toHaveLength(1))
    // Le marqueur est consomme pour ne pas repointer au prochain montage
    expect(sessionStorage.getItem(EXPLICIT_SIGNIN_KEY)).toBeNull()
  })

  it('ignore un marqueur de connexion perime et exige une interaction', async () => {
    // sessionStorage survit aux rechargements : un marqueur orphelin ne doit pas
    // faire pointer un simple rafraichissement d'onglet le lendemain.
    sessionStorage.setItem(EXPLICIT_SIGNIN_KEY, String(Date.now() - 10 * 60_000))

    renderProvider()
    await flush()

    expect(firstActivityCalls()).toHaveLength(0)
    // Perime, il est tout de meme consomme : il ne doit pas survivre a ce passage
    expect(sessionStorage.getItem(EXPLICIT_SIGNIN_KEY)).toBeNull()

    // La voie normale reste ouverte
    await act(async () => {
      window.dispatchEvent(new Event('pointerdown'))
    })
    await waitFor(() => expect(firstActivityCalls()).toHaveLength(1))
  })

  it('ignore un marqueur de connexion illisible', async () => {
    sessionStorage.setItem(EXPLICIT_SIGNIN_KEY, 'pas-un-horodatage')

    renderProvider()
    await flush()

    expect(firstActivityCalls()).toHaveLength(0)
    expect(sessionStorage.getItem(EXPLICIT_SIGNIN_KEY)).toBeNull()
  })

  it('pose le marqueur de connexion explicite sur SIGNED_IN, mais pas sur INITIAL_SESSION', async () => {
    renderProvider()
    await flush()

    await act(async () => {
      await authCallback?.('INITIAL_SESSION')
    })
    expect(sessionStorage.getItem(EXPLICIT_SIGNIN_KEY)).toBeNull()

    await act(async () => {
      await authCallback?.('SIGNED_IN')
    })
    const marker = Number(sessionStorage.getItem(EXPLICIT_SIGNIN_KEY))
    expect(Number.isFinite(marker)).toBe(true)
    expect(Date.now() - marker).toBeLessThan(60_000)
  })

  it('ne repointe pas apres la connexion, meme si l\'utilisateur agit plus tard', async () => {
    // Scenario : connexion a 9h50, aucune action jusqu'a 10h10.
    // Le pointage a eu lieu au login ; l'interaction ulterieure ne doit rien renvoyer.
    sessionStorage.setItem(EXPLICIT_SIGNIN_KEY, String(Date.now()))

    renderProvider()
    await waitFor(() => expect(firstActivityCalls()).toHaveLength(1))
    await waitFor(() => expect(localStorage.getItem(STORAGE_KEY)).toBe(getBusinessDateString()))

    await act(async () => {
      window.dispatchEvent(new Event('pointerdown'))
      window.dispatchEvent(new Event('keydown'))
    })
    await flush()

    expect(firstActivityCalls()).toHaveLength(1)
  })

  it('ne pointe pas tant que l\'utilisateur courant n\'est pas resolu', async () => {
    mockCurrentUserResult.data = null

    renderProvider()
    await flush()

    await act(async () => {
      window.dispatchEvent(new Event('pointerdown'))
    })
    await flush()

    expect(firstActivityCalls()).toHaveLength(0)
  })
})
