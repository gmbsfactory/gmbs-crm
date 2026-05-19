/**
 * Helpers partagés pour la construction du CSV d'export des interventions.
 *
 * Ce module est la SOURCE UNIQUE pour le format CSV : il est utilisé à la fois
 * par le script Node admin (scripts/data/exports/export-interventions-csv.js)
 * et par la route webapp d'export. Toute modification ici impacte les deux
 * côtés — l'ordre des colonnes, l'échappement et le format de date
 * (DD/MM/YYYY) sont figés par le format Excel maître du client.
 *
 * Le format est documenté en détail dans `docs/specs/crm-csv-import-export.md`.
 *
 * Mode standard (défaut) : 24 colonnes du gabarit Excel client. `ID`, `Statut`,
 * `Gest.` et `COMMENTAIRE` font partie du format client (l'`ID` sert aussi de
 * clé d'upsert pour le round-trip CRM → CRM ; `COMMENTAIRE` regroupe les
 * commentaires internes agrégés `[DD/MM/YYYY] contenu` séparés par ` || `).
 *
 * Mode étendu (`{ extended: true }`) : ajoute `SST 2`, `COUT SST 2` et
 * `COÛT MATERIEL 2` en fin (positions 25-27) pour les interventions à deux
 * artisans.
 */

export interface InterventionCost {
  cost_type: string;
  amount: number | string | null;
  /** 1 = artisan primaire, 2 = artisan secondaire, null = coût global */
  artisan_order?: number | null;
}

export interface InterventionRow {
  /**
   * Date métier de l'intervention (`interventions.date`). Source de la colonne
   * `Date` du CSV. Garantit la symétrie d'un round-trip export → re-import :
   * `interventions.date` → CSV `Date` → `interventions.date`. Auparavant la
   * colonne `Date` était alimentée par `created_at`, ce qui écrasait
   * silencieusement la vraie date métier lors d'une réimportation.
   */
  date?: string | null;
  /**
   * Conservé pour usage interne (timestamps de commentaires agrégés via
   * `commentaires`). Ce champ n'alimente PLUS la colonne `Date` du CSV.
   */
  created_at?: string | null;
  id_inter?: string | null;
  adresse?: string | null;
  contexte_intervention?: string | null;
  numero_sst?: string | null;
  pourcentage_sst?: number | string | null;
  date_prevue?: string | null;
  /** Nom de l'artisan primaire (intervention_artisans.is_primary = true) */
  artisan_primary?: string | null;
  /** Nom de l'artisan secondaire, si présent */
  artisan_secondary?: string | null;
  costs?: InterventionCost[] | null;
  agencies?: { label?: string | null } | null;
  tenants?: {
    firstname?: string | null;
    lastname?: string | null;
    plain_nom_client?: string | null;
    telephone?: string | null;
    email?: string | null;
  } | null;
  owner?: {
    plain_nom_facturation?: string | null;
    telephone?: string | null;
    email?: string | null;
  } | null;
  metiers?: { label?: string | null } | null;
  // Champs uniquement utilisés en mode étendu :
  intervention_statuses?: { label?: string | null } | null;
  users?: { username?: string | null } | null;
  /** Commentaires internes agrégés `[DD/MM/YYYY] contenu` séparés par ` || ` */
  commentaires?: string | null;
}

export interface ConvertOptions {
  /** Si true, ajoute les colonnes secondaires (SST 2, COUT SST 2, COÛT MATERIEL 2) en fin. */
  extended?: boolean;
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

/**
 * Récupère le montant d'un coût filtré par type et (optionnellement) par
 * `artisan_order` (1 = primaire, 2 = secondaire, null/undefined = coût global).
 */
export function getCostByType(
  costs: InterventionCost[] | null | undefined,
  costType: string,
  artisanOrder: number | null = null
): string {
  if (!costs || costs.length === 0) return '';

  const cost = costs.find((c) => {
    if (c.cost_type !== costType) return false;
    if (artisanOrder === null) {
      // Coût global : on accepte les lignes sans artisan_order
      return c.artisan_order == null;
    }
    return c.artisan_order === artisanOrder;
  });

  return cost ? formatAmount(cost.amount) : '';
}

const fullName = (first?: string | null, last?: string | null): string =>
  [first || '', last || ''].filter(Boolean).join(' ').trim();

/**
 * Concatène nom + prénom + téléphone + email avec ` - ` comme séparateur.
 * Les segments vides sont omis.
 */
const ownerSummary = (owner: InterventionRow['owner']): string => {
  if (!owner) return '';
  const name = (owner.plain_nom_facturation || '').trim();
  return [name, owner.telephone || '', owner.email || '']
    .filter((s) => s && s.trim())
    .join(' - ');
};

/**
 * Préserve le zéro initial des numéros de téléphone à l'ouverture dans Excel
 * via la formule `="..."`. Sans cette astuce, Excel interprète "0615..." comme
 * un nombre et tronque le 0 de tête.
 */
const excelText = (value?: string | null): string => {
  if (!value) return '';
  return `="${String(value).replace(/"/g, '""')}"`;
};

/**
 * Colonnes du format client (positions 1-23) + colonne technique `ID` (24).
 *
 * L'ordre, l'orthographe (accents, double espace avant `✅`) et la présence
 * des colonnes vides Truspilot/Demande reproduisent **exactement** le gabarit
 * Excel maître du client. Toute modification ici doit être documentée dans
 * `docs/specs/crm-csv-import-export.md`.
 */
const BASE_COLUMNS: readonly ColumnSpec[] = [
  { header: 'Date',                       get: (r) => formatDate(r.date) },
  { header: 'Agence',                     get: (r) => r.agencies?.label || '' },
  { header: 'Adresse',                    get: (r) => r.adresse || '' },
  { header: 'ID',                         get: (r) => r.id_inter || '' },
  { header: 'Statut',                     get: (r) => r.intervention_statuses?.label || '' },
  { header: "Contexte d'intervention",    get: (r) => r.contexte_intervention || '' },
  { header: 'Métier',                     get: (r) => r.metiers?.label || '' },
  { header: 'Gest.',                      get: (r) => r.users?.username || '' },
  { header: 'SST',                        get: (r) => r.artisan_primary || '' },
  { header: 'COUT SST',                   get: (r) => getCostByType(r.costs, 'sst', 1) },
  { header: 'COÛT MATERIEL',              get: (r) => getCostByType(r.costs, 'materiel', 1) },
  { header: 'Numéro SST',                 get: (r) => excelText(r.numero_sst) },
  { header: 'COUT INTER',                 get: (r) => getCostByType(r.costs, 'intervention') },
  { header: '% SST',                      get: (r) => formatAmount(r.pourcentage_sst) },
  { header: 'PROPRIO',                    get: (r) => ownerSummary(r.owner) },
  { header: "Date d'intervention",        get: (r) => formatDate(r.date_prevue) },
  { header: 'TEL LOC',                    get: (r) => excelText(r.tenants?.telephone) },
  { header: 'Locataire',                  get: (r) => r.tenants?.plain_nom_client || fullName(r.tenants?.firstname, r.tenants?.lastname) },
  { header: 'Em@il Locataire',            get: (r) => r.tenants?.email || '' },
  { header: 'COMMENTAIRE',                get: (r) => r.commentaires || '' },
  { header: 'Truspilot',                  get: () => '' },
  { header: "Demande d'intervention ✅",  get: () => '' },
  { header: 'Demande Devis  ✅',          get: () => '' },
  { header: 'Demande TrustPilot  ✅',     get: () => '' },
];

/** Colonnes secondaires (deuxième artisan) ajoutées en mode étendu. */
const EXTENDED_COLUMNS: readonly ColumnSpec[] = [
  { header: 'SST 2',                      get: (r) => r.artisan_secondary || '' },
  { header: 'COUT SST 2',                 get: (r) => getCostByType(r.costs, 'sst', 2) },
  { header: 'COÛT MATERIEL 2',            get: (r) => getCostByType(r.costs, 'materiel', 2) },
];

const columnsFor = (options?: ConvertOptions): readonly ColumnSpec[] =>
  options?.extended ? [...BASE_COLUMNS, ...EXTENDED_COLUMNS] : BASE_COLUMNS;

/** Liste ordonnée des en-têtes du mode standard (24 colonnes, COMMENTAIRE inclus). */
export const CSV_COLUMNS: readonly string[] = BASE_COLUMNS.map((c) => c.header);

/** Liste ordonnée des en-têtes en mode étendu (27 colonnes, avec deuxième artisan). */
export const CSV_COLUMNS_EXTENDED: readonly string[] = [
  ...BASE_COLUMNS,
  ...EXTENDED_COLUMNS,
].map((c) => c.header);

const toCSVRow = (cells: readonly string[]): string =>
  cells.map(escapeCSV).join(',');

/**
 * Convertit une liste d'interventions en CSV (en-tête + une ligne par
 * intervention). N'inclut PAS le BOM UTF-8 — c'est à l'appelant de l'ajouter
 * si nécessaire (ex. pour Excel).
 */
export function convertToCSV(
  interventions: InterventionRow[],
  options?: ConvertOptions
): string {
  const columns = columnsFor(options);
  const headerRow = toCSVRow(columns.map((c) => c.header));
  const dataRows = interventions.map((row) =>
    toCSVRow(columns.map((col) => col.get(row)))
  );
  return [headerRow, ...dataRows].join('\n');
}
