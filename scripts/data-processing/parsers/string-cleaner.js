'use strict';

function cleanString(value) {
  if (!value || value === 'null' || value === 'NULL') return null;
  const cleaned = String(value).trim();
  return cleaned === '' ? null : cleaned;
}

/**
 * Supprime les chiffres isolés d'un champ nom/prénom/raison sociale.
 * Ex: "Jean 2 DUPONT 3" → "Jean DUPONT"
 */
function stripDigitsFromName(value) {
  if (!value) return value;
  return value
    .replace(/(?<!\S)\d+(?!\S)/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim() || null;
}

function truncateString(value, maxLength) {
  if (!value) return null;
  const cleaned = cleanString(value);
  if (!cleaned) return null;
  if (cleaned.length <= maxLength) return cleaned;
  return cleaned.substring(0, maxLength);
}

function cleanSSTNumber(sstValue) {
  if (!sstValue || sstValue.trim() === '') return null;
  const cleaned = cleanString(sstValue);
  if (!cleaned) return null;

  if (cleaned.startsWith('http')) {
    const urlParts = cleaned.split('/');
    const filename = urlParts[urlParts.length - 1];
    if (cleaned.includes('drive.google.com')) {
      const driveMatch = cleaned.match(/\/folders\/([a-zA-Z0-9_-]+)/);
      if (driveMatch) return `drive_${driveMatch[1]}`;
    }
    return filename.length > 50 ? filename.substring(0, 50) : filename;
  }

  return cleaned.length > 200 ? cleaned.substring(0, 200) : cleaned;
}

function cleanPhone(phoneValue) {
  if (!phoneValue || phoneValue.trim() === '') return null;
  const cleaned = phoneValue.replace(/[^\d]/g, '');
  if (cleaned.length < 8 || cleaned.length > 15) return null;
  return cleaned;
}

function cleanEmail(emailValue) {
  if (!emailValue || emailValue.trim() === '') return null;
  const cleaned = emailValue.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(cleaned)) return null;
  return cleaned;
}

function cleanSiret(siretValue) {
  if (!siretValue || siretValue.trim() === '') return null;
  const cleaned = siretValue.replace(/[^\d]/g, '');
  if (cleaned.length !== 14) return null;
  return cleaned;
}

function capitalizeFirstLetter(text) {
  if (!text || typeof text !== 'string') return text;
  return text
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

module.exports = {
  cleanString,
  truncateString,
  cleanPhone,
  cleanEmail,
  cleanSiret,
  stripDigitsFromName,
  capitalizeFirstLetter,
  cleanSSTNumber,
};
