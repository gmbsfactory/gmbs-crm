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

  const warnings = [];
  if (!mappedArtisan.statut_id) {
    warnings.push({ field: 'statut_id', reason: 'Statut artisan manquant ou non reconnu — sera null en base' });
  }

  return { isValid: errors.length === 0, errors, warnings, identifier };
}

module.exports = { validateArtisan };
