import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  EmailAttachmentError,
  loadEmailAttachments,
  markAttachmentsAsSentToArtisan,
  toNodemailerAttachment,
} from '@/lib/services/email-attachment-loader'

const INTERVENTION_ID = 'i-0001'

interface Row {
  id: string
  kind: string
  url: string
  filename: string | null
  mime_type: string | null
  file_size: number | null
}

function storageRow(overrides: Partial<Row> = {}): Row {
  return {
    id: overrides.id ?? 'att-1',
    kind: overrides.kind ?? 'devis',
    url:
      overrides.url ??
      'http://127.0.0.1:54321/storage/v1/object/public/documents/intervention/i-0001/devis.pdf',
    filename: overrides.filename ?? 'devis.pdf',
    mime_type: overrides.mime_type ?? 'application/pdf',
    file_size: overrides.file_size ?? 1024,
  }
}

interface StubOptions {
  rows?: Row[]
  selectError?: { message: string } | null
  downloads?: Record<string, Buffer>
  downloadError?: boolean
  updateError?: { message: string } | null
}

/** Client Supabase minimal : un select filtrable, un storage téléchargeable, un update tracé. */
function createStub(options: StubOptions = {}) {
  const updates: Array<{ payload: unknown; filters: Array<[string, ...unknown[]]> }> = []
  const downloadedPaths: string[] = []

  const from = vi.fn(() => {
    const filters: Array<[string, ...unknown[]]> = []
    const chain: Record<string, unknown> = {}
    let currentPayload: unknown = null

    chain.select = vi.fn(() => chain)
    chain.update = vi.fn((payload: unknown) => {
      currentPayload = payload
      return chain
    })
    for (const method of ['eq', 'in', 'is'] as const) {
      chain[method] = vi.fn((...args: unknown[]) => {
        filters.push([method, ...args])
        if (method === 'is' && currentPayload !== null) {
          updates.push({ payload: currentPayload, filters: [...filters] })
        }
        return chain
      })
    }
    chain.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => {
      const result = currentPayload !== null
        ? { data: null, error: options.updateError ?? null }
        : { data: options.rows ?? [], error: options.selectError ?? null }
      return Promise.resolve(result).then(resolve, reject)
    }
    return chain
  })

  const storage = {
    from: vi.fn(() => ({
      download: vi.fn(async (path: string) => {
        downloadedPaths.push(path)
        if (options.downloadError) {
          return { data: null, error: { message: 'not found' } }
        }
        const buffer = options.downloads?.[path] ?? Buffer.from('contenu-pdf')
        return {
          data: { arrayBuffer: async () => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) },
          error: null,
        }
      }),
    })),
  }

  return { client: { from, storage } as unknown as SupabaseClient, updates, downloadedPaths, from }
}

describe('email-attachment-loader', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('loadEmailAttachments', () => {
    it('should ne rien lire quand aucune pièce n\'est cochée (non-régression de l\'envoi sans pièce)', async () => {
      const stub = createStub()
      const loaded = await loadEmailAttachments(stub.client, INTERVENTION_ID, [])

      expect(loaded).toEqual([])
      expect(stub.from).not.toHaveBeenCalled()
      expect(stub.downloadedPaths).toEqual([])
    })

    it('should lire les octets dans le stockage et non dans le corps de la requête', async () => {
      const stub = createStub({ rows: [storageRow()] })
      const loaded = await loadEmailAttachments(stub.client, INTERVENTION_ID, ['att-1'])

      expect(stub.downloadedPaths).toEqual(['intervention/i-0001/devis.pdf'])
      expect(loaded).toHaveLength(1)
      expect(loaded[0].content).toBeInstanceOf(Buffer)
      expect(loaded[0].content.toString()).toBe('contenu-pdf')
      expect(loaded[0].filename).toBe('devis.pdf')
      expect(loaded[0].mimeType).toBe('application/pdf')
    })

    it('should accepter un fichier de 8 Mo, impossible avant le lot L7', async () => {
      const big = Buffer.alloc(8 * 1024 * 1024, 1)
      const stub = createStub({
        rows: [storageRow({ file_size: big.length })],
        downloads: { 'intervention/i-0001/devis.pdf': big },
      })

      const loaded = await loadEmailAttachments(stub.client, INTERVENTION_ID, ['att-1'])
      expect(loaded[0].content.length).toBe(8 * 1024 * 1024)
    })

    it('should refuser un total au-delà du plafond SMTP', async () => {
      const stub = createStub({ rows: [storageRow({ file_size: 21 * 1024 * 1024 })] })

      await expect(loadEmailAttachments(stub.client, INTERVENTION_ID, ['att-1'])).rejects.toMatchObject({
        name: 'EmailAttachmentError',
        status: 413,
      })
      expect(stub.downloadedPaths).toEqual([])
    })

    it('should refuser un total réel au-delà du plafond, même si file_size mentait', async () => {
      const big = Buffer.alloc(21 * 1024 * 1024, 1)
      const stub = createStub({
        rows: [storageRow({ file_size: 10 })],
        downloads: { 'intervention/i-0001/devis.pdf': big },
      })

      await expect(loadEmailAttachments(stub.client, INTERVENTION_ID, ['att-1'])).rejects.toMatchObject({
        status: 413,
      })
    })

    it('should refuser une pièce qui n\'appartient pas à l\'intervention', async () => {
      const stub = createStub({ rows: [] })

      await expect(loadEmailAttachments(stub.client, INTERVENTION_ID, ['att-inconnue'])).rejects.toMatchObject({
        status: 404,
      })
    })

    it('should refuser une facture GMBS : elle ne part jamais chez l\'artisan', async () => {
      const stub = createStub({ rows: [storageRow({ kind: 'facturesGMBS', filename: 'facture-client.pdf' })] })

      const promise = loadEmailAttachments(stub.client, INTERVENTION_ID, ['att-1'])
      await expect(promise).rejects.toBeInstanceOf(EmailAttachmentError)
      await expect(promise).rejects.toMatchObject({ status: 400 })
      expect(stub.downloadedPaths).toEqual([])
    })

    it('should refuser plus de cinq pièces', async () => {
      const stub = createStub({ rows: [] })
      const ids = ['a', 'b', 'c', 'd', 'e', 'f']

      await expect(loadEmailAttachments(stub.client, INTERVENTION_ID, ids)).rejects.toMatchObject({ status: 400 })
      expect(stub.from).not.toHaveBeenCalled()
    })

    it('should dédoublonner les identifiants envoyés deux fois', async () => {
      const stub = createStub({ rows: [storageRow()] })
      const loaded = await loadEmailAttachments(stub.client, INTERVENTION_ID, ['att-1', 'att-1'])
      expect(loaded).toHaveLength(1)
    })

    it('should signaler un fichier absent du stockage sans envoyer l\'e-mail', async () => {
      const stub = createStub({ rows: [storageRow()], downloadError: true })

      await expect(loadEmailAttachments(stub.client, INTERVENTION_ID, ['att-1'])).rejects.toMatchObject({
        status: 502,
      })
    })

    it('should retomber sur une lecture HTTP pour une pièce hébergée hors du bucket', async () => {
      const fetchMock = vi.fn(async () => ({
        ok: true,
        status: 200,
        arrayBuffer: async () => new TextEncoder().encode('depuis-http').buffer,
      }))
      vi.stubGlobal('fetch', fetchMock)

      const stub = createStub({ rows: [storageRow({ url: 'https://legacy.invalid/devis.pdf' })] })
      const loaded = await loadEmailAttachments(stub.client, INTERVENTION_ID, ['att-1'])

      expect(fetchMock).toHaveBeenCalledWith('https://legacy.invalid/devis.pdf')
      expect(loaded[0].content.toString()).toBe('depuis-http')
      expect(stub.downloadedPaths).toEqual([])
      vi.unstubAllGlobals()
    })
  })

  describe('toNodemailerAttachment', () => {
    it('should produire une pièce nodemailer avec un type par défaut', () => {
      const attachment = toNodemailerAttachment({
        id: 'att-1',
        kind: 'autre',
        filename: 'note.bin',
        mimeType: null,
        content: Buffer.from('x'),
      })

      expect(attachment).toEqual({
        filename: 'note.bin',
        content: expect.any(Buffer),
        contentType: 'application/octet-stream',
      })
    })
  })

  describe('markAttachmentsAsSentToArtisan', () => {
    it('should n\'estampiller que les pièces jamais envoyées (WAL borné, une seule fois)', async () => {
      const stub = createStub()
      const ok = await markAttachmentsAsSentToArtisan(
        stub.client,
        ['att-1', 'att-2'],
        'log-1',
        '2026-09-12T08:00:00.000Z',
      )

      expect(ok).toBe(true)
      expect(stub.updates).toHaveLength(1)
      expect(stub.updates[0].payload).toEqual({
        sent_to_artisan_at: '2026-09-12T08:00:00.000Z',
        sent_to_artisan_email_log_id: 'log-1',
      })
      expect(stub.updates[0].filters).toEqual([
        ['in', 'id', ['att-1', 'att-2']],
        ['is', 'sent_to_artisan_at', null],
      ])
    })

    it('should ne rien écrire sans pièce', async () => {
      const stub = createStub()
      await markAttachmentsAsSentToArtisan(stub.client, [], 'log-1')
      expect(stub.from).not.toHaveBeenCalled()
    })

    it('should ne jamais faire échouer l\'envoi si l\'estampillage rate', async () => {
      const stub = createStub({ updateError: { message: 'permission denied' } })
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await expect(markAttachmentsAsSentToArtisan(stub.client, ['att-1'], 'log-1')).resolves.toBe(false)
      expect(spy).toHaveBeenCalled()
      spy.mockRestore()
    })
  })
})
