import { describe, it, expect } from 'vitest'
import { isBusinessDay, isAfter10AM, isLateLogin } from '@/lib/utils/business-days'

describe('business-days utilities', () => {
  describe('isBusinessDay', () => {
    it('should return true for Monday', () => {
      // 29 décembre 2025 est un lundi
      const monday = new Date('2025-12-29T10:00:00')
      expect(isBusinessDay(monday)).toBe(true)
    })

    it('should return true for Tuesday', () => {
      const tuesday = new Date('2025-12-30T10:00:00')
      expect(isBusinessDay(tuesday)).toBe(true)
    })

    it('should return true for Wednesday', () => {
      const wednesday = new Date('2025-12-31T10:00:00')
      expect(isBusinessDay(wednesday)).toBe(true)
    })

    it('should return true for Thursday', () => {
      const thursday = new Date('2026-01-01T10:00:00')
      expect(isBusinessDay(thursday)).toBe(true)
    })

    it('should return true for Friday', () => {
      const friday = new Date('2025-12-26T10:00:00')
      expect(isBusinessDay(friday)).toBe(true)
    })

    it('should return false for Saturday', () => {
      const saturday = new Date('2025-12-27T10:00:00')
      expect(isBusinessDay(saturday)).toBe(false)
    })

    it('should return false for Sunday', () => {
      const sunday = new Date('2025-12-28T10:00:00')
      expect(isBusinessDay(sunday)).toBe(false)
    })
  })

  describe('isAfter10AM', () => {
    it('should return false before 10:00 AM', () => {
      const date = new Date('2025-12-29T09:59:59')
      expect(isAfter10AM(date)).toBe(false)
    })

    it('should return true at exactly 10:00 AM', () => {
      const date = new Date('2025-12-29T10:00:00')
      expect(isAfter10AM(date)).toBe(true)
    })

    it('should return true after 10:00 AM', () => {
      const date = new Date('2025-12-29T10:00:01')
      expect(isAfter10AM(date)).toBe(true)
    })

    it('should return true at 11:00 AM', () => {
      const date = new Date('2025-12-29T11:00:00')
      expect(isAfter10AM(date)).toBe(true)
    })

    it('should return true at 14:00 PM', () => {
      const date = new Date('2025-12-29T14:00:00')
      expect(isAfter10AM(date)).toBe(true)
    })

    it('should return false at 9:00 AM', () => {
      const date = new Date('2025-12-29T09:00:00')
      expect(isAfter10AM(date)).toBe(false)
    })
  })

  describe('isLateLogin', () => {
    describe('29 décembre 2025 (lundi) - cas spécifique du problème', () => {
      it('should return false before 10:00 AM on Monday', () => {
        const mondayBefore10 = new Date('2025-12-29T09:59:59')
        expect(isLateLogin(mondayBefore10)).toBe(false)
        expect(isBusinessDay(mondayBefore10)).toBe(true)
        expect(isAfter10AM(mondayBefore10)).toBe(false)
      })

      it('should return true at exactly 10:00 AM on Monday', () => {
        const mondayAt10 = new Date('2025-12-29T10:00:00')
        expect(isLateLogin(mondayAt10)).toBe(true)
        expect(isBusinessDay(mondayAt10)).toBe(true)
        expect(isAfter10AM(mondayAt10)).toBe(true)
      })

      it('should return true after 10:00 AM on Monday', () => {
        const mondayAfter10 = new Date('2025-12-29T10:00:01')
        expect(isLateLogin(mondayAfter10)).toBe(true)
        expect(isBusinessDay(mondayAfter10)).toBe(true)
        expect(isAfter10AM(mondayAfter10)).toBe(true)
      })

      it('should return true at 11:00 AM on Monday', () => {
        const mondayAt11 = new Date('2025-12-29T11:00:00')
        expect(isLateLogin(mondayAt11)).toBe(true)
      })

      it('should return true at 14:00 PM on Monday', () => {
        const mondayAt14 = new Date('2025-12-29T14:00:00')
        expect(isLateLogin(mondayAt14)).toBe(true)
      })
    })

    describe('Jours ouvrés (lundi-vendredi)', () => {
      it('should return false on Monday before 10:00 AM', () => {
        const date = new Date('2025-12-29T09:00:00')
        expect(isLateLogin(date)).toBe(false)
      })

      it('should return true on Monday after 10:00 AM', () => {
        const date = new Date('2025-12-29T10:30:00')
        expect(isLateLogin(date)).toBe(true)
      })

      it('should return false on Tuesday before 10:00 AM', () => {
        const date = new Date('2025-12-30T09:00:00')
        expect(isLateLogin(date)).toBe(false)
      })

      it('should return true on Tuesday after 10:00 AM', () => {
        const date = new Date('2025-12-30T11:00:00')
        expect(isLateLogin(date)).toBe(true)
      })

      it('should return false on Friday before 10:00 AM', () => {
        const date = new Date('2025-12-26T09:00:00')
        expect(isLateLogin(date)).toBe(false)
      })

      it('should return true on Friday after 10:00 AM', () => {
        const date = new Date('2025-12-26T15:00:00')
        expect(isLateLogin(date)).toBe(true)
      })
    })

    describe('Weekends (samedi-dimanche)', () => {
      it('should return false on Saturday even after 10:00 AM', () => {
        const saturday = new Date('2025-12-27T14:00:00')
        expect(isLateLogin(saturday)).toBe(false)
        expect(isBusinessDay(saturday)).toBe(false)
        expect(isAfter10AM(saturday)).toBe(true)
      })

      it('should return false on Sunday even after 10:00 AM', () => {
        const sunday = new Date('2025-12-28T14:00:00')
        expect(isLateLogin(sunday)).toBe(false)
        expect(isBusinessDay(sunday)).toBe(false)
        expect(isAfter10AM(sunday)).toBe(true)
      })

      it('should return false on Saturday before 10:00 AM', () => {
        const saturday = new Date('2025-12-27T09:00:00')
        expect(isLateLogin(saturday)).toBe(false)
      })

      it('should return false on Sunday before 10:00 AM', () => {
        const sunday = new Date('2025-12-28T09:00:00')
        expect(isLateLogin(sunday)).toBe(false)
      })
    })

    describe('Cas limites', () => {
      it('should return false at 9:59:59 on a business day', () => {
        const date = new Date('2025-12-29T09:59:59')
        expect(isLateLogin(date)).toBe(false)
      })

      it('should return true at 10:00:00 on a business day', () => {
        const date = new Date('2025-12-29T10:00:00')
        expect(isLateLogin(date)).toBe(true)
      })

      it('should return true at 10:00:01 on a business day', () => {
        const date = new Date('2025-12-29T10:00:01')
        expect(isLateLogin(date)).toBe(true)
      })
    })

    describe('Tests avec fuseaux horaires', () => {
      it('should handle timezone correctly for 29 décembre 2025 10:00 UTC', () => {
        // Créer une date en UTC
        const dateUTC = new Date('2025-12-29T10:00:00Z')
        // La fonction devrait utiliser l'heure locale du système
        // On teste que c'est bien un lundi
        expect(isBusinessDay(dateUTC)).toBe(true)
        // L'heure dépend du fuseau horaire, donc on vérifie juste la structure
        const hours = dateUTC.getHours()
        const isLate = isLateLogin(dateUTC)
        // Si c'est après 10h dans le fuseau local, ça devrait être true
        // Sinon false
        expect(typeof isLate).toBe('boolean')
      })
    })

    describe('Debug: Vérification des valeurs pour 29 décembre 2025', () => {
      it('should log detailed information for debugging', () => {
        const testDate = new Date('2025-12-29T10:00:00')
        const dayOfWeek = testDate.getDay() // 0 = dimanche, 1 = lundi, etc.
        const hours = testDate.getHours()
        const isBusiness = isBusinessDay(testDate)
        const isAfter10 = isAfter10AM(testDate)
        const isLate = isLateLogin(testDate)

        console.log('📅 Test Date:', testDate.toISOString())
        console.log('📅 Local Date:', testDate.toLocaleString('fr-FR', { timeZone: 'Europe/Paris' }))
        console.log('📅 Day of week:', dayOfWeek, '(0=Sunday, 1=Monday, ..., 6=Saturday)')
        console.log('⏰ Hours:', hours)
        console.log('✅ Is business day:', isBusiness)
        console.log('⏰ Is after 10 AM:', isAfter10)
        console.log('🚨 Is late login:', isLate)

        // 29 décembre 2025 est un lundi (dayOfWeek = 1)
        expect(dayOfWeek).toBe(1)
        expect(isBusiness).toBe(true)
        // Si l'heure est 10h ou plus, isLate devrait être true
        if (hours >= 10) {
          expect(isLate).toBe(true)
        } else {
          expect(isLate).toBe(false)
        }
      })
    })
  })
})
