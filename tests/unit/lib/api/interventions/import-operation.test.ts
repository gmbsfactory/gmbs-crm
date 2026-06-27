import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks (vi.hoisted : disponibles dans les factories vi.mock hoistées) ──────
const { adminMock, createClientMock } = vi.hoisted(() => ({
  adminMock: { rpc: vi.fn(), from: vi.fn() },
  createClientMock: vi.fn(() => ({ __client: true })),
}))
vi.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => createClientMock(...args),
}))
vi.mock('@/lib/supabase-admin', () => ({ supabaseAdmin: adminMock }))
// `server-only` lève hors contexte RSC (Vitest = Node) ; on neutralise la barrière en test.
vi.mock('server-only', () => ({}))

import {
  makeImportServiceClient,
  createImportOperation,
  finalizeImportOperation,
  resolveImportActor,
  IMPORT_OPERATION_TYPE,
} from '@/lib/api/interventions/import-operation'

describe('import-operation (Phase 3)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.SUPABASE_URL = 'https://proj.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'svc-key'
  })

  describe('makeImportServiceClient', () => {
    it('should créer un client service_role portant les en-têtes d\'opération', () => {
      makeImportServiceClient('op-123')
      expect(createClientMock).toHaveBeenCalledTimes(1)
      const [url, key, options] = createClientMock.mock.calls[0] as [string, string, Record<string, any>]
      expect(url).toBe('https://proj.supabase.co')
      expect(key).toBe('svc-key')
      expect(options.global.headers['x-crm-operation-id']).toBe('op-123')
      expect(options.global.headers['x-crm-operation-type']).toBe(IMPORT_OPERATION_TYPE)
      expect(options.auth.persistSession).toBe(false)
    })

    it('should throw quand la config service_role est absente', () => {
      delete process.env.SUPABASE_URL
      delete process.env.NEXT_PUBLIC_SUPABASE_URL
      delete process.env.SUPABASE_SERVICE_ROLE_KEY
      expect(() => makeImportServiceClient('op-1')).toThrow()
    })
  })

  describe('createImportOperation', () => {
    it('should insérer une ligne running attribuée à l\'acteur et retourner son id', async () => {
      const single = vi.fn().mockResolvedValue({ data: { id: 'op-xyz' }, error: null })
      const insert = vi.fn(() => ({ select: () => ({ single }) }))
      adminMock.from.mockReturnValue({ insert })

      const id = await createImportOperation({
        actor: { userId: 'u1', display: 'Harold D.', code: 'HD', color: '#fff' },
        fileName: 'export.csv',
        mode: 'upsert',
      })

      expect(id).toBe('op-xyz')
      expect(adminMock.from).toHaveBeenCalledWith('data_operation_log')
      const payload = insert.mock.calls[0][0] as Record<string, unknown>
      expect(payload.operation_type).toBe(IMPORT_OPERATION_TYPE)
      expect(payload.status).toBe('running')
      expect(payload.dry_run).toBe(false)
      expect(payload.actor_user_id).toBe('u1')
      expect(payload.actor_display).toBe('Harold D.')
      expect(payload.mode).toBe('upsert')
      expect(payload.file_name).toBe('export.csv')
    })

    it('should throw quand l\'insert échoue', async () => {
      const single = vi.fn().mockResolvedValue({ data: null, error: { message: 'boom' } })
      adminMock.from.mockReturnValue({ insert: () => ({ select: () => ({ single }) }) })
      await expect(
        createImportOperation({ actor: { userId: null, display: null, code: null, color: null }, fileName: null, mode: 'create' }),
      ).rejects.toThrow()
    })
  })

  describe('finalizeImportOperation', () => {
    it('should mapper les compteurs du rapport et clore en success', async () => {
      const eq = vi.fn().mockResolvedValue({ error: null })
      const update = vi.fn(() => ({ eq }))
      adminMock.from.mockReturnValue({ update })

      await finalizeImportOperation('op-1', 'success', {
        dry_run: false, total: 10, valid: 9, inserted: 7, updated: 2, skipped: 1, unresolved: 0,
        errors: [{ line: 3, id_inter: null, reason: 'x' }],
      })

      const patch = update.mock.calls[0][0] as Record<string, unknown>
      expect(patch.status).toBe('success')
      expect(patch.total_count).toBe(10)
      expect(patch.inserted_count).toBe(7)
      expect(patch.updated_count).toBe(2)
      expect(patch.skipped_count).toBe(1)
      expect(patch.error_count).toBe(1)
      expect(patch.metadata).toBeUndefined()
      expect(eq).toHaveBeenCalledWith('id', 'op-1')
    })

    it('should clore en failed sans rapport (compteurs null)', async () => {
      const eq = vi.fn().mockResolvedValue({ error: null })
      const update = vi.fn(() => ({ eq }))
      adminMock.from.mockReturnValue({ update })
      await finalizeImportOperation('op-2', 'failed')
      const patch = update.mock.calls[0][0] as Record<string, unknown>
      expect(patch.status).toBe('failed')
      expect(patch.total_count).toBeNull()
      expect(patch.error_count).toBeNull()
      expect(patch.metadata).toBeUndefined()
    })

    it('should stocker la raison dans metadata en cas de failed', async () => {
      const eq = vi.fn().mockResolvedValue({ error: null })
      const update = vi.fn(() => ({ eq }))
      adminMock.from.mockReturnValue({ update })
      await finalizeImportOperation('op-3', 'failed', undefined, 'CSV invalide')
      const patch = update.mock.calls[0][0] as Record<string, unknown>
      expect(patch.status).toBe('failed')
      expect(patch.metadata).toEqual({ reason: 'CSV invalide' })
    })
  })

  describe('resolveImportActor', () => {
    it('should mapper le snapshot get_actor_snapshot', async () => {
      adminMock.rpc.mockResolvedValue({
        data: [{ actor_user_id: 'u1', actor_display: 'Harold', actor_code: 'HD', actor_color: '#abc' }],
        error: null,
      })
      const actor = await resolveImportActor('u1')
      expect(adminMock.rpc).toHaveBeenCalledWith('get_actor_snapshot', { p_user_id: 'u1' })
      expect(actor).toEqual({ userId: 'u1', display: 'Harold', code: 'HD', color: '#abc' })
    })

    it('should retomber sur le user id quand la rpc échoue', async () => {
      adminMock.rpc.mockResolvedValue({ data: null, error: { message: 'no' } })
      const actor = await resolveImportActor('u9')
      expect(actor.userId).toBe('u9')
      expect(actor.display).toBeNull()
    })
  })
})
