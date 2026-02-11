import { describe, it, expect } from 'vitest'
import {
  INTERVENTION_STATUS,
  INTERVENTION_STATUS_ORDER,
  isTerminalStatus,
  SCROLL_CONFIG,
  DEFAULT_WORKFLOW_CONFIG,
  type InterventionStatusKey,
} from '@/config/interventions'

describe('config/interventions', () => {
  describe('INTERVENTION_STATUS', () => {
    it('should have all 12 statuses', () => {
      const keys = Object.keys(INTERVENTION_STATUS)
      expect(keys).toHaveLength(12)
    })

    it('should have correct structure for each status', () => {
      for (const [key, config] of Object.entries(INTERVENTION_STATUS)) {
        expect(config.value).toBe(key)
        expect(config.label).toBeTruthy()
        expect(config.color).toMatch(/^bg-/)
        expect(config.hexColor).toMatch(/^#/)
        expect(config.icon).toBeDefined()
      }
    })

    it('should have matching value and key for each status', () => {
      for (const [key, config] of Object.entries(INTERVENTION_STATUS)) {
        expect(config.value).toBe(key)
      }
    })
  })

  describe('INTERVENTION_STATUS_ORDER', () => {
    it('should have 12 statuses', () => {
      expect(INTERVENTION_STATUS_ORDER).toHaveLength(12)
    })

    it('should have POTENTIEL first', () => {
      expect(INTERVENTION_STATUS_ORDER[0]).toBe('POTENTIEL')
    })

    it('should have ANNULE last', () => {
      expect(INTERVENTION_STATUS_ORDER[INTERVENTION_STATUS_ORDER.length - 1]).toBe('ANNULE')
    })

    it('should contain all status keys', () => {
      const statusKeys = Object.keys(INTERVENTION_STATUS) as InterventionStatusKey[]
      for (const key of statusKeys) {
        expect(INTERVENTION_STATUS_ORDER).toContain(key)
      }
    })
  })

  describe('isTerminalStatus', () => {
    it('should return true for REFUSE', () => {
      expect(isTerminalStatus('REFUSE')).toBe(true)
    })

    it('should return true for ANNULE', () => {
      expect(isTerminalStatus('ANNULE')).toBe(true)
    })

    it('should return false for non-terminal statuses', () => {
      const nonTerminal: InterventionStatusKey[] = [
        'DEMANDE', 'DEVIS_ENVOYE', 'VISITE_TECHNIQUE', 'ACCEPTE',
        'INTER_EN_COURS', 'INTER_TERMINEE', 'SAV', 'STAND_BY',
        'ATT_ACOMPTE', 'POTENTIEL',
      ]
      for (const status of nonTerminal) {
        expect(isTerminalStatus(status)).toBe(false)
      }
    })
  })

  describe('SCROLL_CONFIG', () => {
    it('should have expected values', () => {
      expect(SCROLL_CONFIG.OVERSCAN).toBe(15)
      expect(SCROLL_CONFIG.SHOW_POSITION_THRESHOLD).toBe(200)
      expect(SCROLL_CONFIG.CLIENT_FILTER_WARNING_THRESHOLD).toBe(50000)
      expect(SCROLL_CONFIG.LARGE_DATASET_THRESHOLD).toBe(10000)
    })
  })

  describe('DEFAULT_WORKFLOW_CONFIG', () => {
    it('should have correct metadata', () => {
      expect(DEFAULT_WORKFLOW_CONFIG.id).toBe('default-workflow')
      expect(DEFAULT_WORKFLOW_CONFIG.name).toBe('Workflow interventions')
      expect(DEFAULT_WORKFLOW_CONFIG.isActive).toBe(true)
    })

    it('should have 12 statuses', () => {
      expect(DEFAULT_WORKFLOW_CONFIG.statuses).toHaveLength(12)
    })

    it('should have transitions', () => {
      expect(DEFAULT_WORKFLOW_CONFIG.transitions.length).toBeGreaterThan(0)
    })

    it('should have pinned statuses', () => {
      const pinned = DEFAULT_WORKFLOW_CONFIG.statuses.filter(s => s.isPinned)
      expect(pinned.length).toBeGreaterThan(0)
    })
  })
})
