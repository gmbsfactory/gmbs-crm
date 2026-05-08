import { describe, it, expect } from 'vitest';
import { parseNumber, parseDate } from '@/utils/import-export/parsers/date-number-parser';

describe('date-number-parser', () => {
  describe('parseNumber', () => {
    it('parse un entier', () => expect(parseNumber('1500')).toBe(1500));
    it('parse avec virgule décimale (FR)', () => expect(parseNumber('1500,50')).toBe(1500.5));
    it('parse avec point décimal', () => expect(parseNumber('1500.50')).toBe(1500.5));
    it('retourne 0 pour chaîne vide', () => expect(parseNumber('')).toBe(0));
    it('retourne null pour une valeur non numérique', () => expect(parseNumber('abc')).toBeNull());
    it('retourne null pour double séparateur', () => expect(parseNumber('1.500.00')).toBeNull());
    it('accepte les négatifs', () => expect(parseNumber('-100')).toBe(-100));
    it('retourne null pour null', () => expect(parseNumber(null)).toBeNull());
  });

  describe('parseDate', () => {
    it('parse DD/MM/YYYY', () => {
      const result = parseDate('15/06/2024');
      expect(result).toContain('2024-06-15');
    });
    it('parse YYYY-MM-DD', () => {
      const result = parseDate('2024-06-15');
      expect(result).toContain('2024-06-15');
    });
    it('retourne null si vide', () => expect(parseDate('')).toBeNull());
    it('retourne null si invalide', () => expect(parseDate('pas-une-date')).toBeNull());
    it('retourne null pour année hors plage', () => expect(parseDate('01/01/1800')).toBeNull());
    it('parse MM/YYYY comme début de mois', () => {
      const result = parseDate('06/2024');
      expect(result).toContain('2024-06-01');
    });
    it('parse DD-MM-YYYY', () => expect(parseDate('15-06-2024')).toContain('2024-06-15'));
    it('parse D-MM-YYYY', () => expect(parseDate('5-06-2024')).toContain('2024-06-05'));
    it('parse DD-M-YYYY', () => expect(parseDate('15-6-2024')).toContain('2024-06-15'));
    it('parse D-M-YYYY', () => expect(parseDate('5-6-2024')).toContain('2024-06-05'));
    it('parse D-MM-YY (pivot < 70 → 20xx)', () => expect(parseDate('5-06-24')).toContain('2024-06-05'));
    it('parse DD-MM-YY (pivot ≥ 70 → 19xx)', () => expect(parseDate('15-06-85')).toContain('1985-06-15'));
  });
});
