/**
 * Parse un nombre depuis une chaîne CSV (virgule ou point décimal).
 * Retourne null si la valeur n'est pas numérique.
 */
export function parseNumber(value: unknown): number | null {
  if (value == null) return null;
  let str = String(value).trim();
  if (str === '') return 0;
  str = str.replace(/\s+/g, '');
  if (!/^-?[\d,\.]+$/.test(str)) return null;
  str = str.replace(/,/g, '.');
  const dotCount = (str.match(/\./g) || []).length;
  if (dotCount > 1) return null;
  const result = parseFloat(str);
  return isNaN(result) ? null : result;
}

/**
 * Parse une date CSV en ISO 8601. Formats acceptés :
 *   - DD/MM/YYYY, D/M/YYYY (slash, année 4 chiffres)
 *   - DD-MM-YYYY, D-MM-YYYY, DD-M-YYYY, D-M-YYYY (tiret, année 4 chiffres)
 *   - DD-MM-YY, D-MM-YY (tiret, année 2 chiffres)
 *   - MM/YYYY (1er du mois)
 *   - YYYY-MM-DD (ISO)
 * Retourne null si la valeur est absente ou invalide.
 */
export function parseDate(dateValue: unknown): string | null {
  if (!dateValue || String(dateValue).trim() === '') return null;
  const strValue = String(dateValue).trim();
  const dateOnly = strValue.split(/\s+/)[0];

  // Format MM/YYYY (début de mois)
  const monthYearMatch = dateOnly.match(/^(\d{1,2})\/(\d{4})$/);
  if (monthYearMatch) {
    const month = monthYearMatch[1].padStart(2, '0');
    const year = monthYearMatch[2];
    const yearNum = parseInt(year);
    if (yearNum >= 1900 && yearNum <= 2100) {
      return new Date(`${year}-${month}-01T00:00:00Z`).toISOString();
    }
  }

  // Format D/M/YYYY ou D-M-YY[YY] — D/M à 1-2 chiffres, année à 2 ou 4 chiffres.
  const dmyMatch = dateOnly.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2}|\d{4})$/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    let yearNum = parseInt(dmyMatch[3]);
    // Pivot 2-chiffres : 00-69 → 2000-2069, 70-99 → 1970-1999.
    if (dmyMatch[3].length === 2) yearNum = yearNum < 70 ? 2000 + yearNum : 1900 + yearNum;
    if (yearNum < 1900 || yearNum > 2100) return null;
    const year = String(yearNum).padStart(4, '0');
    const d = new Date(`${year}-${month}-${day}T00:00:00Z`);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }

  // Format YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
    const d = new Date(dateOnly);
    if (isNaN(d.getTime())) return null;
    const year = d.getFullYear();
    if (year < 1900 || year > 2100) return null;
    return d.toISOString();
  }

  return null;
}
