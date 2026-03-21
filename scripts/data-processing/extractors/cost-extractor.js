'use strict';

const { parseNumber } = require('../parsers/date-number-parser');
const { cleanCSVKeys } = require('../parsers/csv-parser');

function _validateCostsLimits(coutIntervention, coutSST, maxCost) {
  const errors = [];
  if (coutIntervention !== null && coutIntervention > maxCost) {
    errors.push({
      field: 'costs',
      reason: `Coût intervention hors limites: ${coutIntervention} EUR (max autorisé: ${maxCost} EUR)`,
    });
  }
  if (coutSST !== null && coutSST > maxCost) {
    errors.push({
      field: 'costs',
      reason: `Coût SST hors limites: ${coutSST} EUR (max autorisé: ${maxCost} EUR)`,
    });
  }
  return errors;
}

function _calculateAndValidateMargin(coutIntervention, coutSST, coutMateriel, idInter, minMarginPercent = -200, maxMarginPercent = 200) {
  let marge = null;
  let margePourcentage = null;
  const errors = [];

  if (coutIntervention !== null && coutIntervention > 0) {
    marge = coutIntervention;
    if (coutSST !== null) marge -= coutSST;
    if (coutMateriel !== null) marge -= coutMateriel;

    margePourcentage = (marge / coutIntervention) * 100;

    if (margePourcentage < minMarginPercent || margePourcentage > maxMarginPercent) {
      errors.push({
        field: 'costs',
        reason: `Marge hors limites: ${margePourcentage.toFixed(2)}% (limites: ${minMarginPercent}% à ${maxMarginPercent}%), Marge: ${marge} EUR, Coût Intervention: ${coutIntervention} EUR, Coût SST: ${coutSST || 0} EUR, Coût Matériel: ${coutMateriel || 0} EUR`,
      });
      marge = null;
    } else if (marge < 0) {
      errors.push({
        field: 'costs',
        reason: `Marge négative: ${margePourcentage.toFixed(2)}%, Marge: ${marge} EUR, Coût Intervention: ${coutIntervention} EUR, Coût SST: ${coutSST || 0} EUR, Coût Matériel: ${coutMateriel || 0} EUR`,
      });
    }
  }

  return { marge, margePourcentage, errors };
}

function _extractCosts(csvRow) {
  const COUT_SST_COLUMN = 'COUT SST';
  const COUT_MATERIEL_COLUMN = 'COÛT MATERIEL';
  const COUT_INTER_COLUMN = 'COUT INTER';

  let coutSST = null;
  const coutSSTValue = csvRow[COUT_SST_COLUMN];
  if (coutSSTValue && String(coutSSTValue).trim() !== '') {
    const parsed = parseNumber(coutSSTValue);
    if (parsed !== null) coutSST = parsed;
  }

  let coutMaterielData = 0;
  const coutMaterielValue = csvRow[COUT_MATERIEL_COLUMN];
  if (coutMaterielValue) coutMaterielData = parseNumber(coutMaterielValue);

  let coutIntervention = 0;
  const coutInterValue = csvRow[COUT_INTER_COLUMN];
  if (coutInterValue) coutIntervention = parseNumber(coutInterValue);

  return { coutSST, coutMaterielData, coutIntervention };
}

function extractCostsData(csvRow) {
  csvRow = cleanCSVKeys(csvRow);
  const { coutSST, coutMaterielData, coutIntervention } = _extractCosts(csvRow);

  let marge = null;
  if (coutIntervention !== null && coutIntervention > 0) {
    marge = coutIntervention;
    if (coutSST !== null) marge -= coutSST;
    if (coutMaterielData !== null) marge -= coutMaterielData;
  }

  return { sst: coutSST, materiel: coutMaterielData, intervention: coutIntervention, total: marge };
}

function _formatCostsForInsertion(extractedCosts, idInter = null, verbose = false) {
  if (!extractedCosts) return [];

  let coutSST = extractedCosts.sst !== undefined ? extractedCosts.sst : null;
  let coutMaterielData = extractedCosts.materiel !== undefined ? extractedCosts.materiel : null;
  let coutIntervention = extractedCosts.intervention !== undefined ? extractedCosts.intervention : null;

  const MAX_VALUE = 10000;
  if (coutSST !== null && Math.abs(coutSST) >= MAX_VALUE) {
    console.log(`\n⚠️ Coût SST dépasse 6 chiffres pour id_inter: ${idInter || 'N/A'}`);
    console.log(`  Valeur originale: ${coutSST.toLocaleString('fr-FR')}€`);
    console.log(`  → Valeur mise à 0\n`);
    coutSST = 0;
  }
  if (coutIntervention !== null && Math.abs(coutIntervention) >= MAX_VALUE) {
    console.log(`\n⚠️ Coût intervention dépasse 6 chiffres pour id_inter: ${idInter || 'N/A'}`);
    console.log(`  Valeur originale: ${coutIntervention.toLocaleString('fr-FR')}€`);
    console.log(`  → Valeur mise à 0\n`);
    coutIntervention = 0;
  }

  const { marge, margePourcentage, errors } = _calculateAndValidateMargin(
    coutIntervention, coutSST, coutMaterielData, idInter, -250, 250
  );

  if (errors.length > 0 && errors.some(e => e.reason.includes('hors limites'))) {
    return [];
  }

  const costs = [];
  if (coutSST !== null) costs.push({ cost_type: 'sst', label: 'Coût SST', amount: coutSST, currency: 'EUR' });
  if (coutMaterielData !== null) costs.push({ cost_type: 'materiel', label: 'Coût Matériel', amount: coutMaterielData, currency: 'EUR' });
  if (coutIntervention !== null) costs.push({ cost_type: 'intervention', label: 'Coût Intervention', amount: coutIntervention, currency: 'EUR' });
  if (marge !== null && !errors.some(e => e.reason.includes('hors limites'))) {
    costs.push({ cost_type: 'marge', label: 'Marge', amount: marge, currency: 'EUR' });
  }

  if (verbose) {
    console.log('\n💰 ===== COÛTS FORMATÉS =====');
    console.log(`ID Intervention: ${idInter || 'N/A'}`);
    console.log(`Coût SST: ${coutSST !== null ? coutSST + ' EUR' : 'N/A'}`);
    console.log(`Coût Matériel: ${coutMaterielData !== null ? coutMaterielData + ' EUR' : 'N/A'}`);
    console.log(`Coût Intervention: ${coutIntervention !== null ? coutIntervention + ' EUR' : 'N/A'}`);
    console.log(`Marge (calculée): ${marge !== null ? marge + ' EUR' : 'N/A'}`);
    console.log(`Nombre de coûts formatés: ${costs.length}`);
    if (costs.length > 0) {
      costs.forEach((cost, i) => console.log(`  ${i + 1}. ${cost.label}: ${cost.amount} ${cost.currency}`));
    } else {
      console.log('  ⚠️ Aucun coût formaté');
    }
    console.log('💰 ===========================\n');
  }

  return costs;
}

module.exports = {
  _validateCostsLimits,
  _calculateAndValidateMargin,
  _extractCosts,
  extractCostsData,
  _formatCostsForInsertion,
};
