import { describe, it, expect } from 'vitest'
import { DOMAIN, t } from '@/config/domain'

describe('config/domain', () => {
  describe('DOMAIN', () => {
    it('should have deals, contacts and dashboard keys', () => {
      expect(DOMAIN.deals).toBe('Interventions')
      expect(DOMAIN.contacts).toBe('Artisans')
      expect(DOMAIN.dashboard).toBe('Tableau de bord')
    })
  })

  describe('t (translation helper)', () => {
    it('should return correct translation for deals', () => {
      expect(t('deals')).toBe('Interventions')
    })

    it('should return correct translation for contacts', () => {
      expect(t('contacts')).toBe('Artisans')
    })

    it('should return correct translation for dashboard', () => {
      expect(t('dashboard')).toBe('Tableau de bord')
    })
  })
})
