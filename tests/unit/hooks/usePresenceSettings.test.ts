import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

// ─── Mocks ────────────────────────────────────────────────────────────────
const mockCurrentUserResult: { data: { id: string } | null } = { data: { id: 'user-1' } }
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: vi.fn(() => mockCurrentUserResult),
}))

import {
  usePresenceSettings,
  useUpdatePresenceSettings,
  DEFAULT_PRESENCE_SETTINGS,
  presenceSettingsQueryKey,
} from '@/hooks/usePresenceSettings'

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)
  return { Wrapper, queryClient }
}

function mockFetchOnce(data: unknown, { ok = true, status = 200 }: { ok?: boolean; status?: number } = {}) {
  ;(global.fetch as Mock).mockResolvedValueOnce({ ok, status, json: async () => data })
}

describe('usePresenceSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCurrentUserResult.data = { id: 'user-1' }
  })

  it('charge les réglages depuis /api/monitoring/presence-settings', async () => {
    mockFetchOnce({ idleAfterMinutes: 10, offlineAfterMinutes: 120, updatedAt: '2026-06-25T10:00:00Z', updatedBy: 'admin' })
    const { Wrapper } = createWrapper()
    const { result } = renderHook(() => usePresenceSettings(), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/monitoring/presence-settings',
      expect.objectContaining({ credentials: 'include', cache: 'no-store' }),
    )
    expect(result.current.data).toEqual({
      idleAfterMinutes: 10,
      offlineAfterMinutes: 120,
      updatedAt: '2026-06-25T10:00:00Z',
      updatedBy: 'admin',
    })
  })

  it('retombe sur les défauts en cas de 401', async () => {
    mockFetchOnce(null, { ok: false, status: 401 })
    const { Wrapper } = createWrapper()
    const { result } = renderHook(() => usePresenceSettings(), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(DEFAULT_PRESENCE_SETTINGS)
  })

  it('coerce les minutes en nombres', async () => {
    mockFetchOnce({ idleAfterMinutes: '7', offlineAfterMinutes: '90' })
    const { Wrapper } = createWrapper()
    const { result } = renderHook(() => usePresenceSettings(), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.idleAfterMinutes).toBe(7)
    expect(result.current.data?.offlineAfterMinutes).toBe(90)
  })

  it("ne fetch pas tant qu'aucun utilisateur n'est connecté", () => {
    mockCurrentUserResult.data = null
    const { Wrapper } = createWrapper()
    renderHook(() => usePresenceSettings(), { wrapper: Wrapper })
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('lève une erreur sur réponse non-ok (hors 401)', async () => {
    mockFetchOnce({ error: 'Boom' }, { ok: false, status: 500 })
    const { Wrapper } = createWrapper()
    const { result } = renderHook(() => usePresenceSettings(), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toBe('Boom')
  })
})

describe('useUpdatePresenceSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCurrentUserResult.data = { id: 'user-1' }
  })

  it('PATCH les réglages et met le cache à jour', async () => {
    mockFetchOnce({ idleAfterMinutes: 8, offlineAfterMinutes: 45, updatedAt: '2026-06-25T11:00:00Z', updatedBy: 'admin' })
    const { Wrapper, queryClient } = createWrapper()
    const { result } = renderHook(() => useUpdatePresenceSettings(), { wrapper: Wrapper })

    await act(async () => {
      await result.current.mutateAsync({ idleAfterMinutes: 8, offlineAfterMinutes: 45 })
    })

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/monitoring/presence-settings',
      expect.objectContaining({ method: 'PATCH' }),
    )
    expect(queryClient.getQueryData(presenceSettingsQueryKey)).toEqual({
      idleAfterMinutes: 8,
      offlineAfterMinutes: 45,
      updatedAt: '2026-06-25T11:00:00Z',
      updatedBy: 'admin',
    })
  })

  it('lève une erreur si la réponse est non-ok', async () => {
    mockFetchOnce({ error: 'Permission requise : dev/admin' }, { ok: false, status: 403 })
    const { Wrapper } = createWrapper()
    const { result } = renderHook(() => useUpdatePresenceSettings(), { wrapper: Wrapper })

    await expect(
      result.current.mutateAsync({ idleAfterMinutes: 8, offlineAfterMinutes: 45 }),
    ).rejects.toThrow('Permission requise')
  })
})
