'use strict';

const { getCSVValue } = require('./csv-parser');

function extractAddress(adresseComplete) {
  if (!adresseComplete || adresseComplete.trim() === '') {
    return { adresse: null, ville: null, codePostal: null };
  }
  const codePostalMatch = adresseComplete.match(/\b(\d{5})\b/);
  const codePostal = codePostalMatch ? codePostalMatch[1] : null;
  const villeMatch = adresseComplete.match(/\b(\d{5})\s+([A-Z\s-]+)$/);
  const ville = villeMatch ? villeMatch[2].trim() : null;
  return { adresse: adresseComplete.trim(), ville, codePostal };
}

function extractInterventionAddress(adresseComplete) {
  if (!adresseComplete || adresseComplete.trim() === '') {
    return { adresse: null, ville: null, codePostal: null };
  }

  let cleanedAddress = adresseComplete.trim();
  cleanedAddress = cleanedAddress.replace(/\s*\/\/.*$/g, '');
  cleanedAddress = cleanedAddress.replace(/\s*\/\s*[^\/]*$/g, '');
  cleanedAddress = cleanedAddress.replace(/\s*:\s*[^:]*$/g, '');
  cleanedAddress = cleanedAddress.replace(/^["':\s]+|["':\s]+$/g, '');
  cleanedAddress = cleanedAddress.replace(/^:\s*/, '');
  cleanedAddress = cleanedAddress.replace(/,\s*$/, '');

  if (!cleanedAddress || cleanedAddress.trim() === '') {
    return { adresse: null, ville: null, codePostal: null };
  }

  const codePostalMatch = cleanedAddress.match(/\b(\d{5})\b/);
  const codePostal = codePostalMatch ? codePostalMatch[1] : null;

  let ville = null;
  if (codePostal) {
    const villeMatch = cleanedAddress.match(
      new RegExp(`\\b${codePostal}\\s+([A-ZÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞß\\s-]+)`, 'i')
    );
    if (villeMatch) ville = villeMatch[1].trim();
  }

  if (!ville) {
    const villeEndMatch = cleanedAddress.match(/\b([A-ZÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞß\s-]+)$/i);
    if (villeEndMatch) {
      const potentialVille = villeEndMatch[1].trim();
      if (potentialVille.length > 2 && !potentialVille.match(/^\d+$/)) {
        ville = potentialVille;
      }
    }
  }

  if (!ville) {
    const villeCommaMatch = cleanedAddress.match(/,\s*([A-ZÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞß\s-]+)$/i);
    if (villeCommaMatch) {
      const potentialVille = villeCommaMatch[1].trim();
      if (potentialVille.length > 2 && !potentialVille.match(/^\d+$/)) {
        ville = potentialVille;
      }
    }
  }

  let adresse = cleanedAddress;
  if (codePostal) adresse = adresse.replace(new RegExp(`\\b${codePostal}\\b`), '').trim();
  if (ville) adresse = adresse.replace(new RegExp(`\\b${ville}\\b`, 'i'), '').trim();

  adresse = adresse.replace(/\s+/g, ' ').trim();
  if (ville) ville = ville.replace(/\s+/g, ' ').trim();

  return { adresse: adresse || null, ville: ville || null, codePostal };
}

function extractDepartement(adresseComplete) {
  if (!adresseComplete || adresseComplete.trim() === '') return null;
  const adresse = adresseComplete.trim();

  const codePostalMatch = adresse.match(/\b(\d{5})\b/);
  if (codePostalMatch) {
    const codePostal = codePostalMatch[1];
    const departement = codePostal.substring(0, 2);
    if (departement.startsWith('97')) return codePostal.substring(0, 3);
    return departement;
  }

  const departementLettreMatch = adresse.match(/\b(\d{2,3})\s+([A-Z\s-]+)$/);
  if (departementLettreMatch) {
    const dep = departementLettreMatch[1];
    if (/^(0[1-9]|[1-9][0-9]|9[7-8][0-9])$/.test(dep)) return dep;
  }

  const departementInverseMatch = adresse.match(/\b([A-Z\s-]+)\s+(\d{2,3})\b$/);
  if (departementInverseMatch) {
    const dep = departementInverseMatch[2];
    if (/^(0[1-9]|[1-9][0-9]|9[7-8][0-9])$/.test(dep)) return dep;
  }

  const departementIsoleMatch = adresse.match(/\b(\d{2,3})\b$/);
  if (departementIsoleMatch) {
    const dep = departementIsoleMatch[1];
    if (/^(0[1-9]|[1-9][0-9]|9[7-8][0-9])$/.test(dep)) return dep;
  }

  return null;
}

function extractDepartementFromNamePrenom(nomPrenom) {
  if (!nomPrenom || nomPrenom.trim() === '') return null;
  const nomPrenomClean = nomPrenom.trim();
  const departementMatch = nomPrenomClean.match(/\s+(\d{2,3})$/);
  if (departementMatch) {
    const dep = departementMatch[1];
    if (/^(0[1-9]|[1-9][0-9]|9[7-8][0-9])$/.test(dep)) return dep;
  }
  return null;
}

function extractInterventionId(idValue) {
  if (!idValue || idValue.trim() === '') return null;
  const cleaned = idValue.trim();
  if (/^\d+$/.test(cleaned)) return cleaned;
  const numberMatch = cleaned.match(/^(\d+)/);
  if (numberMatch) return numberMatch[1];
  return null;
}

function extractDepartementWithPriority(csvRow) {
  const dptColumn = getCSVValue(csvRow, 'DPT');
  if (dptColumn && dptColumn.trim() !== '') {
    const dptClean = dptColumn.trim();
    if (/^(0[1-9]|[1-9][0-9]|9[7-8][0-9])$/.test(dptClean)) return dptClean;
  }

  const nomPrenom = getCSVValue(csvRow, 'Nom Prénom');
  const departementFromName = extractDepartementFromNamePrenom(nomPrenom);
  if (departementFromName) return departementFromName;

  const adresse = getCSVValue(csvRow, 'Adresse Postale');
  const departementFromAddress = extractDepartement(adresse);
  if (departementFromAddress) return departementFromAddress;

  return null;
}

module.exports = {
  extractAddress,
  extractInterventionAddress,
  extractDepartement,
  extractDepartementFromNamePrenom,
  extractInterventionId,
  extractDepartementWithPriority,
};
