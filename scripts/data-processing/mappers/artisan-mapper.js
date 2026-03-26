'use strict';

const { cleanString, cleanEmail, cleanPhone, cleanSiret, stripDigitsFromName } = require('../parsers/string-cleaner');
const { parseDate } = require('../parsers/date-number-parser');
const { cleanCSVKeys, getCSVValue, isDateLike } = require('../parsers/csv-parser');
const { extractAddress, extractDepartementWithPriority } = require('../parsers/address-parser');
const { extractNomPrenomStrict, extractSecondPhone } = require('../parsers/name-parser');
const { validateArtisan } = require('../validators/artisan-validator');

function extractDocumentNameFromUrl(url) {
  if (!url || typeof url !== 'string') return null;

  const patterns = [
    /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/,
    /docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)/,
    /docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/,
    /drive\.google\.com\/drive\/folders\/([a-zA-Z0-9_-]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      const fileId = match[1];
      const timestamp = new Date().toISOString().slice(0, 10);
      return `Drive_${fileId.slice(0, 8)}_${timestamp}`;
    }
  }

  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    const lastPart = pathParts[pathParts.length - 1];
    if (
      lastPart &&
      lastPart !== 'view' &&
      lastPart !== 'edit' &&
      (url.includes('drive.google.com') || url.includes('docs.google.com'))
    ) {
      const timestamp = new Date().toISOString().slice(0, 10);
      return `Drive_${lastPart.slice(0, 8)}_${timestamp}`;
    }
  } catch (urlError) {
    return null;
  }

  return null;
}

function mapDocumentsFromCSV(artisan, csvRow, getCSVValueFn) {
  const documents = [];
  const documentDriveUrl = getCSVValueFn(csvRow, 'Document Drive');

  if (documentDriveUrl && documentDriveUrl.trim() !== '') {
    let documentName = extractDocumentNameFromUrl(documentDriveUrl);

    if (!documentName) {
      const artisanName = `${artisan.prenom || ''} ${artisan.nom || ''}`.trim();
      const timestamp = new Date().toISOString().slice(0, 10);
      documentName = artisanName
        ? `Document_${artisanName}_${timestamp}`
        : `Document_Drive_${timestamp}`;
    }

    documents.push({
      artisan_id: artisan.id,
      kind: 'drive',
      url: documentDriveUrl.trim(),
      filename: documentName,
      created_at: new Date().toISOString(),
      mime_type: 'application/octet-stream',
    });
  }

  return documents;
}

async function mapMetiersFromCSV(csvRow, enumResolver, authenticatedClient) {
  const metiers = [];
  const metierValue =
    getCSVValue(csvRow, 'MÉTIER') ||
    getCSVValue(csvRow, 'Métier') ||
    getCSVValue(csvRow, 'metier') ||
    getCSVValue(csvRow, 'METIER');

  if (metierValue && metierValue.trim() !== '') {
    const metierNames = metierValue
      .split(/[,;]/)  // Enlever / pour garder "Volet/Store" intact
      .map((name) => name.trim())
      .filter((name) => name);

    const normalizedMetiers = new Map();

    for (const metierName of metierNames) {
      if (metierName && !isDateLike(metierName.trim())) {
        const normalized = enumResolver.normalizeMetierName(metierName);
        if (normalized) {
          if (!normalizedMetiers.has(normalized) || metierName.length < normalizedMetiers.get(normalized).length) {
            normalizedMetiers.set(normalized, metierName);
          }
        }
      }
    }

    for (const [normalized, originalName] of normalizedMetiers) {
      const metierId = await enumResolver.getMetierId(originalName, authenticatedClient);
      if (metierId) {
        metiers.push({ metier_id: metierId, is_primary: metiers.length === 0 });
      }
    }
  }

  return metiers;
}

async function mapZonesFromCSV(csvRow, enumResolver, authenticatedClient) {
  const zones = [];
  const zoneValue =
    getCSVValue(csvRow, 'ZONE') ||
    getCSVValue(csvRow, 'Zone') ||
    getCSVValue(csvRow, 'zone') ||
    getCSVValue(csvRow, 'ZONES');

  if (zoneValue && zoneValue.trim() !== '') {
    const zoneNames = zoneValue
      .split(/[,;]/)  // Enlever / pour garder les noms de zones intacts
      .map((name) => name.trim())
      .filter((name) => name);

    const normalizedZones = new Map();

    for (const zoneName of zoneNames) {
      const normalized = enumResolver.normalizeZoneName(zoneName);
      if (normalized) {
        if (!normalizedZones.has(normalized) || zoneName.length < normalizedZones.get(normalized).length) {
          normalizedZones.set(normalized, zoneName);
        }
      }
    }

    for (const [normalized, originalName] of normalizedZones) {
      const zoneId = await enumResolver.getZoneId(originalName, authenticatedClient);
      if (zoneId) {
        zones.push({ zone_id: zoneId });
      }
    }
  }

  return zones;
}


async function mapArtisanFromCSV(csvRow, lineNumber = null, enumResolver, errorLogger, authenticatedClient) {
  csvRow = cleanCSVKeys(csvRow);

  const hasAnyData = Object.values(csvRow).some((val) => val && String(val).trim() !== '');
  if (!hasAnyData) {
    return { _invalid: true, reason: 'Ligne vide (tous les champs sont vides)' };
  }

  const originalNomPrenom = getCSVValue(csvRow, 'Nom Prénom') || '';
  const nomPrenom = originalNomPrenom;
  const { prenom, nom } = extractNomPrenomStrict(nomPrenom);

  const mapped = {
    prenom: stripDigitsFromName(prenom),
    nom: stripDigitsFromName(nom),
    plain_nom: nomPrenom ? nomPrenom.trim() : null,
    email: cleanEmail(getCSVValue(csvRow, 'Adresse Mail')),
    telephone: cleanPhone(getCSVValue(csvRow, 'Numéro Téléphone')),
    telephone2: extractSecondPhone(getCSVValue(csvRow, 'Numéro Téléphone')),
    raison_sociale: stripDigitsFromName(cleanString(getCSVValue(csvRow, 'Raison Social'))),
    siret: cleanSiret(getCSVValue(csvRow, 'Siret')),
    statut_juridique: cleanString(getCSVValue(csvRow, 'STATUT JURIDIQUE')),
    adresse_siege_social: extractAddress(getCSVValue(csvRow, 'Adresse Postale')).adresse,
    ville_siege_social: extractAddress(getCSVValue(csvRow, 'Adresse Postale')).ville,
    code_postal_siege_social: extractAddress(getCSVValue(csvRow, 'Adresse Postale')).codePostal,
    departement: extractDepartementWithPriority(csvRow),
    adresse_intervention: null,
    ville_intervention: null,
    code_postal_intervention: null,
    intervention_latitude: null,
    intervention_longitude: null,
    gestionnaire_id: await enumResolver.getUserIdNormalized(
      getCSVValue(csvRow, 'Gestionnaire'),
      authenticatedClient,
      null
    ).catch(err => {
      console.warn(`⚠️  Gestionnaire ignoré pour cet artisan: ${err.message}`);
      return null;
    }),
    statut_id: await enumResolver.getArtisanStatusIdNormalized(
      getCSVValue(csvRow, 'STATUT'),
      authenticatedClient
    ),
    statut_dossier: 'INCOMPLET',
    numero_associe: lineNumber != null ? String(lineNumber + 2) : null,
    suivi_relances_docs: cleanString(getCSVValue(csvRow, 'SUIVI DES RELANCES DOCS')),
    created_at: parseDate(getCSVValue(csvRow, "DATE D'AJOUT")) || undefined,
    is_active: true,
    metiers: await mapMetiersFromCSV(csvRow, enumResolver, authenticatedClient),
  };

  const validation = validateArtisan(mapped);

  if (!validation.isValid) {
    validation.errors.forEach(({ field, reason }) => {
      errorLogger.logParsingError(validation.identifier, `${field}: ${reason}`, csvRow, lineNumber);
    });
    const errorSummary = validation.errors.map(e => `${e.field}: ${e.reason}`).join(', ');
    return { _invalid: true, reason: `Validation échouée — ${errorSummary}`, identifier: validation.identifier };
  }

  mapped._warnings = validation.warnings || [];
  return mapped;
}

module.exports = {
  mapArtisanFromCSV,
  mapMetiersFromCSV,
  mapZonesFromCSV,
  mapDocumentsFromCSV,
  extractDocumentNameFromUrl,
};
