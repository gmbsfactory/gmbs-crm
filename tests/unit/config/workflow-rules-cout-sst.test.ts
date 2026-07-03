import { describe, it, expect } from 'vitest'
import { VALIDATION_RULES } from '@/config/workflow-rules'

// Le coût SST à 0 correspond au cas "travaux offerts" par l'artisan.
// La règle doit accepter 0 mais toujours bloquer l'absence de valeur.
describe('workflow-rules — INTER_EN_COURS_COUT_SST (travaux offerts)', () => {
  const rule = VALIDATION_RULES.find((r) => r.key === 'INTER_EN_COURS_COUT_SST')

  it('exists, blocks the transition and targets INTER_EN_COURS', () => {
    expect(rule).toBeDefined()
    expect(rule?.blockTransition).toBe(true)
    expect(rule?.to).toBe('INTER_EN_COURS')
  })

  it('accepts a coût SST of exactly 0 (travaux offerts)', () => {
    expect(rule?.validate({ coutSST: 0 } as any)).toBe(true)
  })

  it('accepts a positive coût SST', () => {
    expect(rule?.validate({ coutSST: 150 } as any)).toBe(true)
  })

  it('blocks when coût SST is missing (null / undefined / absent)', () => {
    expect(rule?.validate({ coutSST: null } as any)).toBe(false)
    expect(rule?.validate({ coutSST: undefined } as any)).toBe(false)
    expect(rule?.validate({} as any)).toBe(false)
  })

  it('blocks a negative coût SST', () => {
    expect(rule?.validate({ coutSST: -10 } as any)).toBe(false)
  })
})
