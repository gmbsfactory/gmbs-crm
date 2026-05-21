import Papa from 'papaparse';

export type CsvRow = Record<string, string>;

/** Normalise les clés d'un objet CSV (supprime les \n, trim). */
export function cleanCSVKeys(csvRow: CsvRow): CsvRow {
  const cleaned: CsvRow = {};
  for (const key in csvRow) {
    const cleanKey = key.replace(/\n/g, ' ').trim();
    cleaned[cleanKey] = csvRow[key];
    if (cleanKey !== key) cleaned[key] = csvRow[key];
  }
  return cleaned;
}

/** Récupère une valeur par nom de colonne (insensible aux espaces superflus et à la casse). */
export function getCSVValue(csvRow: CsvRow, columnName: string): string | null {
  if (!csvRow) return null;
  if (csvRow[columnName] !== undefined) return csvRow[columnName];
  const normalized = columnName.trim();
  if (csvRow[normalized] !== undefined) return csvRow[normalized];
  // Fallback 1 : correspondance exacte après trim des clés.
  const exactKey = Object.keys(csvRow).find((k) => k.trim() === normalized);
  if (exactKey) return csvRow[exactKey];
  // Fallback 2 : correspondance insensible à la casse (ex. CSV avec "adresse" en minuscule).
  const lowered = normalized.toLowerCase();
  const ciKey = Object.keys(csvRow).find((k) => k.trim().toLowerCase() === lowered);
  return ciKey ? csvRow[ciKey] : null;
}

/** Extrait la valeur du statut depuis plusieurs noms de colonne possibles. */
export function getStatutValue(csvRow: CsvRow): string | null {
  if (csvRow['statut_value']?.trim()) return csvRow['statut_value'].trim();
  for (const key of ['Statut', ' Statut', 'Statut ', 'STATUT', 'status']) {
    if (csvRow[key]?.trim()) return csvRow[key].trim();
  }
  return null;
}

/**
 * Détecte les lignes mal formatées (ex : valeur ISO dans un champ textuel).
 * Retourne false si la ligne doit être rejetée.
 */
export function isValidRow(csvRow: CsvRow): boolean {
  const criticalColumns = [' Statut', 'Agence', ' Gest.', 'Métier'];
  return !criticalColumns.some((col) => {
    const value = csvRow[col];
    return value && typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value);
  });
}

/**
 * Parse un contenu CSV brut (RFC 4180) en tableau d'objets via papaparse.
 * Retire le BOM UTF-8 si présent. La première ligne est l'en-tête.
 * Gère correctement les champs multi-lignes entre guillemets.
 */
export function parseCSV(content: string): CsvRow[] {
  const withoutBom = content.startsWith('﻿') ? content.slice(1) : content;
  if (!withoutBom.trim()) return [];

  const result = Papa.parse<CsvRow>(withoutBom, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.replace(/\n/g, ' ').trim(),
  });

  return result.data.filter(
    (row) => row && Object.values(row).some((v) => v != null && String(v).trim() !== ''),
  );
}
