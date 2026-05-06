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
  "Date,Agence,Adresse,Contexte d'intervention,Métier,SST,COUT SST,COÛT MATERIEL,Numéro SST,COUT INTER,% SST,PROPRIO,Date d'intervention,TEL LOC,Locataire,Em@il Locataire,Truspilot,Demande d'intervention ✅,Demande Devis  ✅,Demande TrustPilot  ✅,SST 2,COUT SST 2,COÛT MATERIEL 2,ID";

const HEADER_EXTENDED = `${HEADER},Statut,Gest.,COMMENTAIRE`;

describe('intervention-csv', () => {
  describe('CSV_COLUMNS', () => {
    it('should have 24 columns in the client-defined order (mode standard)', () => {
      expect(CSV_COLUMNS).toHaveLength(24);
      expect(CSV_COLUMNS[0]).toBe('Date');
      expect(CSV_COLUMNS[2]).toBe('Adresse');
      expect(CSV_COLUMNS[5]).toBe('SST');
      expect(CSV_COLUMNS[20]).toBe('SST 2');
      expect(CSV_COLUMNS[23]).toBe('ID');
    });

    it('should add Statut/Gest./COMMENTAIRE in extended mode (27 cols)', () => {
      expect(CSV_COLUMNS_EXTENDED).toHaveLength(27);
      expect(CSV_COLUMNS_EXTENDED.slice(24)).toEqual(['Statut', 'Gest.', 'COMMENTAIRE']);
    });
  });

  describe('convertToCSV', () => {
    it('should produce header row only when given an empty array', () => {
      expect(convertToCSV([])).toBe(HEADER);
    });

    it('should produce exact CSV for a fully-populated intervention with both artisans', () => {
      const intervention: InterventionRow = {
        // Local-time mid-day to avoid TZ-induced day shifts
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
        owner: { owner_firstname: 'Pierre', owner_lastname: 'Dupont' },
        metiers: { label: 'Plombier' },
      };

      const expectedRow =
        '15/03/2024,Agence Paris,10 rue de la Paix,Plomberie,Plombier,Jean Martin,100,50,SST-42,200,10,Pierre Dupont,20/03/2024,0612345678,Marie Curie,marie@example.com,,,,,Paul Durand,80,30,INT-001';

      expect(convertToCSV([intervention])).toBe(`${HEADER}\n${expectedRow}`);
    });

    it('should leave SST 2 / COUT SST 2 / COÛT MATERIEL 2 empty when no second artisan', () => {
      const intervention: InterventionRow = {
        created_at: '2024-03-15T12:00:00',
        id_inter: 'INT-002',
        artisan_primary: 'Jean Martin',
        costs: [{ cost_type: 'sst', amount: 100, artisan_order: 1 }],
      };

      const csv = convertToCSV([intervention]);
      const dataRow = csv.split('\n')[1];
      const cells = dataRow.split(',');
      // SST 2 = col 21 (index 20), COUT SST 2 = 22, COÛT MATERIEL 2 = 23
      expect(cells[20]).toBe('');
      expect(cells[21]).toBe('');
      expect(cells[22]).toBe('');
      // ID = col 24 (index 23)
      expect(cells[23]).toBe('INT-002');
    });

    it('should append Statut / Gest. / COMMENTAIRE in extended mode', () => {
      const intervention: InterventionRow = {
        created_at: '2024-03-15T12:00:00',
        id_inter: 'INT-003',
        intervention_statuses: { label: 'En cours' },
        users: { username: 'jdoe' },
        commentaires: '[15/03/2024] RAS',
      };

      const csv = convertToCSV([intervention], { extended: true });
      const lines = csv.split('\n');
      expect(lines[0]).toBe(HEADER_EXTENDED);
      const cells = lines[1].split(',');
      expect(cells).toHaveLength(27);
      expect(cells[24]).toBe('En cours');
      expect(cells[25]).toBe('jdoe');
      expect(cells[26]).toBe('[15/03/2024] RAS');
    });

    it('should output empty cells (and not crash) when all nested relations / costs are null', () => {
      const intervention: InterventionRow = {
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
      };

      // 24 empty cells → 23 commas
      const expectedRow = ','.repeat(23);
      expect(convertToCSV([intervention])).toBe(`${HEADER}\n${expectedRow}`);
    });
  });
});
