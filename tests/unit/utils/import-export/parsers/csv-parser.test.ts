import { describe, it, expect } from 'vitest';
import { cleanCSVKeys, getCSVValue, getStatutValue, isValidRow, parseCSV } from '@/utils/import-export/parsers/csv-parser';

describe('csv-parser', () => {
  describe('cleanCSVKeys', () => {
    it('retire les \\n des clés', () => {
      const result = cleanCSVKeys({ 'Gest.\n': 'Alice' });
      expect(result['Gest.']).toBe('Alice');
    });
    it('trim les clés', () => {
      const result = cleanCSVKeys({ '  Date  ': '01/01/2024' });
      expect(result['Date']).toBe('01/01/2024');
    });
  });

  describe('getCSVValue', () => {
    it('retourne la valeur directe', () => {
      expect(getCSVValue({ Agence: 'ImoDirect' }, 'Agence')).toBe('ImoDirect');
    });
    it('retourne null si absente', () => {
      expect(getCSVValue({ Agence: 'ImoDirect' }, 'Métier')).toBeNull();
    });
    it('tolère les espaces superflus dans la clé', () => {
      expect(getCSVValue({ ' Statut ': 'Terminé' }, 'Statut')).toBe('Terminé');
    });
  });

  describe('getStatutValue', () => {
    it('lit la clé Statut', () => {
      expect(getStatutValue({ Statut: 'En cours' })).toBe('En cours');
    });
    it('lit la clé normalisée statut_value en priorité', () => {
      expect(getStatutValue({ statut_value: 'Terminé', Statut: 'En cours' })).toBe('Terminé');
    });
    it('retourne null si absent', () => {
      expect(getStatutValue({})).toBeNull();
    });
  });

  describe('isValidRow', () => {
    it('retourne false si une colonne critique contient une date ISO', () => {
      expect(isValidRow({ ' Statut': '2024-01-01T00:00:00Z' })).toBe(false);
    });
    it('retourne true pour une ligne normale', () => {
      expect(isValidRow({ Statut: 'En cours', Agence: 'ImoDirect' })).toBe(true);
    });
  });

  describe('parseCSV', () => {
    it('parse un CSV simple', () => {
      const csv = 'Date,Agence,ID\n01/01/2024,ImoDirect,123\n02/01/2024,AFEDIM,456';
      const rows = parseCSV(csv);
      expect(rows).toHaveLength(2);
      expect(rows[0]).toEqual({ Date: '01/01/2024', Agence: 'ImoDirect', ID: '123' });
    });

    it('retire le BOM UTF-8', () => {
      const csv = '﻿Date,ID\n01/01/2024,1';
      const rows = parseCSV(csv);
      expect(rows[0]).toHaveProperty('Date');
    });

    it('gère les valeurs avec virgule entre guillemets', () => {
      const csv = 'Adresse,ID\n"12, rue de la Paix",1';
      const rows = parseCSV(csv);
      expect(rows[0]['Adresse']).toBe('12, rue de la Paix');
    });

    it('gère les guillemets doublés RFC 4180', () => {
      const csv = 'COMMENTAIRE,ID\n"Texte avec ""guillemets""",1';
      const rows = parseCSV(csv);
      expect(rows[0]['COMMENTAIRE']).toBe('Texte avec "guillemets"');
    });

    it('retourne [] si moins de 2 lignes', () => {
      expect(parseCSV('Date,ID')).toHaveLength(0);
      expect(parseCSV('')).toHaveLength(0);
    });
  });
});
