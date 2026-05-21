import { describe, it, expect } from 'vitest'
import {
  CSV_DB_PAIRS,
  orderByRank,
  rankRawKey,
  rankDbKey,
} from '@/utils/import-export/preview-field-order'

describe('preview-field-order', () => {
  describe('orderByRank', () => {
    it('should place known keys first in canonical order', () => {
      // Volontairement désordonné par rapport à l'ordre canonique.
      const input = ['statut', 'id_inter', 'agence', 'date']
      expect(orderByRank(input, rankDbKey)).toEqual([
        'id_inter',
        'agence',
        'date',
        'statut',
      ])
    })

    it('should keep unknown keys in trailing position, original order preserved', () => {
      const input = ['cout_sst', 'colonne_inconnue', 'id_inter', 'autre_inconnue']
      expect(orderByRank(input, rankDbKey)).toEqual([
        'id_inter',
        'cout_sst',
        'colonne_inconnue',
        'autre_inconnue',
      ])
    })

    it('should be a stable sort for equal ranks', () => {
      // Deux clés inconnues : leur ordre d'apparition doit être conservé.
      const input = ['z_inconnue', 'a_inconnue']
      expect(orderByRank(input, rankDbKey)).toEqual(['z_inconnue', 'a_inconnue'])
    })

    it('should not drop any key', () => {
      const input = ['proprietaire', 'inconnu', 'date', 'metier']
      const out = orderByRank(input, rankDbKey)
      expect([...out].sort()).toEqual([...input].sort())
    })
  })

  describe('rankRawKey', () => {
    it('should rank CSV headers in the canonical sequence', () => {
      expect(rankRawKey('ID')).toBeLessThan(rankRawKey('Agence'))
      expect(rankRawKey('Agence')).toBeLessThan(rankRawKey('Adresse'))
      expect(rankRawKey('Adresse')).toBeLessThan(rankRawKey('Date'))
      expect(rankRawKey('Date')).toBeLessThan(rankRawKey('Métier'))
      expect(rankRawKey('Métier')).toBeLessThan(rankRawKey('Statut'))
      expect(rankRawKey('Statut')).toBeLessThan(rankRawKey('Gest.'))
    })

    it('should match headers case- and whitespace-insensitively', () => {
      expect(rankRawKey('  id  ')).toBe(rankRawKey('ID'))
      expect(rankRawKey('AGENCE')).toBe(rankRawKey('Agence'))
    })

    it('should map declared variants to the same field slot (adjacent ranks)', () => {
      // Variantes alternatives : même paire (rang ÷ 100 identique), un seul
      // en-tête est présent à la fois dans un CSV réel.
      expect(Math.floor(rankRawKey('Metier') / 100)).toBe(
        Math.floor(rankRawKey('Métier') / 100),
      )
      expect(Math.floor(rankRawKey("Adresse d'intervention") / 100)).toBe(
        Math.floor(rankRawKey('Adresse') / 100),
      )
    })

    it('should group tenant columns consecutively', () => {
      const ranks = ['Locataire', 'TEL LOC', 'Em@il Locataire'].map(rankRawKey)
      // Trois rangs strictement croissants et contigus (même paire, variantes 0/1/2).
      expect(ranks[0]).toBeLessThan(ranks[1])
      expect(ranks[1]).toBeLessThan(ranks[2])
      expect(ranks[2] - ranks[0]).toBe(2)
    })

    it('should reject unmapped CSV columns to the tail', () => {
      expect(rankRawKey('COMMENTAIRE')).toBe(Number.POSITIVE_INFINITY)
      expect(rankRawKey('Numéro SST')).toBe(Number.POSITIVE_INFINITY)
      expect(rankRawKey('Truspilot')).toBe(Number.POSITIVE_INFINITY)
    })
  })

  describe('rankDbKey', () => {
    it('should rank displayPayload keys in declaration order', () => {
      expect(rankDbKey('id_inter')).toBe(0)
      CSV_DB_PAIRS.forEach((pair, idx) => {
        expect(rankDbKey(pair.db)).toBe(idx)
      })
    })

    it('should reject unknown keys to the tail', () => {
      expect(rankDbKey('inconnu')).toBe(Number.POSITIVE_INFINITY)
    })
  })
})
