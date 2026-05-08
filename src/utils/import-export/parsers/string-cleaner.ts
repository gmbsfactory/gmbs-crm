export function cleanString(value: unknown): string | null {
  if (!value || value === 'null' || value === 'NULL') return null;
  const cleaned = String(value).trim();
  return cleaned === '' ? null : cleaned;
}

export function truncateString(value: unknown, maxLength: number): string | null {
  const cleaned = cleanString(value);
  if (!cleaned) return null;
  return cleaned.length <= maxLength ? cleaned : cleaned.substring(0, maxLength);
}

export function cleanPhone(phoneValue: unknown): string | null {
  if (!phoneValue || String(phoneValue).trim() === '') return null;
  const cleaned = String(phoneValue).replace(/[^\d]/g, '');
  if (cleaned.length < 8 || cleaned.length > 15) return null;
  return cleaned;
}

export function cleanEmail(emailValue: unknown): string | null {
  if (!emailValue || String(emailValue).trim() === '') return null;
  const cleaned = String(emailValue).trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned) ? cleaned : null;
}

export function capitalizeFirstLetter(text: string): string {
  if (!text || typeof text !== 'string') return text;
  return text
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
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
