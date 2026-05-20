export interface ParsedAddress {
  adresse: string | null;
  ville: string | null;
  codePostal: string | null;
}

export function extractInterventionAddress(adresseComplete: string | null | undefined): ParsedAddress {
  if (!adresseComplete?.trim()) return { adresse: null, ville: null, codePostal: null };

  let cleaned = adresseComplete.trim();
  cleaned = cleaned.replace(/\s*\/\/.*$/g, '');
  cleaned = cleaned.replace(/\s*\/\s*[^\/]*$/g, '');
  cleaned = cleaned.replace(/\s*:\s*[^:]*$/g, '');
  cleaned = cleaned.replace(/^["':\s]+|["':\s]+$/g, '');
  cleaned = cleaned.replace(/^:\s*/, '');
  cleaned = cleaned.replace(/,\s*$/, '').trim();

  if (!cleaned) return { adresse: null, ville: null, codePostal: null };

  const codePostalMatch = cleaned.match(/\b(\d{5})\b/);
  const codePostal = codePostalMatch ? codePostalMatch[1] : null;

  let ville: string | null = null;
  if (codePostal) {
    const villeMatch = cleaned.match(
      new RegExp(`\\b${codePostal}\\s+([A-ZÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞß\\s-]+)`, 'i')
    );
    if (villeMatch) ville = villeMatch[1].trim();
  }

  if (!ville) {
    const villeEndMatch = cleaned.match(/\b([A-ZÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞß\s-]+)$/i);
    if (villeEndMatch) {
      const potentialVille = villeEndMatch[1].trim();
      if (potentialVille.length > 2 && !/^\d+$/.test(potentialVille)) ville = potentialVille;
    }
  }

  if (!ville) {
    const villeCommaMatch = cleaned.match(/,\s*([A-ZÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞß\s-]+)$/i);
    if (villeCommaMatch) {
      const potentialVille = villeCommaMatch[1].trim();
      if (potentialVille.length > 2 && !/^\d+$/.test(potentialVille)) ville = potentialVille;
    }
  }

  let adresse = cleaned;
  if (codePostal) adresse = adresse.replace(new RegExp(`\\b${codePostal}\\b`), '').trim();
  if (ville) adresse = adresse.replace(new RegExp(`\\b${ville}\\b`, 'i'), '').trim();
  adresse = adresse.replace(/\s+/g, ' ').trim();
  if (ville) ville = ville.replace(/\s+/g, ' ').trim();

  return { adresse: adresse || null, ville: ville || null, codePostal };
}
