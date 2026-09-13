import { describe, it, expect } from 'vitest'

import { resolveListRange } from '../../../supabase/functions/_shared/list-range'

const MAX_ROWS = 10000

describe('resolveListRange', () => {
  describe('sans limite demandée', () => {
    it('should return no limit and cover every row up to MAX_ROWS', () => {
      const range = resolveListRange(null, null, MAX_ROWS)

      expect(range.limit).toBeNull()
      expect(range.offset).toBe(0)
      expect(range.from).toBe(0)
      expect(range.to).toBe(MAX_ROWS - 1)
    })

    it('should cover far beyond the 50 rows that used to hide documents', () => {
      // Régression : l'intervention 22757 (107 pièces jointes, 96 photos)
      // ne renvoyait que 50 lignes, dont zéro facture artisan.
      const range = resolveListRange(null, null, MAX_ROWS)

      expect(range.to - range.from + 1).toBeGreaterThanOrEqual(107)
    })

    it('should keep the offset when only an offset is given', () => {
      const range = resolveListRange(null, '100', MAX_ROWS)

      expect(range.limit).toBeNull()
      expect(range.offset).toBe(100)
      expect(range.from).toBe(100)
      expect(range.to).toBe(100 + MAX_ROWS - 1)
    })
  })

  describe('avec une limite explicite', () => {
    it('should honour an explicit limit', () => {
      const range = resolveListRange('20', null, MAX_ROWS)

      expect(range.limit).toBe(20)
      expect(range.from).toBe(0)
      expect(range.to).toBe(19)
    })

    it('should honour limit and offset together', () => {
      const range = resolveListRange('20', '40', MAX_ROWS)

      expect(range.limit).toBe(20)
      expect(range.offset).toBe(40)
      expect(range.from).toBe(40)
      expect(range.to).toBe(59)
    })

    it('should clamp a limit above MAX_ROWS', () => {
      const range = resolveListRange('999999', null, MAX_ROWS)

      expect(range.limit).toBe(MAX_ROWS)
      expect(range.to).toBe(MAX_ROWS - 1)
    })
  })

  describe('entrées invalides', () => {
    it.each([
      ['une limite non numérique', 'abc'],
      ['une limite nulle', '0'],
      ['une limite négative', '-5'],
      ['une limite vide', ''],
    ])('should ignore %s and return everything', (_label, rawLimit) => {
      const range = resolveListRange(rawLimit, null, MAX_ROWS)

      // Une limite invalide ne doit jamais masquer de documents.
      expect(range.limit).toBeNull()
      expect(range.to).toBe(MAX_ROWS - 1)
    })

    it.each([
      ['un offset non numérique', 'abc'],
      ['un offset négatif', '-10'],
    ])('should fall back to offset 0 for %s', (_label, rawOffset) => {
      const range = resolveListRange(null, rawOffset, MAX_ROWS)

      expect(range.offset).toBe(0)
      expect(range.from).toBe(0)
    })
  })
})
