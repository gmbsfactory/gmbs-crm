import { describe, it, expect } from 'vitest';
import {
  CSV_COLUMNS,
  CSV_COLUMNS_EXTENDED,
  convertToCSV,
  type InterventionRow,
} from '@/utils/import-export/intervention-csv';

// Format client (24 colonnes) — les en-têtes Demande * contiennent un double
// espace avant ✅, c'est volontaire (gabarit Excel maître).
const HEADER =
  "Date,Agence,Adresse,ID,Statut,Contexte d'intervention,Métier,Gest.,SST,COUT SST,COÛT MATERIEL,Numéro SST,COUT INTER,% SST,PROPRIO,Date d'intervention,TEL LOC,Locataire,Em@il Locataire,COMMENTAIRE,Truspilot,Demande d'intervention ✅,Demande Devis  ✅,Demande TrustPilot  ✅";

const HEADER_EXTENDED = `${HEADER},SST 2,COUT SST 2,COÛT MATERIEL 2`;

describe('intervention-csv', () => {
  describe('CSV_COLUMNS', () => {
    it('should have 24 columns in the client-defined order (mode standard)', () => {
      expect(CSV_COLUMNS).toHaveLength(24);
      expect(CSV_COLUMNS[0]).toBe('Date');
      expect(CSV_COLUMNS[3]).toBe('ID');
      expect(CSV_COLUMNS[4]).toBe('Statut');
      expect(CSV_COLUMNS[7]).toBe('Gest.');
      expect(CSV_COLUMNS[8]).toBe('SST');
      expect(CSV_COLUMNS[19]).toBe('COMMENTAIRE');
      expect(CSV_COLUMNS[23]).toBe('Demande TrustPilot  ✅');
    });

    it('should add second-artisan columns in extended mode (27 cols)', () => {
      expect(CSV_COLUMNS_EXTENDED).toHaveLength(27);
      expect(CSV_COLUMNS_EXTENDED[24]).toBe('SST 2');
      expect(CSV_COLUMNS_EXTENDED[25]).toBe('COUT SST 2');
      expect(CSV_COLUMNS_EXTENDED[26]).toBe('COÛT MATERIEL 2');
    });
  });

  describe('convertToCSV', () => {
    it('should produce header row only when given an empty array', () => {
      expect(convertToCSV([])).toBe(HEADER);
    });

    it('should produce exact CSV for a fully-populated intervention (base mode, no second artisan)', () => {
      const intervention: InterventionRow = {
        // Local-time mid-day to avoid TZ-induced day shifts. La colonne `Date`
        // est désormais alimentée par `interventions.date` (date métier) et
        // non plus par `created_at` (date d'insertion en base).
        date: '2024-03-15T12:00:00',
        created_at: '2024-03-15T12:00:00',
        date_prevue: '2024-03-20T12:00:00',
        id_inter: 'INT-001',
        adresse: '10 rue de la Paix',
        contexte_intervention: 'Plomberie',
        numero_sst: 'SST-42',
        pourcentage_sst: 10,
        artisan_primary: 'Jean Martin',
        artisan_secondary: 'Paul Durand',
        costs: [
          { cost_type: 'sst', amount: 100, artisan_order: 1 },
          { cost_type: 'materiel', amount: 50, artisan_order: 1 },
          { cost_type: 'sst', amount: 80, artisan_order: 2 },
          { cost_type: 'materiel', amount: 30, artisan_order: 2 },
          { cost_type: 'intervention', amount: 200, artisan_order: null },
        ],
        agencies: { label: 'Agence Paris' },
        tenants: {
          firstname: 'Marie',
          lastname: 'Curie',
          telephone: '0612345678',
          email: 'marie@example.com',
        },
        owner: {
          plain_nom_facturation: 'Pierre Dupont',
          telephone: '0698765432',
          email: 'pierre@example.com',
        },
        intervention_statuses: { label: 'En cours' },
        users: { username: 'jdoe' },
        metiers: { label: 'Plombier' },
        commentaires: '[15/03/2024] RAS',
      };

      const expectedRow =
        '15/03/2024,Agence Paris,10 rue de la Paix,INT-001,En cours,Plomberie,Plombier,jdoe,Jean Martin,100,50,SST-42,200,10,Pierre Dupont - 0698765432 - pierre@example.com,20/03/2024,"=""0612345678""",Marie Curie,marie@example.com,[15/03/2024] RAS,,,,';

      expect(convertToCSV([intervention])).toBe(`${HEADER}\n${expectedRow}`);
    });

    it('should include COMMENTAIRE in base mode at column 20', () => {
      const intervention: InterventionRow = {
        created_at: '2024-03-15T12:00:00',
        id_inter: 'INT-002',
        commentaires: '[15/03/2024] RAS',
      };

      const csv = convertToCSV([intervention]);
      const cells = csv.split('\n')[1].split(',');
      expect(cells).toHaveLength(24);
      expect(cells[19]).toBe('[15/03/2024] RAS');
    });

    it('should append SST 2 / COUT SST 2 / COÛT MATERIEL 2 in extended mode', () => {
      const intervention: InterventionRow = {
        created_at: '2024-03-15T12:00:00',
        id_inter: 'INT-003',
        artisan_primary: 'Jean Martin',
        artisan_secondary: 'Paul Durand',
        costs: [
          { cost_type: 'sst', amount: 80, artisan_order: 2 },
          { cost_type: 'materiel', amount: 30, artisan_order: 2 },
        ],
      };

      const csv = convertToCSV([intervention], { extended: true });
      const lines = csv.split('\n');
      expect(lines[0]).toBe(HEADER_EXTENDED);
      const cells = lines[1].split(',');
      expect(cells).toHaveLength(27);
      expect(cells[24]).toBe('Paul Durand');
      expect(cells[25]).toBe('80');
      expect(cells[26]).toBe('30');
    });

    it('should leave SST 2 / COUT SST 2 / COÛT MATERIEL 2 empty when no second artisan (extended)', () => {
      const intervention: InterventionRow = {
        created_at: '2024-03-15T12:00:00',
        id_inter: 'INT-004',
        artisan_primary: 'Jean Martin',
        costs: [{ cost_type: 'sst', amount: 100, artisan_order: 1 }],
      };

      const csv = convertToCSV([intervention], { extended: true });
      const cells = csv.split('\n')[1].split(',');
      expect(cells[24]).toBe('');
      expect(cells[25]).toBe('');
      expect(cells[26]).toBe('');
    });

    it('should output empty cells (and not crash) when all nested relations / costs are null', () => {
      const intervention: InterventionRow = {
        date: null,
        created_at: null,
        date_prevue: null,
        id_inter: null,
        adresse: null,
        contexte_intervention: null,
        numero_sst: null,
        pourcentage_sst: null,
        artisan_primary: null,
        artisan_secondary: null,
        costs: null,
        agencies: null,
        tenants: null,
        owner: null,
        metiers: null,
        intervention_statuses: null,
        users: null,
      };

      // 24 empty cells → 23 commas
      const expectedRow = ','.repeat(23);
      expect(convertToCSV([intervention])).toBe(`${HEADER}\n${expectedRow}`);
    });
  });
});
