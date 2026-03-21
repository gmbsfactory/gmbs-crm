'use strict';

const { cleanPhone } = require('./string-cleaner');
const { getCSVValue } = require('./csv-parser');
const { parsePersonName } = require('./name-parser');

function extractEmail(text) {
  if (!text || typeof text !== 'string') return null;
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  const match = text.match(emailRegex);
  return match ? match[0].toLowerCase() : null;
}

function extractPhones(text) {
  if (!text || typeof text !== 'string') return [];
  const phones = [];
  const patterns = [
    /0[1-9](?:[\s.-]?\d{2}){4}/g,
    /\+33[\s.-]?[1-9](?:[\s.-]?\d{2}){4}/g,
    /\d{10}/g,
  ];

  for (const pattern of patterns) {
    const matches = text.match(pattern);
    if (matches) {
      matches.forEach((match) => {
        const cleaned = match.replace(/[\s.-]/g, '');
        const normalized = cleaned.startsWith('+33') ? '0' + cleaned.slice(3) : cleaned;
        if (normalized.length === 10 && normalized.startsWith('0') && !phones.includes(normalized)) {
          phones.push(normalized);
        }
      });
    }
  }

  return phones;
}

function parseTenantInfo(csvRow, verbose = false) {
  const locataireCol = getCSVValue(csvRow, 'Locataire') || '';
  const emailCol = getCSVValue(csvRow, 'Em@il Locataire') || '';
  const telCol = getCSVValue(csvRow, 'TEL LOC') || '';

  const result = {
    firstname: null,
    lastname: null,
    email: null,
    telephone: null,
    telephone2: null,
    raw: { locataire: locataireCol, email: emailCol, tel: telCol },
  };

  result.email = extractEmail(emailCol) || extractEmail(locataireCol) || extractEmail(telCol);

  let phones = extractPhones(telCol);
  if (phones.length === 0) phones = extractPhones(locataireCol);
  if (phones.length === 0) phones = extractPhones(emailCol);

  if (phones.length > 0) {
    result.telephone = phones[0];
    if (phones.length > 1) result.telephone2 = phones[1];
  }

  let nameSource = locataireCol.trim();
  if (!nameSource && telCol.trim()) nameSource = telCol.trim();

  if (nameSource) {
    const parsedName = parsePersonName(nameSource);
    result.firstname = parsedName.firstname;
    result.lastname = parsedName.lastname;
  }

  return result;
}

function parseOwnerInfo(csvRow, verbose = false) {
  const proprioCol = getCSVValue(csvRow, 'PROPRIO') || '';
  if (!proprioCol || !proprioCol.trim()) return null;

  const telephones = extractPhones(proprioCol);
  const email = extractEmail(proprioCol);

  let nameText = proprioCol;
  telephones.forEach((tel) => {
    nameText = nameText.replace(tel, '');
    nameText = nameText.replace(tel.replace(/(\d{2})(?=\d)/g, '$1 '), '');
    nameText = nameText.replace(tel.replace(/(\d{2})(?=\d)/g, '$1.'), '');
  });

  if (email) nameText = nameText.replace(email, '');

  const parsedName = parsePersonName(nameText);

  return {
    firstname: parsedName.firstname,
    lastname: parsedName.lastname,
    telephone: telephones.length > 0 ? telephones[0] : null,
    email,
  };
}

module.exports = {
  extractEmail,
  extractPhones,
  parseTenantInfo,
  parseOwnerInfo,
};
