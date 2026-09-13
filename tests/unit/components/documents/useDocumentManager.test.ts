import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockGetAll = vi.fn()
const mockGetSupportedTypes = vi.fn()
const mockUploadDocument = vi.fn()

const mockToast = {
  success: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
}

vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToast.success(...args),
    warning: (...args: unknown[]) => mockToast.warning(...args),
    error: (...args: unknown[]) => mockToast.error(...args),
  },
}))

vi.mock('@/lib/api', () => ({
  documentsApi: {
    getAll: (...args: unknown[]) => mockGetAll(...args),
    getSupportedTypes: (...args: unknown[]) => mockGetSupportedTypes(...args),
    update: vi.fn(),
    delete: vi.fn(),
  },
}))

vi.mock('@/hooks/useDocumentUpload', () => ({
  useDocumentUpload: () => ({
    uploadDocument: (...args: unknown[]) => mockUploadDocument(...args),
    loading: false,
    error: null,
    progress: 0,
  }),
}))

import { useDocumentManager } from '@/components/documents/useDocumentManager'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const INTERVENTION_ID = 'cb5df3c7-6d8e-4fd0-a257-db99dbfd93ba'

const KINDS = [
  { kind: 'photos', label: 'Photos' },
  { kind: 'facturesArtisans', label: 'Factures artisans' },
]

function makeDoc(overrides: Record<string, unknown> = {}) {
  return {
    id: 'doc-1',
    kind: 'photos',
    url: 'https://example.test/doc-1.jpg',
    filename: 'photo.jpg',
    mime_type: 'image/jpeg',
    created_at: '2026-09-10T08:43:26.687Z',
    ...overrides,
  }
}

function makeResponse(items: unknown[]) {
  return {
    data: items,
    pagination: { limit: null, offset: 0, total: items.length, hasMore: false },
  }
}

function renderManager() {
  return renderHook(() =>
    useDocumentManager({
      entityType: 'intervention',
      entityId: INTERVENTION_ID,
      kinds: KINDS,
      accept: 'image/*,application/pdf',
    }),
  )
}

function makeFile(name: string) {
  return new File(['contenu'], name, { type: 'application/pdf' })
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useDocumentManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetAll.mockResolvedValue(makeResponse([]))
    mockGetSupportedTypes.mockResolvedValue({ allowed_mime_types: [] })
    mockUploadDocument.mockResolvedValue('https://example.test/uploaded.pdf')
  })

  describe('fetchDocuments', () => {
    it('should request documents without any limit or offset', async () => {
      renderManager()

      await waitFor(() => expect(mockGetAll).toHaveBeenCalled())

      const params = mockGetAll.mock.calls[0][0]
      expect(params).toEqual({
        entity_type: 'intervention',
        entity_id: INTERVENTION_ID,
      })
      // Régression : demander une fenêtre paginée masquait les documents
      // ajoutés après les 50 premières lignes.
      expect(params).not.toHaveProperty('limit')
      expect(params).not.toHaveProperty('offset')
    })

    it('should expose every document returned, well past the old 50-row window', async () => {
      const many = Array.from({ length: 107 }, (_, i) =>
        makeDoc({
          id: `doc-${i}`,
          kind: i < 96 ? 'photos' : 'facturesArtisans',
          created_at: new Date(Date.UTC(2026, 8, 10, 8, 0, i)).toISOString(),
        }),
      )
      mockGetAll.mockResolvedValue(makeResponse(many))

      const { result } = renderManager()

      await waitFor(() => expect(result.current.rows).toHaveLength(107))
      expect(
        result.current.rows.filter((row) => row.kind === 'facturesArtisans'),
      ).toHaveLength(11)
    })
  })

  describe('tri des documents', () => {
    it('should order rows by date of addition, most recent first', async () => {
      mockGetAll.mockResolvedValue(
        makeResponse([
          makeDoc({ id: 'ancien', created_at: '2026-09-10T08:43:26.687Z' }),
          makeDoc({ id: 'recent', created_at: '2026-09-10T13:50:56.536Z' }),
          makeDoc({ id: 'milieu', created_at: '2026-09-10T09:03:14.825Z' }),
        ]),
      )

      const { result } = renderManager()

      await waitFor(() => expect(result.current.rows).toHaveLength(3))
      expect(result.current.rows.map((row) => row.id)).toEqual([
        'recent',
        'milieu',
        'ancien',
      ])
    })
  })

  describe('processUploadQueue — retour utilisateur', () => {
    it('should announce success when every upload succeeds', async () => {
      const { result } = renderManager()
      await waitFor(() => expect(mockGetAll).toHaveBeenCalled())

      await act(async () => {
        await result.current.processUploadQueue('facturesArtisans', [
          makeFile('facture-1.pdf'),
          makeFile('facture-2.pdf'),
        ])
      })

      expect(mockToast.success).toHaveBeenCalledWith(
        expect.stringContaining('2 document(s) importé(s)'),
      )
      expect(mockToast.warning).not.toHaveBeenCalled()
    })

    it('should not announce success when every upload fails', async () => {
      mockUploadDocument.mockRejectedValue(new Error('storage indisponible'))

      const { result } = renderManager()
      await waitFor(() => expect(mockGetAll).toHaveBeenCalled())

      await act(async () => {
        await result.current.processUploadQueue('facturesArtisans', [
          makeFile('facture-1.pdf'),
        ])
      })

      // Régression : le succès était annoncé même quand rien n'avait été importé.
      expect(mockToast.success).not.toHaveBeenCalled()
      expect(mockToast.error).toHaveBeenCalledWith(
        expect.stringContaining("Aucun document n'a pu être importé"),
      )
    })

    it('should report a partial import when only some uploads succeed', async () => {
      mockUploadDocument
        .mockResolvedValueOnce('https://example.test/ok.pdf')
        .mockRejectedValueOnce(new Error('fichier trop volumineux'))

      const { result } = renderManager()
      await waitFor(() => expect(mockGetAll).toHaveBeenCalled())

      await act(async () => {
        await result.current.processUploadQueue('facturesArtisans', [
          makeFile('facture-1.pdf'),
          makeFile('facture-2.pdf'),
        ])
      })

      expect(mockToast.success).not.toHaveBeenCalled()
      expect(mockToast.warning).toHaveBeenCalledWith(
        expect.stringContaining('1 document(s) importé(s) sur 2'),
      )
    })
  })
})
