/**
 * Script complet d'import des documents depuis Google Drive
 * 
 * Ce script :
 * 1. Extrait les noms de dossiers depuis Google Drive (dossier "Artisans")
 * 2. Fait le matching avec les artisans en base de données
 * 3. Classe les documents par type
 * 4. Insère les documents en base de données
 * 
 * Tout en un seul script pour simplifier l'utilisation
 */

const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

// Charger les variables d'environnement selon l'environnement
const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env.local';
require('dotenv').config({ path: envFile });
console.log(`📁 Variables chargées depuis ${envFile}`);

// Utiliser l'API v2 centralisée (comme dans database-manager-v2.js)
// Note: Le chemin est relatif depuis scripts/imports/documents/ (3 niveaux vers la racine)
// Note: Les modules TypeScript nécessitent tsx pour être exécutés
let artisansApi, documentsApi;
try {
  const apiV2 = require('../../../src/lib/api/v2');
  artisansApi = apiV2.artisansApi;
  documentsApi = apiV2.documentsApi;
} catch (error) {
  console.error('❌ Erreur lors du chargement de l\'API v2:', error.message);
  console.error('   Assurez-vous d\'utiliser tsx pour exécuter ce script (npm run drive:match-artisans)');
  process.exit(1);
}

// Importer le module de classification des documents
const { classifyDocument, getDocumentTypeLabel, isValidDocumentType } = require('./document-classifier');

// Configuration Google Drive
const { googleDriveConfig } = require('../config/google-drive-config');
googleDriveConfig.reloadConfig();

/**
 * Normalise un nom pour la comparaison
 */
function normalizeName(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Supprimer les accents
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Nettoie un nom en enlevant les numéros à la fin
 * Ex: "ABBAS Virginie 34" -> "ABBAS Virginie"
 */
function cleanName(name) {
  if (!name) return '';
  // Enlever les numéros à la fin (espaces + chiffres)
  return name.replace(/\s+\d+$/, '').trim();
}

/**
 * Inverse le nom et prénom dans une chaîne
 * Ex: "Virginie ABBAS" -> "ABBAS Virginie"
 * Ex: "ABBAS Virginie" -> "Virginie ABBAS"
 */
function invertNameOrder(name) {
  if (!name) return '';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    // Prendre les deux premiers mots et les inverser
    return `${parts[1]} ${parts[0]} ${parts.slice(2).join(' ')}`.trim();
  }
  return name;
}

/**
 * Extrait les parties d'un nom (premier mot, deuxième mot, reste)
 * Utile pour faire des recherches flexibles
 */
function extractNameParts(name) {
  if (!name) return { first: '', second: '', rest: '', full: '' };
  const cleaned = cleanName(name);
  const normalized = normalizeName(cleaned);
  const parts = normalized.split(/\s+/).filter(p => p.length > 0);
  
  return {
    first: parts[0] || '',
    second: parts[1] || '',
    rest: parts.slice(2).join(' ') || '',
    full: normalized,
    cleaned: cleaned
  };
}

/**
 * Trouve le dossier "Artisans" dans Google Drive
 */
async function findArtisansFolder(drive, rootFolderId = null) {
  try {
    // Si un ID de dossier racine est fourni, l'utiliser
    if (rootFolderId) {
      const response = await drive.files.get({
        fileId: rootFolderId,
        fields: 'id, name, mimeType'
      });
      
      if (response.data.mimeType === 'application/vnd.google-apps.folder') {
        return response.data;
      }
    }

    // Sinon, chercher le dossier "artisans" à la racine
    const query = "name='artisans' or name='Artisans' and mimeType='application/vnd.google-apps.folder' and trashed=false";
    const response = await drive.files.list({
      q: query,
      fields: 'files(id, name, mimeType)',
      pageSize: 10
    });

    if (response.data.files && response.data.files.length > 0) {
      return response.data.files[0];
    }

    return null;
  } catch (error) {
    console.error('❌ Erreur lors de la recherche du dossier artisans:', error.message);
    throw error;
  }
}

/**
 * Liste tous les sous-dossiers dans un dossier donné
 */
async function listArtisanFolders(drive, folderId) {
  try {
    const folders = [];
    let nextPageToken = null;

    do {
      const query = `'${folderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
      
      const response = await drive.files.list({
        q: query,
        fields: 'nextPageToken, files(id, name, createdTime, modifiedTime)',
        pageSize: 1000,
        pageToken: nextPageToken
      });

      if (response.data.files) {
        folders.push(...response.data.files);
      }

      nextPageToken = response.data.nextPageToken;
    } while (nextPageToken);

    return folders;
  } catch (error) {
    console.error(`❌ Erreur lors de la liste des dossiers dans ${folderId}:`, error.message);
    throw error;
  }
}

/**
 * Compte les documents dans un dossier
 */
async function countDocumentsInFolder(drive, folderId) {
  try {
    const query = `'${folderId}' in parents and trashed=false and mimeType!='application/vnd.google-apps.folder'`;
    
    const response = await drive.files.list({
      q: query,
      fields: 'files(id, name, mimeType, size)',
      pageSize: 1000
    });

    return response.data.files || [];
  } catch (error) {
    console.error(`❌ Erreur lors du comptage des documents dans ${folderId}:`, error.message);
    return [];
  }
}

/**
 * Extrait les dossiers depuis Google Drive et les sauvegarde
 */
async function extractFoldersFromDrive(drive) {
  console.log('📁 Extraction des noms de dossiers depuis Google Drive...\n');

  try {
    // 1. Récupérer directement le dossier Artisans depuis la variable d'environnement
    console.log('🔍 Recherche du dossier Artisans...');
    const artisansRootFolderId = googleDriveConfig.getArtisansRootFolderId();
    
    if (!artisansRootFolderId) {
      console.error('❌ GOOGLE_DRIVE_GMBS_ARTISANS_ROOT_FOLDER non défini dans les variables d\'environnement');
      console.log('\n💡 Suggestions:');
      console.log('   - Vérifiez que GOOGLE_DRIVE_GMBS_ARTISANS_ROOT_FOLDER est défini dans .env.local');
      console.log('   - Cette variable doit pointer directement vers le dossier "Artisans"');
      throw new Error('GOOGLE_DRIVE_GMBS_ARTISANS_ROOT_FOLDER non défini');
    }

    // Vérifier que le dossier existe et récupérer ses infos
    let artisansFolder;
    try {
      const response = await drive.files.get({
        fileId: artisansRootFolderId,
        fields: 'id, name, mimeType'
      });
      
      if (response.data.mimeType !== 'application/vnd.google-apps.folder') {
        throw new Error('L\'ID fourni ne correspond pas à un dossier');
      }
      
      artisansFolder = response.data;
    } catch (error) {
      console.error(`❌ Erreur lors de l'accès au dossier Artisans (ID: ${artisansRootFolderId}):`, error.message);
      throw new Error('Impossible d\'accéder au dossier Artisans');
    }

    console.log(`✅ Dossier Artisans trouvé: ${artisansFolder.name} (ID: ${artisansFolder.id})\n`);

    // 2. Lister directement les sous-dossiers dans "Artisans" (plus besoin de chercher un sous-dossier)
    console.log('📂 Liste des sous-dossiers dans "Artisans"...');
    const artisansSubFolders = await listArtisanFolders(drive, artisansFolder.id);
    console.log(`✅ ${artisansSubFolders.length} sous-dossiers trouvés dans "Artisans"\n`);

    // 3. Extraire les informations pour chaque sous-dossier d'Artisans
    console.log('📊 Extraction des informations des sous-dossiers d\'Artisans...');
    const artisansSubFolderData = [];
    
    for (let i = 0; i < artisansSubFolders.length; i++) {
      const folder = artisansSubFolders[i];
      const documents = await countDocumentsInFolder(drive, folder.id);

      artisansSubFolderData.push({
        name: folder.name,
        normalizedName: normalizeName(folder.name),
        folderId: folder.id,
        documentCount: documents.length,
        createdTime: folder.createdTime,
        modifiedTime: folder.modifiedTime
      });

      if ((i + 1) % 10 === 0) {
        console.log(`  Traité ${i + 1}/${artisansSubFolders.length} sous-dossiers...`);
      }
    }
    
    console.log(`✅ Extraction des sous-dossiers d'Artisans terminée\n`);

    // 4. Préparer les données pour export
    const exportData = {
      extractedAt: new Date().toISOString(),
      artisansFolder: {
        id: artisansFolder.id,
        name: artisansFolder.name
      },
      totalSubFolders: artisansSubFolderData.length,
      subFolders: artisansSubFolderData.map(f => ({
        name: f.name,
        normalizedName: f.normalizedName,
        documentCount: f.documentCount,
        createdTime: f.createdTime,
        modifiedTime: f.modifiedTime
      })),
      subFoldersWithDetails: artisansSubFolderData // Version avec folderId pour récupération des documents
    };

    // 5. Sauvegarder dans le fichier JSON
    const outputDir = path.join(__dirname, '../../../data/docs_imports/');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const jsonPath = path.join(outputDir, 'artisans-subfolders.json');
    fs.writeFileSync(jsonPath, JSON.stringify(exportData, null, 2));
    console.log(`💾 Données sauvegardées dans: ${jsonPath}\n`);

    return exportData;
  } catch (error) {
    console.error('❌ Erreur lors de l\'extraction:', error);
    throw error;
  }
}

/**
 * Liste tous les documents dans un dossier Google Drive
 */
async function listDocumentsInFolder(drive, folderId) {
  try {
    const documents = [];
    let nextPageToken = null;

    do {
      const query = `'${folderId}' in parents and trashed=false and mimeType!='application/vnd.google-apps.folder'`;
      
      const response = await drive.files.list({
        q: query,
        fields: 'nextPageToken, files(id, name, mimeType, size, createdTime, modifiedTime, webViewLink)',
        pageSize: 1000,
        pageToken: nextPageToken
      });

      if (response.data.files) {
        documents.push(...response.data.files);
      }

      nextPageToken = response.data.nextPageToken;
    } while (nextPageToken);

    return documents;
  } catch (error) {
    console.error(`❌ Erreur lors de la liste des documents dans ${folderId}:`, error.message);
    return [];
  }
}

/**
 * Mappe le type de document classifié vers le kind pour la base de données
 * Si le document n'est pas classifié (type "autre"), retourne "a_classe"
 */
function mapDocumentTypeToKind(documentType) {
  // Si le type est valide et différent de "autre", utiliser le type directement
  if (isValidDocumentType(documentType) && documentType !== 'autre') {
    return documentType;
  }
  // Sinon, marquer comme "a_classe"
  return 'a_classe';
}

/**
 * Construit l'URL Google Drive pour un document
 */
function buildGoogleDriveUrl(fileId, webViewLink = null) {
  // Si on a déjà un webViewLink, l'utiliser
  if (webViewLink) {
    return webViewLink;
  }
  // Sinon, construire l'URL depuis l'ID
  return `https://drive.google.com/file/d/${fileId}/view`;
}

/**
 * Classe les documents d'un dossier et retourne les statistiques
 */
function classifyDocuments(documents) {
  const classified = documents.map(doc => {
    const docType = classifyDocument(doc.name);
    const kind = mapDocumentTypeToKind(docType);
    return {
      id: doc.id,
      name: doc.name,
      mimeType: doc.mimeType,
      size: doc.size,
      createdTime: doc.createdTime,
      modifiedTime: doc.modifiedTime,
      webViewLink: doc.webViewLink,
      driveUrl: buildGoogleDriveUrl(doc.id, doc.webViewLink),
      type: docType,
      typeLabel: getDocumentTypeLabel(docType),
      kind: kind // Kind pour la base de données
    };
  });

  // Compter par type
  const statsByType = {};
  classified.forEach(doc => {
    statsByType[doc.type] = (statsByType[doc.type] || 0) + 1;
  });

  // Compter par kind
  const statsByKind = {};
  classified.forEach(doc => {
    statsByKind[doc.kind] = (statsByKind[doc.kind] || 0) + 1;
  });

  return {
    documents: classified,
    statsByType: statsByType,
    statsByKind: statsByKind,
    total: classified.length
  };
}

/**
 * Récupère tous les artisans de la base de données avec leur plain_nom
 * Utilise l'API v2 pour centraliser les accès
 */
async function getAllArtisans() {
  console.log('📊 Récupération de tous les artisans depuis la base de données (API v2)...');
  
  try {
    // Récupérer tous les artisans par lots (l'API v2 limite à 100 par défaut)
    let allArtisans = [];
    let offset = 0;
    const limit = 100;
    let hasMore = true;

    while (hasMore) {
      const result = await artisansApi.getAll({ 
        limit, 
        offset 
      });

      if (result.data && result.data.length > 0) {
        // Filtrer uniquement ceux qui ont un plain_nom
        const artisansWithPlainNom = result.data.filter(a => a.plain_nom);
        allArtisans = allArtisans.concat(artisansWithPlainNom);
      }

      hasMore = result.pagination.hasMore;
      offset += limit;

      if (allArtisans.length % 500 === 0) {
        console.log(`  Récupéré ${allArtisans.length} artisans...`);
      }
    }

    console.log(`✅ ${allArtisans.length} artisans récupérés avec plain_nom\n`);
    return allArtisans;
  } catch (error) {
    throw new Error(`Erreur lors de la récupération des artisans: ${error.message}`);
  }
}

/**
 * Trouve l'artisan correspondant à un nom de dossier
 * Utilise l'API v2 pour les recherches (centralisé et optimisé)
 */
async function findMatchingArtisan(folderName, artisansCache = null) {
  // Nettoyer le nom du dossier dès le début (enlever les numéros)
  const cleanedFolderName = cleanName(folderName);
  const normalizedFolderName = normalizeName(cleanedFolderName);
  
  if (!normalizedFolderName) {
    return { artisan: null, matchType: 'none', reason: 'Nom de dossier vide' };
  }
  
  try {
    // 1. Recherche par nom via l'API v2 (cherche dans nom, prénom, raison_sociale, plain_nom)
    // Cette méthode utilise ilike donc fonctionne avec les noms partiels/normalisés
    try {
      const nameResult = await artisansApi.searchByName(normalizedFolderName, { limit: 20 });
      if (nameResult.data && nameResult.data.length > 0) {
        // Chercher le meilleur match parmi les résultats (priorité au match exact)
        let exactMatch = null;
        let partialMatch = null;
        let raisonSocialeMatch = null;
        let nomPrenomMatch = null;

        for (const candidate of nameResult.data) {
          // Match exact avec plain_nom (priorité maximale) - nettoyer les numéros avant comparaison
          if (candidate.plain_nom) {
            const cleanedPlainNom = cleanName(candidate.plain_nom);
            const normalizedPlainNom = normalizeName(cleanedPlainNom);
            if (normalizedPlainNom === normalizedFolderName) {
              exactMatch = { artisan: candidate, matchType: 'exact', reason: 'Match exact avec plain_nom nettoyé (API v2)' };
              break; // Match exact trouvé, on s'arrête
            } else if (!partialMatch && (normalizedFolderName.includes(normalizedPlainNom) || 
                       normalizedPlainNom.includes(normalizedFolderName))) {
              partialMatch = { artisan: candidate, matchType: 'partial', reason: 'Match partiel avec plain_nom nettoyé (API v2)' };
            }
          }
          
          // Match avec raison sociale
          if (!raisonSocialeMatch && candidate.raison_sociale) {
            const normalizedRaisonSociale = normalizeName(candidate.raison_sociale);
            if (normalizedFolderName.includes(normalizedRaisonSociale) || 
                normalizedRaisonSociale.includes(normalizedFolderName)) {
              raisonSocialeMatch = { artisan: candidate, matchType: 'raison_sociale', reason: 'Match avec raison_sociale (API v2)' };
            }
          }
          
          // Match avec nom + prénom
          if (!nomPrenomMatch) {
            const fullName = `${candidate.prenom || ''} ${candidate.nom || ''}`.trim();
            if (fullName) {
              const normalizedFullName = normalizeName(fullName);
              if (normalizedFolderName.includes(normalizedFullName) || 
                  normalizedFullName.includes(normalizedFolderName)) {
                nomPrenomMatch = { artisan: candidate, matchType: 'nom_prenom', reason: 'Match avec nom + prénom (API v2)' };
              }
            }
          }
        }

        // Retourner le meilleur match trouvé (priorité: exact > partial > raison_sociale > nom_prenom)
        if (exactMatch) return exactMatch;
        if (partialMatch) return partialMatch;
        if (raisonSocialeMatch) return raisonSocialeMatch;
        if (nomPrenomMatch) return nomPrenomMatch;
      }
    } catch (error) {
      // Si l'API v2 échoue, continuer avec le cache si disponible
      console.warn(`  ⚠️ Erreur API v2 pour "${folderName}": ${error.message}`);
    }

    // 3. Fallback : recherche dans le cache si fourni (pour compatibilité)
    if (artisansCache && Array.isArray(artisansCache)) {
      // Recherche exacte par plain_nom normalisé (avec nettoyage des numéros)
      let match = artisansCache.find(a => {
        if (!a.plain_nom) return false;
        const cleanedPlainNom = cleanName(a.plain_nom);
        const normalizedPlainNom = normalizeName(cleanedPlainNom);
        return normalizedPlainNom === normalizedFolderName;
      });
      if (match) {
        return { artisan: match, matchType: 'exact', reason: 'Match exact avec plain_nom nettoyé (cache)' };
      }

      // Recherche partielle (avec nettoyage des numéros)
      match = artisansCache.find(a => {
        if (!a.plain_nom) return false;
        const cleanedPlainNom = cleanName(a.plain_nom);
        const normalizedPlainNom = normalizeName(cleanedPlainNom);
        return normalizedFolderName.includes(normalizedPlainNom) || 
               normalizedPlainNom.includes(normalizedFolderName);
      });
      if (match) {
        return { artisan: match, matchType: 'partial', reason: 'Match partiel avec plain_nom nettoyé (cache)' };
      }
    }

    // 4. Stratégie avancée : inversion nom/prénom et nettoyage des numéros
    try {
      const folderParts = extractNameParts(folderName);
      
      // Si on a au moins deux mots, essayer l'inversion
      if (folderParts.first && folderParts.second) {
        // Inverser le nom : "Virginie ABBAS" -> "ABBAS Virginie"
        const invertedName = invertNameOrder(folderName);
        const normalizedInverted = normalizeName(cleanName(invertedName));
        
        // Rechercher avec le nom inversé via l'API v2
        try {
          const invertedResult = await artisansApi.searchByName(normalizedInverted, { limit: 20 });
          if (invertedResult.data && invertedResult.data.length > 0) {
            for (const candidate of invertedResult.data) {
              // Nettoyer et normaliser le plain_nom du candidat
              const cleanedPlainNom = cleanName(candidate.plain_nom || '');
              const normalizedCleanedPlainNom = normalizeName(cleanedPlainNom);
              
              // Comparer avec le nom inversé nettoyé
              if (normalizedCleanedPlainNom === normalizedInverted) {
                return { artisan: candidate, matchType: 'inverted_exact', reason: 'Match exact avec nom inversé (API v2)' };
              }
              
              // Match partiel avec nom inversé
              if (normalizedInverted.includes(normalizedCleanedPlainNom) || 
                  normalizedCleanedPlainNom.includes(normalizedInverted)) {
                return { artisan: candidate, matchType: 'inverted_partial', reason: 'Match partiel avec nom inversé (API v2)' };
              }
            }
          }
        } catch (error) {
          // Continuer avec le cache si l'API échoue
        }

        // Recherche dans le cache avec nom inversé
        if (artisansCache && Array.isArray(artisansCache)) {
          const match = artisansCache.find(a => {
            if (!a.plain_nom) return false;
            const cleanedPlainNom = cleanName(a.plain_nom);
            const normalizedCleanedPlainNom = normalizeName(cleanedPlainNom);
            
            // Comparer avec le nom inversé nettoyé
            return normalizedCleanedPlainNom === normalizedInverted ||
                   normalizedInverted.includes(normalizedCleanedPlainNom) ||
                   normalizedCleanedPlainNom.includes(normalizedInverted);
          });
          
          if (match) {
            return { artisan: match, matchType: 'inverted_partial', reason: 'Match avec nom inversé (cache)' };
          }
        }
      }

      // 5. Stratégie : nettoyer les numéros et réessayer
      const cleanedFolderName = cleanName(folderName);
      if (cleanedFolderName !== folderName) {
        const normalizedCleaned = normalizeName(cleanedFolderName);
        
        // Rechercher avec le nom nettoyé via l'API v2
        try {
          const cleanedResult = await artisansApi.searchByName(normalizedCleaned, { limit: 20 });
          if (cleanedResult.data && cleanedResult.data.length > 0) {
            for (const candidate of cleanedResult.data) {
              const cleanedPlainNom = cleanName(candidate.plain_nom || '');
              const normalizedCleanedPlainNom = normalizeName(cleanedPlainNom);
              
              if (normalizedCleanedPlainNom === normalizedCleaned) {
                return { artisan: candidate, matchType: 'cleaned_exact', reason: 'Match exact avec nom nettoyé (API v2)' };
              }
              
              if (normalizedCleaned.includes(normalizedCleanedPlainNom) || 
                  normalizedCleanedPlainNom.includes(normalizedCleaned)) {
                return { artisan: candidate, matchType: 'cleaned_partial', reason: 'Match partiel avec nom nettoyé (API v2)' };
              }
            }
          }
        } catch (error) {
          // Continuer avec le cache
        }

        // Recherche dans le cache avec nom nettoyé
        if (artisansCache && Array.isArray(artisansCache)) {
          const match = artisansCache.find(a => {
            if (!a.plain_nom) return false;
            const cleanedPlainNom = cleanName(a.plain_nom);
            const normalizedCleanedPlainNom = normalizeName(cleanedPlainNom);
            
            return normalizedCleanedPlainNom === normalizedCleaned ||
                   normalizedCleaned.includes(normalizedCleanedPlainNom) ||
                   normalizedCleanedPlainNom.includes(normalizedCleaned);
          });
          
          if (match) {
            return { artisan: match, matchType: 'cleaned_partial', reason: 'Match avec nom nettoyé (cache)' };
          }
        }
      }
    } catch (error) {
      // Ignorer les erreurs de stratégie avancée
    }

    return { artisan: null, matchType: 'none', reason: 'Aucun match trouvé' };
  } catch (error) {
    return { artisan: null, matchType: 'none', reason: `Erreur lors de la recherche: ${error.message}` };
  }
}

// Importer la fonction utilitaire pour télécharger depuis Google Drive
const { downloadFileFromDrive } = require('../lib/google-drive-utils');

/**
 * Insère un document en base de données en téléchargeant depuis Google Drive
 * et en l'uploadant dans Supabase Storage via l'API v2
 */
async function insertDocumentToDatabase(artisanId, document, drive) {
  try {
    // Normaliser le kind : utiliser "a_classe" (avec underscore) pour compatibilité avec la contrainte DB
    let kind = document.kind;
    if (kind === 'à classifier' || kind === 'a classifier') {
      kind = 'a_classe'; // La DB utilise "a_classe" (avec underscore)
    }

    // Télécharger le fichier depuis Google Drive
    if (!document.id) {
      throw new Error('ID du fichier Google Drive manquant');
    }

    if (process.argv.includes('--debug') || process.argv.includes('-v')) {
      console.log(`    📥 Téléchargement de "${document.name}" depuis Google Drive...`);
    }

    const fileContentBase64 = await downloadFileFromDrive(drive, document.id);

    if (process.argv.includes('--debug') || process.argv.includes('-v')) {
      console.log(`    ✅ Fichier téléchargé (${(fileContentBase64.length * 3 / 4 / 1024).toFixed(2)} KB)`);
      console.log(`    📤 Upload vers Supabase Storage...`);
    }

    // Upload vers Supabase Storage via l'API v2
    const result = await documentsApi.upload({
      entity_id: artisanId,
      entity_type: 'artisan',
      kind: kind,
      filename: document.name,
      mime_type: document.mimeType || 'application/octet-stream',
      file_size: document.size || fileContentBase64.length * 3 / 4, // Approximation si size manquant
      content: fileContentBase64
    });

    return { success: true, data: result };
  } catch (error) {
    // Améliorer le logging des erreurs pour debug
    const errorDetails = {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      document: {
        name: document.name,
        kind: document.kind,
        fileId: document.id
      }
    };
    
    // Afficher l'erreur complète en mode debug
    if (process.argv.includes('--debug') || process.argv.includes('-v')) {
      console.error('    ❌ Erreur détaillée:', JSON.stringify(errorDetails, null, 2));
    }
    
    return { success: false, error: error.message, details: errorDetails };
  }
}

/**
 * Insère tous les documents d'un artisan en base de données
 */
async function insertArtisanDocuments(artisanId, documents, drive, dryRun = false) {
  const results = {
    total: documents.length,
    inserted: 0,
    errors: 0,
    skipped: 0,
    details: []
  };

  if (dryRun) {
    console.log(`    🔍 [DRY RUN] ${documents.length} document(s) seraient téléchargé(s) et inséré(s)`);
    return results;
  }

  for (const doc of documents) {
    const result = await insertDocumentToDatabase(artisanId, doc, drive);
    
    if (result.success) {
      results.inserted++;
      results.details.push({
        filename: doc.name,
        kind: doc.kind,
        success: true
      });
    } else {
      results.errors++;
      const errorInfo = {
        filename: doc.name,
        kind: doc.kind,
        success: false,
        error: result.error
      };
      
      // Ajouter les détails si disponibles
      if (result.details) {
        errorInfo.details = result.details;
      }
      
      results.details.push(errorInfo);
      
      // Afficher l'erreur pour les premiers documents (pour debug)
      if (results.errors <= 3) {
        console.warn(`      ⚠️ Erreur pour "${doc.name}": ${result.error}`);
      }
    }
  }

  return results;
}

/**
 * Affiche l'aide du script
 */
function showHelp() {
  console.log(`
Usage: npm run drive:match-artisans [options]

Options:
  --dry-run, -d          Mode simulation (aucune insertion en base)
  --skip-insert, -s     Faire le matching et la classification sans insérer
  --insert-only, -i     Insérer uniquement les documents déjà matchés (depuis JSON)
  --help, -h            Afficher cette aide

Exemples:
  npm run drive:import-documents                  # Extraction + Matching + Classification + Insertion
  npm run drive:import-documents --dry-run        # Simulation complète
  npm run drive:import-documents --skip-insert    # Extraction + Matching sans insertion
  npm run drive:import-documents-artisans --insert-only   # Insertion depuis JSON existant
`);
}

/**
 * Fonction principale
 */
async function main() {
  // Vérifier les arguments de ligne de commande
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    process.exit(0);
  }
  
  const dryRun = args.includes('--dry-run') || args.includes('-d');
  const skipInsert = args.includes('--skip-insert') || args.includes('-s');
  const insertOnly = args.includes('--insert-only') || args.includes('-i');

  if (dryRun) {
    console.log('🔍 Mode DRY RUN activé - Aucune insertion en base de données\n');
  }
  if (skipInsert) {
    console.log('⏭️  Mode SKIP INSERT activé - Pas d\'insertion en base de données\n');
  }

  console.log('🔍 Matching des dossiers Google Drive avec les artisans en base (API v2)...\n');

  // Vérifier la configuration Supabase pour debug
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const explicitFunctionsUrl = process.env.NEXT_PUBLIC_SUPABASE_FUNCTIONS_URL || 
                               process.env.SUPABASE_FUNCTIONS_URL;
  
  if (dryRun || process.argv.includes('--debug') || process.argv.includes('-v')) {
    console.log('🔧 Configuration Supabase:');
    if (explicitFunctionsUrl) {
      console.log(`   URL Edge Functions (explicite): ${explicitFunctionsUrl}`);
    } else if (supabaseUrl) {
      let functionsUrl = supabaseUrl.replace(/\/rest\/v1$/, '').replace(/\/$/, '');
      if (!functionsUrl.endsWith('/functions/v1')) {
        functionsUrl = functionsUrl + '/functions/v1';
      }
      console.log(`   URL Supabase de base: ${supabaseUrl}`);
      console.log(`   URL Edge Functions (construite): ${functionsUrl}`);
    } else {
      console.log(`   ⚠️ Aucune URL Supabase trouvée`);
    }
    console.log('');
  }

  // Initialiser Google Drive API
  console.log('🔐 Initialisation de l\'authentification Google Drive...');
  
  const credentials = googleDriveConfig.getCredentials();
  
  if (!credentials || !credentials.client_email || !credentials.private_key) {
    console.error('\n❌ Configuration Google Drive incomplète.');
    console.error('   Vérifiez que les variables d\'environnement sont correctement définies dans .env.local');
    googleDriveConfig.displayConfig();
    process.exit(1);
  }

  // Créer l'authentification JWT avec la syntaxe correcte (comme dans google-sheets-import-clean-v2.js)
  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ['https://www.googleapis.com/auth/drive.readonly']
  });

  const drive = google.drive({ version: 'v3', auth });
  console.log('✅ Authentification Google Drive initialisée\n');

  try {
    // 1. Extraire les dossiers depuis Google Drive
    let folderData;
    let subFolders;
    
    console.log('📁 Extraction des dossiers d\'artisans depuis Google Drive...\n');
    folderData = await extractFoldersFromDrive(drive);
    subFolders = folderData.subFolders || [];
    
    // Afficher quelques exemples pour confirmer l'utilisation
    if (subFolders.length > 0) {
      console.log(`📋 ${subFolders.length} dossiers à traiter`);
      console.log(`   Exemples de dossiers à matcher:`);
      subFolders.slice(0, 3).forEach((f, idx) => {
        console.log(`     ${idx + 1}. "${f.name}" (${f.documentCount || 0} doc(s))`);
      });
      if (subFolders.length > 3) {
        console.log(`     ... et ${subFolders.length - 3} autres`);
      }
      console.log('');
    }
    
    // S'assurer que folderId est disponible (utiliser subFoldersWithDetails si nécessaire)
    const subFoldersWithDetails = folderData.subFoldersWithDetails || [];
    const folderIdMap = new Map();
    subFoldersWithDetails.forEach(f => {
      if (f.folderId) {
        folderIdMap.set(f.name, f.folderId);
      }
    });
    
    // Enrichir les subFolders avec folderId si manquant
    subFolders.forEach(folder => {
      if (!folder.folderId && folderIdMap.has(folder.name)) {
        folder.folderId = folderIdMap.get(folder.name);
      }
    });

    // 2. Récupérer tous les artisans via l'API v2 (pour le cache optionnel)
    // Note: On peut aussi faire des recherches individuelles via l'API v2 sans charger tout
    const artisansCache = await getAllArtisans();

    // 3. Faire le matching pour chaque dossier
    const matches = [];
    const unmatched = [];
    
    if (insertOnly) {
      console.log('💾 Mode INSERT ONLY - Insertion des documents déjà matchés...\n');
      // Charger les matches existants
      const existingMatchesPath = path.join(__dirname, '../../../data/docs_imports/folder-artisan-matches.json');
      if (fs.existsSync(existingMatchesPath)) {
        const existingData = JSON.parse(fs.readFileSync(existingMatchesPath, 'utf8'));
        matches.push(...(existingData.matches || []));
        console.log(`✅ ${matches.length} match(s) chargé(s) depuis le fichier existant\n`);
        
        // Insérer les documents pour chaque match chargé
        for (let i = 0; i < matches.length; i++) {
          const match = matches[i];
          if (match.artisan && match.documents && match.documents.length > 0) {
            const insertResults = await insertArtisanDocuments(
              match.artisan.id,
              match.documents,
              drive,
              dryRun
            );
            match.insertResults = insertResults;
            
            if ((i + 1) % 10 === 0) {
              console.log(`  Traité ${i + 1}/${matches.length} artisans...`);
            }
          }
        }
        
        console.log(`✅ Insertion terminée\n`);
        // Sortir de la fonction après l'insertion
        return;
      } else {
        console.error('❌ Fichier de matches non trouvé. Exécutez d\'abord le matching complet.');
        process.exit(1);
      }
    } else {
      console.log('🔗 Matching des dossiers avec les artisans...\n');
    }
    const stats = {
      total: subFolders.length,
      exact: 0,
      partial: 0,
      raison_sociale: 0,
      nom_prenom: 0,
      inverted_exact: 0,
      inverted_partial: 0,
      cleaned_exact: 0,
      cleaned_partial: 0,
      none: 0
    };

    for (let i = 0; i < subFolders.length; i++) {
      const folder = subFolders[i];
      // Utiliser l'API v2 pour chaque recherche (centralisé et optimisé)
      const matchResult = await findMatchingArtisan(folder.name, artisansCache);

      const matchInfo = {
        folderName: folder.name,
        normalizedFolderName: folder.normalizedName,
        folderId: folder.folderId || null,
        documentCount: folder.documentCount || 0,
        matchType: matchResult.matchType,
        reason: matchResult.reason,
        artisan: matchResult.artisan ? {
          id: matchResult.artisan.id,
          nom: matchResult.artisan.nom,
          prenom: matchResult.artisan.prenom,
          plain_nom: matchResult.artisan.plain_nom,
          raison_sociale: matchResult.artisan.raison_sociale,
          email: matchResult.artisan.email,
          numero_associe: matchResult.artisan.numero_associe
        } : null,
        documents: null, // Sera rempli si match trouvé
        documentsClassification: null
      };

      // Si match trouvé, récupérer et classifier les documents
      if (matchResult.artisan) {
        // Utiliser folderId depuis folder.folderId ou depuis la map créée
        const folderId = folder.folderId || folderIdMap.get(folder.name);
        
        if (folderId) {
          try {
            if (i % 10 === 0 || (i + 1) % 10 === 0) {
              console.log(`  📄 Analyse des documents pour "${folder.name}"...`);
            }
            const documents = await listDocumentsInFolder(drive, folderId);
            const classification = classifyDocuments(documents);
            
            matchInfo.folderId = folderId; // S'assurer que folderId est sauvegardé
            matchInfo.documents = classification.documents;
            matchInfo.documentsClassification = {
              statsByType: classification.statsByType,
              statsByKind: classification.statsByKind,
              total: classification.total
            };
            
            if (classification.total > 0 && (i % 10 === 0 || (i + 1) % 10 === 0)) {
              console.log(`    ✅ ${classification.total} document(s) trouvé(s) et classifié(s)`);
              Object.entries(classification.statsByType).forEach(([type, count]) => {
                console.log(`       - ${getDocumentTypeLabel(type)}: ${count}`);
              });
            }

            // Insérer les documents en base de données si demandé
            if (!skipInsert && matchResult.artisan && classification.total > 0) {
              const insertResults = await insertArtisanDocuments(
                matchResult.artisan.id,
                classification.documents,
                drive,
                dryRun
              );
              
              matchInfo.insertResults = insertResults;
              
              if (insertResults.inserted > 0 || insertResults.errors > 0) {
                if (i % 10 === 0 || (i + 1) % 10 === 0 || insertResults.errors > 0) {
                  console.log(`    💾 ${insertResults.inserted} document(s) inséré(s) en base${insertResults.errors > 0 ? `, ${insertResults.errors} erreur(s)` : ''}`);
                  
                  // Afficher les erreurs détaillées si mode debug
                  if (insertResults.errors > 0 && (process.argv.includes('--debug') || process.argv.includes('-v'))) {
                    insertResults.details
                      .filter(d => !d.success)
                      .slice(0, 3)
                      .forEach(d => {
                        console.log(`      ❌ "${d.filename}" (${d.kind}): ${d.error}`);
                      });
                  }
                }
              }
            }
          } catch (error) {
            console.warn(`    ⚠️ Erreur lors de la récupération des documents pour "${folder.name}": ${error.message}`);
          }
        } else {
          // Pas de folderId disponible, on ne peut pas récupérer les documents
          // (Pas de log pour éviter le spam, mais l'info sera dans le JSON)
        }
      }

      if (matchResult.artisan) {
        matches.push(matchInfo);
        stats[matchResult.matchType]++;
      } else {
        unmatched.push(matchInfo);
        stats.none++;
      }

      if ((i + 1) % 50 === 0) {
        console.log(`  Traité ${i + 1}/${subFolders.length} dossiers...`);
      }
    }

    console.log(`✅ Matching terminé\n`);

    // 4. Préparer les données pour export
    const outputData = {
      generatedAt: new Date().toISOString(),
      stats: stats,
      summary: {
        totalFolders: subFolders.length,
        matched: matches.length,
        unmatched: unmatched.length,
        matchRate: ((matches.length / subFolders.length) * 100).toFixed(2) + '%'
      },
      matches: matches,
      unmatched: unmatched
    };

    // 5. Sauvegarder les résultats
    const outputDir = path.join(__dirname, '../../../data/docs_imports/');
    
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // JSON complet
    const outputJsonPath = path.join(outputDir, 'folder-artisan-matches.json');
    fs.writeFileSync(outputJsonPath, JSON.stringify(outputData, null, 2));
    console.log(`💾 Résultats complets sauvegardés dans: ${outputJsonPath}`);

    // CSV des matches
    const csvMatchesPath = path.join(outputDir, 'folder-artisan-matches.csv');
    const csvHeader = 'Nom dossier,Nom normalisé,Type match,ID artisan,Nom,Prénom,Plain nom,Raison sociale,Email,Numéro associé,Nombre documents,Documents classifiés\n';
    const csvRows = matches.map(m => {
      const docStats = m.documentsClassification ? 
        Object.entries(m.documentsClassification.statsByType)
          .map(([type, count]) => `${getDocumentTypeLabel(type)}:${count}`)
          .join('; ') : 'Aucun';
      return `"${m.folderName}","${m.normalizedFolderName}","${m.matchType}","${m.artisan?.id || ''}","${m.artisan?.nom || ''}","${m.artisan?.prenom || ''}","${m.artisan?.plain_nom || ''}","${m.artisan?.raison_sociale || ''}","${m.artisan?.email || ''}","${m.artisan?.numero_associe || ''}",${m.documentCount},"${docStats}"`;
    }).join('\n');
    fs.writeFileSync(csvMatchesPath, csvHeader + csvRows);
    console.log(`💾 CSV des matches sauvegardé dans: ${csvMatchesPath}`);

    // JSON détaillé avec documents classifiés
    const detailedJsonPath = path.join(outputDir, 'folder-artisan-matches-with-documents.json');
    fs.writeFileSync(detailedJsonPath, JSON.stringify(outputData, null, 2));
    console.log(`💾 JSON détaillé avec documents sauvegardé dans: ${detailedJsonPath}`);

    // CSV des documents classifiés (un document par ligne)
    const documentsCsvPath = path.join(outputDir, 'documents-classified.csv');
    const documentsCsvHeader = 'Nom dossier,ID artisan,Plain nom,Nom fichier,Type document,Label type,Taille,Date création,Date modification,ID fichier Drive\n';
    const documentsCsvRows = [];
    matches.forEach(match => {
      if (match.documents && match.documents.length > 0) {
        match.documents.forEach(doc => {
          documentsCsvRows.push(
            `"${match.folderName}","${match.artisan?.id || ''}","${match.artisan?.plain_nom || ''}","${doc.name}","${doc.type}","${doc.typeLabel}",${doc.size || 0},"${doc.createdTime || ''}","${doc.modifiedTime || ''}","${doc.id}"`
          );
        });
      }
    });
    fs.writeFileSync(documentsCsvPath, documentsCsvHeader + documentsCsvRows.join('\n'));
    console.log(`💾 CSV des documents classifiés sauvegardé dans: ${documentsCsvPath}`);

    // CSV des non-matchés
    const csvUnmatchedPath = path.join(outputDir, 'folder-artisan-unmatched.csv');
    const csvUnmatchedHeader = 'Nom dossier,Nom normalisé,Nombre documents\n';
    const csvUnmatchedRows = unmatched.map(m => 
      `"${m.folderName}","${m.normalizedFolderName}",${m.documentCount}`
    ).join('\n');
    fs.writeFileSync(csvUnmatchedPath, csvUnmatchedHeader + csvUnmatchedRows);
    console.log(`💾 CSV des non-matchés sauvegardé dans: ${csvUnmatchedPath}`);

    // 6. Afficher le résumé
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('📊 RÉSUMÉ DU MATCHING');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log(`Total dossiers: ${stats.total}`);
    console.log(`✅ Matchés: ${matches.length} (${outputData.summary.matchRate})`);
    console.log(`   - Match exact: ${stats.exact}`);
    console.log(`   - Match partiel: ${stats.partial}`);
    console.log(`   - Match raison sociale: ${stats.raison_sociale}`);
    console.log(`   - Match nom/prénom: ${stats.nom_prenom}`);
    console.log(`   - Match nom inversé (exact): ${stats.inverted_exact}`);
    console.log(`   - Match nom inversé (partiel): ${stats.inverted_partial}`);
    console.log(`   - Match nom nettoyé (exact): ${stats.cleaned_exact}`);
    console.log(`   - Match nom nettoyé (partiel): ${stats.cleaned_partial}`);
    console.log(`❌ Non matchés: ${unmatched.length}`);
    
    // Statistiques des documents classifiés
    const totalDocuments = matches.reduce((sum, m) => sum + (m.documentsClassification?.total || 0), 0);
    const documentsByType = {};
    matches.forEach(m => {
      if (m.documentsClassification?.statsByType) {
        Object.entries(m.documentsClassification.statsByType).forEach(([type, count]) => {
          documentsByType[type] = (documentsByType[type] || 0) + count;
        });
      }
    });

    if (totalDocuments > 0) {
      console.log(`\n📄 Documents classifiés: ${totalDocuments} document(s) au total`);
      Object.entries(documentsByType).forEach(([type, count]) => {
        console.log(`   - ${getDocumentTypeLabel(type)}: ${count}`);
      });
    }

    // Statistiques d'insertion
    const totalInserted = matches.reduce((sum, m) => sum + (m.insertResults?.inserted || 0), 0);
    const totalInsertErrors = matches.reduce((sum, m) => sum + (m.insertResults?.errors || 0), 0);
    
    if (!skipInsert && (totalInserted > 0 || totalInsertErrors > 0)) {
      console.log(`\n💾 Documents insérés en base: ${totalInserted} document(s)`);
      if (totalInsertErrors > 0) {
        console.log(`   ⚠️ Erreurs lors de l'insertion: ${totalInsertErrors}`);
      }
    }
    
    if (unmatched.length > 0) {
      console.log(`\nPremiers 10 dossiers non matchés:`);
      unmatched.slice(0, 10).forEach((m, i) => {
        console.log(`  ${i + 1}. ${m.folderName}`);
      });
      if (unmatched.length > 10) {
        console.log(`  ... et ${unmatched.length - 10} autres`);
      }
    }

    console.log('\n✅ Matching et classification terminés avec succès!');
    console.log(`\n📝 Fichiers générés:`);
    console.log(`   - ${outputJsonPath}`);
    console.log(`   - ${detailedJsonPath}`);
    console.log(`   - ${csvMatchesPath}`);
    console.log(`   - ${documentsCsvPath}`);
    console.log(`   - ${csvUnmatchedPath}`);

  } catch (error) {
    console.error('❌ Erreur lors du matching:', error);
    process.exit(1);
  }
}

// Exécuter si appelé directement
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  normalizeName,
  cleanName,
  invertNameOrder,
  extractNameParts,
  findArtisansFolder,
  listArtisanFolders,
  countDocumentsInFolder,
  extractFoldersFromDrive,
  listDocumentsInFolder,
  classifyDocuments,
  findMatchingArtisan,
  getAllArtisans,
  insertDocumentToDatabase,
  insertArtisanDocuments
};

