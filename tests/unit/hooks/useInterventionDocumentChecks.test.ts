import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockGetAll = vi.fn()

vi.mock('@/lib/api/documentsApi', () => ({
  documentsApi: {
    getAll: (...args: unknown[]) => mockGetAll(...args),
  },
}))

import { useInterventionDocumentChecks } from '@/hooks/useInterventionDocumentChecks'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makePaginatedResponse<T>(items: T[]) {
  return {
    data: items,
    pagination: { limit: 100, offset: 0, total: items.length, hasMore: false },
  }
}

const FACTURE_DOC = { id: 'doc-1', kind: 'facturesGMBS', name: 'facture.pdf' }
const DEVIS_DOC   = { id: 'doc-2', kind: 'devis',        name: 'devis.pdf'   }

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useInterventionDocumentChecks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── Initial state ──────────────────────────────────────────────────────────

  describe('initial fetch — no documents', () => {
    it('should return hasFactureGMBS=false and hasDevis=false when no documents exist', async () => {
      mockGetAll.mockResolvedValue(makePaginatedResponse([]))

      const { result } = renderHook(() =>
        useInterventionDocumentChecks('inter-1')
      )

      await waitFor(() => {
        expect(mockGetAll).toHaveBeenCalledTimes(2)
      })

      expect(result.current.hasFactureGMBS).toBe(false)
      expect(result.current.hasDevis).toBe(false)
    })

    it('should call documentsApi.getAll with correct params for facturesGMBS', async () => {
      mockGetAll.mockResolvedValue(makePaginatedResponse([]))

      renderHook(() => useInterventionDocumentChecks('inter-42'))

      await waitFor(() => expect(mockGetAll).toHaveBeenCalledTimes(2))

      expect(mockGetAll).toHaveBeenCalledWith({
        entity_id: 'inter-42',
        entity_type: 'intervention',
        kind: 'facturesGMBS',
      })
    })

    it('should call documentsApi.getAll with correct params for devis', async () => {
      mockGetAll.mockResolvedValue(makePaginatedResponse([]))

      renderHook(() => useInterventionDocumentChecks('inter-42'))

      await waitFor(() => expect(mockGetAll).toHaveBeenCalledTimes(2))

      expect(mockGetAll).toHaveBeenCalledWith({
        entity_id: 'inter-42',
        entity_type: 'intervention',
        kind: 'devis',
      })
    })
  })

  // ── Documents present ──────────────────────────────────────────────────────

  describe('initial fetch — documents present', () => {
    it('should return hasFactureGMBS=true and hasDevis=true when both documents exist', async () => {
      mockGetAll.mockImplementation(({ kind }: { kind: string }) => {
        if (kind === 'facturesGMBS') return Promise.resolve(makePaginatedResponse([FACTURE_DOC]))
        if (kind === 'devis')        return Promise.resolve(makePaginatedResponse([DEVIS_DOC]))
        return Promise.resolve(makePaginatedResponse([]))
      })

      const { result } = renderHook(() =>
        useInterventionDocumentChecks('inter-1')
      )

      await waitFor(() => {
        expect(result.current.hasFactureGMBS).toBe(true)
        expect(result.current.hasDevis).toBe(true)
      })
    })

    it('should return hasFactureGMBS=true and hasDevis=false when only facture exists', async () => {
      mockGetAll.mockImplementation(({ kind }: { kind: string }) => {
        if (kind === 'facturesGMBS') return Promise.resolve(makePaginatedResponse([FACTURE_DOC]))
        return Promise.resolve(makePaginatedResponse([]))
      })

      const { result } = renderHook(() =>
        useInterventionDocumentChecks('inter-1')
      )

      await waitFor(() => expect(mockGetAll).toHaveBeenCalledTimes(2))

      expect(result.current.hasFactureGMBS).toBe(true)
      expect(result.current.hasDevis).toBe(false)
    })

    it('should return hasFactureGMBS=false and hasDevis=true when only devis exists', async () => {
      mockGetAll.mockImplementation(({ kind }: { kind: string }) => {
        if (kind === 'devis') return Promise.resolve(makePaginatedResponse([DEVIS_DOC]))
        return Promise.resolve(makePaginatedResponse([]))
      })

      const { result } = renderHook(() =>
        useInterventionDocumentChecks('inter-1')
      )

      await waitFor(() => expect(mockGetAll).toHaveBeenCalledTimes(2))

      expect(result.current.hasFactureGMBS).toBe(false)
      expect(result.current.hasDevis).toBe(true)
    })
  })

  // ── Error handling ─────────────────────────────────────────────────────────

  describe('error handling', () => {
    it('should keep hasFactureGMBS=false when facturesGMBS API call throws', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      mockGetAll.mockImplementation(({ kind }: { kind: string }) => {
        if (kind === 'facturesGMBS') return Promise.reject(new Error('Network error'))
        return Promise.resolve(makePaginatedResponse([]))
      })

      const { result } = renderHook(() =>
        useInterventionDocumentChecks('inter-1')
      )

      await waitFor(() => expect(mockGetAll).toHaveBeenCalledTimes(2))

      expect(result.current.hasFactureGMBS).toBe(false)
      expect(result.current.hasDevis).toBe(false)

      errorSpy.mockRestore()
    })

    it('should keep hasDevis=false when devis API call throws', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      mockGetAll.mockImplementation(({ kind }: { kind: string }) => {
        if (kind === 'devis') return Promise.reject(new Error('Unauthorized'))
        return Promise.resolve(makePaginatedResponse([FACTURE_DOC]))
      })

      const { result } = renderHook(() =>
        useInterventionDocumentChecks('inter-1')
      )

      await waitFor(() => expect(mockGetAll).toHaveBeenCalledTimes(2))

      expect(result.current.hasFactureGMBS).toBe(true)
      expect(result.current.hasDevis).toBe(false)

      errorSpy.mockRestore()
    })

    it('should not throw when both API calls fail', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      mockGetAll.mockRejectedValue(new Error('Server error'))

      const { result } = renderHook(() =>
        useInterventionDocumentChecks('inter-1')
      )

      await waitFor(() => expect(mockGetAll).toHaveBeenCalledTimes(2))

      expect(result.current.hasFactureGMBS).toBe(false)
      expect(result.current.hasDevis).toBe(false)

      errorSpy.mockRestore()
    })
  })

  // ── Refresh callbacks ──────────────────────────────────────────────────────

  describe('refreshFactureGMBS', () => {
    it('should re-check facturesGMBS and update hasFactureGMBS', async () => {
      // First call: empty; subsequent calls: document exists
      mockGetAll
        .mockResolvedValueOnce(makePaginatedResponse([]))  // facturesGMBS initial
        .mockResolvedValueOnce(makePaginatedResponse([]))  // devis initial
        .mockResolvedValueOnce(makePaginatedResponse([FACTURE_DOC])) // facturesGMBS refresh

      const { result } = renderHook(() =>
        useInterventionDocumentChecks('inter-1')
      )

      await waitFor(() => expect(mockGetAll).toHaveBeenCalledTimes(2))
      expect(result.current.hasFactureGMBS).toBe(false)

      await act(async () => {
        await result.current.refreshFactureGMBS()
      })

      expect(result.current.hasFactureGMBS).toBe(true)
    })

    it('should only re-fetch facturesGMBS (not devis) when refreshFactureGMBS is called', async () => {
      mockGetAll.mockResolvedValue(makePaginatedResponse([]))

      const { result } = renderHook(() =>
        useInterventionDocumentChecks('inter-1')
      )

      await waitFor(() => expect(mockGetAll).toHaveBeenCalledTimes(2))
      mockGetAll.mockClear()

      await act(async () => {
        await result.current.refreshFactureGMBS()
      })

      expect(mockGetAll).toHaveBeenCalledTimes(1)
      expect(mockGetAll).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'facturesGMBS' })
      )
    })
  })

  describe('refreshDevis', () => {
    it('should re-check devis and update hasDevis', async () => {
      mockGetAll
        .mockResolvedValueOnce(makePaginatedResponse([]))  // facturesGMBS initial
        .mockResolvedValueOnce(makePaginatedResponse([]))  // devis initial
        .mockResolvedValueOnce(makePaginatedResponse([DEVIS_DOC])) // devis refresh

      const { result } = renderHook(() =>
        useInterventionDocumentChecks('inter-1')
      )

      await waitFor(() => expect(mockGetAll).toHaveBeenCalledTimes(2))
      expect(result.current.hasDevis).toBe(false)

      await act(async () => {
        await result.current.refreshDevis()
      })

      expect(result.current.hasDevis).toBe(true)
    })

    it('should only re-fetch devis (not facturesGMBS) when refreshDevis is called', async () => {
      mockGetAll.mockResolvedValue(makePaginatedResponse([]))

      const { result } = renderHook(() =>
        useInterventionDocumentChecks('inter-1')
      )

      await waitFor(() => expect(mockGetAll).toHaveBeenCalledTimes(2))
      mockGetAll.mockClear()

      await act(async () => {
        await result.current.refreshDevis()
      })

      expect(mockGetAll).toHaveBeenCalledTimes(1)
      expect(mockGetAll).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'devis' })
      )
    })
  })

  // ── Empty interventionId ───────────────────────────────────────────────────

  describe('empty interventionId', () => {
    it('should not call documentsApi.getAll when interventionId is empty string', () => {
      renderHook(() => useInterventionDocumentChecks(''))

      expect(mockGetAll).not.toHaveBeenCalled()
    })

    it('should return hasFactureGMBS=false and hasDevis=false when interventionId is empty', () => {
      const { result } = renderHook(() =>
        useInterventionDocumentChecks('')
      )

      expect(result.current.hasFactureGMBS).toBe(false)
      expect(result.current.hasDevis).toBe(false)
    })

    it('should not call API when refresh functions are called with empty interventionId', async () => {
      const { result } = renderHook(() =>
        useInterventionDocumentChecks('')
      )

      await act(async () => {
        await result.current.refreshFactureGMBS()
        await result.current.refreshDevis()
      })

      expect(mockGetAll).not.toHaveBeenCalled()
    })
  })
})
