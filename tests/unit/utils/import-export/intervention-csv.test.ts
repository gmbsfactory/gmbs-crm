import { describe, it, expect } from 'vitest';
import {
  CSV_COLUMNS,
  convertToCSV,
  type InterventionRow,
} from '@/utils/import-export/intervention-csv';

const HEADER =
  "Date,Agence,Adresse d'intervention,ID,Statut,Contexte d'intervention,Métier,Gest.,Technicien,COUT SST,COÛT MATERIEL,Numéro SST,COUT INTER,% SST,PROPRIO,Date d'intervention,TEL LOC,Locataire,Em@il Locataire,COMMENTAIRE";

describe('intervention-csv', () => {
  describe('CSV_COLUMNS', () => {
    it('should have 20 columns in the client-defined order', () => {
      expect(CSV_COLUMNS).toHaveLength(20);
      expect(CSV_COLUMNS[0]).toBe('Date');
      expect(CSV_COLUMNS[19]).toBe('COMMENTAIRE');
    });
  });

  describe('convertToCSV', () => {
    it('should produce header row only when given an empty array', () => {
      expect(convertToCSV([])).toBe(HEADER);
    });

    it('should produce exact CSV for a fully-populated intervention (escaping comma in commentaire)', () => {
      const intervention: InterventionRow = {
        // Use local-time mid-day to avoid TZ-induced day shifts
        created_at: '2024-03-15T12:00:00',
        date_prevue: '2024-03-20T12:00:00',
        id_inter: 'INT-001',
        adresse: '10 rue de la Paix',
        contexte_intervention: 'Plomberie',
        numero_sst: 'SST-42',
        pourcentage_sst: 10,
        commentaires: 'Bon travail, merci',
        technicien: 'Jean Martin',
        costs: [
          { cost_type: 'sst', amount: 100 },
          { cost_type: 'materiel', amount: 50 },
          { cost_type: 'intervention', amount: 200 },
        ],
        agencies: { label: 'Agence Paris' },
        tenants: {
          firstname: 'Marie',
          lastname: 'Curie',
          telephone: '0612345678',
          email: 'marie@example.com',
        },
        owner: { owner_firstname: 'Pierre', owner_lastname: 'Dupont' },
        users: { username: 'jdoe' },
        intervention_statuses: { label: 'En cours' },
        metiers: { label: 'Plombier' },
      };

      const expectedRow =
        '15/03/2024,Agence Paris,10 rue de la Paix,INT-001,En cours,Plomberie,Plombier,jdoe,Jean Martin,100,50,SST-42,200,10,Pierre Dupont,20/03/2024,0612345678,Marie Curie,marie@example.com,"Bon travail, merci"';

      expect(convertToCSV([intervention])).toBe(`${HEADER}\n${expectedRow}`);
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
        commentaires: null,
        technicien: null,
        costs: null,
        agencies: null,
        tenants: null,
        owner: null,
        users: null,
        intervention_statuses: null,
        metiers: null,
      };

      // 20 empty cells → 19 commas
      const expectedRow = ','.repeat(19);
      expect(convertToCSV([intervention])).toBe(`${HEADER}\n${expectedRow}`);
    });
  });
});
