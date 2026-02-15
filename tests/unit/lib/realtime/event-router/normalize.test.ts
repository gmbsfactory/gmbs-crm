import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { normalizePayload } from '@/lib/realtime/event-router/normalize'

// Mock remote-edit-indicator
const mockIsLocalModification = vi.fn().mockReturnValue(false)
vi.mock('@/lib/realtime/remote-edit-indicator', () => ({
  getRemoteEditIndicatorManager: () => ({
    isLocalModification: mockIsLocalModification,
  }),
}))

interface TestRecord { id: string; is_active?: boolean; name?: string }

function makePayload(
  eventType: 'INSERT' | 'UPDATE' | 'DELETE',
  data: { new?: TestRecord | null; old?: TestRecord | null }
): RealtimePostgresChangesPayload<TestRecord> {
  return {
    commit_timestamp: '2025-01-01T00:00:00Z',
    errors: null,
    schema: 'public',
    table: 'test',
    eventType,
    new: data.new ?? null,
    old: data.old ?? null,
  } as RealtimePostgresChangesPayload<TestRecord>
}

describe('normalizePayload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsLocalModification.mockReturnValue(false)
  })

  it('extracts record and previousRecord from INSERT', () => {
    const record = { id: '1', name: 'test' }
    const event = normalizePayload('interventions', makePayload('INSERT', { new: record }))

    expect(event.table).toBe('interventions')
    expect(event.eventType).toBe('INSERT')
    expect(event.record).toEqual(record)
    expect(event.previousRecord).toBeNull()
  })

  it('extracts record and previousRecord from UPDATE', () => {
    const oldRecord = { id: '1', name: 'old' }
    const newRecord = { id: '1', name: 'new' }
    const event = normalizePayload('artisans', makePayload('UPDATE', { old: oldRecord, new: newRecord }))

    expect(event.record).toEqual(newRecord)
    expect(event.previousRecord).toEqual(oldRecord)
  })

  it('extracts previousRecord from DELETE (no new)', () => {
    const oldRecord = { id: '1', name: 'deleted' }
    const event = normalizePayload('interventions', makePayload('DELETE', { old: oldRecord }))

    expect(event.eventType).toBe('DELETE')
    expect(event.record).toBeNull()
    expect(event.previousRecord).toEqual(oldRecord)
  })

  it('detects isAccessRevoked when UPDATE has no new record', () => {
    const oldRecord = { id: '1', is_active: true }
    const event = normalizePayload('interventions', makePayload('UPDATE', { old: oldRecord, new: null }))

    expect(event.meta.isAccessRevoked).toBe(true)
    expect(event.meta.isSoftDelete).toBe(false)
  })

  it('does not flag isAccessRevoked on INSERT', () => {
    const event = normalizePayload('interventions', makePayload('INSERT', { new: { id: '1' } }))
    expect(event.meta.isAccessRevoked).toBe(false)
  })

  it('detects isSoftDelete when is_active goes true→false', () => {
    const oldRecord = { id: '1', is_active: true }
    const newRecord = { id: '1', is_active: false }
    const event = normalizePayload('interventions', makePayload('UPDATE', { old: oldRecord, new: newRecord }))

    expect(event.meta.isSoftDelete).toBe(true)
    expect(event.meta.isAccessRevoked).toBe(false)
  })

  it('does not flag isSoftDelete when is_active stays true', () => {
    const oldRecord = { id: '1', is_active: true }
    const newRecord = { id: '1', is_active: true }
    const event = normalizePayload('interventions', makePayload('UPDATE', { old: oldRecord, new: newRecord }))

    expect(event.meta.isSoftDelete).toBe(false)
  })

  it('detects isRemote=true when not a local modification', () => {
    mockIsLocalModification.mockReturnValue(false)
    const event = normalizePayload('interventions', makePayload('INSERT', { new: { id: '42' } }))

    expect(event.meta.isRemote).toBe(true)
    expect(mockIsLocalModification).toHaveBeenCalledWith('42')
  })

  it('detects isRemote=false when is a local modification', () => {
    mockIsLocalModification.mockReturnValue(true)
    const event = normalizePayload('interventions', makePayload('UPDATE', {
      old: { id: '42' },
      new: { id: '42', name: 'updated' },
    }))

    expect(event.meta.isRemote).toBe(false)
  })

  it('handles empty payloads (no old, no new) gracefully', () => {
    const event = normalizePayload('interventions', makePayload('DELETE', {}))

    expect(event.record).toBeNull()
    expect(event.previousRecord).toBeNull()
    expect(event.meta.isRemote).toBe(true)
  })
})
