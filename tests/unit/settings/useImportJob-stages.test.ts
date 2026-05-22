import { describe, it, expect } from 'vitest'
import { stagesFromJob } from '@/features/settings/import-job-stages'
import type { ImportJobRow } from '@/lib/api/interventions/import-jobs'

type JobSnapshot = Pick<ImportJobRow, 'status' | 'stage' | 'processed_rows' | 'total_rows'>

const snap = (s: Partial<JobSnapshot>): JobSnapshot => ({
  status: 'running',
  stage: null,
  processed_rows: 0,
  total_rows: null,
  ...s,
})

const byId = (stages: ReturnType<typeof stagesFromJob>) =>
  Object.fromEntries(stages.map((s) => [s.id, s]))

describe('stagesFromJob', () => {
  it('marque les stages précédentes comme done et la courante active', () => {
    const m = byId(stagesFromJob(snap({ stage: 'lookup' })))
    expect(m.parsing.status).toBe('done')
    expect(m.validating.status).toBe('done')
    expect(m.lookup.status).toBe('active')
    expect(m.persisting.status).toBe('idle')
    expect(m.done.status).toBe('idle')
  })

  it('expose la progression pour validating (processed/total)', () => {
    const m = byId(stagesFromJob(snap({ stage: 'validating', processed_rows: 3000, total_rows: 6000 })))
    expect(m.validating.status).toBe('active')
    expect(m.validating.progress).toBeCloseTo(0.5)
    expect(m.validating.detail).toBe('3 000 / 6 000')
  })

  it('rattache le stage "parsed" du worker à "parsing"', () => {
    const m = byId(stagesFromJob(snap({ stage: 'parsed' })))
    expect(m.parsing.status).toBe('active')
  })

  it('met toutes les stages à done quand le job a réussi', () => {
    const stages = stagesFromJob(snap({ status: 'succeeded', stage: 'persisting' }))
    expect(stages.every((s) => s.status === 'done')).toBe(true)
  })

  it('met la stage courante en erreur quand le job a échoué', () => {
    const m = byId(stagesFromJob(snap({ status: 'failed', stage: 'persisting' })))
    expect(m.persisting.status).toBe('error')
    // Les stages antérieures restent done.
    expect(m.parsing.status).toBe('done')
  })

  it('traite une annulation comme une erreur visuelle sur la stage courante', () => {
    const m = byId(stagesFromJob(snap({ status: 'cancelled', stage: 'validating' })))
    expect(m.validating.status).toBe('error')
  })
})
