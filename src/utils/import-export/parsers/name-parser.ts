import { capitalizeFirstLetter } from './string-cleaner';

export interface ParsedName {
  firstname: string | null;
  lastname: string | null;
}

export function parsePersonName(fullName: unknown): ParsedName {
  if (!fullName || typeof fullName !== 'string') return { firstname: null, lastname: null };

  let cleaned = fullName.trim();
  cleaned = cleaned.replace(/0[1-9](?:[\s.-]?\d{2}){4}/g, '');
  cleaned = cleaned.replace(/\+33[\s.-]?[1-9](?:[\s.-]?\d{2}){4}/g, '');
  cleaned = cleaned.replace(/\b(conjointe?|conjoint|tél\.?|téléphone|email|mail)\b/gi, '');
  cleaned = cleaned.replace(/\b(M\.|Mme|Mlle|Mr|Monsieur|Madame|Mademoiselle)\b/gi, '');
  cleaned = cleaned.replace(/[,:;\/]/g, ' ').replace(/\s+/g, ' ').trim();

  if (!cleaned) return { firstname: null, lastname: null };

  let words = cleaned.split(/\s+/).filter((w) => w.length > 0);
  const civilites = ['m', 'mme', 'mlle', 'mr', 'ms', 'dr'];
  if (words.length > 1 && civilites.includes(words[0].toLowerCase())) {
    words = words.slice(1);
  }

  if (words.length === 0) return { firstname: null, lastname: null };
  if (words.length === 1) return { firstname: null, lastname: capitalizeFirstLetter(words[0]) };

  const uppercaseWords = words.filter((w) => w === w.toUpperCase() && w.length > 1);
  const lowercaseWords = words.filter((w) => !(w === w.toUpperCase() && w.length > 1));

  if (uppercaseWords.length > 0 && lowercaseWords.length > 0) {
    return {
      firstname: capitalizeFirstLetter(lowercaseWords.join(' ')),
      lastname: capitalizeFirstLetter(uppercaseWords.join(' ')),
    };
  }

  if (uppercaseWords.length === words.length) {
    return {
      firstname: capitalizeFirstLetter(words[0]),
      lastname: capitalizeFirstLetter(words.slice(1).join(' ')),
    };
  }

  return {
    firstname: capitalizeFirstLetter(words[0]),
    lastname: capitalizeFirstLetter(words.slice(1).join(' ')),
  };
}
