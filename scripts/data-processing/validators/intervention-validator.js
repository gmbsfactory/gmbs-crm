'use strict';

const { _validateCostsLimits, _calculateAndValidateMargin } = require('../extractors/cost-extractor');

function validateIntervention(mappedIntervention) {
  const errors = [];
  const idInter = mappedIntervention.id_inter || 'N/A';

  const requiredFields = {
    // id_inter est OPTIONNEL : généré automatiquement par la base si absent
    date: 'Champ date invalide (obligatoire)',
    statut_id: 'Champ statut_id invalide (obligatoire)',
  };

  Object.entries(requiredFields).forEach(([field, reason]) => {
    const value = mappedIntervention[field];
    if (value === null || value === undefined || value === '') {
      errors.push({ field, reason });
    }
  });

  if (mappedIntervention.date) {
    const dateValue = new Date(mappedIntervention.date);
    if (isNaN(dateValue.getTime())) {
      errors.push({ field: 'date', reason: 'Format de date invalide' });
    }
  }

  if (mappedIntervention.costs) {
    const { sst: coutSST, materiel: coutMateriel, intervention: coutIntervention, total: margeCalculee } = mappedIntervention.costs;

    const MAX_COST = 100000;
    const costLimitErrors = _validateCostsLimits(coutIntervention, coutSST, MAX_COST, idInter);
    errors.push(...costLimitErrors);

    let marginErrors = [];
    if (margeCalculee !== null && coutIntervention !== null && coutIntervention > 0) {
      const margePourcentage = (margeCalculee / coutIntervention) * 100;
      if (margePourcentage < -200 || margePourcentage > 200) {
        marginErrors.push({
          field: 'costs',
          reason: `Marge hors limites: ${margePourcentage.toFixed(2)}% (limites: -200% à 200%), Marge: ${margeCalculee} EUR, Coût Intervention: ${coutIntervention} EUR, Coût SST: ${coutSST || 0} EUR, Coût Matériel: ${coutMateriel || 0} EUR`,
        });
      } else if (margeCalculee < 0) {
        marginErrors.push({
          field: 'costs',
          reason: `Marge négative: ${margePourcentage.toFixed(2)}%, Marge: ${margeCalculee} EUR, Coût Intervention: ${coutIntervention} EUR, Coût SST: ${coutSST || 0} EUR, Coût Matériel: ${coutMateriel || 0} EUR`,
        });
      }
    } else if (coutIntervention !== null && coutIntervention > 0) {
      const { errors: calculatedMarginErrors } = _calculateAndValidateMargin(
        coutIntervention, coutSST, coutMateriel, idInter, -200, 200
      );
      marginErrors = calculatedMarginErrors;
    }

    const criticalMarginErrors = marginErrors.filter(e => e.reason.includes('hors limites'));
    errors.push(...criticalMarginErrors);

    if (costLimitErrors.length > 0 || criticalMarginErrors.length > 0) {
      mappedIntervention.costs = { sst: null, materiel: null, intervention: null, total: null };
    }
  }

  const interventionWarnings = [];
  if (!mappedIntervention.adresse) {
    interventionWarnings.push({ field: 'adresse', reason: "Adresse manquante — intervention insérée sans adresse" });
  }

  const criticalErrors = errors.filter(e => !e.reason.includes('Marge négative'));

  return { isValid: criticalErrors.length === 0, errors, warnings: interventionWarnings, idInter };
}

module.exports = { validateIntervention };
