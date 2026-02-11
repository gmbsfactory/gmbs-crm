/**
 * Module de préprocessing des données pour l'import Google Sheets
 * 
 * Ce module nettoie, valide et transforme les données avant insertion
 * dans la base de données Supabase.
 */

// Fonction pour logger
function log(message, level = 'info', verbose = false) {
  const timestamp = new Date().toISOString();
  
  switch (level) {
    case 'error':
      console.error(`❌ [PREPROCESS] ${message}`);
      break;
    case 'warn':
      console.warn(`⚠️  [PREPROCESS] ${message}`);
      break;
    case 'success':
      console.log(`✅ [PREPROCESS] ${message}`);
      break;
    case 'verbose':
      if (verbose) {
        console.log(`🔍 [PREPROCESS] ${message}`);
      }
      break;
    default:
      console.log(`ℹ️  [PREPROCESS] ${message}`);
  }
}

// Fonction pour nettoyer et valider les dates
function processDate(dateValue, fieldName = 'date', verbose = false) {
  if (!dateValue || dateValue === '' || dateValue === 'null' || dateValue === 'NULL') {
    log(`Date vide pour ${fieldName}: ${dateValue}`, 'verbose', verbose);
    return null;
  }

  // Essayer de parser la date
  let parsedDate;
  
  // Formats de date courants
  const dateFormats = [
    // ISO format
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
    // DD/MM/YYYY
    /^\d{2}\/\d{2}\/\d{4}/,
    // DD-MM-YYYY
    /^\d{2}-\d{2}-\d{4}/,
    // YYYY-MM-DD
    /^\d{4}-\d{2}-\d{2}$/,
    // DD/MM/YYYY HH:MM
    /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}/
  ];

  // Vérifier si c'est déjà un format ISO valide
  if (typeof dateValue === 'string' && dateValue.includes('T')) {
    parsedDate = new Date(dateValue);
  } else {
    // Essayer de parser avec différents formats
    for (const format of dateFormats) {
      if (format.test(dateValue)) {
        if (format.source.includes('\\d{2}\\/\\d{2}\\/\\d{4}')) {
          // Convertir DD/MM/YYYY en YYYY-MM-DD
          const parts = dateValue.split(/[\/\s]/);
          if (parts.length >= 3) {
            const day = parts[0].padStart(2, '0');
            const month = parts[1].padStart(2, '0');
            const year = parts[3] || parts[2];
            const time = parts.length > 3 ? `T${parts[4] || '00:00:00'}` : 'T00:00:00';
            // Créer la date en UTC pour éviter les problèmes de timezone
            parsedDate = new Date(`${year}-${month}-${day}${time}Z`);
          }
        } else {
          parsedDate = new Date(dateValue);
        }
        break;
      }
    }
    
    // Si aucun format ne correspond, essayer de parser directement
    if (!parsedDate) {
      parsedDate = new Date(dateValue);
    }
  }

  // Vérifier si la date est valide
  if (isNaN(parsedDate.getTime())) {
    log(`Date invalide pour ${fieldName}: ${dateValue}`, 'warn', verbose);
    return null;
  }

  // Vérifier si la date est dans une plage raisonnable (après 1900 et avant 2100)
  const year = parsedDate.getFullYear();
  if (year < 1900 || year > 2100) {
    log(`Date hors plage pour ${fieldName}: ${dateValue} (année: ${year})`, 'warn', verbose);
    return null;
  }

  // S'assurer que la date est en UTC (timestamp)
  const utcDate = new Date(parsedDate.getTime() - (parsedDate.getTimezoneOffset() * 60000));
  
  log(`Date valide pour ${fieldName}: ${dateValue} -> ${utcDate.toISOString()}`, 'verbose', verbose);
  return utcDate.toISOString();
}

// Fonction pour nettoyer et valider les nombres
function processNumber(numberValue, fieldName = 'number', verbose = false) {
  if (!numberValue || numberValue === '' || numberValue === 'null' || numberValue === 'NULL') {
    return null;
  }

  // Nettoyer la chaîne (supprimer espaces, virgules, etc.)
  let cleanValue = String(numberValue).trim();
  
  // Gérer les cas spéciaux comme "2976,55 dire 2900"
  if (cleanValue.includes('dire')) {
    // Extraire le premier nombre avant "dire"
    const match = cleanValue.match(/^([\d\s,\.]+)\s*dire/);
    if (match) {
      cleanValue = match[1].trim();
    }
  }
  
  // Supprimer les espaces (séparateurs de milliers)
  cleanValue = cleanValue.replace(/\s/g, '');
  
  // Remplacer les virgules par des points pour les décimales
  cleanValue = cleanValue.replace(',', '.');
  
  // Supprimer les caractères non numériques sauf le point et le signe moins
  cleanValue = cleanValue.replace(/[^\d.-]/g, '');
  
  // Vérifier qu'il reste quelque chose après le nettoyage
  if (cleanValue === '' || cleanValue === '.') {
    log(`Nombre invalide pour ${fieldName}: ${numberValue}`, 'warn', verbose);
    return null;
  }
  
  const parsedNumber = parseFloat(cleanValue);
  
  if (isNaN(parsedNumber)) {
    log(`Nombre invalide pour ${fieldName}: ${numberValue}`, 'warn', verbose);
    return null;
  }

  // Vérifier si c'est un nombre raisonnable
  if (Math.abs(parsedNumber) > 999999999) {
    log(`Nombre trop grand pour ${fieldName}: ${parsedNumber}`, 'warn', verbose);
    return null;
  }

  log(`Nombre valide pour ${fieldName}: ${numberValue} -> ${parsedNumber}`, 'verbose', verbose);
  return parsedNumber;
}

// Fonction pour nettoyer et valider les booléens
function processBoolean(booleanValue, fieldName = 'boolean', verbose = false) {
  if (!booleanValue || booleanValue === '' || booleanValue === 'null' || booleanValue === 'NULL') {
    return false;
  }

  const cleanValue = String(booleanValue).toLowerCase().trim();
  
  const trueValues = ['true', '1', 'yes', 'oui', 'o', 'y', 'vrai'];
  const falseValues = ['false', '0', 'no', 'non', 'n', 'faux'];
  
  if (trueValues.includes(cleanValue)) {
    log(`Booléen true pour ${fieldName}: ${booleanValue}`, 'verbose', verbose);
    return true;
  } else if (falseValues.includes(cleanValue)) {
    log(`Booléen false pour ${fieldName}: ${booleanValue}`, 'verbose', verbose);
    return false;
  } else {
    log(`Booléen invalide pour ${fieldName}: ${booleanValue}, défaut: false`, 'warn', verbose);
    return false;
  }
}

// Fonction pour nettoyer et valider les chaînes de caractères
function processString(stringValue, fieldName = 'string', maxLength = null, verbose = false) {
  if (!stringValue || stringValue === 'null' || stringValue === 'NULL') {
    return null;
  }

  let cleanValue = String(stringValue).trim();
  
  // Supprimer les caractères de contrôle
  cleanValue = cleanValue.replace(/[\x00-\x1F\x7F]/g, '');
  
  // Vérifier la longueur maximale
  if (maxLength && cleanValue.length > maxLength) {
    log(`Chaîne tronquée pour ${fieldName}: ${cleanValue.length} > ${maxLength}`, 'warn', verbose);
    cleanValue = cleanValue.substring(0, maxLength);
  }
  
  if (cleanValue === '') {
    return null;
  }

  log(`Chaîne valide pour ${fieldName}: ${cleanValue.length} caractères`, 'verbose', verbose);
  return cleanValue;
}

// Fonction pour nettoyer et valider les emails
function processEmail(emailValue, fieldName = 'email', lineNumber = 'N/A', verbose = false) {
  if (!emailValue || emailValue === '' || emailValue === 'null' || emailValue === 'NULL') {
    return 'NaN';
  }

  const cleanEmail = String(emailValue).trim().toLowerCase();
  
  // Validation basique de l'email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!emailRegex.test(cleanEmail)) {
    log(`Email invalide ligne ${lineNumber} pour ${fieldName}: "${emailValue}" -> laissé tel quel avec avertissement`, 'warn', verbose);
    return cleanEmail; // Laisser tel quel avec avertissement
  }

  log(`Email valide pour ${fieldName}: ${cleanEmail}`, 'verbose', verbose);
  return cleanEmail;
}

// Fonction pour nettoyer et valider les téléphones
function processPhone(phoneValue, fieldName = 'phone', verbose = false) {
  if (!phoneValue || phoneValue === '' || phoneValue === 'null' || phoneValue === 'NULL') {
    return null;
  }

  // Nettoyer le numéro de téléphone - garder seulement les chiffres
  let cleanPhone = String(phoneValue).replace(/[^\d]/g, '');
  
  if (cleanPhone === '') {
    return null;
  }

  // Vérifier la longueur minimale (au moins 8 chiffres)
  if (cleanPhone.length < 8) {
    log(`Téléphone trop court pour ${fieldName}: ${phoneValue}`, 'warn', verbose);
    return null;
  }

  // Vérifier la longueur maximale (au plus 15 chiffres)
  if (cleanPhone.length > 15) {
    log(`Téléphone trop long pour ${fieldName}: ${phoneValue}`, 'warn', verbose);
    return null;
  }

  log(`Téléphone valide pour ${fieldName}: ${phoneValue} -> ${cleanPhone}`, 'verbose', verbose);
  return cleanPhone;
}

// Fonction pour traiter les téléphones avec séparation possible
function processPhoneWithSplit(value, fieldName, verbose = false) {
  if (!value || value.trim() === '') return { telephone: null, telephone2: null };
  
  // Détecter si il y a deux numéros séparés par / ou autre séparateur
  const separators = ['/', '\\', '|', ' ou ', ' et ', ' - ', ' -'];
  let hasSeparator = false;
  let separator = '';
  
  for (const sep of separators) {
    if (value.includes(sep)) {
      hasSeparator = true;
      separator = sep;
      break;
    }
  }
  
  if (hasSeparator) {
    // Séparer les deux numéros
    const parts = value.split(separator).map(part => part.trim());
    
    if (parts.length >= 2) {
      const phone1 = processPhone(parts[0], `${fieldName}_1`, verbose);
      const phone2 = processPhone(parts[1], `${fieldName}_2`, verbose);
      
      log(`Téléphone séparé pour ${fieldName}: "${value}" -> "${phone1}" + "${phone2}"`, 'verbose', verbose);
      
      return {
        telephone: phone1,
        telephone2: phone2
      };
    }
  }
  
  // Un seul numéro
  const singlePhone = processPhone(value, fieldName, verbose);
  return {
    telephone: singlePhone,
    telephone2: null
  };
}

// Fonction pour nettoyer et valider les codes postaux
function processPostalCode(postalValue, fieldName = 'postal_code', verbose = false) {
  if (!postalValue || postalValue === '' || postalValue === 'null' || postalValue === 'NULL') {
    return null;
  }

  const cleanPostal = String(postalValue).trim();
  
  // Vérifier que c'est un code postal français valide (5 chiffres)
  const postalRegex = /^\d{5}$/;
  
  if (!postalRegex.test(cleanPostal)) {
    log(`Code postal invalide pour ${fieldName}: ${postalValue}`, 'warn', verbose);
    return null;
  }

  log(`Code postal valide pour ${fieldName}: ${cleanPostal}`, 'verbose', verbose);
  return cleanPostal;
}

// Fonction pour nettoyer et valider les SIRET
function processSiret(siretValue, fieldName = 'siret', verbose = false) {
  if (!siretValue || siretValue === '' || siretValue === 'null' || siretValue === 'NULL') {
    return 'NaN';
  }

  // Nettoyer le SIRET (supprimer espaces, points, etc.)
  const cleanSiret = String(siretValue).replace(/[^\d]/g, '');
  
  // Vérifier que c'est un SIRET valide (14 chiffres)
  if (cleanSiret.length !== 14) {
    log(`SIRET invalide pour ${fieldName}: ${siretValue} (${cleanSiret.length} chiffres) -> mis à NaN`, 'warn', verbose);
    return 'NaN';
  }

  log(`SIRET valide pour ${fieldName}: ${cleanSiret}`, 'verbose', verbose);
  return cleanSiret;
}

// Fonction pour nettoyer et valider les coordonnées GPS
function processCoordinates(latValue, lngValue, fieldName = 'coordinates', verbose = false) {
  const lat = processNumber(latValue, `${fieldName}_latitude`, verbose);
  const lng = processNumber(lngValue, `${fieldName}_longitude`, verbose);
  
  if (lat === null || lng === null) {
    return { latitude: null, longitude: null };
  }
  
  // Vérifier que les coordonnées sont dans des plages valides
  if (lat < -90 || lat > 90) {
    log(`Latitude invalide pour ${fieldName}: ${lat}`, 'warn', verbose);
    return { latitude: null, longitude: lng };
  }
  
  if (lng < -180 || lng > 180) {
    log(`Longitude invalide pour ${fieldName}: ${lng}`, 'warn', verbose);
    return { latitude: lat, longitude: null };
  }
  
  log(`Coordonnées valides pour ${fieldName}: ${lat}, ${lng}`, 'verbose', verbose);
  return { latitude: lat, longitude: lng };
}

// Fonction pour nettoyer et valider les données JSON
function processJson(jsonValue, fieldName = 'json', verbose = false) {
  if (!jsonValue || jsonValue === '' || jsonValue === 'null' || jsonValue === 'NULL') {
    return {};
  }

  try {
    // Si c'est déjà un objet, le retourner
    if (typeof jsonValue === 'object') {
      return jsonValue;
    }
    
    // Essayer de parser le JSON
    const parsed = JSON.parse(jsonValue);
    log(`JSON valide pour ${fieldName}`, 'verbose', verbose);
    return parsed;
  } catch (error) {
    log(`JSON invalide pour ${fieldName}: ${jsonValue}`, 'warn', verbose);
    return {};
  }
}

// Fonction principale de préprocessing pour les artisans
function preprocessArtisanData(rawData, verbose = false) {
  log(`Préprocessing des données d'artisan: ${rawData['                  Nom Prénom '] || 'N/A'}`, 'verbose', verbose);
  
  const processed = {};
  
  // Informations personnelles (extraction depuis "Nom Prénom")
  const nomPrenom = processString(rawData['                  Nom Prénom '], 'nom_prenom', 200, verbose);
  if (nomPrenom && nomPrenom.trim() !== '') {
    // Essayer de séparer nom et prénom
    const parts = nomPrenom.trim().split(/\s+/);
    if (parts.length >= 2) {
      processed.prenom = parts[0];
      processed.nom = parts.slice(1).join(' ');
    } else {
      processed.prenom = nomPrenom;
      processed.nom = '';
    }
  } else {
    // Initialiser avec NaN si le champ est vide
    processed.prenom = 'NaN';
    processed.nom = 'NaN';
  }
  
  // Traitement des téléphones avec séparation possible
  const phoneResult = processPhoneWithSplit(rawData['Numéro Téléphone '], 'telephone', verbose);
  processed.telephone = phoneResult.telephone || 'NaN';
  processed.telephone2 = phoneResult.telephone2;
  processed.email = processEmail(rawData['Adresse Mail'], 'email', 'N/A', verbose) || 'NaN';
  
  // Informations d'entreprise
  processed.raison_sociale = processString(rawData['Raison Social'], 'raison_sociale', 200, verbose) || 'NaN';
  processed.siret = processSiret(rawData['Siret '], 'siret', verbose) || 'NaN';
  processed.statut_juridique = processString(rawData['STATUT JURIDIQUE'], 'statut_juridique', 50, verbose) || 'NaN';
  // Pour statut_dossier, on utilise 'INCOMPLET' par défaut si vide car la contrainte DB n'accepte que des valeurs spécifiques
  const statutDossier = processString(rawData['DOSSIER ARTISAN'], 'statut_dossier', 50, verbose);
  const valeursAutorisees = ['COMPLET', 'INCOMPLET', 'DOSSIER COMPLET', 'DOSSIER INCOMPLET', 'DOSSIER À FINALISER'];
  
  if (statutDossier && valeursAutorisees.includes(statutDossier)) {
    processed.statut_dossier = statutDossier;
  } else {
    processed.statut_dossier = 'INCOMPLET'; // Valeur par défaut quand pas de données
  }
  processed.statut_artisan = processString(rawData['STATUT'], 'statut_artisan', 50, verbose) || 'NaN';
  processed.statut_inactif = false; // Par défaut
  
  // Adresses (extraction depuis "Adresse Postale")
  const adresseComplete = processString(rawData['Adresse Postale'], 'adresse_siege_social', 200, verbose);
  if (adresseComplete) {
    // Extraire le code postal et la ville de l'adresse
    const codePostalMatch = adresseComplete.match(/\b(\d{5})\b/);
    const villeMatch = adresseComplete.match(/\b(\d{5})\s+([A-Z\s-]+)$/);
    
    processed.adresse_siege_social = adresseComplete;
    processed.code_postal_siege_social = codePostalMatch ? codePostalMatch[1] : 'NaN';
    processed.ville_siege_social = villeMatch ? villeMatch[2].trim() : 'NaN';
  } else {
    processed.adresse_siege_social = 'NaN';
    processed.code_postal_siege_social = 'NaN';
    processed.ville_siege_social = 'NaN';
  }
  
  // Pas d'adresse d'intervention séparée dans votre structure
  processed.adresse_intervention = null;
  processed.ville_intervention = null;
  processed.code_postal_intervention = null;
  processed.intervention_latitude = null;
  processed.intervention_longitude = null;
  
  // Autres champs
  processed.nom_prenom = nomPrenom || 'NaN';
  processed.numero_associe = null; // Pas dans votre structure
  processed.date_ajout = processString(rawData['DATE D\'AJOUT '], 'date_ajout', 50, verbose) || 'NaN';
  processed.suivi_relances_docs = processString(rawData['SUIVI DES RELANCES DOCS'], 'suivi_relances_docs', 500, verbose) || 'NaN';
  
  // Nombres
  processed.nombre_interventions = processNumber(rawData['NOMBRE D\'INTERVENTION(S)'], 'nombre_interventions', verbose) || 0;
  processed.cout_sst = processNumber(rawData['COUT SST'], 'cout_sst', verbose) || 'NaN';
  processed.cout_inter = processNumber(rawData['COUT INTER'], 'cout_inter', verbose) || 'NaN';
  processed.cout_materiel = processNumber(rawData['COUT MATÉRIEL\n(cleaner colonne)'], 'cout_materiel', verbose) || 'NaN';
  processed.gain_brut = processNumber(rawData['GAIN BRUT €'], 'gain_brut', verbose) || 'NaN';
  processed.pourcentage_sst = processNumber(rawData['% SST'], 'pourcentage_sst', verbose) || 'NaN';
  
  // Métier
  processed.metier_id = processString(rawData['MÉTIER'], 'metier_id', 100, verbose) || 'NaN';
  
  // Nouveaux champs de votre structure
  processed.departement = processString(rawData['DPT'], 'departement', 50, verbose) || 'NaN';
  processed.document_drive = processString(rawData['Document Drive '], 'document_drive', 500, verbose) || 'NaN';
  processed.commentaire = processString(rawData['Commentaire'], 'commentaire', 1000, verbose) || 'NaN';
  // Note: gestionnaire sera traité comme gestionnaire_id dans le script principal
  processed._gestionnaire_nom_temp = processString(rawData['Gestionnaire'], 'gestionnaire_nom', 100, verbose) || 'NaN';
  
  // Champs par défaut
  processed.created_at = new Date().toISOString();
  processed.updated_at = new Date().toISOString();
  
  return processed;
}

// Fonction principale de préprocessing pour les interventions
function preprocessInterventionData(rawData, verbose = false) {
  log(`Préprocessing des données d'intervention: ${rawData.ID || 'N/A'}`, 'verbose', verbose);
  
  const processed = {};
  
  // Informations de base (basées sur les colonnes réelles du CSV)
  processed.id_facture = processNumber(rawData['ID'], 'id_facture', verbose);
  processed.date = processDate(rawData['Date'], 'date', verbose);
  processed.agence = processString(rawData['Agence'], 'agence', 100, verbose);
  processed.contexte_intervention = processString(rawData['Contexte d\'intervention'], 'contexte_intervention', 2000, verbose);
  
  // Adresse (extraire code postal et ville de l'adresse complète)
  const adresseComplete = processString(rawData['Adresse d\'intervention'], 'adresse', 200, verbose);
  if (adresseComplete) {
    // Extraire le code postal et la ville de l'adresse
    const codePostalMatch = adresseComplete.match(/\b(\d{5})\b/);
    const villeMatch = adresseComplete.match(/\b(\d{5})\s+([A-Z\s]+)$/);
    
    processed.adresse = adresseComplete;
    processed.code_postal = codePostalMatch ? codePostalMatch[1] : null;
    processed.ville = villeMatch ? villeMatch[2].trim() : null;
  }
  
  // Statut et métier
  processed.statut = processString(rawData['Statut'], 'statut', 100, verbose);
  processed.metier = processString(rawData['Métier'], 'metier', 100, verbose);
  
  // Gestionnaire (colonne Gest.)
  processed.commentaire_agent = processString(rawData['Gest.'], 'commentaire_agent', 100, verbose);
  
  // Numéro SST (peut être dans SST ou Numéro SST)
  const numeroSST = rawData['SST'] || rawData['Numéro SST'];
  processed.numero_sst = processString(numeroSST, 'numero_sst', 50, verbose);
  
  // Coûts (nettoyer les valeurs avec virgules et espaces)
  processed.cout_sst = processNumber(rawData['COUT SST'], 'cout_sst', verbose);
  processed.cout_materiel = processNumber(rawData['COÛT MATERIEL'], 'cout_materiel', verbose);
  processed.cout_intervention = processNumber(rawData['COUT INTER'], 'cout_intervention', verbose);
  processed.pourcentage_sst = processNumber(rawData['% SST'], 'pourcentage_sst', verbose);
  
  // Propriétaire (colonne PROPRIO)
  processed.prenom_proprietaire = processString(rawData['PROPRIO'], 'prenom_proprietaire', 100, verbose);
  
  // Date d'intervention
  processed.date_intervention = processDate(rawData['Date d\'intervention'], 'date_intervention', verbose);
  
  // Informations locataire
  processed.tel_loc = processPhone(rawData['TEL LOC'], 'tel_loc', verbose);
  processed.locataire = processString(rawData['Locataire'], 'locataire', 100, verbose);
  processed.email_locataire = processEmail(rawData['Em@il Locataire'], 'email_locataire', verbose);
  
  // Commentaire
  processed.commentaire = processString(rawData['COMMENTAIRE'], 'commentaire', 1000, verbose);
  
  // Trustpilot
  processed.truspilot = processString(rawData['Truspilot'], 'truspilot', 100, verbose);
  
  // Demandes (colonnes avec ✅)
  processed.demande_intervention = processString(rawData['Demande d\'intervention ✅'], 'demande_intervention', 1000, verbose);
  processed.demande_devis = processString(rawData['Demande Devis ✅'], 'demande_devis', 1000, verbose);
  processed.demande_trust_pilot = processString(rawData['Demande TrustPilot ✅'], 'demande_trust_pilot', 1000, verbose);
  
  // Champs par défaut
  processed.created_at = new Date().toISOString();
  processed.updated_at = new Date().toISOString();
  
  return processed;
}

// Fonction pour valider les données après préprocessing
function validateProcessedData(data, type, verbose = false) {
  const errors = [];
  const warnings = [];
  
  if (type === 'artisan') {
    // Validation des artisans (NaN est accepté comme valeur par défaut)
    // Accepter NaN comme valeur valide pour les champs obligatoires
    const hasValidName = (data.prenom && data.prenom !== 'NaN' && data.prenom.trim() !== '') || 
                         (data.nom && data.nom !== 'NaN' && data.nom.trim() !== '') ||
                         (data.prenom === 'NaN' && data.nom === 'NaN'); // Accepter NaN comme valeur valide
    
    if (!hasValidName) {
      errors.push('Prénom ou nom requis');
    }
    
    // Pour les contacts, NaN est acceptable
    const hasValidContact = (data.email && data.email !== 'NaN' && data.email.trim() !== '') || 
                           (data.telephone && data.telephone !== 'NaN' && data.telephone.trim() !== '') ||
                           (data.email === 'NaN' && data.telephone === 'NaN'); // Accepter NaN comme valeur valide
    
    if (!hasValidContact) {
      warnings.push('Email ou téléphone recommandé');
    }
    
    if (data.email && data.email !== 'NaN' && !data.email.includes('@')) {
      errors.push('Email invalide');
    }
    
    if (data.siret && data.siret !== 'NaN' && data.siret.length !== 14) {
      warnings.push('SIRET invalide');
    }
    
  } else if (type === 'intervention') {
    // Validation des interventions
    if (!data.date && !data.date_prevue) {
      warnings.push('Date ou date prévue recommandée');
    }
    
    if (!data.adresse && !data.ville) {
      warnings.push('Adresse ou ville recommandée');
    }
    
    if (data.cout_sst && data.cout_sst < 0) {
      warnings.push('Coût SST négatif');
    }
  }
  
  if (errors.length > 0) {
    log(`Erreurs de validation: ${errors.join(', ')}`, 'error', verbose);
  }
  
  if (warnings.length > 0) {
    log(`Avertissements de validation: ${warnings.join(', ')}`, 'warn', verbose);
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

// Fonction pour nettoyer les données avant insertion
function cleanDataForInsertion(data) {
  const cleaned = { ...data };
  
  // Supprimer les champs qui ne doivent pas être insérés
  delete cleaned._sourceRowIndex;
  delete cleaned._rowIndex;
  
  // Supprimer les champs vides pour éviter les erreurs
  Object.keys(cleaned).forEach(key => {
    if (cleaned[key] === null || cleaned[key] === undefined || cleaned[key] === '') {
      delete cleaned[key];
    }
  });
  
  return cleaned;
}

module.exports = {
  preprocessArtisanData,
  preprocessInterventionData,
  validateProcessedData,
  cleanDataForInsertion,
  processDate,
  processNumber,
  processBoolean,
  processString,
  processEmail,
  processPhone,
  processPhoneWithSplit,
  processPostalCode,
  processSiret,
  processCoordinates,
  processJson
};
