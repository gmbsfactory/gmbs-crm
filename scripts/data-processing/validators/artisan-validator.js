'use strict';

function validateArtisan(mappedArtisan) {
  const errors = [];
  const identifier = mappedArtisan.plain_nom ||
    `${mappedArtisan.prenom || ''} ${mappedArtisan.nom || ''}`.trim() ||
    mappedArtisan.raison_sociale ||
    'N/A';

  if (!mappedArtisan.nom || mappedArtisan.nom.trim() === '') {
    errors.push({ field: 'nom', reason: 'Le champ nom invalide' });
  }

  if (mappedArtisan.email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(mappedArtisan.email)) {
      errors.push({ field: 'email', reason: "Format d'email invalide" });
    }
  }

  if (mappedArtisan.siret && mappedArtisan.siret.length !== 14) {
    if (mappedArtisan.siret.length !== 14) {
      errors.push({ field: 'siret', reason: 'SIRET invalide (doit contenir 14 chiffres)' });
    } else {
      errors.push({ field: 'siret', reason: 'SIRET invalide' });
    }
  }

  const warnings = [];
  if (!mappedArtisan.statut_id) {
    warnings.push({ field: 'statut_id', reason: 'Statut artisan manquant ou non reconnu — sera null en base' });
  }

  return { isValid: errors.length === 0, errors, warnings, identifier };
}

module.exports = { validateArtisan };
