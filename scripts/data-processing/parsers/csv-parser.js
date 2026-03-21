'use strict';

function normalizeColumnName(columnName) {
  if (!columnName) return '';
  return columnName.trim();
}

function cleanCSVKeys(csvRow) {
  const cleaned = {};
  for (const key in csvRow) {
    const cleanKey = key.replace(/\n/g, ' ').trim();
    cleaned[cleanKey] = csvRow[key];
    if (cleanKey !== key) {
      cleaned[key] = csvRow[key];
    }
  }
  return cleaned;
}

function getCSVValue(csvRow, columnName) {
  if (!csvRow) return null;
  if (csvRow[columnName] !== undefined) return csvRow[columnName];
  const normalizedName = normalizeColumnName(columnName);
  if (csvRow[normalizedName] !== undefined) return csvRow[normalizedName];
  const foundKey = Object.keys(csvRow).find(
    (key) => normalizeColumnName(key) === normalizedName
  );
  if (foundKey) return csvRow[foundKey];
  return null;
}

function getStatutValue(csvRow) {
  // Chercher la clé normalisée en priorité (créée par ColumnMapper)
  if (csvRow['statut_value'] && String(csvRow['statut_value']).trim() !== '') {
    if (process.env.VERBOSE || process.argv.includes('--verbose')) {
      console.log(`✅ [STATUT] Trouvé via clé normalisée: "${csvRow['statut_value']}"`);
    }
    return String(csvRow['statut_value']).trim();
  }

  // Fallback sur les anciennes clés possibles (pour compatibilité)
  const possibleKeys = ['Statut', ' Statut', 'Statut ', 'STATUT', 'diag fenetr', 'diagnostic fenetre', 'status'];
  for (const key of possibleKeys) {
    if (csvRow[key] && String(csvRow[key]).trim() !== '') {
      if (process.env.VERBOSE || process.argv.includes('--verbose')) {
        console.log(`✅ [STATUT] Trouvé avec clé "${key}": "${csvRow[key]}"`);
      }
      return String(csvRow[key]).trim();
    }
  }

  if (process.env.VERBOSE || process.argv.includes('--verbose')) {
    console.log(`❌ [STATUT] Aucune colonne statut trouvée dans csvRow`);
  }
  return null;
}

function isValidRow(csvRow) {
  const criticalColumns = [' Statut', 'Agence', ' Gest.', 'Métier'];
  for (const col of criticalColumns) {
    const value = csvRow[col];
    if (value && typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}/)) {
      return false;
    }
  }
  return true;
}

function isDateLike(str) {
  if (!str) return false;
  const datePatterns = [
    /^\d{1,2}\/\d{1,2}\/\d{4}$/,
    /^\d{1,2}-\d{1,2}-\d{4}$/,
    /^\d{4}-\d{1,2}-\d{1,2}$/,
    /^\d{1,2}\/\d{1,2}\/\d{2}$/,
    /^\d{1,2}-\d{1,2}-\d{2}$/,
    /^\d{2}\/\d{2}\/\d{4}$/,
    /^\d{2}-\d{2}-\d{4}$/,
  ];
  return datePatterns.some((pattern) => pattern.test(str));
}

module.exports = {
  normalizeColumnName,
  cleanCSVKeys,
  getCSVValue,
  getStatutValue,
  isValidRow,
  isDateLike,
};
