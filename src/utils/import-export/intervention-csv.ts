/**
 * Helpers partagés pour la construction du CSV d'export des interventions.
 *
 * Ce module est la SOURCE UNIQUE pour le format CSV : il est utilisé à la fois
 * par le script Node admin (scripts/data/exports/export-interventions-csv.js)
 * et par la future route webapp d'export. Toute modification ici impacte les
 * deux côtés — l'ordre des colonnes, l'échappement et le format de date
 * (DD/MM/YYYY) sont figés par le format client.
 *
 * Design : chaque colonne est décrite par un {@link ColumnSpec} qui regroupe
 * son en-tête et la fonction d'extraction. Cela garantit qu'on ne peut pas
 * faire diverger l'ordre des en-têtes de l'ordre des cellules.
 */

export interface InterventionCost {
  cost_type: string;
  amount: number | string | null;
}

export interface InterventionRow {
  created_at?: string | null;
  id_inter?: string | null;
  adresse?: string | null;
  contexte_intervention?: string | null;
  numero_sst?: string | null;
  pourcentage_sst?: number | string | null;
  date_prevue?: string | null;
  commentaires?: string | null;
  technicien?: string | null;
  costs?: InterventionCost[] | null;
  agencies?: { label?: string | null } | null;
  tenants?: {
    firstname?: string | null;
    lastname?: string | null;
    telephone?: string | null;
    email?: string | null;
  } | null;
  owner?: {
    owner_firstname?: string | null;
    owner_lastname?: string | null;
  } | null;
  users?: { username?: string | null } | null;
  intervention_statuses?: { label?: string | null } | null;
  metiers?: { label?: string | null } | null;
}

interface ColumnSpec {
  /** En-tête tel qu'il apparaît dans le CSV (figé par le format client) */
  header: string;
  /** Extrait la valeur brute depuis l'intervention (avant échappement CSV) */
  get: (row: InterventionRow) => string;
}

/** Échappe une valeur pour CSV (gestion guillemets, virgules, sauts de ligne). */
export function escapeCSV(value: unknown): string {
  if (value == null) return '';

  const stringValue = String(value);

  if (
    stringValue.includes('"') ||
    stringValue.includes(',') ||
    stringValue.includes('\n') ||
    stringValue.includes('\r')
  ) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

/** Formate une date au format DD/MM/YYYY (chaîne vide si invalide). */
export function formatDate(dateString: string | Date | null | undefined): string {
  if (!dateString) return '';

  const date = new Date(dateString as string);
  if (isNaN(date.getTime())) return '';

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();

  return `${day}/${month}/${year}`;
}

/** Formate un montant (chaîne vide pour null/empty). */
export function formatAmount(amount: number | string | null | undefined): string {
  if (amount == null || amount === '') return '';
  return String(amount);
}

/** Récupère le montant d'un coût par type (chaîne vide si absent). */
export function getCostByType(
  costs: InterventionCost[] | null | undefined,
  costType: string
): string {
  if (!costs || costs.length === 0) return '';

  const cost = costs.find((c) => c.cost_type === costType);
  return cost ? formatAmount(cost.amount) : '';
}

const fullName = (first?: string | null, last?: string | null): string =>
  [first || '', last || ''].filter(Boolean).join(' ').trim();

/**
 * Définition des colonnes — source unique de vérité pour le format CSV.
 * L'ordre de ce tableau définit l'ordre des colonnes dans le fichier exporté.
 */
const COLUMNS: readonly ColumnSpec[] = [
  { header: 'Date',                     get: (r) => formatDate(r.created_at) },
  { header: 'Agence',                   get: (r) => r.agencies?.label || '' },
  { header: "Adresse d'intervention",   get: (r) => r.adresse || '' },
  { header: 'ID',                       get: (r) => r.id_inter || '' },
  { header: 'Statut',                   get: (r) => r.intervention_statuses?.label || '' },
  { header: "Contexte d'intervention",  get: (r) => r.contexte_intervention || '' },
  { header: 'Métier',                   get: (r) => r.metiers?.label || '' },
  { header: 'Gest.',                    get: (r) => r.users?.username || '' },
  { header: 'Technicien',               get: (r) => r.technicien || '' },
  { header: 'COUT SST',                 get: (r) => getCostByType(r.costs, 'sst') },
  { header: 'COÛT MATERIEL',            get: (r) => getCostByType(r.costs, 'materiel') },
  { header: 'Numéro SST',               get: (r) => r.numero_sst || '' },
  { header: 'COUT INTER',               get: (r) => getCostByType(r.costs, 'intervention') },
  { header: '% SST',                    get: (r) => formatAmount(r.pourcentage_sst) },
  { header: 'PROPRIO',                  get: (r) => fullName(r.owner?.owner_firstname, r.owner?.owner_lastname) },
  { header: "Date d'intervention",      get: (r) => formatDate(r.date_prevue) },
  { header: 'TEL LOC',                  get: (r) => r.tenants?.telephone || '' },
  { header: 'Locataire',                get: (r) => fullName(r.tenants?.firstname, r.tenants?.lastname) },
  { header: 'Em@il Locataire',          get: (r) => r.tenants?.email || '' },
  { header: 'COMMENTAIRE',              get: (r) => r.commentaires || '' },
];

/** Liste ordonnée des en-têtes (dérivée de {@link COLUMNS}). */
export const CSV_COLUMNS: readonly string[] = COLUMNS.map((c) => c.header);

const toCSVRow = (cells: readonly string[]): string =>
  cells.map(escapeCSV).join(',');

/**
 * Convertit une liste d'interventions en CSV (en-tête + une ligne par
 * intervention). N'inclut PAS le BOM UTF-8 — c'est à l'appelant de l'ajouter
 * si nécessaire (ex. pour Excel).
 */
export function convertToCSV(interventions: InterventionRow[]): string {
  const headerRow = toCSVRow(CSV_COLUMNS);
  const dataRows = interventions.map((row) =>
    toCSVRow(COLUMNS.map((col) => col.get(row)))
  );
  return [headerRow, ...dataRows].join('\n');
}
