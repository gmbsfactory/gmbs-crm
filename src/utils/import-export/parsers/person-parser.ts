import { cleanPhone } from './string-cleaner';
import { getCSVValue, type CsvRow } from './csv-parser';
import { parsePersonName } from './name-parser';

export interface TenantInfo {
  plain_nom_client: string | null;
  firstname: string | null;
  lastname: string | null;
  email: string | null;
  telephone: string | null;
  telephone2: string | null;
}

export interface OwnerInfo {
  plain_nom_facturation: string | null;
  firstname: string | null;
  lastname: string | null;
  telephone: string | null;
  email: string | null;
}

function extractEmail(text: string): string | null {
  if (!text || typeof text !== 'string') return null;
  const match = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return match ? match[0].toLowerCase() : null;
}

function extractPhones(text: string): string[] {
  if (!text || typeof text !== 'string') return [];
  const phones: string[] = [];
  const patterns = [
    /0[1-9](?:[\s.-]?\d{2}){4}/g,
    /\+33[\s.-]?[1-9](?:[\s.-]?\d{2}){4}/g,
    /\d{10}/g,
    // 9 chiffres commençant par [1-9] : Excel ampute parfois le 0 de tête.
    /[1-9](?:[\s.-]?\d{2}){4}/g,
  ];
  for (const pattern of patterns) {
    const matches = text.match(pattern);
    if (matches) {
      for (const match of matches) {
        const cleaned = match.replace(/[\s.-]/g, '');
        const normalized = recoverLeadingZero(
          cleaned.startsWith('+33') ? '0' + cleaned.slice(3) : cleaned,
        );
        if (normalized.length === 10 && normalized.startsWith('0') && !phones.includes(normalized)) {
          phones.push(normalized);
        }
      }
    }
  }
  return phones;
}

/**
 * Restitue le 0 de tête ampute par Excel : un numero de 9 chiffres commencant
 * par [1-9] devient un numero francais a 10 chiffres (612345678 -> 0612345678).
 */
function recoverLeadingZero(digits: string): string {
  return digits.length === 9 && /^[1-9]/.test(digits) ? '0' + digits : digits;
}

/**
 * Conserve un numero non standard (ex. tronque a la saisie ou par Excel) plutot
 * que de le perdre. Sert de repli quand `extractPhones` ne reconnait aucun
 * numero bien forme : la donnee est preservee meme si elle ne fait pas 10
 * chiffres. Seuil bas (>= 4 chiffres) pour eviter de stocker du bruit isole.
 */
function lenientPhone(text: string): string | null {
  if (!text || typeof text !== 'string') return null;
  const digits = recoverLeadingZero(text.replace(/\D/g, ''));
  if (digits.length < 4 || digits.length > 15) return null;
  return digits;
}

export function parseTenantInfo(csvRow: CsvRow): TenantInfo {
  const locataireCol = getCSVValue(csvRow, 'Locataire') ?? '';
  const emailCol = getCSVValue(csvRow, 'Em@il Locataire') ?? '';
  const telCol = getCSVValue(csvRow, 'TEL LOC') ?? '';

  const result: TenantInfo = {
    plain_nom_client: locataireCol.trim() || null,
    firstname: null,
    lastname: null,
    email: null,
    telephone: null,
    telephone2: null,
  };

  result.email =
    extractEmail(emailCol) ?? extractEmail(locataireCol) ?? extractEmail(telCol);

  let phones = extractPhones(telCol);
  if (phones.length === 0) phones = extractPhones(locataireCol);
  if (phones.length === 0) phones = extractPhones(emailCol);

  if (phones.length > 0) {
    result.telephone = phones[0];
    if (phones.length > 1) result.telephone2 = phones[1];
  } else {
    // Aucun numero bien forme : on conserve la valeur brute de TEL LOC plutot
    // que de la perdre (cohérent avec le reste du CRM qui n'impose aucun format).
    result.telephone = lenientPhone(telCol);
  }

  const nameSource = locataireCol.trim() || telCol.trim();
  if (nameSource) {
    const parsed = parsePersonName(nameSource);
    result.firstname = parsed.firstname;
    result.lastname = parsed.lastname;
  }

  return result;
}

export function parseOwnerInfo(csvRow: CsvRow): OwnerInfo | null {
  const proprioCol = getCSVValue(csvRow, 'PROPRIO') ?? '';
  if (!proprioCol.trim()) return null;

  const telephones = extractPhones(proprioCol);
  const email = extractEmail(proprioCol);

  let nameText = proprioCol;
  for (const tel of telephones) {
    nameText = nameText.replace(tel, '').replace(tel.replace(/(\d{2})(?=\d)/g, '$1 '), '').replace(tel.replace(/(\d{2})(?=\d)/g, '$1.'), '');
  }
  if (email) nameText = nameText.replace(email, '');

  const parsed = parsePersonName(nameText);

  return {
    plain_nom_facturation: proprioCol.trim() || null,
    firstname: parsed.firstname,
    lastname: parsed.lastname,
    telephone: telephones[0] ?? lenientPhone(proprioCol),
    email,
  };
}

export { cleanPhone, extractEmail, extractPhones };
