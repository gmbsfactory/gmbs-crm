import { describe, it, expect, vi } from 'vitest'
import { createPipeline } from '@/lib/realtime/event-router/pipeline'
import { STOP } from '@/lib/realtime/event-router/types'
import type { CrmEvent, SyncContext, SyncMiddleware } from '@/lib/realtime/event-router/types'
import { QueryClient } from '@tanstack/react-query'

interface TestRecord { id: string }

function makeEvent(overrides?: Partial<CrmEvent<TestRecord>>): CrmEvent<TestRecord> {
  return {
    table: 'test',
    eventType: 'UPDATE',
    record: { id: '1' },
    previousRecord: null,
    meta: { isAccessRevoked: false, isSoftDelete: false, isRemote: true },
    ...overrides,
  }
}

function makeCtx(): SyncContext {
  return {
    queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
    currentUserId: 'user-1',
    options: {},
  }
}

describe('createPipeline', () => {
  it('runs middleware in order', async () => {
    const order: number[] = []
    const step1: SyncMiddleware<TestRecord> = () => { order.push(1) }
    const step2: SyncMiddleware<TestRecord> = () => { order.push(2) }
    const step3: SyncMiddleware<TestRecord> = () => { order.push(3) }

    const pipeline = createPipeline(step1, step2, step3)
    await pipeline(makeEvent(), makeCtx())

    expect(order).toEqual([1, 2, 3])
  })

  it('stops on STOP sentinel', async () => {
    const order: number[] = []
    const step1: SyncMiddleware<TestRecord> = () => { order.push(1) }
    const step2: SyncMiddleware<TestRecord> = () => { order.push(2); return STOP }
    const step3: SyncMiddleware<TestRecord> = () => { order.push(3) }

    const pipeline = createPipeline(step1, step2, step3)
    await pipeline(makeEvent(), makeCtx())

    expect(order).toEqual([1, 2])
  })

  it('handles async middleware', async () => {
    const order: number[] = []
    const step1: SyncMiddleware<TestRecord> = async () => {
      await new Promise((r) => setTimeout(r, 1))
      order.push(1)
    }
    const step2: SyncMiddleware<TestRecord> = () => { order.push(2) }

    const pipeline = createPipeline(step1, step2)
    await pipeline(makeEvent(), makeCtx())

    expect(order).toEqual([1, 2])
  })

  it('handles empty pipeline (no-op)', async () => {
    const pipeline = createPipeline<TestRecord>()
    // Should not throw
    await pipeline(makeEvent(), makeCtx())
  })

  it('passes event and ctx to each middleware', async () => {
    const spy = vi.fn()
    const event = makeEvent()
    const ctx = makeCtx()

    const pipeline = createPipeline<TestRecord>(spy)
    await pipeline(event, ctx)

    expect(spy).toHaveBeenCalledWith(event, ctx)
  })
})
