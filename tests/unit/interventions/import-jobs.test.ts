import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { importJobsApi, type ImportJobRow } from '@/lib/api/interventions/import-jobs'
import type { RunImportResult } from '@/lib/api/interventions/interventions-import'

// Mock de chaîne Supabase minimal : chaque méthode retourne `this`, et les
// terminaux (`single`/`maybeSingle`) ainsi que le `then` (await direct)
// résolvent le résultat configuré. On expose les vi.fn pour inspecter les
// arguments passés (notamment le patch d'`update`).
function makeChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  for (const m of ['select', 'insert', 'update', 'delete', 'eq', 'in', 'order', 'limit']) {
    chain[m] = vi.fn(() => chain)
  }
  chain.single = vi.fn().mockResolvedValue(result)
  chain.maybeSingle = vi.fn().mockResolvedValue(result)
  // Thenable pour `await chain` (cas list / cancel qui n'ont pas de terminal).
  chain.then = vi.fn((resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve))
  return chain
}

function makeClient(result: { data: unknown; error: unknown }) {
  const chain = makeChain(result)
  const from = vi.fn(() => chain)
  const client = { from } as unknown as SupabaseClient
  return { client, chain, from }
}

const baseRow: ImportJobRow = {
  id: 'job-1',
  created_by: 'auth-uid',
  mode: 'upsert',
  dry_run: false,
  resolutions: null,
  status: 'running',
  stage: null,
  total_rows: null,
  processed_rows: 0,
  inserted_rows: 0,
  updated_rows: 0,
  failed_rows: 0,
  preview: null,
  result: null,
  error_message: null,
  created_at: '2026-05-22T00:00:00Z',
  started_at: null,
  finished_at: null,
  updated_at: '2026-05-22T00:00:00Z',
}

describe('importJobsApi', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('claim', () => {
    it('retourne la ligne quand le job était pending', async () => {
      const { client, chain } = makeClient({ data: baseRow, error: null })
      const res = await importJobsApi.claim(client, 'job-1')
      expect(res).toEqual(baseRow)
      // Transition gardée par status='pending' (idempotence).
      expect(chain.eq).toHaveBeenCalledWith('status', 'pending')
      expect(chain.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'running' }),
      )
    })

    it('retourne null quand le job est déjà pris (zéro ligne)', async () => {
      const { client } = makeClient({ data: null, error: null })
      const res = await importJobsApi.claim(client, 'job-1')
      expect(res).toBeNull()
    })
  })

  describe('finish', () => {
    it('mappe un import réussi en compteurs + statut succeeded', async () => {
      const { client, chain } = makeClient({ data: null, error: null })
      const result: RunImportResult = {
        ok: true,
        body: {
          dry_run: false,
          total: 100,
          valid: 98,
          inserted: 60,
          updated: 38,
          skipped: 2,
          unresolved: 0,
          errors: [{ line: 5, id_inter: 'A1', reason: 'boom' }],
        },
      }
      await importJobsApi.finish(client, 'job-1', result)
      expect(chain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'succeeded',
          inserted_rows: 60,
          updated_rows: 38,
          failed_rows: 1,
          total_rows: 100,
          processed_rows: 100,
        }),
      )
    })

    it('mappe un échec fatal en statut failed + error_message', async () => {
      const { client, chain } = makeClient({ data: null, error: null })
      const result: RunImportResult = { ok: false, status: 500, error: 'DB down' }
      await importJobsApi.finish(client, 'job-1', result)
      expect(chain.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'failed', error_message: 'DB down' }),
      )
    })

    it('stocke le preview pour un dry-run', async () => {
      const { client, chain } = makeClient({ data: null, error: null })
      const preview = { toInsert: [], toUpdate: [], skipped: [], toResolve: [], truncated: false, perBucketLimit: 10000 }
      const result: RunImportResult = {
        ok: true,
        body: {
          dry_run: true, total: 10, valid: 10, inserted: 8, updated: 2,
          skipped: 0, unresolved: 0, errors: [], preview,
        },
      }
      await importJobsApi.finish(client, 'job-1', result)
      expect(chain.update).toHaveBeenCalledWith(expect.objectContaining({ preview }))
    })
  })

  describe('cancel', () => {
    it("ne cible que les jobs encore actifs (pending/running)", async () => {
      const { client, chain } = makeClient({ data: null, error: null })
      await importJobsApi.cancel(client, 'job-1')
      expect(chain.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'cancelled' }),
      )
      expect(chain.in).toHaveBeenCalledWith('status', ['pending', 'running'])
    })
  })

  describe('patchProgress', () => {
    it('renvoie le statut courant (détection annulation)', async () => {
      const { client } = makeClient({ data: { status: 'cancelled' }, error: null })
      const res = await importJobsApi.patchProgress(client, 'job-1', { processed_rows: 50 })
      expect(res.status).toBe('cancelled')
    })
  })
})
