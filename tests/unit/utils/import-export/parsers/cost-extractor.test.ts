import { describe, it, expect } from 'vitest';
import { extractCostsData, formatCostsForInsertion } from '@/utils/import-export/parsers/cost-extractor';

describe('cost-extractor', () => {
  describe('extractCostsData', () => {
    it('extrait les 5 types de coûts', () => {
      const row = {
        'COUT SST': '500',
        'COÛT MATERIEL': '200',
        'COUT INTER': '1500',
        'COUT SST 2': '300',
        'COÛT MATERIEL 2': '100',
      };
      const costs = extractCostsData(row);
      expect(costs.sst).toBe(500);
      expect(costs.materiel).toBe(200);
      expect(costs.intervention).toBe(1500);
      expect(costs.sst2).toBe(300);
      expect(costs.materiel2).toBe(100);
    });

    it('retourne null pour cellules vides', () => {
      const costs = extractCostsData({ 'COUT SST': '', 'COÛT MATERIEL': '' });
      expect(costs.sst).toBeNull();
      expect(costs.materiel).toBeNull();
    });

    it('parse les virgules décimales', () => {
      const costs = extractCostsData({ 'COUT SST': '1 500,50' });
      expect(costs.sst).toBe(1500.5);
    });
  });

  describe('formatCostsForInsertion', () => {
    it('formate les coûts présents uniquement', () => {
      const costs = formatCostsForInsertion({ sst: 500, materiel: null, intervention: 1500, sst2: null, materiel2: null });
      expect(costs).toHaveLength(2);
      expect(costs.find((c) => c.cost_type === 'sst')?.artisan_position).toBe(1);
    });

    it('inclut artisan_position=2 pour SST 2', () => {
      const costs = formatCostsForInsertion({ sst: null, materiel: null, intervention: null, sst2: 300, materiel2: 100 });
      expect(costs.find((c) => c.cost_type === 'sst')?.artisan_position).toBe(2);
      expect(costs.find((c) => c.cost_type === 'materiel')?.artisan_position).toBe(2);
    });

    it('ignore les coûts dépassant MAX_COST', () => {
      const costs = formatCostsForInsertion({ sst: 200_000, materiel: null, intervention: null, sst2: null, materiel2: null });
      expect(costs.find((c) => c.cost_type === 'sst')).toBeUndefined();
    });
  });
});
