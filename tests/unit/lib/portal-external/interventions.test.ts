import { describe, it, expect } from 'vitest'
import { pickPortalReport } from '@/lib/portal-external/interventions'

describe('pickPortalReport', () => {
  it('should return null without report', () => {
    expect(pickPortalReport([])).toBeNull()
  })

  it('should return the first (most recent) report when none is pending', () => {
    const reports = [{ id: 'b', status: 'approved' }, { id: 'a', status: 'rejected' }]
    expect(pickPortalReport(reports)?.id).toBe('b')
  })

  it('should prefer the submitted report even if an approved one is more recent', () => {
    const reports = [
      { id: 'sofia-v2', status: 'approved' },
      { id: 'karim-v1', status: 'submitted' },
      { id: 'sofia-v1', status: 'rejected' },
    ]
    expect(pickPortalReport(reports)?.id).toBe('karim-v1')
  })

  it('should keep the first submitted report when several are pending', () => {
    const reports = [{ id: 'k', status: 'submitted' }, { id: 's', status: 'submitted' }]
    expect(pickPortalReport(reports)?.id).toBe('k')
  })
})
