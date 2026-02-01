import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { parse } from 'papaparse';

/**
 * Test suite for interventions-folders.csv
 * 
 * Validates:
 * - CSV structure and format
 * - Data integrity (required fields, data types)
 * - Format validation (INTER_ID_FACTURE, INTER_SIMPLE, etc.)
 * - ID extraction logic consistency
 * - Data consistency checks
 */

const CSV_PATH = path.join(__dirname, '../../data/docs_imports/interventions-folders.csv');

interface InterventionFolderRow {
  Mois: string;
  'Nom dossier': string;
  'ID intervention': string;
  'Numéro facture': string;
  'Nombre documents': string;
  Format: string;
  'Folder ID': string;
}

describe('interventions-folders.csv', () => {
  let csvData: InterventionFolderRow[] = [];
  let rawCsvContent: string = '';

  // Load CSV file before all tests
  beforeAll(() => {
    if (!fs.existsSync(CSV_PATH)) {
      throw new Error(`CSV file not found at: ${CSV_PATH}`);
    }
    rawCsvContent = fs.readFileSync(CSV_PATH, 'utf-8');
    
    const parseResult = parse<InterventionFolderRow>(rawCsvContent, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
    });

    if (parseResult.errors.length > 0) {
      console.warn('CSV parsing errors:', parseResult.errors);
    }

    csvData = parseResult.data;
  });

  describe('File Structure', () => {
    it('should exist', () => {
      expect(fs.existsSync(CSV_PATH)).toBe(true);
    });

    it('should not be empty', () => {
      expect(rawCsvContent.length).toBeGreaterThan(0);
    });

    it('should have correct headers', () => {
      const expectedHeaders = [
        'Mois',
        'Nom dossier',
        'ID intervention',
        'Numéro facture',
        'Nombre documents',
        'Format',
        'Folder ID'
      ];

      const firstLine = rawCsvContent.split('\n')[0];
      expectedHeaders.forEach(header => {
        expect(firstLine).toContain(header);
      });
    });

    it('should have data rows', () => {
      expect(csvData.length).toBeGreaterThan(0);
    });

    it('should have exactly 541 data rows (excluding header)', () => {
      expect(csvData.length).toBe(541);
    });
  });

  describe('Data Integrity', () => {
    it('should have all required columns for each row', () => {
      const requiredColumns = [
        'Mois',
        'Nom dossier',
        'ID intervention',
        'Numéro facture',
        'Nombre documents',
        'Format',
        'Folder ID'
      ];

      csvData.forEach((row, index) => {
        requiredColumns.forEach(column => {
          expect(row).toHaveProperty(column);
          expect(row[column as keyof InterventionFolderRow]).not.toBeUndefined();
        });
      });
    });

    it('should have valid month values', () => {
      const validMonths = [
        '9-SEPTEMBRE 2025',
        '10-Octobre 2025'
      ];

      csvData.forEach((row, index) => {
        expect(validMonths).toContain(row.Mois);
      });
    });

    it('should have non-empty folder names', () => {
      csvData.forEach((row, index) => {
        expect(row['Nom dossier']).toBeTruthy();
        expect(row['Nom dossier'].trim().length).toBeGreaterThan(0);
      });
    });

    it('should have valid Folder IDs (Google Drive format)', () => {
      // Google Drive IDs are typically alphanumeric with dashes and underscores
      const folderIdPattern = /^[a-zA-Z0-9_-]+$/;

      csvData.forEach((row, index) => {
        const folderId = row['Folder ID'].trim();
        expect(folderId).toMatch(folderIdPattern);
        expect(folderId.length).toBeGreaterThan(0);
      });
    });

    it('should have valid document counts', () => {
      csvData.forEach((row, index) => {
        const docCount = row['Nombre documents'].trim();
        const count = parseInt(docCount, 10);
        
        expect(docCount).toBeTruthy();
        expect(isNaN(count)).toBe(false);
        expect(count).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('Format Validation', () => {
    it('should have valid format values', () => {
      const validFormats = [
        'INTER_ID_FACTURE',
        'INTER_SIMPLE',
        'INTER_ID_EXPLICITE',
        'UNKNOWN'
      ];

      csvData.forEach((row, index) => {
        expect(validFormats).toContain(row.Format);
      });
    });

    it('should have INTER_ID_FACTURE format when both ID and invoice number are present', () => {
      csvData
        .filter(row => {
          const hasId = row['ID intervention'].trim() !== '';
          const hasFacture = row['Numéro facture'].trim() !== '';
          return hasId && hasFacture;
        })
        .forEach((row, index) => {
          expect(row.Format).toBe('INTER_ID_FACTURE');
        });
    });

    it('should have INTER_SIMPLE format when ID is present but no invoice number', () => {
      csvData
        .filter(row => {
          const hasId = row['ID intervention'].trim() !== '';
          const hasFacture = row['Numéro facture'].trim() !== '';
          return hasId && !hasFacture && row.Format === 'INTER_SIMPLE';
        })
        .forEach((row, index) => {
          expect(row['Numéro facture'].trim()).toBe('');
        });
    });

    it('should have UNKNOWN format when ID is missing', () => {
      csvData
        .filter(row => row.Format === 'UNKNOWN')
        .forEach((row, index) => {
          const id = row['ID intervention'].trim();
          expect(id === '' || id === null || id === undefined).toBe(true);
        });
    });
  });

  describe('ID Extraction Logic', () => {
    it('should extract valid intervention IDs when present', () => {
      csvData
        .filter(row => row['ID intervention'].trim() !== '')
        .forEach((row, index) => {
          const id = parseInt(row['ID intervention'].trim(), 10);
          expect(isNaN(id)).toBe(false);
          expect(id).toBeGreaterThan(0);
        });
    });

    it('should have intervention ID matching folder name pattern', () => {
      csvData
        .filter(row => row['ID intervention'].trim() !== '')
        .forEach((row, index) => {
          const folderName = row['Nom dossier'].toUpperCase();
          const id = row['ID intervention'].trim();
          
          // Folder name should contain the ID
          expect(folderName).toContain(id);
        });
    });

    it('should extract valid invoice numbers when present', () => {
      csvData
        .filter(row => row['Numéro facture'].trim() !== '')
        .forEach((row, index) => {
          const factureNum = parseInt(row['Numéro facture'].trim(), 10);
          expect(isNaN(factureNum)).toBe(false);
          expect(factureNum).toBeGreaterThan(0);
        });
    });

    it('should have invoice number matching folder name pattern when present', () => {
      csvData
        .filter(row => row['Numéro facture'].trim() !== '')
        .forEach((row, index) => {
          const folderName = row['Nom dossier'].toUpperCase();
          const factureNum = row['Numéro facture'].trim();
          
          // Folder name should contain FACTURE and the number
          expect(folderName).toMatch(/FACTURE/i);
          expect(folderName).toContain(factureNum);
        });
    });
  });

  describe('Data Consistency', () => {
    it('should have unique folder IDs', () => {
      const folderIds = csvData.map(row => row['Folder ID'].trim());
      const uniqueFolderIds = new Set(folderIds);
      
      expect(uniqueFolderIds.size).toBe(folderIds.length);
    });

    it('should have consistent month distribution', () => {
      const monthCounts = csvData.reduce((acc, row) => {
        acc[row.Mois] = (acc[row.Mois] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Both months should have data
      expect(Object.keys(monthCounts).length).toBeGreaterThan(0);
      
      // Log distribution for debugging
      console.log('Month distribution:', monthCounts);
    });

    it('should have consistent format distribution', () => {
      const formatCounts = csvData.reduce((acc, row) => {
        acc[row.Format] = (acc[row.Format] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Should have at least one format type
      expect(Object.keys(formatCounts).length).toBeGreaterThan(0);
      
      // Log distribution for debugging
      console.log('Format distribution:', formatCounts);
    });

    it('should have document counts matching expected ranges', () => {
      const docCounts = csvData.map(row => parseInt(row['Nombre documents'].trim(), 10));
      
      const minDocs = Math.min(...docCounts);
      const maxDocs = Math.max(...docCounts);
      const avgDocs = docCounts.reduce((a, b) => a + b, 0) / docCounts.length;

      expect(minDocs).toBeGreaterThanOrEqual(0);
      expect(maxDocs).toBeLessThan(1000); // Sanity check
      
      console.log(`Document count stats: min=${minDocs}, max=${maxDocs}, avg=${avgDocs.toFixed(2)}`);
    });
  });

  describe('Edge Cases', () => {
    it('should handle rows with missing invoice numbers', () => {
      const rowsWithoutFacture = csvData.filter(
        row => row['Numéro facture'].trim() === ''
      );

      rowsWithoutFacture.forEach((row) => {
        expect(row['Numéro facture'].trim()).toBe('');
        // Should still have a valid format
        expect(['INTER_SIMPLE', 'INTER_ID_EXPLICITE', 'UNKNOWN']).toContain(row.Format);
      });
    });

    it('should handle rows with zero documents', () => {
      const rowsWithZeroDocs = csvData.filter(
        row => parseInt(row['Nombre documents'].trim(), 10) === 0
      );

      rowsWithZeroDocs.forEach((row) => {
        expect(parseInt(row['Nombre documents'].trim(), 10)).toBe(0);
      });
    });

    it('should handle UNKNOWN format rows correctly', () => {
      const unknownRows = csvData.filter(row => row.Format === 'UNKNOWN');

      unknownRows.forEach((row) => {
        // UNKNOWN format should have missing or invalid ID
        const id = row['ID intervention'].trim();
        expect(id === '' || isNaN(parseInt(id, 10))).toBe(true);
      });
    });
  });

  describe('Specific Examples', () => {
    it('should correctly parse INTER_ID_FACTURE format', () => {
      const example = csvData.find(
        row => row.Format === 'INTER_ID_FACTURE' && 
               row['ID intervention'].trim() !== '' &&
               row['Numéro facture'].trim() !== ''
      );

      if (example) {
        expect(example.Format).toBe('INTER_ID_FACTURE');
        expect(parseInt(example['ID intervention'].trim(), 10)).toBeGreaterThan(0);
        expect(parseInt(example['Numéro facture'].trim(), 10)).toBeGreaterThan(0);
        expect(example['Nom dossier'].toUpperCase()).toMatch(/INTER/i);
        expect(example['Nom dossier'].toUpperCase()).toMatch(/FACTURE/i);
      }
    });

    it('should correctly parse INTER_SIMPLE format', () => {
      const example = csvData.find(
        row => row.Format === 'INTER_SIMPLE' && 
               row['ID intervention'].trim() !== '' &&
               row['Numéro facture'].trim() === ''
      );

      if (example) {
        expect(example.Format).toBe('INTER_SIMPLE');
        expect(parseInt(example['ID intervention'].trim(), 10)).toBeGreaterThan(0);
        expect(example['Numéro facture'].trim()).toBe('');
      }
    });

    it('should correctly parse INTER_ID_EXPLICITE format', () => {
      const example = csvData.find(
        row => row.Format === 'INTER_ID_EXPLICITE'
      );

      if (example) {
        expect(example.Format).toBe('INTER_ID_EXPLICITE');
        expect(example['Nom dossier'].toUpperCase()).toMatch(/ID/i);
      }
    });
  });
});

