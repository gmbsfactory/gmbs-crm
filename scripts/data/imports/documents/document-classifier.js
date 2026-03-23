/**
 * Module de classification des documents
 *
 * Classifie automatiquement les documents basés sur leur nom de fichier
 * Types supportés:
 *   - facturesGMBS (pattern: "FACTURE NUM INTER ID")
 *   - KBIS
 *   - Carte d'identité (CNI)
 *   - Décharge paternelle
 *   - Attestation assurance
 *   - IBAN
 *   - Autre
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
 * Détecte une facture GMBS et extrait les métadonnées
 *
 * Pattern: "FACTURE NUM_X INTER ID_INTER"
 * Exemples:
 *   - "FACTURE 1234 INTER 5678"
 *   - "FACTURE 1234 INTER ID 5678"
 *   - "FRACTURE 1234 INTER ID_5678" (typo commune)
 *   - "FACRTURE 1234 INTER 5678" (typo)
 *   - "FACTURE_1234_INTER_5678" (avec underscores)
 *   - "FACTURE-1234-INTER-5678" (avec tirets)
 *
 * @param {string} filename - Nom du fichier
 * @returns {Object|null} - { type: 'facturesGMBS', numeroFacture, interventionId, confidence } ou null
 */
function extractFactureGmbs(filename) {
  if (!filename || typeof filename !== 'string') {
    return null;
  }

  // Patterns pour détecter les factures GMBS (ordre de priorité)
  const patterns = [
    // Format strict avec regex: "FACTURE NUM INTER ID" avec variantes
    // Gère les variantes: FACTURE, FRACTURE, FACRTURE, etc.
    /(?:facture|fracture|facrture)\s+(\d+)\s+inter\s+(?:id\s+)?(\d+)/i,
    // Variante avec séparateurs alternatifs (tirets, underscores)
    /(?:facture|fracture|facrture)[-_](\d+)[-_]inter[-_](?:id[-_])?(\d+)/i,
    // Format: "INTER ID FACTURE NUM" (ordre inverse)
    /inter\s+(?:id\s+)?(\d+).*?(?:facture|fracture|facrture)\s+(\d+)/i,
  ];

  for (const pattern of patterns) {
    const match = filename.match(pattern);
    if (match && match[1] && match[2]) {
      // Distinguer l'ordre: pattern normal ou inversé
      let numeroFacture, interventionId;

      if (pattern.source.includes('inter')) {
        // Format "FACTURE NUM INTER ID"
        numeroFacture = parseInt(match[1], 10);
        interventionId = parseInt(match[2], 10);
      } else {
        // Format "INTER ID FACTURE NUM"
        interventionId = parseInt(match[1], 10);
        numeroFacture = parseInt(match[2], 10);
      }

      if (!isNaN(numeroFacture) && !isNaN(interventionId)) {
        return {
          type: 'facturesGMBS',
          numeroFacture,
          interventionId,
          confidence: 0.95 // Haute confiance si pattern matché
        };
      }
    }
  }

  return null;
}

/**
 * Classifie un document basé sur son nom de fichier
 *
 * @param {string} filename - Nom du fichier
 * @returns {string} - Type de document: 'facturesGMBS', 'kbis', 'cni_recto_verso', 'decharge_partenariat', 'assurance', 'iban', 'autre'
 */
function classifyDocument(filename) {
  if (!filename || typeof filename !== 'string') {
    return 'autre';
  }

  // 0. Facture GMBS (priorité haute - spécifique aux interventions)
  const factureGmbs = extractFactureGmbs(filename);
  if (factureGmbs) {
    return factureGmbs.type; // 'facturesGMBS'
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
    'facturesGMBS': 'Facture GMBS',
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
    'facturesGMBS',
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
  normalizeString,
  extractFactureGmbs
};

