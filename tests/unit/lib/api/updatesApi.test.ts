import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock supabase-client before importing the module under test
const mockSelect = vi.fn()
const mockInsert = vi.fn()
const mockUpdate = vi.fn()
const mockDelete = vi.fn()
const mockEq = vi.fn()
const mockOrder = vi.fn()
const mockSingle = vi.fn()
const mockUpsert = vi.fn()

const mockFrom = vi.fn(() => ({
  select: mockSelect,
  insert: mockInsert,
  update: mockUpdate,
  delete: mockDelete,
  upsert: mockUpsert,
}))

vi.mock('@/lib/supabase-client', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}))

// Build fluent chain helpers
function chainBuilder(finalData: unknown, finalError: unknown = null) {
  const chain: Record<string, any> = {}
  chain.select = vi.fn().mockReturnValue(chain)
  chain.insert = vi.fn().mockReturnValue(chain)
  chain.update = vi.fn().mockReturnValue(chain)
  chain.delete = vi.fn().mockReturnValue(chain)
  chain.upsert = vi.fn().mockReturnValue(chain)
  chain.eq = vi.fn().mockReturnValue(chain)
  chain.order = vi.fn().mockReturnValue(chain)
  chain.single = vi.fn().mockResolvedValue({ data: finalData, error: finalError })
  // For queries that don't end with .single()
  chain.then = undefined
  // Override for terminal calls
  Object.defineProperty(chain, 'then', {
    get() {
      return (resolve: (val: any) => void) =>
        resolve({ data: finalData, error: finalError })
    },
  })
  return chain
}

describe('updatesApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  describe('getAll', () => {
    it('should fetch all updates ordered by created_at desc', async () => {
      const mockUpdates = [
        { id: '1', title: 'Update 1', created_at: '2025-01-01' },
        { id: '2', title: 'Update 2', created_at: '2024-12-01' },
      ]

      const chain = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockUpdates, error: null }),
      }
      mockFrom.mockReturnValue(chain)

      const { updatesApi } = await import('@/lib/api/updatesApi')
      const result = await updatesApi.getAll()

      expect(mockFrom).toHaveBeenCalledWith('app_updates')
      expect(chain.select).toHaveBeenCalledWith('*')
      expect(result).toEqual(mockUpdates)
    })

    it('should throw on error', async () => {
      const chain = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
      }
      mockFrom.mockReturnValue(chain)

      const { updatesApi } = await import('@/lib/api/updatesApi')
      await expect(updatesApi.getAll()).rejects.toThrow('DB error')
    })
  })

  describe('create', () => {
    it('should insert and return the created update', async () => {
      const input = {
        version: '1.00',
        title: 'New Update',
        content: 'Content',
        audience: ['all'],
        target_user_ids: [],
        severity: 'info' as const,
        status: 'draft' as const,
        published_at: null,
        created_by: 'user-1',
      }
      const created = { id: 'new-id', ...input, created_at: '2025-01-01' }

      const chain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: created, error: null }),
      }
      mockFrom.mockReturnValue(chain)

      const { updatesApi } = await import('@/lib/api/updatesApi')
      const result = await updatesApi.create(input)

      expect(mockFrom).toHaveBeenCalledWith('app_updates')
      expect(chain.insert).toHaveBeenCalledWith(input)
      expect(result).toEqual(created)
    })
  })

  describe('remove', () => {
    it('should delete by id', async () => {
      const chain = {
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      }
      mockFrom.mockReturnValue(chain)

      const { updatesApi } = await import('@/lib/api/updatesApi')
      await updatesApi.remove('update-1')

      expect(mockFrom).toHaveBeenCalledWith('app_updates')
      expect(chain.delete).toHaveBeenCalled()
      expect(chain.eq).toHaveBeenCalledWith('id', 'update-1')
    })

    it('should throw on delete error', async () => {
      const chain = {
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: { message: 'Delete failed' } }),
      }
      mockFrom.mockReturnValue(chain)

      const { updatesApi } = await import('@/lib/api/updatesApi')
      await expect(updatesApi.remove('update-1')).rejects.toThrow('Delete failed')
    })
  })

  describe('acknowledgeUpdates', () => {
    it('should do nothing for empty array', async () => {
      const { updatesApi } = await import('@/lib/api/updatesApi')
      await updatesApi.acknowledgeUpdates('user-1', [])
      expect(mockFrom).not.toHaveBeenCalled()
    })

    it('should upsert views for given update ids', async () => {
      const chain = {
        upsert: vi.fn().mockResolvedValue({ error: null }),
      }
      mockFrom.mockReturnValue(chain)

      const { updatesApi } = await import('@/lib/api/updatesApi')
      await updatesApi.acknowledgeUpdates('user-1', ['u1', 'u2'])

      expect(mockFrom).toHaveBeenCalledWith('app_update_views')
      expect(chain.upsert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ update_id: 'u1', user_id: 'user-1' }),
          expect.objectContaining({ update_id: 'u2', user_id: 'user-1' }),
        ]),
        { onConflict: 'update_id,user_id' }
      )
    })
  })
})
