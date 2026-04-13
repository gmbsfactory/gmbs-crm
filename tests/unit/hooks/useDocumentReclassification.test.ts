import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockGetAll = vi.fn()
const mockUpdate = vi.fn()

vi.mock('@/lib/api/documentsApi', () => ({
  documentsApi: {
    getAll: (...args: unknown[]) => mockGetAll(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
  },
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

import { useDocumentReclassification } from '@/hooks/useDocumentReclassification'
import { toast } from 'sonner'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const makeDoc = (id: string, kind: string, name = `doc-${id}.pdf`) => ({
  id,
  kind,
  name,
  filename: name,
  mime_type: 'application/pdf',
  file_size: 1024,
  created_at: '2026-01-01T00:00:00Z',
})

const DOCS = {
  classified: makeDoc('doc-1', 'facturesGMBS', 'FACTURE 10 INTER 20.pdf'),
  aClasse1: makeDoc('doc-2', 'a_classe', 'scan_inconnu.pdf'),
  aClasse2: makeDoc('doc-3', 'a_classe', 'photo_chantier.jpg'),
  kbis: makeDoc('doc-4', 'kbis', 'KBIS_entreprise.pdf'),
}

function makePaginatedResponse<T>(items: T[]) {
  return {
    data: items,
    pagination: { limit: 100, offset: 0, total: items.length, hasMore: false },
  }
}

// ─── Wrapper ──────────────────────────────────────────────────────────────────

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

// ─────────────────────────────────────────────────────────────────────────────

describe('useDocumentReclassification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── Data fetching ──────────────────────────────────────────────────────────

  describe('data fetching', () => {
    it('should fetch documents for the given entity', async () => {
      mockGetAll.mockResolvedValue(makePaginatedResponse([DOCS.classified, DOCS.aClasse1]))

      const { result } = renderHook(
        () => useDocumentReclassification({ entityType: 'intervention', entityId: 'inter-1' }),
        { wrapper: createWrapper() }
      )

      await waitFor(() => expect(result.current.isLoading).toBe(false))

      expect(mockGetAll).toHaveBeenCalledWith({
        entity_type: 'intervention',
        entity_id: 'inter-1',
      })
      expect(result.current.allDocuments).toHaveLength(2)
    })

    it('should not fetch when enabled is false', () => {
      const { result } = renderHook(
        () => useDocumentReclassification({ entityType: 'intervention', entityId: 'inter-1', enabled: false }),
        { wrapper: createWrapper() }
      )

      expect(mockGetAll).not.toHaveBeenCalled()
      expect(result.current.isLoading).toBe(false)
    })

    it('should return empty arrays when API returns empty', async () => {
      mockGetAll.mockResolvedValue(makePaginatedResponse([]))

      const { result } = renderHook(
        () => useDocumentReclassification({ entityType: 'artisan', entityId: 'art-1' }),
        { wrapper: createWrapper() }
      )

      await waitFor(() => expect(result.current.isLoading).toBe(false))
      expect(result.current.allDocuments).toHaveLength(0)
      expect(result.current.documentsToReclassify).toHaveLength(0)
    })
  })

  // ── Filtering ──────────────────────────────────────────────────────────────

  describe('documentsToReclassify', () => {
    it('should only return documents with kind "a_classe"', async () => {
      mockGetAll.mockResolvedValue(
        makePaginatedResponse([DOCS.classified, DOCS.aClasse1, DOCS.aClasse2, DOCS.kbis])
      )

      const { result } = renderHook(
        () => useDocumentReclassification({ entityType: 'intervention', entityId: 'inter-1' }),
        { wrapper: createWrapper() }
      )

      await waitFor(() => expect(result.current.isLoading).toBe(false))

      expect(result.current.allDocuments).toHaveLength(4)
      expect(result.current.documentsToReclassify).toHaveLength(2)
      expect(result.current.documentsToReclassify.every((d: { kind: string }) => d.kind === 'a_classe')).toBe(true)
    })

    it('should return empty array when no documents are a_classe', async () => {
      mockGetAll.mockResolvedValue(makePaginatedResponse([DOCS.classified, DOCS.kbis]))

      const { result } = renderHook(
        () => useDocumentReclassification({ entityType: 'intervention', entityId: 'inter-1' }),
        { wrapper: createWrapper() }
      )

      await waitFor(() => expect(result.current.isLoading).toBe(false))
      expect(result.current.documentsToReclassify).toHaveLength(0)
    })
  })

  // ── reclassify (mutation simple) ───────────────────────────────────────────

  describe('reclassify', () => {
    it('should call documentsApi.update with correct params for intervention', async () => {
      mockGetAll.mockResolvedValue(makePaginatedResponse([DOCS.aClasse1]))
      mockUpdate.mockResolvedValue({ ...DOCS.aClasse1, kind: 'facturesGMBS' })

      const { result } = renderHook(
        () => useDocumentReclassification({ entityType: 'intervention', entityId: 'inter-1' }),
        { wrapper: createWrapper() }
      )

      await waitFor(() => expect(result.current.isLoading).toBe(false))

      await act(async () => {
        await result.current.reclassifyAsync({ documentId: 'doc-2', newKind: 'facturesGMBS' })
      })

      expect(mockUpdate).toHaveBeenCalledWith('doc-2', { kind: 'facturesGMBS' }, 'intervention')
    })

    it('should pass entityType "artisan" to update for artisan entity', async () => {
      mockGetAll.mockResolvedValue(makePaginatedResponse([DOCS.aClasse1]))
      mockUpdate.mockResolvedValue({ ...DOCS.aClasse1, kind: 'kbis' })

      const { result } = renderHook(
        () => useDocumentReclassification({ entityType: 'artisan', entityId: 'art-1' }),
        { wrapper: createWrapper() }
      )

      await waitFor(() => expect(result.current.isLoading).toBe(false))

      await act(async () => {
        await result.current.reclassifyAsync({ documentId: 'doc-2', newKind: 'kbis' })
      })

      expect(mockUpdate).toHaveBeenCalledWith('doc-2', { kind: 'kbis' }, 'artisan')
    })

    it('should show success toast after reclassification', async () => {
      mockGetAll.mockResolvedValue(makePaginatedResponse([DOCS.aClasse1]))
      mockUpdate.mockResolvedValue({ ...DOCS.aClasse1, kind: 'assurance' })

      const { result } = renderHook(
        () => useDocumentReclassification({ entityType: 'intervention', entityId: 'inter-1' }),
        { wrapper: createWrapper() }
      )

      await waitFor(() => expect(result.current.isLoading).toBe(false))

      await act(async () => {
        await result.current.reclassifyAsync({ documentId: 'doc-2', newKind: 'assurance' })
      })

      expect(toast.success).toHaveBeenCalledWith('Document reclassifié en "assurance"')
    })

    it('should show error toast when update fails', async () => {
      mockGetAll.mockResolvedValue(makePaginatedResponse([DOCS.aClasse1]))
      mockUpdate.mockRejectedValue(new Error('Accès refusé'))

      const { result } = renderHook(
        () => useDocumentReclassification({ entityType: 'intervention', entityId: 'inter-1' }),
        { wrapper: createWrapper() }
      )

      await waitFor(() => expect(result.current.isLoading).toBe(false))

      await act(async () => {
        try {
          await result.current.reclassifyAsync({ documentId: 'doc-2', newKind: 'kbis' })
        } catch {
          // attendu
        }
      })

      expect(toast.error).toHaveBeenCalledWith('Accès refusé')
    })
  })

  // ── batchReclassify ────────────────────────────────────────────────────────

  describe('batchReclassifyAsync', () => {
    it('should call update for each document in the batch', async () => {
      mockGetAll.mockResolvedValue(makePaginatedResponse([DOCS.aClasse1, DOCS.aClasse2]))
      mockUpdate.mockResolvedValue({})

      const { result } = renderHook(
        () => useDocumentReclassification({ entityType: 'intervention', entityId: 'inter-1' }),
        { wrapper: createWrapper() }
      )

      await waitFor(() => expect(result.current.isLoading).toBe(false))

      await act(async () => {
        await result.current.batchReclassifyAsync([
          { documentId: 'doc-2', newKind: 'facturesGMBS' },
          { documentId: 'doc-3', newKind: 'photos' },
        ])
      })

      expect(mockUpdate).toHaveBeenCalledTimes(2)
      expect(mockUpdate).toHaveBeenCalledWith('doc-2', { kind: 'facturesGMBS' }, 'intervention')
      expect(mockUpdate).toHaveBeenCalledWith('doc-3', { kind: 'photos' }, 'intervention')
    })

    it('should show batch success toast with count', async () => {
      mockGetAll.mockResolvedValue(makePaginatedResponse([DOCS.aClasse1, DOCS.aClasse2]))
      mockUpdate.mockResolvedValue({})

      const { result } = renderHook(
        () => useDocumentReclassification({ entityType: 'intervention', entityId: 'inter-1' }),
        { wrapper: createWrapper() }
      )

      await waitFor(() => expect(result.current.isLoading).toBe(false))

      await act(async () => {
        await result.current.batchReclassifyAsync([
          { documentId: 'doc-2', newKind: 'facturesGMBS' },
          { documentId: 'doc-3', newKind: 'photos' },
        ])
      })

      expect(toast.success).toHaveBeenCalledWith('2 document(s) reclassifié(s) avec succès')
    })

    it('should show error toast if any update in the batch fails', async () => {
      mockGetAll.mockResolvedValue(makePaginatedResponse([DOCS.aClasse1, DOCS.aClasse2]))
      mockUpdate
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(new Error('Erreur réseau'))

      const { result } = renderHook(
        () => useDocumentReclassification({ entityType: 'intervention', entityId: 'inter-1' }),
        { wrapper: createWrapper() }
      )

      await waitFor(() => expect(result.current.isLoading).toBe(false))

      await act(async () => {
        try {
          await result.current.batchReclassifyAsync([
            { documentId: 'doc-2', newKind: 'facturesGMBS' },
            { documentId: 'doc-3', newKind: 'photos' },
          ])
        } catch {
          // attendu
        }
      })

      expect(toast.error).toHaveBeenCalledWith('Erreur réseau')
    })
  })
})
