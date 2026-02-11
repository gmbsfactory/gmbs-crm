/**
 * Module de classification des documents
 * 
 * Classifie automatiquement les documents basés sur leur nom de fichier
 * Types supportés: KBIS, Carte d'identité, Décharge paternelle, Attestation assurance, IBAN, Autre
 */

/**
 * Normalise une chaîne pour la comparaison (lowercase, suppression accents, espaces)
 */
function normalizeString(str) {
  if (!str) return '';
  
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Supprimer les accents
    .trim()
    .replace(/\s+/g, ' '); // Normaliser les espaces
}

/**
 * Vérifie si le nom de fichier correspond à un pattern donné
 */
function matchesPattern(filename, patterns) {
  const normalized = normalizeString(filename);
  return patterns.some(pattern => normalized.includes(pattern));
}

/**
 * Classifie un document basé sur son nom de fichier
 * 
 * @param {string} filename - Nom du fichier
 * @returns {string} - Type de document: 'kbis', 'cni_recto_verso', 'decharge_partenariat', 'assurance', 'iban', 'autre'
 */
function classifyDocument(filename) {
  if (!filename || typeof filename !== 'string') {
    return 'autre';
  }

  const normalizedFilename = normalizeString(filename);

  // 1. KBIS
  const kbisPatterns = [
    'kbis',
    'extrait kbis',
    'extrait-kbis',
    'extrait_kbis',
    'k-bis',
    'k_bis',
    'extrait k-bis',
    'siret',
    'extrait siret',
    'registre commerce'
  ];
  if (matchesPattern(normalizedFilename, kbisPatterns)) {
    return 'kbis';
  }

  // 2. Carte d'identité
  const cniPatterns = [
    'cni',
    'carte identite',
    'carte-identite',
    'carte_identite',
    'carte nationale identite',
    'identite',
    'piece identite',
    'piece-identite',
    'piece_identite',
    'recto verso',
    'recto-verso',
    'recto_verso',
    'recto',
    'verso',
    'ci ',
    'ci-',
    'ci_'
  ];
  if (matchesPattern(normalizedFilename, cniPatterns)) {
    return 'cni_recto_verso';
  }

  // 3. Décharge paternelle
  const dechargePatterns = [
    'decharge',
    'decharge paternelle',
    'decharge-paternelle',
    'decharge_paternelle',
    'decharge partenariat',
    'decharge-partenariat',
    'decharge_partenariat',
    'autorisation parentale',
    'autorisation-parentale',
    'autorisation_parentale',
    'consentement',
    'consentement parent',
    'consentement-parent',
    'consentement_parent'
  ];
  if (matchesPattern(normalizedFilename, dechargePatterns)) {
    return 'decharge_partenariat';
  }

  // 4. Attestation assurance
  const assurancePatterns = [
    'assurance',
    'attestation assurance',
    'attestation-assurance',
    'attestation_assurance',
    'attestation responsabilite',
    'attestation-responsabilite',
    'attestation_responsabilite',
    'rc pro',
    'rc-pro',
    'rc_pro',
    'responsabilite civile',
    'responsabilite-civile',
    'responsabilite_civile',
    'certificat assurance',
    'certificat-assurance',
    'certificat_assurance',
    'police assurance',
    'police-assurance',
    'police_assurance'
  ];
  if (matchesPattern(normalizedFilename, assurancePatterns)) {
    return 'assurance';
  }

  // 5. IBAN
  const ibanPatterns = [
    'iban',
    'rib',
    'releve identite bancaire',
    'releve-identite-bancaire',
    'releve_identite_bancaire',
    'compte bancaire',
    'compte-bancaire',
    'compte_bancaire',
    'coordonnees bancaires',
    'coordonnees-bancaires',
    'coordonnees_bancaires',
    'identifiant bancaire',
    'identifiant-bancaire',
    'identifiant_bancaire',
    'bic',
    'swift'
  ];
  if (matchesPattern(normalizedFilename, ibanPatterns)) {
    return 'iban';
  }

  // 6. Par défaut: autre
  return 'autre';
}

/**
 * Obtient la description lisible d'un type de document
 */
function getDocumentTypeLabel(type) {
  const labels = {
    'kbis': 'KBIS',
    'cni_recto_verso': 'Carte d\'identité',
    'decharge_partenariat': 'Décharge paternelle',
    'assurance': 'Attestation assurance',
    'iban': 'IBAN',
    'autre': 'Autre'
  };
  return labels[type] || 'Autre';
}

/**
 * Vérifie si un type de document est valide
 */
function isValidDocumentType(type) {
  const validTypes = [
    'kbis',
    'cni_recto_verso',
    'decharge_partenariat',
    'assurance',
    'iban',
    'autre'
  ];
  return validTypes.includes(type);
}

module.exports = {
  classifyDocument,
  getDocumentTypeLabel,
  isValidDocumentType,
  normalizeString
};

