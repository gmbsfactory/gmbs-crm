'use strict';

const { cleanString, cleanEmail, cleanPhone } = require('../parsers/string-cleaner');
const { extractInterventionAddress } = require('../parsers/address-parser');
const { extractNomClient, extractPrenomClient } = require('../parsers/name-parser');

function mapClientFromInterventionCSV(csvRow) {
  const mapped = {
    external_ref: cleanString(csvRow['ID']),
    firstname: extractPrenomClient(csvRow['Locataire']),
    lastname: extractNomClient(csvRow['Locataire']),
    email: cleanEmail(csvRow['Em@il Locataire']),
    telephone: cleanPhone(csvRow['TEL LOC']),
    telephone2: null,
    adresse: extractInterventionAddress(csvRow["Adresse d'intervention"]).adresse,
    ville: extractInterventionAddress(csvRow["Adresse d'intervention"]).ville,
    code_postal: extractInterventionAddress(csvRow["Adresse d'intervention"]).codePostal,
    is_active: true,
  };
  return mapped;
}

module.exports = { mapClientFromInterventionCSV };
