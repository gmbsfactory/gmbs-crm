// Ported from scripts/data-processing/parsers/string-cleaner.js
// Behavior MUST stay identical — script-side originals are still in use.

export function cleanString(value: unknown): string | null {
  if (!value || value === 'null' || value === 'NULL') return null;
  const cleaned = String(value).trim();
  return cleaned === '' ? null : cleaned;
}

export function stripDigitsFromName(value: string | null | undefined): string | null {
  if (!value) return value ?? null;
  return (
    value
      .replace(/(?<!\S)\d+(?!\S)/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim() || null
  );
}

export function truncateString(value: unknown, maxLength: number): string | null {
  if (!value) return null;
  const cleaned = cleanString(value);
  if (!cleaned) return null;
  if (cleaned.length <= maxLength) return cleaned;
  return cleaned.substring(0, maxLength);
}

export function cleanSSTNumber(sstValue: string | null | undefined): string | null {
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

export function cleanPhone(phoneValue: string | null | undefined): string | null {
  if (!phoneValue || phoneValue.trim() === '') return null;
  const cleaned = phoneValue.replace(/[^\d]/g, '');
  if (cleaned.length < 8 || cleaned.length > 15) return null;
  return cleaned;
}

export function cleanEmail(emailValue: string | null | undefined): string | null {
  if (!emailValue || emailValue.trim() === '') return null;
  const cleaned = emailValue.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(cleaned)) return null;
  return cleaned;
}

export function cleanSiret(siretValue: string | null | undefined): string | null {
  if (!siretValue || siretValue.trim() === '') return null;
  const cleaned = siretValue.replace(/[^\d]/g, '');
  if (cleaned.length !== 14) return null;
  return cleaned;
}

export function capitalizeFirstLetter(text: unknown): unknown {
  if (!text || typeof text !== 'string') return text;
  return text
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
