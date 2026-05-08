import { parseNumber } from './date-number-parser';
import { cleanCSVKeys, type CsvRow } from './csv-parser';

export interface ExtractedCosts {
  /** Artisan primaire (colonne SST) */
  sst: number | null;
  materiel: number | null;
  intervention: number | null;
  /** Artisan secondaire (colonne SST 2) */
  sst2: number | null;
  materiel2: number | null;
}

export interface FormattedCost {
  cost_type: string;
  label: string;
  amount: number;
  currency: 'EUR';
  artisan_position?: 1 | 2;
}

export function extractCostsData(csvRow: CsvRow): ExtractedCosts {
  const row = cleanCSVKeys(csvRow);

  return {
    sst: parseNumberCell(row['COUT SST']),
    materiel: parseNumberCell(row['COÛT MATERIEL']),
    intervention: parseNumberCell(row['COUT INTER']),
    sst2: parseNumberCell(row['COUT SST 2']),
    materiel2: parseNumberCell(row['COÛT MATERIEL 2']),
  };
}

function parseNumberCell(value: string | undefined): number | null {
  if (!value || value.trim() === '') return null;
  return parseNumber(value);
}

const MAX_COST = 100_000;

export function formatCostsForInsertion(
  costs: ExtractedCosts,
  idInter: string | null = null
): FormattedCost[] {
  const result: FormattedCost[] = [];

  const clamp = (v: number | null, field: string): number | null => {
    if (v === null) return null;
    if (Math.abs(v) >= MAX_COST) {
      console.warn(`[csv-import] ${field} hors limite (${v}) pour id_inter=${idInter} → ignoré`);
      return null;
    }
    return v;
  };

  const sst = clamp(costs.sst, 'COUT SST');
  const materiel = clamp(costs.materiel, 'COÛT MATERIEL');
  const intervention = clamp(costs.intervention, 'COUT INTER');
  const sst2 = clamp(costs.sst2, 'COUT SST 2');
  const materiel2 = clamp(costs.materiel2, 'COÛT MATERIEL 2');

  if (sst !== null) result.push({ cost_type: 'sst', label: 'Coût SST', amount: sst, currency: 'EUR', artisan_position: 1 });
  if (materiel !== null) result.push({ cost_type: 'materiel', label: 'Coût Matériel', amount: materiel, currency: 'EUR', artisan_position: 1 });
  if (intervention !== null) result.push({ cost_type: 'intervention', label: 'Coût Intervention', amount: intervention, currency: 'EUR' });
  if (sst2 !== null) result.push({ cost_type: 'sst', label: 'Coût SST 2', amount: sst2, currency: 'EUR', artisan_position: 2 });
  if (materiel2 !== null) result.push({ cost_type: 'materiel', label: 'Coût Matériel 2', amount: materiel2, currency: 'EUR', artisan_position: 2 });

  return result;
}
