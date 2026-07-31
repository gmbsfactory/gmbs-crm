import { describe, it, expect } from 'vitest'
import { getBusinessDateString, getBusinessParts } from '@/lib/utils/business-timezone'
import { isAfter10AM, isBusinessDay, isLateLogin } from '@/lib/utils/business-days'

/**
 * Ces tests utilisent des instants absolus (suffixe Z) : ils sont donc
 * deterministes quel que soit le fuseau du process qui execute la suite,
 * ce qui est precisement la regression que ce module corrige.
 */
describe('business-timezone', () => {
  describe('getBusinessParts', () => {
    it('should decode an instant in Paris time during summer (UTC+2)', () => {
      // 2026-07-31 est un vendredi
      const parts = getBusinessParts(new Date('2026-07-31T13:51:23Z'))

      expect(parts).toEqual({
        dateString: '2026-07-31',
        dayOfWeek: 5,
        hours: 15,
        minutes: 51,
      })
    })

    it('should decode an instant in Paris time during winter (UTC+1)', () => {
      const parts = getBusinessParts(new Date('2026-01-12T09:30:00Z'))

      expect(parts).toEqual({
        dateString: '2026-01-12',
        dayOfWeek: 1,
        hours: 10,
        minutes: 30,
      })
    })

    it('should use hour 0 rather than 24 at Paris midnight', () => {
      expect(getBusinessParts(new Date('2026-07-30T22:00:00Z')).hours).toBe(0)
    })
  })

  describe('getBusinessDateString', () => {
    it('should still be the previous day just before Paris midnight', () => {
      // 21:59 UTC = 23:59 Paris le 30
      expect(getBusinessDateString(new Date('2026-07-30T21:59:00Z'))).toBe('2026-07-30')
    })

    it('should roll over at Paris midnight, not at UTC midnight', () => {
      // 22:00 UTC = 00:00 Paris le 31 : la journee metier a deja bascule
      expect(getBusinessDateString(new Date('2026-07-30T22:00:00Z'))).toBe('2026-07-31')
      // 23:30 UTC = 01:30 Paris le 31 : bug historique, on comptait encore le 30
      expect(getBusinessDateString(new Date('2026-07-30T23:30:00Z'))).toBe('2026-07-31')
    })
  })

  describe('isAfter10AM (Paris)', () => {
    it('should be false at 09:59 Paris even though it is 07:59 UTC', () => {
      expect(isAfter10AM(new Date('2026-07-31T07:59:00Z'))).toBe(false)
    })

    it('should be true from 10:00 Paris, i.e. 08:00 UTC in summer', () => {
      expect(isAfter10AM(new Date('2026-07-31T08:00:00Z'))).toBe(true)
    })

    it('should be true at 11:30 Paris, which the UTC-based check used to miss', () => {
      // Regression : 09:30 UTC < 10 => l'ancien code ne comptait pas ce retard
      expect(isAfter10AM(new Date('2026-07-31T09:30:00Z'))).toBe(true)
    })

    it('should account for the winter offset (UTC+1)', () => {
      expect(isAfter10AM(new Date('2026-01-12T08:59:00Z'))).toBe(false)
      expect(isAfter10AM(new Date('2026-01-12T09:00:00Z'))).toBe(true)
    })
  })

  describe('isBusinessDay (Paris)', () => {
    it('should treat Saturday 00:30 Paris as a weekend, not as Friday', () => {
      // 2026-07-31 est un vendredi : 22:30 UTC = samedi 00:30 a Paris
      expect(isBusinessDay(new Date('2026-07-31T22:30:00Z'))).toBe(false)
    })

    it('should treat Monday 00:30 Paris as a business day', () => {
      // dimanche 22:30 UTC = lundi 00:30 a Paris
      expect(isBusinessDay(new Date('2026-08-02T22:30:00Z'))).toBe(true)
    })
  })

  describe('isLateLogin', () => {
    it('should flag the 15:51 Paris login observed in production', () => {
      expect(isLateLogin(new Date('2026-07-31T13:51:23Z'))).toBe(true)
    })

    it('should not flag an 09:30 Paris arrival', () => {
      expect(isLateLogin(new Date('2026-07-31T07:30:00Z'))).toBe(false)
    })

    it('should never flag a weekend login', () => {
      expect(isLateLogin(new Date('2026-08-01T14:00:00Z'))).toBe(false)
    })
  })
})
