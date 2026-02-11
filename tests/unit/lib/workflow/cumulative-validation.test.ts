import { describe, it, expect } from 'vitest'
import {
  getPredecessorStatuses,
  isOnCumulativeChain,
  getEntryRulesForStatus,
  getCumulativeEntryRules,
} from '@/lib/workflow/cumulative-validation'
import type { InterventionStatusValue } from '@/types/interventions'

describe('cumulative-validation', () => {
  describe('getPredecessorStatuses', () => {
    it('should return empty for DEMANDE (first on chain)', () => {
      expect(getPredecessorStatuses('DEMANDE')).toEqual([])
    })

    it('should return [DEMANDE] for DEVIS_ENVOYE', () => {
      expect(getPredecessorStatuses('DEVIS_ENVOYE')).toEqual(['DEMANDE'])
    })

    it('should return [DEMANDE, DEVIS_ENVOYE] for ACCEPTE', () => {
      expect(getPredecessorStatuses('ACCEPTE')).toEqual(['DEMANDE', 'DEVIS_ENVOYE'])
    })

    it('should return [DEMANDE, DEVIS_ENVOYE, ACCEPTE] for INTER_EN_COURS', () => {
      expect(getPredecessorStatuses('INTER_EN_COURS')).toEqual([
        'DEMANDE',
        'DEVIS_ENVOYE',
        'ACCEPTE',
      ])
    })

    it('should return [DEMANDE, DEVIS_ENVOYE, ACCEPTE, INTER_EN_COURS] for INTER_TERMINEE', () => {
      expect(getPredecessorStatuses('INTER_TERMINEE')).toEqual([
        'DEMANDE',
        'DEVIS_ENVOYE',
        'ACCEPTE',
        'INTER_EN_COURS',
      ])
    })

    it('should return empty for off-chain statuses', () => {
      const offChainStatuses: InterventionStatusValue[] = [
        'VISITE_TECHNIQUE',
        'STAND_BY',
        'REFUSE',
        'ANNULE',
        'SAV',
        'ATT_ACOMPTE',
        'POTENTIEL',
      ]
      for (const status of offChainStatuses) {
        expect(getPredecessorStatuses(status)).toEqual([])
      }
    })
  })

  describe('isOnCumulativeChain', () => {
    it('should return true for all chain members', () => {
      const chainStatuses: InterventionStatusValue[] = [
        'DEMANDE',
        'DEVIS_ENVOYE',
        'ACCEPTE',
        'INTER_EN_COURS',
        'INTER_TERMINEE',
      ]
      for (const status of chainStatuses) {
        expect(isOnCumulativeChain(status)).toBe(true)
      }
    })

    it('should return false for off-chain statuses', () => {
      const offChainStatuses: InterventionStatusValue[] = [
        'VISITE_TECHNIQUE',
        'STAND_BY',
        'REFUSE',
        'ANNULE',
        'SAV',
        'ATT_ACOMPTE',
        'POTENTIEL',
      ]
      for (const status of offChainStatuses) {
        expect(isOnCumulativeChain(status)).toBe(false)
      }
    })
  })

  describe('getEntryRulesForStatus', () => {
    it('should return rules with to=DEVIS_ENVOYE and no from', () => {
      const rules = getEntryRulesForStatus('DEVIS_ENVOYE')
      const ruleKeys = rules.map(r => r.key)

      expect(ruleKeys).toContain('DEVIS_ENVOYE_NOM_FACTURATION')
      expect(ruleKeys).toContain('DEVIS_ENVOYE_ASSIGNED_USER')
    })

    it('should include rules matching via statuses array', () => {
      const rules = getEntryRulesForStatus('DEVIS_ENVOYE')
      const ruleKeys = rules.map(r => r.key)

      // INTERVENTION_ID_REQUIRED has statuses including DEVIS_ENVOYE
      expect(ruleKeys).toContain('INTERVENTION_ID_REQUIRED')
    })

    it('should NOT include rules with a from constraint', () => {
      // DEVIS_ENVOYE_TO_ACCEPTE has from=DEVIS_ENVOYE, to=ACCEPTE
      const rules = getEntryRulesForStatus('ACCEPTE')
      const ruleKeys = rules.map(r => r.key)

      expect(ruleKeys).not.toContain('DEVIS_ENVOYE_TO_ACCEPTE')
    })

    it('should return INTER_EN_COURS entry rules', () => {
      const rules = getEntryRulesForStatus('INTER_EN_COURS')
      const ruleKeys = rules.map(r => r.key)

      expect(ruleKeys).toContain('INTER_EN_COURS_COUT_INTERVENTION')
      expect(ruleKeys).toContain('INTER_EN_COURS_COUT_SST')
      expect(ruleKeys).toContain('INTER_EN_COURS_CONSIGNE_ARTISAN')
      expect(ruleKeys).toContain('INTER_EN_COURS_NOM_CLIENT')
      expect(ruleKeys).toContain('INTER_EN_COURS_TELEPHONE_CLIENT')
      expect(ruleKeys).toContain('INTER_EN_COURS_DATE_PREVUE')
    })

    it('should return artisan rule for INTER_EN_COURS via statuses array', () => {
      const rules = getEntryRulesForStatus('INTER_EN_COURS')
      const ruleKeys = rules.map(r => r.key)

      // ARTISAN_REQUIRED_FOR_STATUS has statuses including INTER_EN_COURS
      expect(ruleKeys).toContain('ARTISAN_REQUIRED_FOR_STATUS')
    })

    it('should return empty for DEMANDE (no entry rules)', () => {
      const rules = getEntryRulesForStatus('DEMANDE')
      // DEMANDE has no specific to/statuses rules targeting it
      expect(rules.length).toBe(0)
    })
  })

  describe('getCumulativeEntryRules', () => {
    it('should return empty for DEMANDE (first on chain, no predecessors)', () => {
      const rules = getCumulativeEntryRules('DEMANDE')
      expect(rules).toEqual([])
    })

    it('should return empty for off-chain statuses', () => {
      const offChainStatuses: InterventionStatusValue[] = [
        'VISITE_TECHNIQUE',
        'STAND_BY',
        'REFUSE',
        'ANNULE',
        'SAV',
      ]
      for (const status of offChainStatuses) {
        expect(getCumulativeEntryRules(status)).toEqual([])
      }
    })

    it('should include DEVIS_ENVOYE entry rules when target is ACCEPTE', () => {
      const rules = getCumulativeEntryRules('ACCEPTE')
      const ruleKeys = rules.map(r => r.key)

      expect(ruleKeys).toContain('DEVIS_ENVOYE_NOM_FACTURATION')
      expect(ruleKeys).toContain('DEVIS_ENVOYE_ASSIGNED_USER')
    })

    it('should include DEVIS_ENVOYE + ACCEPTE rules when target is INTER_EN_COURS', () => {
      const rules = getCumulativeEntryRules('INTER_EN_COURS')
      const ruleKeys = rules.map(r => r.key)

      // From DEVIS_ENVOYE
      expect(ruleKeys).toContain('DEVIS_ENVOYE_NOM_FACTURATION')
      expect(ruleKeys).toContain('DEVIS_ENVOYE_ASSIGNED_USER')
      // INTERVENTION_ID_REQUIRED applies to DEVIS_ENVOYE via statuses
      expect(ruleKeys).toContain('INTERVENTION_ID_REQUIRED')
    })

    it('should include all predecessor rules when target is INTER_TERMINEE', () => {
      const rules = getCumulativeEntryRules('INTER_TERMINEE')
      const ruleKeys = rules.map(r => r.key)

      // From DEVIS_ENVOYE predecessors
      expect(ruleKeys).toContain('DEVIS_ENVOYE_NOM_FACTURATION')
      expect(ruleKeys).toContain('DEVIS_ENVOYE_ASSIGNED_USER')
      // From INTER_EN_COURS predecessors
      expect(ruleKeys).toContain('INTER_EN_COURS_COUT_INTERVENTION')
      expect(ruleKeys).toContain('INTER_EN_COURS_COUT_SST')
      expect(ruleKeys).toContain('INTER_EN_COURS_CONSIGNE_ARTISAN')
      expect(ruleKeys).toContain('INTER_EN_COURS_NOM_CLIENT')
      expect(ruleKeys).toContain('INTER_EN_COURS_TELEPHONE_CLIENT')
      expect(ruleKeys).toContain('INTER_EN_COURS_DATE_PREVUE')
    })

    it('should deduplicate rules by key', () => {
      const rules = getCumulativeEntryRules('INTER_TERMINEE')
      const ruleKeys = rules.map(r => r.key)
      const uniqueKeys = new Set(ruleKeys)

      expect(ruleKeys.length).toBe(uniqueKeys.size)
    })

    it('should NOT include transition-specific rules (with from)', () => {
      // DEVIS_ENVOYE_TO_ACCEPTE: from=DEVIS_ENVOYE, to=ACCEPTE
      const rules = getCumulativeEntryRules('INTER_EN_COURS')
      const ruleKeys = rules.map(r => r.key)

      expect(ruleKeys).not.toContain('DEVIS_ENVOYE_TO_ACCEPTE')
    })
  })
})
