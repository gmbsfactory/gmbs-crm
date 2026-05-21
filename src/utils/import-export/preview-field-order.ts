/**
 * Ordre canonique d'affichage des champs dans la prévisualisation d'import
 * (modale « comparaison entre le CSV brut et le mapping vers la base »).
 *
 * Les deux colonnes côte à côte — « CSV brut » et « Mapping base de données » —
 * sont triées selon CETTE même séquence de paires, de sorte que la ligne N de
 * gauche corresponde à la ligne N de droite. L'utilisateur lit la cartographie
 * CSV → BDD ligne par ligne sans avoir à chercher la correspondance.
 *
 * Les paires reflètent les liens RÉELS câblés dans `intervention-mapper.ts`,
 * `buildDisplayPayload` (interventions-import.ts), `person-parser.ts` et
 * `cost-extractor.ts`. Toute évolution du mapping doit être répercutée ici.
 *
 * Les colonnes CSV sans pendant en base (Numéro SST, % SST, COMMENTAIRE,
 * Truspilot, etc.) et les clés non listées tombent en fin de liste, dans leur
 * ordre d'apparition d'origine (jamais masquées).
 */

/** Une paire « en-têtes CSV » ↔ « clé du displayPayload (mapping BDD) ». */
export interface CsvDbPair {
  /**
   * En-têtes CSV alimentant ce champ. Plusieurs entrées = variantes
   * alternatives (ex. `Métier`/`Metier`) OU colonnes agrégées affichées
   * consécutivement (ex. locataire = `Locataire` + `TEL LOC` + `Em@il
   * Locataire`). Tableau vide = champ sans colonne CSV (ex. `is_active`).
   */
  csv: string[];
  /** Clé correspondante dans `displayPayload`. */
  db: string;
}

export const CSV_DB_PAIRS: ReadonlyArray<CsvDbPair> = [
  { csv: ['ID'], db: 'id_inter' },
  { csv: ['Agence'], db: 'agence' },
  { csv: ['Adresse', "Adresse d'intervention"], db: 'adresse' },
  { csv: ['Date'], db: 'date' },
  { csv: ['Métier', 'Metier'], db: 'metier' },
  { csv: ['Statut', 'STATUT'], db: 'statut' },
  { csv: ['Gest.'], db: 'gestionnaire' },
  { csv: ["Contexte d'intervention"], db: 'contexte_intervention' },
  { csv: ["Date d'intervention"], db: 'date_prevue' },
  { csv: ['SST', 'Technicien'], db: 'artisan_sst' },
  { csv: ['SST 2'], db: 'artisan_sst2' },
  { csv: ['COUT SST'], db: 'cout_sst' },
  { csv: ['COÛT MATERIEL'], db: 'cout_materiel' },
  { csv: ['COUT INTER'], db: 'cout_intervention' },
  { csv: ['COUT SST 2'], db: 'cout_sst_2' },
  { csv: ['COÛT MATERIEL 2'], db: 'cout_materiel_2' },
  { csv: ['Locataire', 'TEL LOC', 'Em@il Locataire'], db: 'locataire' },
  { csv: ['PROPRIO'], db: 'proprietaire' },
  { csv: [], db: 'is_active' },
];

/** Normalise un en-tête CSV pour un matching tolérant (casse, espaces). */
const normHeader = (s: string): string => s.trim().toLowerCase().replace(/\s+/g, ' ');

// Rang d'un en-tête CSV brut : index de la paire × 100 + position de la variante
// (pour conserver l'ordre interne des colonnes agrégées comme le locataire).
const CSV_RAW_RANK = new Map<string, number>();
CSV_DB_PAIRS.forEach((pair, pairIdx) => {
  pair.csv.forEach((header, variantIdx) => {
    CSV_RAW_RANK.set(normHeader(header), pairIdx * 100 + variantIdx);
  });
});

// Rang d'une clé du displayPayload : simple index de la paire.
const DB_RANK = new Map<string, number>();
CSV_DB_PAIRS.forEach((pair, pairIdx) => DB_RANK.set(pair.db, pairIdx));

/** Rang d'un en-tête CSV brut (Infinity si hors paires → rejeté en queue). */
export const rankRawKey = (key: string): number =>
  CSV_RAW_RANK.get(normHeader(key)) ?? Number.POSITIVE_INFINITY;

/** Rang d'une clé de mapping BDD (Infinity si hors paires → rejeté en queue). */
export const rankDbKey = (key: string): number =>
  DB_RANK.get(key) ?? Number.POSITIVE_INFINITY;

/**
 * Trie une liste de clés selon une fonction de rang. Les clés connues passent
 * en tête dans l'ordre canonique ; les inconnues (rang Infinity) restent en
 * queue, dans leur ordre d'apparition d'origine. Tri stable (égalité de rang →
 * ordre d'origine préservé).
 */
export function orderByRank(keys: string[], rank: (key: string) => number): string[] {
  return keys
    .map((key, index) => ({ key, index, r: rank(key) }))
    .sort((a, b) => (a.r === b.r ? a.index - b.index : a.r - b.r))
    .map((entry) => entry.key);
}
