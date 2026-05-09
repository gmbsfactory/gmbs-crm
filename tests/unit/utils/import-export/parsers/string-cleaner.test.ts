import { describe, it, expect } from 'vitest';
import { cleanString, truncateString, cleanPhone, cleanEmail, capitalizeFirstLetter } from '@/utils/import-export/parsers/string-cleaner';

describe('string-cleaner', () => {
  describe('cleanString', () => {
    it('retourne null pour les valeurs vides', () => {
      expect(cleanString('')).toBeNull();
      expect(cleanString(null)).toBeNull();
      expect(cleanString(undefined)).toBeNull();
      expect(cleanString('null')).toBeNull();
      expect(cleanString('NULL')).toBeNull();
    });
    it('trim et retourne la valeur', () => {
      expect(cleanString('  hello  ')).toBe('hello');
      expect(cleanString('foo')).toBe('foo');
    });
  });

  describe('truncateString', () => {
    it('retourne null si vide', () => {
      expect(truncateString('', 10)).toBeNull();
    });
    it('retourne la valeur intacte si sous la limite', () => {
      expect(truncateString('hello', 10)).toBe('hello');
    });
    it('tronque à maxLength', () => {
      expect(truncateString('hello world', 5)).toBe('hello');
    });
  });

  describe('cleanPhone', () => {
    it('retourne null si trop court', () => {
      expect(cleanPhone('123')).toBeNull();
    });
    it('normalise un numéro FR', () => {
      expect(cleanPhone('06 12 34 56 78')).toBe('0612345678');
    });
    it('retourne null si invalide', () => {
      expect(cleanPhone('')).toBeNull();
    });
  });

  describe('cleanEmail', () => {
    it('retourne null si invalide', () => {
      expect(cleanEmail('pas-un-email')).toBeNull();
      expect(cleanEmail('')).toBeNull();
    });
    it('normalise en minuscules', () => {
      expect(cleanEmail('Test@Example.COM')).toBe('test@example.com');
    });
  });

  describe('capitalizeFirstLetter', () => {
    it('capitalise chaque mot', () => {
      expect(capitalizeFirstLetter('jean dupont')).toBe('Jean Dupont');
      expect(capitalizeFirstLetter('JEAN DUPONT')).toBe('Jean Dupont');
    });
  });
});
