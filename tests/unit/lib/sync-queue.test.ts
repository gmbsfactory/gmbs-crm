import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock interventionsApi
const mockCreate = vi.fn().mockResolvedValue({ id: 'new-id' })
const mockUpdate = vi.fn().mockResolvedValue({ id: 'existing-id' })
const mockDelete = vi.fn().mockResolvedValue({ message: 'deleted', data: { id: 'deleted-id' } })

vi.mock('@/lib/api/v2', () => ({
  interventionsApi: {
    create: mockCreate,
    update: mockUpdate,
    delete: mockDelete,
  },
}))

// Mock realtime-client to avoid import issues
vi.mock('@/lib/realtime/realtime-client', () => ({
  isNetworkError: vi.fn(() => false),
}))

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value }),
    removeItem: vi.fn((key: string) => { delete store[key] }),
    clear: vi.fn(() => { store = {} }),
  }
})()

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock })

import { SyncQueue } from '@/lib/realtime/sync-queue'
import type { QueuedModification } from '@/lib/realtime/sync-queue'

describe('SyncQueue', () => {
  let queue: SyncQueue

  beforeEach(() => {
    vi.clearAllMocks()
    mockCreate.mockResolvedValue({ id: 'new-id' })
    mockUpdate.mockResolvedValue({ id: 'existing-id' })
    mockDelete.mockResolvedValue({ message: 'deleted', data: { id: 'deleted-id' } })
    localStorageMock.clear()
    vi.useFakeTimers()
    queue = new SyncQueue()
  })

  afterEach(() => {
    queue.stopBatchProcessing()
    vi.useRealTimers()
  })

  describe('syncModification (via processBatch)', () => {
    const createModification = (
      overrides: Partial<QueuedModification> = {}
    ): Omit<QueuedModification, 'id' | 'timestamp' | 'retryCount'> => ({
      interventionId: 'intervention-123',
      type: 'update',
      data: { id_inter: 'INT-001' },
      ...overrides,
    })

    it('should call interventionsApi.create for create type', async () => {
      queue.enqueue(createModification({ type: 'create', data: { id_inter: 'INT-NEW' } }))

      // Trigger batch processing
      await vi.advanceTimersByTimeAsync(5000)

      expect(mockCreate).toHaveBeenCalledWith({ id_inter: 'INT-NEW' })
      expect(queue.getPending()).toHaveLength(0)
    })

    it('should call interventionsApi.update for update type', async () => {
      queue.enqueue(
        createModification({
          type: 'update',
          interventionId: 'intervention-456',
          data: { id_inter: 'INT-UPD' },
        })
      )

      await vi.advanceTimersByTimeAsync(5000)

      expect(mockUpdate).toHaveBeenCalledWith('intervention-456', { id_inter: 'INT-UPD' })
      expect(queue.getPending()).toHaveLength(0)
    })

    it('should call interventionsApi.delete for delete type', async () => {
      queue.enqueue(
        createModification({
          type: 'delete',
          interventionId: 'intervention-789',
          data: {},
        })
      )

      await vi.advanceTimersByTimeAsync(5000)

      expect(mockDelete).toHaveBeenCalledWith('intervention-789')
      expect(queue.getPending()).toHaveLength(0)
    })

    it('should handle API errors with retry and eventual removal', async () => {
      mockUpdate.mockRejectedValue(new Error('Network error'))

      queue.enqueue(createModification({ type: 'update' }))

      // First batch attempt (triggers syncModificationWithRetry with 3 internal retries)
      // The internal retry delays are 1s, 2s, 4s - we need to advance through them
      await vi.advanceTimersByTimeAsync(5000)
      // Allow internal retries to complete
      await vi.advanceTimersByTimeAsync(1000)
      await vi.advanceTimersByTimeAsync(2000)
      await vi.advanceTimersByTimeAsync(4000)

      // After first batch processBatch call, retryCount becomes 1
      // Second batch interval
      await vi.advanceTimersByTimeAsync(5000)
      await vi.advanceTimersByTimeAsync(1000)
      await vi.advanceTimersByTimeAsync(2000)
      await vi.advanceTimersByTimeAsync(4000)

      // Third batch interval
      await vi.advanceTimersByTimeAsync(5000)
      await vi.advanceTimersByTimeAsync(1000)
      await vi.advanceTimersByTimeAsync(2000)
      await vi.advanceTimersByTimeAsync(4000)

      // After 3 retryCount, the modification should be removed
      expect(queue.getPending()).toHaveLength(0)
    })

    it('should process multiple modifications in a batch', async () => {
      queue.enqueue(createModification({ type: 'create', data: { id_inter: 'A' } }))
      queue.enqueue(
        createModification({ type: 'update', interventionId: 'id-B', data: { id_inter: 'B' } })
      )
      queue.enqueue(createModification({ type: 'delete', interventionId: 'id-C', data: {} }))

      await vi.advanceTimersByTimeAsync(5000)

      expect(mockCreate).toHaveBeenCalledTimes(1)
      expect(mockUpdate).toHaveBeenCalledTimes(1)
      expect(mockDelete).toHaveBeenCalledTimes(1)
      expect(queue.getPending()).toHaveLength(0)
    })
  })

  describe('enqueue and dequeue', () => {
    it('should enqueue a modification', () => {
      queue.enqueue({
        interventionId: 'int-1',
        type: 'update',
        data: { id_inter: 'test' },
      })

      const pending = queue.getPending()
      expect(pending).toHaveLength(1)
      expect(pending[0].interventionId).toBe('int-1')
      expect(pending[0].type).toBe('update')
      expect(pending[0].retryCount).toBe(0)
    })

    it('should dequeue by id', () => {
      queue.enqueue({ interventionId: 'int-1', type: 'update', data: {} })
      const pending = queue.getPending()
      queue.dequeue(pending[0].id)
      expect(queue.getPending()).toHaveLength(0)
    })

    it('should dequeue by interventionId', () => {
      queue.enqueue({ interventionId: 'int-1', type: 'update', data: {} })
      queue.enqueue({ interventionId: 'int-1', type: 'create', data: {} })
      queue.enqueue({ interventionId: 'int-2', type: 'delete', data: {} })

      queue.dequeueByInterventionId('int-1')
      const pending = queue.getPending()
      expect(pending).toHaveLength(1)
      expect(pending[0].interventionId).toBe('int-2')
    })

    it('should evict oldest modification when queue is full', () => {
      // Fill queue to MAX_QUEUE_SIZE (50)
      for (let i = 0; i < 50; i++) {
        queue.enqueue({ interventionId: `int-${i}`, type: 'update', data: {} })
      }
      expect(queue.getPending()).toHaveLength(50)

      // Adding one more should evict the oldest
      queue.enqueue({ interventionId: 'int-new', type: 'create', data: {} })
      const pending = queue.getPending()
      expect(pending).toHaveLength(50)
      expect(pending[0].interventionId).toBe('int-1') // int-0 was evicted
      expect(pending[pending.length - 1].interventionId).toBe('int-new')
    })
  })

  describe('clear', () => {
    it('should clear all pending modifications', () => {
      queue.enqueue({ interventionId: 'int-1', type: 'update', data: {} })
      queue.enqueue({ interventionId: 'int-2', type: 'create', data: {} })
      expect(queue.getPending()).toHaveLength(2)

      queue.clear()
      expect(queue.getPending()).toHaveLength(0)
    })
  })
})
