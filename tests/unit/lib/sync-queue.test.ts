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

  describe('race conditions and concurrent mutations', () => {
    // Helper to create a manually-controllable promise
    function deferred<T>() {
      let resolve!: (value: T) => void
      let reject!: (err: unknown) => void
      const promise = new Promise<T>((res, rej) => {
        resolve = res
        reject = rej
      })
      return { promise, resolve, reject }
    }

    it('should prevent reentrant processBatch while a batch is in flight', async () => {
      // First call hangs, so the in-flight batch never finishes within the test window.
      const d = deferred<{ id: string }>()
      mockUpdate.mockImplementationOnce(() => d.promise)

      queue.enqueue({ interventionId: 'int-1', type: 'update', data: { id_inter: 'A' } })

      // First interval tick — kicks off processBatch and awaits mockUpdate.
      await vi.advanceTimersByTimeAsync(5000)
      expect(mockUpdate).toHaveBeenCalledTimes(1)

      // Second interval tick fires while the first batch is still in flight.
      // The `processing` guard must short-circuit — no new API call.
      await vi.advanceTimersByTimeAsync(5000)
      expect(mockUpdate).toHaveBeenCalledTimes(1)

      // Third tick — still guarded.
      await vi.advanceTimersByTimeAsync(5000)
      expect(mockUpdate).toHaveBeenCalledTimes(1)

      // Resolve the in-flight call so processing can drain and the lock releases.
      d.resolve({ id: 'int-1' })
      await vi.advanceTimersByTimeAsync(0)

      expect(queue.getPending()).toHaveLength(0)
    })

    it('should not lose items enqueued while a batch is in flight', async () => {
      const d = deferred<{ id: string }>()
      mockUpdate.mockImplementationOnce(() => d.promise)

      queue.enqueue({ interventionId: 'int-1', type: 'update', data: { id_inter: 'A' } })
      await vi.advanceTimersByTimeAsync(5000)
      expect(mockUpdate).toHaveBeenCalledTimes(1)

      // Mid-flight enqueue — must land in the queue and survive the in-flight batch.
      queue.enqueue({ interventionId: 'int-2', type: 'create', data: { id_inter: 'B' } })
      expect(
        queue.getPending().some((m) => m.interventionId === 'int-2'),
      ).toBe(true)

      // First batch finishes; int-1 dequeued, int-2 still pending.
      d.resolve({ id: 'int-1' })
      await vi.advanceTimersByTimeAsync(0)

      const pending = queue.getPending()
      expect(pending).toHaveLength(1)
      expect(pending[0].interventionId).toBe('int-2')

      // Next interval picks up the new item.
      await vi.advanceTimersByTimeAsync(5000)
      expect(mockCreate).toHaveBeenCalledWith({ id_inter: 'B' })
      expect(queue.getPending()).toHaveLength(0)
    })

    it('should handle dequeueByInterventionId called mid-batch without resurrecting the item', async () => {
      const d = deferred<{ id: string }>()
      mockUpdate.mockImplementationOnce(() => d.promise)

      queue.enqueue({ interventionId: 'int-1', type: 'update', data: {} })
      await vi.advanceTimersByTimeAsync(5000)
      expect(mockUpdate).toHaveBeenCalledTimes(1)

      // External removal while the API call is in flight. The batch operates on a
      // snapshot, so the in-flight call still completes — but the final dequeue
      // becomes a no-op against an already-empty queue.
      queue.dequeueByInterventionId('int-1')
      expect(queue.getPending()).toHaveLength(0)

      d.resolve({ id: 'int-1' })
      await vi.advanceTimersByTimeAsync(0)

      expect(queue.getPending()).toHaveLength(0)

      // Subsequent intervals must not re-trigger anything.
      await vi.advanceTimersByTimeAsync(5000)
      await vi.advanceTimersByTimeAsync(5000)
      expect(mockUpdate).toHaveBeenCalledTimes(1)
    })

    it('should not resurrect items when clear() is called mid-batch', async () => {
      const d1 = deferred<{ id: string }>()
      mockUpdate
        .mockImplementationOnce(() => d1.promise)
        .mockResolvedValue({ id: 'snapshot-tail' })

      queue.enqueue({ interventionId: 'int-1', type: 'update', data: { id_inter: 'A' } })
      queue.enqueue({ interventionId: 'int-2', type: 'update', data: { id_inter: 'B' } })

      await vi.advanceTimersByTimeAsync(5000)
      expect(mockUpdate).toHaveBeenCalledTimes(1)

      // External clear during processing. The current batch snapshot still drains,
      // but nothing new should reappear afterwards.
      queue.clear()
      expect(queue.getPending()).toHaveLength(0)

      d1.resolve({ id: 'int-1' })
      await vi.advanceTimersByTimeAsync(0)

      expect(queue.getPending()).toHaveLength(0)

      // Next interval is a no-op — no items to process.
      await vi.advanceTimersByTimeAsync(5000)
      expect(queue.getPending()).toHaveLength(0)
    })

    it('should respect BATCH_SIZE and process remaining items on the next interval (FIFO)', async () => {
      for (let i = 0; i < 12; i++) {
        queue.enqueue({
          interventionId: `int-${i}`,
          type: 'update',
          data: { id_inter: `id-${i}` },
        })
      }
      expect(queue.getPending()).toHaveLength(12)

      // First batch processes 10 items.
      await vi.advanceTimersByTimeAsync(5000)
      expect(mockUpdate).toHaveBeenCalledTimes(10)

      // FIFO order — first 10 enqueued processed first.
      for (let i = 0; i < 10; i++) {
        expect(mockUpdate).toHaveBeenNthCalledWith(i + 1, `int-${i}`, { id_inter: `id-${i}` })
      }

      const remaining = queue.getPending()
      expect(remaining).toHaveLength(2)
      expect(remaining.map((m) => m.interventionId)).toEqual(['int-10', 'int-11'])

      // Next interval drains the rest.
      await vi.advanceTimersByTimeAsync(5000)
      expect(mockUpdate).toHaveBeenCalledTimes(12)
      expect(queue.getPending()).toHaveLength(0)
    })

    it('should isolate failures: a failing item leaves siblings successfully processed', async () => {
      // int-1 succeeds, int-2 fails all 3 internal retries, int-3 succeeds.
      mockUpdate
        .mockResolvedValueOnce({ id: 'int-1' })
        .mockRejectedValueOnce(new Error('fail'))
        .mockRejectedValueOnce(new Error('fail'))
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValueOnce({ id: 'int-3' })

      queue.enqueue({ interventionId: 'int-1', type: 'update', data: { id_inter: '1' } })
      queue.enqueue({ interventionId: 'int-2', type: 'update', data: { id_inter: '2' } })
      queue.enqueue({ interventionId: 'int-3', type: 'update', data: { id_inter: '3' } })

      // Drain interval (t=5000) + the 1s/2s internal backoff for int-2.
      // Note: with maxRetries=3 the third attempt is the last, so only 2 sleeps fire.
      // We must stay below t=10000 to avoid the next interval re-processing int-2.
      await vi.advanceTimersByTimeAsync(5000) // t=5000: batch starts, int-1 ok, int-2 attempt 1 fails, sleep(1000)
      await vi.advanceTimersByTimeAsync(1000) // t=6000: int-2 attempt 2 fails, sleep(2000)
      await vi.advanceTimersByTimeAsync(2000) // t=8000: int-2 attempt 3 (last) fails, retryCount=1, then int-3 ok

      // 1 success + 3 failed attempts + 1 success = 5 calls total.
      expect(mockUpdate).toHaveBeenCalledTimes(5)

      const pending = queue.getPending()
      expect(pending).toHaveLength(1)
      expect(pending[0].interventionId).toBe('int-2')
      expect(pending[0].retryCount).toBe(1)
    })

    it('should release the processing lock after a failing batch so the next interval proceeds', async () => {
      mockUpdate.mockRejectedValue(new Error('persistent failure'))
      queue.enqueue({ interventionId: 'int-1', type: 'update', data: {} })

      // First batch (t=5000) + 1s/2s backoff. Last attempt = no trailing sleep.
      await vi.advanceTimersByTimeAsync(5000) // t=5000: attempt 1 fails, sleep(1000)
      await vi.advanceTimersByTimeAsync(1000) // t=6000: attempt 2 fails, sleep(2000)
      await vi.advanceTimersByTimeAsync(2000) // t=8000: attempt 3 (last) fails, retryCount=1

      expect(mockUpdate).toHaveBeenCalledTimes(3)
      const afterFirstBatch = queue.getPending()
      expect(afterFirstBatch).toHaveLength(1)
      expect(afterFirstBatch[0].retryCount).toBe(1)

      // Next interval at t=10000. If the processing lock had leaked, we'd still
      // see only 3 calls. Drain its 1s/2s backoff too — staying below t=15000.
      await vi.advanceTimersByTimeAsync(2000) // t=10000: interval fires, attempt 1 fails, sleep(1000)
      await vi.advanceTimersByTimeAsync(1000) // t=11000: attempt 2 fails, sleep(2000)
      await vi.advanceTimersByTimeAsync(2000) // t=13000: attempt 3 (last) fails, retryCount=2

      expect(mockUpdate).toHaveBeenCalledTimes(6)
      expect(queue.getPending()[0].retryCount).toBe(2)
    })
  })
})
