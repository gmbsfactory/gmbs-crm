import { vi, type Mock } from 'vitest'

/**
 * Client Supabase « planifié » pour les tests des routes du portail.
 *
 * Chaque appel `from(table)` consomme le résultat suivant du plan de cette
 * table (le dernier se répète). Toutes les méthodes de filtre sont chaînables ;
 * `single()`, `maybeSingle()` et `await` renvoient le résultat. Les appels
 * sont enregistrés (`calls`) pour vérifier les insertions / mises à jour.
 */

export interface PlannedResult {
  data: unknown
  error: { message: string; code?: string } | null
}

export interface RecordedCall {
  table: string
  op: 'select' | 'insert' | 'update' | 'delete' | 'upsert' | null
  payload?: unknown
  filters: Array<[string, ...unknown[]]>
}

export interface PlannedClient {
  from: Mock
  storage: { from: Mock }
  /** Invocations d'Edge Functions (`process-avatar`…), enregistrées et sans effet. */
  functions: { invoke: Mock }
  calls: RecordedCall[]
  uploads: Array<{ bucket: string; path: string; size: number; contentType?: string }>
  invocations: Array<{ name: string; body: unknown }>
}

const FILTER_METHODS = [
  'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'is', 'in', 'contains',
  'order', 'limit', 'range', 'not', 'or', 'filter', 'match',
] as const

export function createPlannedClient(plan: Record<string, PlannedResult[]>): PlannedClient {
  const counters: Record<string, number> = {}
  const calls: RecordedCall[] = []
  const uploads: PlannedClient['uploads'] = []

  const from = vi.fn((table: string) => {
    const list = plan[table] ?? [{ data: null, error: null }]
    const idx = counters[table] ?? 0
    counters[table] = idx + 1
    const result = list[Math.min(idx, list.length - 1)]
    const call: RecordedCall = { table, op: null, filters: [] }
    calls.push(call)

    const chain: Record<string, unknown> = {}
    for (const op of ['select', 'insert', 'update', 'delete', 'upsert'] as const) {
      chain[op] = vi.fn((payload?: unknown) => {
        if (op !== 'select') {
          call.op = op
          call.payload = payload
        } else if (!call.op) {
          call.op = 'select'
        }
        return chain
      })
    }
    for (const m of FILTER_METHODS) {
      chain[m] = vi.fn((...args: unknown[]) => {
        call.filters.push([m, ...args])
        return chain
      })
    }
    chain.single = vi.fn(() => Promise.resolve(result))
    chain.maybeSingle = vi.fn(() => Promise.resolve(result))
    chain.then = (resolve: (v: PlannedResult) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject)
    return chain
  })

  const storage = {
    from: vi.fn((bucket: string) => ({
      upload: vi.fn(async (path: string, body: Buffer, options?: { contentType?: string }) => {
        uploads.push({ bucket, path, size: body.length, contentType: options?.contentType })
        return { data: { path }, error: null }
      }),
      getPublicUrl: vi.fn((path: string) => ({ data: { publicUrl: `http://storage.local/${bucket}/${path}` } })),
    })),
  }

  const invocations: PlannedClient['invocations'] = []
  const functions = {
    invoke: vi.fn(async (name: string, options?: { body?: unknown }) => {
      invocations.push({ name, body: options?.body })
      return { data: { success: true }, error: null }
    }),
  }

  return { from, storage, functions, calls, uploads, invocations }
}

/** Ligne `artisan_portal_tokens` valide (jointure artisan incluse) pour un jeton de test. */
export function validTokenRow(overrides: Partial<{ is_active: boolean; expires_at: string; artisan_is_active: boolean }> = {}) {
  return {
    id: 'tok-1',
    artisan_id: 'art-1',
    is_active: overrides.is_active ?? true,
    expires_at: overrides.expires_at ?? new Date(Date.now() + 86_400_000).toISOString(),
    artisan: {
      id: 'art-1',
      prenom: 'Karim',
      nom: 'Benali',
      raison_sociale: 'BENALI PLOMBERIE',
      email: 'karim@example.invalid',
      telephone: '06 00 00 10 01',
      statut_dossier: 'INCOMPLET',
      is_active: overrides.artisan_is_active ?? true,
      statut: { code: 'CONFIRME' },
    },
  }
}

/** Jeton de test (64 hex) et en-têtes machine à machine attendus par les routes. */
export const TEST_TOKEN = 'a'.repeat(64)
export const TEST_KEY_ID = 'demo-key-id'
export const TEST_SECRET = 'demo-secret-value'

export function portalHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'X-GMBS-Key-Id': TEST_KEY_ID,
    'X-GMBS-Secret': TEST_SECRET,
    'X-Portal-Token': TEST_TOKEN,
    ...extra,
  }
}
