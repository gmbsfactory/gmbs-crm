import { describe, it, expect } from 'vitest'
import {
  DEFAULT_ARRIVAL_TIME,
  getLatenessMinutes,
  isAfterArrivalTime,
  isLateLogin,
  normalizeArrivalTime,
} from '@/lib/utils/business-days'

/**
 * Heure d'arrivee configurable.
 *
 * Comme pour business-timezone, tous les instants sont absolus (suffixe Z) :
 * le seuil doit etre evalue a Paris, jamais dans le fuseau du process.
 * 2026-07-31 est un vendredi d'ete (Paris = UTC+2).
 */
describe('heure d\'arrivee configurable', () => {
  describe('DEFAULT_ARRIVAL_TIME', () => {
    it('vaut 10h00, le comportement historique', () => {
      expect(DEFAULT_ARRIVAL_TIME).toEqual({ hour: 10, minute: 0 })
    })
  })

  describe('normalizeArrivalTime', () => {
    it('accepte une heure valide', () => {
      expect(normalizeArrivalTime({ hour: 9, minute: 30 })).toEqual({ hour: 9, minute: 30 })
    })

    it('accepte les bornes', () => {
      expect(normalizeArrivalTime({ hour: 0, minute: 0 })).toEqual({ hour: 0, minute: 0 })
      expect(normalizeArrivalTime({ hour: 23, minute: 59 })).toEqual({ hour: 23, minute: 59 })
    })

    it('retombe sur 10h00 si la config est absente', () => {
      expect(normalizeArrivalTime(null)).toEqual(DEFAULT_ARRIVAL_TIME)
      expect(normalizeArrivalTime(undefined)).toEqual(DEFAULT_ARRIVAL_TIME)
      expect(normalizeArrivalTime({})).toEqual(DEFAULT_ARRIVAL_TIME)
    })

    it('rejette les valeurs hors bornes plutot que de produire un seuil aberrant', () => {
      expect(normalizeArrivalTime({ hour: 24, minute: 0 })).toEqual(DEFAULT_ARRIVAL_TIME)
      expect(normalizeArrivalTime({ hour: -1, minute: 0 })).toEqual(DEFAULT_ARRIVAL_TIME)
      expect(normalizeArrivalTime({ hour: 9, minute: 60 })).toEqual({ hour: 9, minute: 0 })
      expect(normalizeArrivalTime({ hour: 9.5, minute: 0 })).toEqual({ hour: 10, minute: 0 })
    })
  })

  describe('isAfterArrivalTime', () => {
    it('utilise 10h00 par defaut', () => {
      // 07:59 UTC = 09:59 Paris
      expect(isAfterArrivalTime(new Date('2026-07-31T07:59:00Z'))).toBe(false)
      // 08:00 UTC = 10:00 Paris
      expect(isAfterArrivalTime(new Date('2026-07-31T08:00:00Z'))).toBe(true)
    })

    it('respecte un seuil avance a 09h00', () => {
      const arrival = { hour: 9, minute: 0 }
      // 06:59 UTC = 08:59 Paris
      expect(isAfterArrivalTime(new Date('2026-07-31T06:59:00Z'), arrival)).toBe(false)
      // 07:00 UTC = 09:00 Paris
      expect(isAfterArrivalTime(new Date('2026-07-31T07:00:00Z'), arrival)).toBe(true)
    })

    it('respecte un seuil recule a 11h30', () => {
      const arrival = { hour: 11, minute: 30 }
      // 09:29 UTC = 11:29 Paris
      expect(isAfterArrivalTime(new Date('2026-07-31T09:29:00Z'), arrival)).toBe(false)
      // 09:30 UTC = 11:30 Paris — la limite est inclusive
      expect(isAfterArrivalTime(new Date('2026-07-31T09:30:00Z'), arrival)).toBe(true)
    })

    it('prend les minutes en compte, pas seulement l\'heure', () => {
      const arrival = { hour: 9, minute: 30 }
      // 07:29 UTC = 09:29 Paris — meme heure, mais avant le seuil
      expect(isAfterArrivalTime(new Date('2026-07-31T07:29:00Z'), arrival)).toBe(false)
      expect(isAfterArrivalTime(new Date('2026-07-31T07:30:00Z'), arrival)).toBe(true)
    })
  })

  describe('isLateLogin', () => {
    it('reste faux le week-end, meme largement apres le seuil', () => {
      // 2026-08-01 est un samedi, 14:00 UTC = 16:00 Paris
      expect(isLateLogin(new Date('2026-08-01T14:00:00Z'), { hour: 9, minute: 0 })).toBe(false)
    })

    it('compte un retard un jour ouvre selon le seuil configure', () => {
      // 07:30 UTC = 09:30 Paris : en retard a 09h00, a l\'heure a 10h00
      const instant = new Date('2026-07-31T07:30:00Z')
      expect(isLateLogin(instant, { hour: 9, minute: 0 })).toBe(true)
      expect(isLateLogin(instant, { hour: 10, minute: 0 })).toBe(false)
    })
  })

  describe('getLatenessMinutes', () => {
    it('reproduit le cas Gabriel : 13:51 UTC = 15:51 Paris, soit 5h51 de retard sur 10h', () => {
      const minutes = getLatenessMinutes(new Date('2026-07-31T13:51:00Z'))

      expect(minutes).toBe(351)
      expect(Math.floor(minutes / 60)).toBe(5)
      expect(minutes % 60).toBe(51)
    })

    it('vaut 0 pile a l\'heure limite', () => {
      expect(getLatenessMinutes(new Date('2026-07-31T08:00:00Z'))).toBe(0)
    })

    it('est negatif en avance', () => {
      // 07:30 UTC = 09:30 Paris, soit 30 min avant 10h
      expect(getLatenessMinutes(new Date('2026-07-31T07:30:00Z'))).toBe(-30)
    })

    it('suit le seuil configure', () => {
      // 09:30 Paris, seuil a 09h00 => 30 min de retard
      expect(getLatenessMinutes(new Date('2026-07-31T07:30:00Z'), { hour: 9, minute: 0 })).toBe(30)
    })

    it('reste coherent avec isLateLogin', () => {
      const arrival = { hour: 9, minute: 30 }
      const instant = new Date('2026-07-31T07:31:00Z') // 09:31 Paris

      expect(isLateLogin(instant, arrival)).toBe(true)
      expect(getLatenessMinutes(instant, arrival)).toBeGreaterThan(0)
    })
  })
})
