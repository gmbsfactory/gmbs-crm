'use strict';

const { cleanString, truncateString } = require('../parsers/string-cleaner');
const { parseDate, parseNumber } = require('../parsers/date-number-parser');
const { cleanCSVKeys, getCSVValue, getStatutValue, isValidRow } = require('../parsers/csv-parser');
const { extractInterventionAddress, extractInterventionId } = require('../parsers/address-parser');
const { parseTenantInfo, parseOwnerInfo } = require('../parsers/person-parser');
const { extractCostsData, _formatCostsForInsertion } = require('../extractors/cost-extractor');
const { validateIntervention } = require('../validators/intervention-validator');
const { mapMetiersFromCSV } = require('./artisan-mapper');

async function mapInterventionFromCSV(csvRow, verbose = false, lineNumber = null, enumResolver, entityFinder, errorLogger, authenticatedClient) {
  const warnings = [];

  csvRow = cleanCSVKeys(csvRow);

  const hasData = Object.values(csvRow).some((val) => val && String(val).trim() !== '');
  if (!hasData) {
    return { _invalid: true, reason: 'Ligne vide (toutes les cellules sont vides)', idInter: 'N/A' };
  }

  const hasEssentialData =
    (csvRow['ID'] && String(csvRow['ID']).trim() !== '') ||
    (csvRow["Adresse d'intervention"] && String(csvRow["Adresse d'intervention"]).trim() !== '') ||
    (csvRow["Contexte d'intervention"] && String(csvRow["Contexte d'intervention"]).trim() !== '') ||
    (csvRow["Contexte d'intervention "] && String(csvRow["Contexte d'intervention "]).trim() !== '') ||
    (csvRow['Technicien'] && String(csvRow['Technicien']).trim() !== '') ||
    (csvRow['Technicien '] && String(csvRow['Technicien ']).trim() !== '') ||
    (csvRow['Artisan'] && String(csvRow['Artisan']).trim() !== '');

  if (!hasEssentialData) {
    return { _invalid: true, reason: 'Ligne sans données essentielles (ID, adresse, contexte, technicien ou artisan manquants)', idInter: 'N/A' };
  }

  let idInter = extractInterventionId(csvRow['ID']);

  if (!isValidRow(csvRow)) {
    errorLogger.logParsingError(idInter || 'N/A', 'Ligne avec mauvais formatage', csvRow, lineNumber);
    if (verbose) console.log('⚠️ Ligne avec mauvais formatage');
    return { _invalid: true, reason: 'Ligne avec mauvais formatage', idInter: idInter || 'N/A', csvSample: csvRow };
  }

  const metiers = await mapMetiersFromCSV(csvRow, enumResolver, authenticatedClient);
  let metierId = metiers.length > 0 ? metiers[0].metier_id : null;

  if (!metierId) {
    if (verbose) console.log(`⚠️ Aucun métier trouvé, assignation du métier par défaut "AUTRES"`);
    metierId = await enumResolver.getMetierId('AUTRES', authenticatedClient);
    if (metierId && verbose) console.log(`✅ Métier par défaut assigné: AUTRES (ID: ${metierId})`);
  }

  let agenceId = await enumResolver.getAgencyId(csvRow['Agence'], authenticatedClient);
  if (!agenceId) {
    if (verbose) console.log(`⚠️ Aucune agence trouvée, assignation de l'agence par défaut "DEFAUT"`);
    agenceId = await enumResolver.getAgencyId('DEFAUT', authenticatedClient);
    if (agenceId && verbose) console.log(`✅ Agence par défaut assignée: DEFAUT (ID: ${agenceId})`);
  }

  const rawDate = csvRow['Date '] || csvRow['Date'] || csvRow['FErn'] || csvRow['745'] || csvRow["Date d'intervention"];
  const dateValue = parseDate(rawDate);
  const rawAdresse = csvRow["Adresse d'intervention"] || csvRow['Adresse'] || null;
  const adresseExtracted = extractInterventionAddress(rawAdresse);

  let contexteValue = cleanString(csvRow["Contexte d'intervention "]) || cleanString(csvRow["Contexte d'intervention"]);

  if (!contexteValue || contexteValue.trim() === '') {
    const coutSSTValue = csvRow['COUT SST'];
    if (coutSSTValue && String(coutSSTValue).trim() !== '') {
      const testNumber = parseNumber(coutSSTValue);
      if (testNumber === null || testNumber === 0) {
        contexteValue = cleanString(coutSSTValue);
      }
    }
  }

  if (!idInter && verbose) {
    console.log(`ℹ️ Aucun id_inter fourni - intervention sera créée sans ID externe`);
  }

  const mapped = {
    id_inter: idInter,
    agence_id: agenceId,
    assigned_user_id: await enumResolver.getUserIdNormalized(csvRow['Gest.'], authenticatedClient, warnings),
    statut_id: await enumResolver.getInterventionStatusIdNormalized(getStatutValue(csvRow), authenticatedClient),
    metier_id: metierId,
    date: dateValue || null,
    date_termine: null,
    date_prevue: parseDate(csvRow["Date d'intervention"]) || null,
    due_date: null,
    contexte_intervention: truncateString(contexteValue || 'Intervention sans contexte détaillé', 10000),
    commentaire_agent: cleanString(csvRow['COMMENTAIRE']),
    adresse: rawAdresse ? rawAdresse.trim() : adresseExtracted.adresse,
    code_postal: adresseExtracted.codePostal,
    ville: adresseExtracted.ville,
    latitude: null,
    longitude: null,
    is_active: true,
    tenant: parseTenantInfo(csvRow, false),
    owner: parseOwnerInfo(csvRow, false),
    artisanSST: await entityFinder.findArtisanSST(
      getCSVValue(csvRow, 'Artisan') || getCSVValue(csvRow, 'Technicien') || getCSVValue(csvRow, 'SST') || null,
      idInter,
      csvRow,
      lineNumber,
      warnings
    ),
  };

  mapped._warnings = [...warnings];

  const extractedCosts = extractCostsData(csvRow);
  const mappedForValidation = { ...mapped, costs: extractedCosts };
  const validation = validateIntervention(mappedForValidation);

  if (!validation.isValid) {
    validation.errors.forEach(({ field, reason }) => {
      errorLogger.logParsingError(validation.idInter, `${field}: ${reason}`, csvRow, lineNumber);
    });

    console.log(`❌ Intervention ${validation.idInter} invalide:`);
    validation.errors.forEach(({ field, reason }) => {
      console.log(`   - ${field}: ${reason}\n\t\t${JSON.stringify(csvRow, null, 2)}`);
    });

    const errorSummary = validation.errors.map(e => `${e.field}: ${e.reason}`).join(', ');
    return { _invalid: true, reason: `Validation échouée — ${errorSummary}`, idInter: validation.idInter, csvSample: csvRow };
  }

  if (validation.warnings && validation.warnings.length > 0) {
    mapped._warnings.push(...validation.warnings);
  }

  mapped.costs = _formatCostsForInsertion(extractedCosts, idInter, verbose);

  if (verbose) {
    logMappedIntervention(mapped);
  }

  return mapped;
}

function logMappedIntervention(mapped) {
  console.log('\n📋 ===== INTERVENTION MAPPÉE =====');
  console.log(`ID: ${mapped.id_inter}`);
  console.log(`Date: ${mapped.date}`);
  console.log(`Date prévue: ${mapped.date_prevue || 'NULL'}`);
  console.log(`Agence ID: ${mapped.agence_id || 'NULL'}`);
  console.log(`Statut ID: ${mapped.statut_id || 'NULL'}`);
  console.log(`Métier ID: ${mapped.metier_id || 'NULL'}`);
  console.log(`Gestionnaire ID: ${mapped.assigned_user_id || 'NULL'}`);
  const adresseDisplay = mapped.adresse || '[Manquante]';
  const cpDisplay = mapped.code_postal || '[Manquant]';
  const villeDisplay = mapped.ville || '[Manquante]';
  console.log(`Adresse: ${adresseDisplay}, ${cpDisplay} ${villeDisplay}`);
  console.log(`Artisan SST: ${mapped.artisanSST || 'NULL'}`);
  if (mapped.costs && Array.isArray(mapped.costs)) {
    const costsDisplay = mapped.costs.map(cost => `${cost.label}: ${cost.amount}€`);
    console.log(`Coûts: ${costsDisplay.length > 0 ? costsDisplay.join(' | ') : 'Aucun'}`);
  }
  if (mapped.tenant) {
    const name = [mapped.tenant.firstname, mapped.tenant.lastname].filter(Boolean).join(' ') || 'N/A';
    console.log(`Tenant: ${name} (Email: ${mapped.tenant.email || 'N/A'}, Tel: ${mapped.tenant.telephone || 'N/A'})`);
  } else {
    console.log('Tenant: NULL');
  }
  if (mapped.owner) {
    const name = [mapped.owner.firstname, mapped.owner.lastname].filter(Boolean).join(' ') || 'N/A';
    console.log(`Owner: ${name} (Tel: ${mapped.owner.telephone || 'N/A'})`);
  } else {
    console.log('Owner: NULL');
  }
  console.log('📋 ================================\n');
}

module.exports = { mapInterventionFromCSV };
