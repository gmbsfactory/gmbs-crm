'use strict';

/**
 * Vérifie si une chaîne contient des lettres invalides
 */
function _hasInvalidLetters(str) {
  const withoutDire = str.replace(/\s*dire\s*[\d\s,\.]*/gi, '');
  const withoutOperators = withoutDire.replace(/[\/\*\+\-]/g, '');
  return /[\p{L}]/u.test(withoutOperators);
}

/**
 * Parse un nombre simple (sans opérations mathématiques)
 */
function _parseSimpleNumber(str) {
  let cleaned = str;
  if (cleaned.toLowerCase().includes('dire')) {
    const match = cleaned.match(/([\d\s,\.]+)\s*dire/i);
    if (match) cleaned = match[1];
  }

  const hasComma = cleaned.includes(',');
  const hasDot = cleaned.includes('.');

  if (hasComma) {
    cleaned = cleaned.replace(/\s+/g, '');
    cleaned = cleaned.replace(',', '.');
  } else if (hasDot) {
    const parts = cleaned.split('.');
    if (parts.length === 2) {
      cleaned = parts[0].replace(/\s+/g, '') + '.' + parts[1];
    } else {
      cleaned = cleaned.replace(/\s+/g, '');
      const dotParts = cleaned.split('.');
      cleaned = dotParts.slice(0, -1).join('') + '.' + dotParts[dotParts.length - 1];
    }
  } else {
    cleaned = cleaned.replace(/\s+/g, '');
  }

  cleaned = cleaned.replace(/[^\d.-]/g, '');
  const parsed = parseFloat(cleaned);
  if (isNaN(parsed)) return null;
  return parsed;
}

/**
 * Évalue une expression mathématique avec opérations (*, +, -)
 */
function _evaluateExpression(str) {
  let processedStr = str;

  if (processedStr.includes('*')) {
    let hasChanged = true;
    let iterations = 0;
    const maxIterations = 100;

    while (processedStr.includes('*') && hasChanged && iterations < maxIterations) {
      iterations++;
      hasChanged = false;
      const multPattern = /([\d\s,\.]+)\s*\*\s*([\d\s,\.]+)/;
      const match = processedStr.match(multPattern);
      if (match) {
        const left = parseNumber(match[1].trim());
        const right = parseNumber(match[2].trim());
        if (left !== null && right !== null) {
          const multResult = left * right;
          processedStr = processedStr.replace(match[0], multResult.toString());
          hasChanged = true;
        } else {
          return null;
        }
      } else {
        hasChanged = false;
      }
    }

    if (iterations >= maxIterations) {
      console.warn(`⚠️ Trop d'itérations lors du parsing de "${str}"`);
      return null;
    }

    if (processedStr.includes('*')) {
      console.warn(`⚠️ Multiplications restantes non résolues dans "${processedStr}"`);
      return null;
    }
  }

  if (processedStr.includes('+')) {
    const terms = processedStr.split('+').map(s => s.trim());
    let sum = 0;
    for (const term of terms) {
      const termValue = parseNumber(term);
      if (termValue === null) return null;
      sum += termValue;
    }
    return sum;
  }

  const subtractionMatch = processedStr.match(/^([\d\s,\.]+)\s*-\s*([\d\s,\.]+)$/);
  if (subtractionMatch) {
    const left = parseNumber(subtractionMatch[1]);
    const right = parseNumber(subtractionMatch[2]);
    if (left !== null && right !== null) return left - right;
    return null;
  }

  return _parseSimpleNumber(processedStr);
}

function parseNumber(value) {
  if (!value) return null;
  let str = String(value).trim();
  if (str === '') return 0;
  str = str.replace(/\s+/g, '');
  if (!/^-?[\d,\.]+$/.test(str)) return null;
  str = str.replace(/,/g, '.');
  const dotCount = (str.match(/\./g) || []).length;
  if (dotCount > 1) return null;
  const result = parseFloat(str);
  if (isNaN(result)) return null;
  return result;
}

function parseDate(dateValue) {
  if (!dateValue || String(dateValue).trim() === '') return null;
  const strValue = String(dateValue).trim();
  const dateOnly = strValue.split(/\s+/)[0];

  const monthYearMatch = dateOnly.match(/^(\d{1,2})\/(\d{4})$/);
  if (monthYearMatch) {
    const month = monthYearMatch[1].padStart(2, '0');
    const year = monthYearMatch[2];
    const yearNum = parseInt(year);
    if (yearNum >= 1900 && yearNum <= 2100) {
      return new Date(`${year}-${month}-01T00:00:00Z`).toISOString();
    }
  }

  const dateFormats = [
    /^\d{2}\/\d{2}\/\d{4}/,
    /^\d{2}-\d{2}-\d{4}/,
    /^\d{4}-\d{2}-\d{2}$/,
  ];

  let parsedDate;

  for (const format of dateFormats) {
    if (format.test(dateOnly)) {
      if (format.source.includes('\\d{2}\\/\\d{2}\\/\\d{4}')) {
        const parts = dateOnly.split('/');
        if (parts.length >= 3) {
          const day = parts[0].padStart(2, '0');
          const month = parts[1].padStart(2, '0');
          const year = parts[2].trim();
          const yearNum = parseInt(year);
          if (yearNum < 1900 || yearNum > 2100) return null;
          parsedDate = new Date(`${year}-${month}-${day}T00:00:00Z`);
        }
      } else {
        parsedDate = new Date(dateOnly);
      }
      break;
    }
  }

  if (!parsedDate) parsedDate = new Date(dateOnly);
  if (isNaN(parsedDate.getTime())) return null;

  const year = parsedDate.getFullYear();
  if (year < 1900 || year > 2100) return null;

  return parsedDate.toISOString();
}

module.exports = {
  _hasInvalidLetters,
  parseNumber,
  _parseSimpleNumber,
  _evaluateExpression,
  parseDate,
};
