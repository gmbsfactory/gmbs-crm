import { describe, it, expect } from 'vitest';
import { parseTenantInfo, parseOwnerInfo } from '@/utils/import-export/parsers/person-parser';
import type { CsvRow } from '@/utils/import-export/parsers/csv-parser';

const tenantRow = (overrides: Partial<Record<string, string>> = {}): CsvRow => ({
  Locataire: '',
  'Em@il Locataire': '',
  'TEL LOC': '',
  ...overrides,
});

describe('person-parser', () => {
  describe('parseTenantInfo - téléphone bien formé', () => {
    it('garde un numéro français à 10 chiffres', () => {
      const r = parseTenantInfo(tenantRow({ Locataire: 'Tyson Fury', 'TEL LOC': '06 12 34 56 78' }));
      expect(r.telephone).toBe('0612345678');
    });

    it('normalise un +33 en 0', () => {
      const r = parseTenantInfo(tenantRow({ Locataire: 'Tyson Fury', 'TEL LOC': '+33 6 12 34 56 78' }));
      expect(r.telephone).toBe('0612345678');
    });
  });

  describe('parseTenantInfo - récupération du zéro Excel', () => {
    it('restitue le 0 de tête sur un numéro de 9 chiffres', () => {
      const r = parseTenantInfo(tenantRow({ Locataire: 'Tyson Fury', 'TEL LOC': '612345678' }));
      expect(r.telephone).toBe('0612345678');
    });

    it('restitue le 0 même avec des séparateurs', () => {
      const r = parseTenantInfo(tenantRow({ Locataire: 'Tyson Fury', 'TEL LOC': '6 12 34 56 78' }));
      expect(r.telephone).toBe('0612345678');
    });
  });

  describe('parseTenantInfo - numéro non standard conservé', () => {
    it('conserve un numéro tronqué (056777) au lieu de le perdre', () => {
      const r = parseTenantInfo(tenantRow({ Locataire: 'Tyson Fury', 'TEL LOC': '056777' }));
      expect(r.telephone).toBe('056777');
    });

    it('ne stocke pas un bruit isolé (< 4 chiffres)', () => {
      const r = parseTenantInfo(tenantRow({ Locataire: 'Tyson Fury', 'TEL LOC': '12' }));
      expect(r.telephone).toBeNull();
    });

    it('extrait toujours le nom indépendamment du téléphone non standard', () => {
      const r = parseTenantInfo(tenantRow({ Locataire: 'Tyson Fury', 'TEL LOC': '056777' }));
      expect(r.plain_nom_client).toBe('Tyson Fury');
    });
  });

  describe('parseOwnerInfo', () => {
    it('extrait un téléphone bien formé du champ PROPRIO', () => {
      const r = parseOwnerInfo({ PROPRIO: 'M TOP ARNAUD 06 12 34 56 78' });
      expect(r?.telephone).toBe('0612345678');
    });

    it('ne fabrique pas de téléphone à partir d un nom sans chiffres', () => {
      const r = parseOwnerInfo({ PROPRIO: 'M TOP ARNAUD' });
      expect(r?.telephone).toBeNull();
    });
  });
});
