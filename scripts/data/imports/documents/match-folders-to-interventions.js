/**
 * Script complet d'import des documents d'interventions depuis Google Drive
 * 
 * Ce script :
 * 1. Extrait les dossiers d'interventions depuis Google Drive
 * 2. Fait le matching avec les interventions en base de données
 * 3. Classe les documents (tous avec kind = "a_classe")
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

// Utiliser l'API v2 centralisée
let interventionsApi, documentsApi;
try {
  const apiV2 = require('../../../src/lib/api/v2');
  interventionsApi = apiV2.interventionsApi;
  documentsApi = apiV2.documentsApi;
} catch (error) {
  console.error('❌ Erreur lors du chargement de l\'API v2:', error.message);
  console.error('   Assurez-vous d\'utiliser tsx pour exécuter ce script');
  process.exit(1);
}

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
 * Trouve le dossier racine (GMBS) dans Google Drive
 */
async function findRootFolder(drive, rootFolderId = null) {
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

    // Sinon, chercher le dossier "GMBS" à la racine
    const query = "(name='GMBS' or name contains 'GMBS') and mimeType='application/vnd.google-apps.folder' and trashed=false";
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
    console.error('❌ Erreur lors de la recherche du dossier racine:', error.message);
    throw error;
  }
}

/**
 * Trouve le dossier "Interventions 2025 GMBS" dans le dossier racine
 */
async function findInterventionsFolder(drive, rootFolderId) {
  try {
    // Chercher "Interventions 2025 GMBS" dans le dossier racine
    const query = `'${rootFolderId}' in parents and (name='Interventions 2025 GMBS' or name contains 'Interventions 2025') and mimeType='application/vnd.google-apps.folder' and trashed=false`;
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
    console.error('❌ Erreur lors de la recherche du dossier interventions:', error.message);
    throw error;
  }
}

/**
 * Liste tous les sous-dossiers dans un dossier donné
 */
async function listFolders(drive, folderId) {
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
 * Parse le nom d'un dossier INTER pour extraire l'ID d'intervention
 */
function parseInterventionId(folderName) {
  if (!folderName) return null;

  // Normaliser le nom
  const normalized = folderName.toUpperCase().trim();
  
  // Patterns à chercher (dans l'ordre de priorité)
  // Supporte les variantes courantes : INTER, INTE, INTRER (faute de frappe)
  const patterns = [
    // Format: "INTER 1831 ID 11778" ou "INTE 1831 ID 11778" ou "INTRER 1831 ID 11778"
    /(?:INTER|INTE|INTRER)\s+\d+\s+ID\s+(\d+)/i,
    // Format: "INTER 3319 FACTURE 1858" → prendre le premier nombre après INTER/INTE/INTRER
    /(?:INTER|INTE|INTRER)\s+(\d+)/i,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match && match[1]) {
      const id = parseInt(match[1], 10);
      if (!isNaN(id)) {
        return id;
      }
    }
  }

  return null;
}

/**
 * Extrait les informations d'un nom de dossier INTER
 */
function parseInterventionFolder(folderName) {
  const id = parseInterventionId(folderName);
  
  // Extraire aussi le numéro de facture si présent
  const factureMatch = folderName.match(/FACTURE\s+(\d+)/i);
  const factureNumber = factureMatch ? parseInt(factureMatch[1], 10) : null;

  return {
    originalName: folderName,
    normalizedName: normalizeName(folderName),
    interventionId: id,
    factureNumber: factureNumber,
    hasId: id !== null,
    format: id ? (factureNumber ? 'INTER_ID_FACTURE' : (folderName.match(/ID\s+\d+/i) ? 'INTER_ID_EXPLICITE' : 'INTER_SIMPLE')) : 'UNKNOWN'
  };
}

/**
 * Extrait les dossiers d'interventions depuis Google Drive
 */
async function extractFoldersFromDrive(drive) {
  console.log('📁 Extraction des dossiers d\'interventions depuis Google Drive...\n');

  try {
    // 1. Récupérer directement le dossier Interventions depuis la variable d'environnement
    console.log('🔍 Recherche du dossier Interventions...');
    const interventionsRootFolderId = googleDriveConfig.getInterventionsRootFolderId();
    
    if (!interventionsRootFolderId) {
      console.error('❌ GOOGLE_DRIVE_GMBS_INTERVENTIONS_YEAR_ROOT_FOLDER non défini dans les variables d\'environnement');
      console.log('\n💡 Suggestions:');
      console.log('   - Vérifiez que GOOGLE_DRIVE_GMBS_INTERVENTIONS_YEAR_ROOT_FOLDER est défini dans .env.local');
      console.log('   - Cette variable doit pointer directement vers le dossier "Interventions-2025-GMBS"');
      throw new Error('GOOGLE_DRIVE_GMBS_INTERVENTIONS_YEAR_ROOT_FOLDER non défini');
    }

    // Vérifier que le dossier existe et récupérer ses infos
    let interventionsFolder;
    try {
      const response = await drive.files.get({
        fileId: interventionsRootFolderId,
        fields: 'id, name, mimeType'
      });
      
      if (response.data.mimeType !== 'application/vnd.google-apps.folder') {
        throw new Error('L\'ID fourni ne correspond pas à un dossier');
      }
      
      interventionsFolder = response.data;
    } catch (error) {
      console.error(`❌ Erreur lors de l'accès au dossier Interventions (ID: ${interventionsRootFolderId}):`, error.message);
      throw new Error('Impossible d\'accéder au dossier Interventions');
    }

    console.log(`✅ Dossier trouvé: ${interventionsFolder.name} (ID: ${interventionsFolder.id})\n`);

    // 2. Lister directement les dossiers de mois (plus besoin de chercher dans GMBS)
    console.log('📂 Liste des dossiers de mois...');
    const monthFolders = await listFolders(drive, interventionsFolder.id);
    console.log(`✅ ${monthFolders.length} dossier(s) de mois trouvé(s)\n`);

    // 3. Pour chaque mois, lister les dossiers INTER
    const allInterventionFolders = [];
    const monthData = [];

    for (let i = 0; i < monthFolders.length; i++) {
      const monthFolder = monthFolders[i];
      console.log(`📁 Traitement du mois: ${monthFolder.name}...`);

      // Lister les dossiers INTER dans ce mois
      const interFolders = await listFolders(drive, monthFolder.id);
      
      // Filtrer et parser les dossiers INTER
      const parsedFolders = interFolders.map(folder => {
        const parsed = parseInterventionFolder(folder.name);
        return {
          ...parsed,
          folderId: folder.id,
          createdTime: folder.createdTime,
          modifiedTime: folder.modifiedTime,
          monthFolder: monthFolder.name,
          monthFolderId: monthFolder.id
        };
      });

      // Compter les documents dans chaque dossier INTER (parallélisé par batches)
      console.log(`   📊 Analyse de ${parsedFolders.length} dossier(s) INTER...`);
      const BATCH_SIZE = 10; // Traiter 10 dossiers en parallèle pour éviter les limites API
      for (let j = 0; j < parsedFolders.length; j += BATCH_SIZE) {
        const batch = parsedFolders.slice(j, j + BATCH_SIZE);
        const results = await Promise.all(
          batch.map(folder => 
            countDocumentsInFolder(drive, folder.folderId)
              .then(documents => ({ folder, count: documents.length }))
              .catch(error => {
                console.warn(`     ⚠️ Erreur pour "${folder.originalName}": ${error.message}`);
                return { folder, count: 0 };
              })
          )
        );
        
        results.forEach(({ folder, count }) => {
          folder.documentCount = count;
        });
        
        if ((j + BATCH_SIZE) % 50 === 0 || j + BATCH_SIZE >= parsedFolders.length) {
          console.log(`     Traité ${Math.min(j + BATCH_SIZE, parsedFolders.length)}/${parsedFolders.length} dossiers...`);
        }
      }

      monthData.push({
        monthFolder: monthFolder.name,
        monthFolderId: monthFolder.id,
        totalInterFolders: parsedFolders.length,
        foldersWithId: parsedFolders.filter(f => f.hasId).length,
        foldersWithoutId: parsedFolders.filter(f => !f.hasId).length,
        folders: parsedFolders
      });

      allInterventionFolders.push(...parsedFolders);

      console.log(`   ✅ ${parsedFolders.length} dossier(s) INTER traité(s) (${parsedFolders.filter(f => f.hasId).length} avec ID)\n`);
    }

    // 4. Vérifier quels IDs existent en base de données
    const foldersWithId = allInterventionFolders.filter(f => f.hasId && f.interventionId);
    const uniqueInterventionIds = [...new Set(foldersWithId.map(f => f.interventionId))];
    
    let existingIdsSet = new Set();
    let matchingStats = {
      totalIdsExtracted: uniqueInterventionIds.length,
      idsFoundInDb: 0,
      idsNotFoundInDb: 0,
      matchRate: 0
    };

    if (uniqueInterventionIds.length > 0) {
      console.log(`🔍 Vérification rapide des ${uniqueInterventionIds.length} ID(s) unique(s) en base de données...`);
      existingIdsSet = await checkInterventionIdsExist(uniqueInterventionIds);
      matchingStats.idsFoundInDb = existingIdsSet.size;
      matchingStats.idsNotFoundInDb = uniqueInterventionIds.length - existingIdsSet.size;
      matchingStats.matchRate = uniqueInterventionIds.length > 0 
        ? ((existingIdsSet.size / uniqueInterventionIds.length) * 100).toFixed(2) 
        : 0;
      
      // Compter les dossiers avec et sans match après avoir ajouté le flag
      // (on le fera après avoir ajouté les flags)
      
      console.log(`   ✅ ${existingIdsSet.size} ID(s) trouvé(s) en BDD (${matchingStats.matchRate}%)`);
      console.log(`   ⚠️  ${matchingStats.idsNotFoundInDb} ID(s) non trouvé(s) en BDD\n`);
      
      // Ajouter le flag hasMatch à chaque dossier
      allInterventionFolders.forEach(folder => {
        if (folder.hasId && folder.interventionId) {
          folder.hasMatch = existingIdsSet.has(String(folder.interventionId));
        } else {
          folder.hasMatch = false; // Pas d'ID = pas de match possible
        }
      });
      
      // Mettre à jour aussi dans monthData
      monthData.forEach(month => {
        if (month.folders) {
          month.folders.forEach(folder => {
            if (folder.hasId && folder.interventionId) {
              folder.hasMatch = existingIdsSet.has(String(folder.interventionId));
            } else {
              folder.hasMatch = false;
            }
          });
          
          // Ajouter les statistiques de match par mois
          const monthFoldersWithMatch = month.folders.filter(f => f.hasMatch === true).length;
          const monthFoldersWithoutMatch = month.folders.filter(f => f.hasMatch === false).length;
          month.foldersWithMatch = monthFoldersWithMatch;
          month.foldersWithoutMatch = monthFoldersWithoutMatch;
        }
      });
      
      // Ajouter les statistiques de dossiers dans matchingStats
      matchingStats.foldersWithMatch = allInterventionFolders.filter(f => f.hasMatch === true).length;
      matchingStats.foldersWithoutMatch = allInterventionFolders.filter(f => f.hasMatch === false).length;
    } else {
      // Si aucun ID n'a été extrait, marquer tous les dossiers comme hasMatch = false
      allInterventionFolders.forEach(folder => {
        folder.hasMatch = false;
      });
      monthData.forEach(month => {
        if (month.folders) {
          month.folders.forEach(folder => {
            folder.hasMatch = false;
          });
          
          // Ajouter les statistiques de match par mois (tous à false)
          month.foldersWithMatch = 0;
          month.foldersWithoutMatch = month.folders.length;
        }
      });
      
      // Ajouter les statistiques de dossiers dans matchingStats
      matchingStats.foldersWithMatch = 0;
      matchingStats.foldersWithoutMatch = allInterventionFolders.length;
    }

    // 5. Statistiques globales
    console.log('📊 Statistiques globales:');
    console.log(`   Total dossiers INTER: ${allInterventionFolders.length}`);
    console.log(`   Dossiers avec ID extrait: ${foldersWithId.length}`);
    console.log(`   Dossiers sans ID: ${allInterventionFolders.filter(f => !f.hasId).length}`);
    console.log(`   Total documents: ${allInterventionFolders.reduce((sum, f) => sum + (f.documentCount || 0), 0)}`);
    if (matchingStats.totalIdsExtracted > 0) {
      const foldersWithMatch = matchingStats.foldersWithMatch || 0;
      const foldersWithoutMatch = matchingStats.foldersWithoutMatch || 0;
      console.log(`   Dossiers avec match en BDD: ${foldersWithMatch} (${((foldersWithMatch / allInterventionFolders.length) * 100).toFixed(2)}%)`);
      console.log(`   Dossiers sans match en BDD: ${foldersWithoutMatch} (${((foldersWithoutMatch / allInterventionFolders.length) * 100).toFixed(2)}%)`);
      console.log(`   IDs correspondant en BDD: ${matchingStats.idsFoundInDb} / ${matchingStats.totalIdsExtracted} (${matchingStats.matchRate}%)\n`);
    } else {
      console.log('');
    }

    // 6. Sauvegarder les données
    const outputDir = path.join(__dirname, '../../../data/docs_imports/');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const exportData = {
      extractedAt: new Date().toISOString(),
      interventionsFolder: {
        id: interventionsFolder.id,
        name: interventionsFolder.name
      },
      totalMonths: monthData.length,
      totalInterFolders: allInterventionFolders.length,
      foldersWithId: foldersWithId.length,
      foldersWithoutId: allInterventionFolders.filter(f => !f.hasId).length,
      matchingStats: matchingStats,
      months: monthData
    };

    const jsonPath = path.join(outputDir, 'interventions-folders.json');
    fs.writeFileSync(jsonPath, JSON.stringify(exportData, null, 2));
    console.log(`💾 Données sauvegardées dans: ${jsonPath}\n`);

    return exportData;
  } catch (error) {
    console.error('❌ Erreur lors de l\'extraction:', error);
    throw error;
  }
}

/**
 * Récupère toutes les interventions de la base de données
 * Utilise l'API v2 pour centraliser les accès
 */
async function getAllInterventions() {
  try {
    console.log('📊 Récupération de toutes les interventions en base...');
    const allInterventions = [];
    let offset = 0;
    const limit = 500;
    let hasMore = true;

    while (hasMore) {
      const result = await interventionsApi.getAll({ limit, offset });
      allInterventions.push(...result.data);
      hasMore = result.pagination.hasMore;
      offset += limit;
      
      if (allInterventions.length % 1000 === 0) {
        console.log(`   ${allInterventions.length} interventions chargées...`);
      }
    }

    console.log(`✅ ${allInterventions.length} intervention(s) chargée(s)\n`);
    return allInterventions;
  } catch (error) {
    console.error('❌ Erreur lors de la récupération des interventions:', error.message);
    throw error;
  }
}

/**
 * Vérifie rapidement quels IDs d'interventions existent en base de données
 * Retourne un Set des IDs qui existent (pour vérification rapide)
 */
async function checkInterventionIdsExist(interventionIds) {
  try {
    if (!interventionIds || interventionIds.length === 0) {
      return new Set();
    }

    const { createClient } = require('@supabase/supabase-js');
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !serviceRoleKey) {
      console.warn('⚠️  Impossible de vérifier les IDs en BDD: variables d\'environnement manquantes');
      return new Set();
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Convertir tous les IDs en strings pour la comparaison
    const idStrings = interventionIds.map(id => String(id));
    
    // Construire la requête OR pour vérifier plusieurs IDs en une fois
    // Limite: Supabase PostgREST limite à ~2000 caractères pour une requête OR
    // On va faire des batches de 100 IDs à la fois
    const batchSize = 100;
    const existingIds = new Set();

    for (let i = 0; i < idStrings.length; i += batchSize) {
      const batch = idStrings.slice(i, i + batchSize);
      const orConditions = batch.map(id => `id_inter.eq.${id}`).join(',');
      
      const { data, error } = await supabase
        .from('interventions')
        .select('id_inter')
        .or(orConditions);

      if (error && error.code !== 'PGRST116') {
        console.warn(`⚠️  Erreur lors de la vérification des IDs (batch ${i / batchSize + 1}):`, error.message);
        continue;
      }

      if (data) {
        data.forEach(intervention => {
          if (intervention.id_inter) {
            existingIds.add(String(intervention.id_inter));
          }
        });
      }
    }

    return existingIds;
  } catch (error) {
    console.warn('⚠️  Erreur lors de la vérification des IDs en BDD:', error.message);
    return new Set();
  }
}

/**
 * Trouve une intervention correspondante par id_inter (qui correspond à interventionId)
 */
async function findMatchingIntervention(interventionId, interventionsCache = null) {
  try {
    if (!interventionId) {
      return { intervention: null, matchType: 'none', reason: 'ID d\'intervention manquant' };
    }

    // Convertir l'ID en string pour la comparaison (id_inter est text dans la BDD)
    const idInterString = String(interventionId);

    // Chercher directement dans le cache si disponible
    if (interventionsCache) {
      const exactMatch = interventionsCache.find(
        i => i.id_inter === idInterString || i.id_inter === interventionId
      );
      
      if (exactMatch) {
        return {
          intervention: exactMatch,
          matchType: 'exact',
          reason: `Match exact par id_inter: ${idInterString}`
        };
      }
    }

    // Sinon, chercher via Supabase directement (plus rapide pour une recherche simple)
    const { createClient } = require('@supabase/supabase-js');
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis');
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Chercher par id_inter (qui correspond à interventionId)
    const { data, error } = await supabase
      .from('interventions')
      .select('*')
      .or(`id_inter.eq.${idInterString},id_inter.eq.${interventionId}`)
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows returned, c'est normal si pas de match
      throw error;
    }

    if (data) {
      return {
        intervention: data,
        matchType: 'exact',
        reason: `Match exact par id_inter: ${idInterString}`
      };
    }

    return { intervention: null, matchType: 'none', reason: `Aucune intervention trouvée avec id_inter: ${idInterString}` };
  } catch (error) {
    return { intervention: null, matchType: 'none', reason: `Erreur lors de la recherche: ${error.message}` };
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
 * Prépare les documents pour l'insertion (tous avec kind = "a_classe")
 */
function prepareDocumentsForInsertion(documents) {
  return documents.map(doc => ({
    id: doc.id,
    name: doc.name,
    mimeType: doc.mimeType,
    size: doc.size ? parseInt(doc.size) : null,
    createdTime: doc.createdTime,
    modifiedTime: doc.modifiedTime,
    webViewLink: doc.webViewLink,
    driveUrl: buildGoogleDriveUrl(doc.id, doc.webViewLink),
    kind: 'a_classe' // Tous les documents sont classifiés comme "a_classe" (non classifiés)
  }));
}

// Importer la fonction utilitaire pour télécharger depuis Google Drive
const { downloadFileFromDrive } = require('../lib/google-drive-utils');

/**
 * Insère un document en base de données en téléchargeant depuis Google Drive
 * et en l'uploadant dans Supabase Storage via l'API v2
 */
async function insertDocumentToDatabase(interventionId, document, drive) {
  try {
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
      entity_id: interventionId,
      entity_type: 'intervention',
      kind: document.kind, // "a_classe"
      filename: document.name,
      mime_type: document.mimeType || 'application/octet-stream',
      file_size: document.size || fileContentBase64.length * 3 / 4, // Approximation si size manquant
      content: fileContentBase64
    });

    return { success: true, data: result };
  } catch (error) {
    const errorDetails = {
      message: error.message,
      document: {
        name: document.name,
        kind: document.kind,
        fileId: document.id
      }
    };
    
    // Afficher l'erreur en mode debug
    if (process.argv.includes('--debug') || process.argv.includes('-v')) {
      console.error('    ❌ Erreur détaillée:', JSON.stringify(errorDetails, null, 2));
    }
    
    return { success: false, error: error.message, details: errorDetails };
  }
}

/**
 * Insère tous les documents d'une intervention en base de données
 */
async function insertInterventionDocuments(interventionId, documents, drive, dryRun = false) {
  const results = {
    total: documents.length,
    inserted: 0,
    errors: 0,
    details: []
  };

  if (dryRun) {
    console.log(`    🔍 Mode DRY RUN: ${documents.length} document(s) seraient téléchargé(s) et inséré(s)`);
    return results;
  }

  // Insérer les documents séquentiellement pour respecter la limite de 3 écritures/seconde
  // Mais avec gestion d'erreur améliorée
  for (let i = 0; i < documents.length; i++) {
    const doc = documents[i];
    
    // Petit délai pour éviter de dépasser les limites d'écriture (3 req/s)
    if (i > 0 && i % 3 === 0) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // Attendre 1 seconde tous les 3 documents
    }
    
    const result = await insertDocumentToDatabase(interventionId, doc, drive);
    
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
 * Fonction principale
 */
async function main() {
  // Vérifier les arguments de ligne de commande
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: npm run drive:import-documents-interventions [options]

Options:
  --first-month-only    Traiter uniquement le premier mois (pour développement)
  --dry-run, -d         Mode simulation (aucune insertion en base)
  --skip-insert, -s     Faire le matching sans insérer les documents
  --help, -h            Afficher cette aide

Exemples:
  npm run drive:import-documents-interventions                    # Extraction + Matching + Insertion
  npm run drive:import-documents-interventions --dry-run          # Simulation complète
  npm run drive:import-documents-interventions --skip-insert      # Extraction + Matching sans insertion
  npm run drive:import-documents-interventions --first-month-only # Traitement du premier mois uniquement
`);
    process.exit(0);
  }

  const insertOnly = args.includes('--insert-only') || args.includes('-i');
  const firstMonthOnly = args.includes('--first-month-only');
  const dryRun = args.includes('--dry-run') || args.includes('-d');
  const skipInsert = args.includes('--skip-insert') || args.includes('-s');

  if (dryRun) {
    console.log('🔍 Mode DRY RUN activé - Aucune insertion en base de données\n');
  }
  if (skipInsert) {
    console.log('⏭️  Mode SKIP INSERT activé - Pas d\'insertion en base de données\n');
  }
  if (insertOnly) {
    console.log('💾 Mode INSERT ONLY activé - Insertion des documents déjà matchés\n');
  }

  console.log('🔍 Matching des dossiers Google Drive avec les interventions en base (API v2)...\n');
  console.log('📌 Note: Le matching se fait entre interventionId (du nom du dossier) et id_inter (de la BDD)');
  console.log('📌 Note: Tous les documents seront classifiés avec kind = "a_classe"\n');

  try {
    // Initialiser Google Drive API (nécessaire pour extraction et insertion de documents)
    let drive = null;
    if (!skipInsert && !dryRun) {
      console.log('🔐 Initialisation de l\'authentification Google Drive...');
      
      const credentials = googleDriveConfig.getCredentials();
      
      if (!credentials || !credentials.client_email || !credentials.private_key) {
        console.error('\n❌ Configuration Google Drive incomplète.');
        console.error('   Vérifiez que les variables d\'environnement sont correctement définies dans .env.local');
        googleDriveConfig.displayConfig();
        process.exit(1);
      }

      // Créer l'authentification JWT
      const auth = new google.auth.JWT({
        email: credentials.client_email,
        key: credentials.private_key,
        scopes: ['https://www.googleapis.com/auth/drive.readonly']
      });

      drive = google.drive({ version: 'v3', auth });
      console.log('✅ Authentification Google Drive initialisée\n');
    }

    // 1. Extraire les dossiers depuis Google Drive
    let folderData;
    
    if (!drive) {
      console.error('❌ Google Drive API non initialisée. Impossible d\'extraire les dossiers.');
      process.exit(1);
    }
    
    console.log('📁 Extraction des dossiers d\'interventions depuis Google Drive...\n');
    folderData = await extractFoldersFromDrive(drive);
    
    // Limiter au premier mois si demandé
    let monthsToProcess = folderData.months || [];
    if (firstMonthOnly && monthsToProcess.length > 0) {
      monthsToProcess = [monthsToProcess[0]];
      console.log(`⚠️  Mode développement: traitement du premier mois uniquement\n`);
    }

    const allFolders = monthsToProcess.flatMap(month => month.folders || []);
    // Filtrer les dossiers avec interventionId (qui correspond à id_inter)
    const foldersWithId = allFolders.filter(f => f.hasId && f.interventionId);
    
    console.log(`✅ ${allFolders.length} dossier(s) INTER chargé(s)`);
    console.log(`   ${foldersWithId.length} avec ID d'intervention (id_inter)`);
    console.log(`   ${allFolders.length - foldersWithId.length} sans ID\n`);

    // Afficher quelques exemples
    if (foldersWithId.length > 0) {
      console.log(`📋 Exemples de dossiers à matcher:`);
      foldersWithId.slice(0, 5).forEach((f, idx) => {
        console.log(`     ${idx + 1}. "${f.originalName}" → ID: ${f.interventionId} (id_inter)`);
      });
      if (foldersWithId.length > 5) {
        console.log(`     ... et ${foldersWithId.length - 5} autres`);
      }
      console.log('');
    }

    // Mode INSERT ONLY : charger les matches existants et faire uniquement l'insertion
    if (insertOnly) {
      console.log('💾 Mode INSERT ONLY - Insertion des documents déjà matchés...\n');
      // Charger les matches existants
      const existingMatchesPath = path.join(__dirname, '../../../data/docs_imports/intervention-folder-matches.json');
      if (fs.existsSync(existingMatchesPath)) {
        const existingData = JSON.parse(fs.readFileSync(existingMatchesPath, 'utf8'));
        const matches = existingData.matches || [];
        console.log(`✅ ${matches.length} match(s) chargé(s) depuis le fichier existant\n`);
        
        // Initialiser Google Drive si nécessaire pour télécharger les fichiers
        if (!drive && !skipInsert && !dryRun) {
          console.log('🔐 Initialisation de l\'authentification Google Drive...');
          
          const credentials = googleDriveConfig.getCredentials();
          
          if (!credentials || !credentials.client_email || !credentials.private_key) {
            console.error('\n❌ Configuration Google Drive incomplète.');
            console.error('   Vérifiez que les variables d\'environnement sont correctement définies dans .env.local');
            googleDriveConfig.displayConfig();
            process.exit(1);
          }

          const auth = new google.auth.JWT({
            email: credentials.client_email,
            key: credentials.private_key,
            scopes: ['https://www.googleapis.com/auth/drive.readonly']
          });

          drive = google.drive({ version: 'v3', auth });
          console.log('✅ Authentification Google Drive initialisée\n');
        }
        
        // Insérer les documents pour chaque match chargé
        for (let i = 0; i < matches.length; i++) {
          const match = matches[i];
          if (match.intervention && match.documents && match.documents.length > 0 && !skipInsert && drive) {
            // Reconstruire les documents avec les IDs pour le téléchargement
            const documentsWithIds = match.documents.map(doc => {
              // Essayer d'extraire l'ID depuis l'URL Google Drive si pas déjà présent
              let fileId = doc.id;
              if (!fileId && doc.driveUrl) {
                // Format: https://drive.google.com/file/d/FILE_ID/view
                const match = doc.driveUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
                if (match) {
                  fileId = match[1];
                }
              }
              
              return {
                id: fileId,
                name: doc.name,
                mimeType: doc.mimeType,
                size: doc.size,
                kind: doc.kind || 'a_classe',
                driveUrl: doc.driveUrl
              };
            }).filter(doc => doc.id); // Filtrer ceux qui ont un ID valide
            
            if (documentsWithIds.length > 0) {
              const insertResults = await insertInterventionDocuments(
                match.intervention.id,
                documentsWithIds,
                drive,
                dryRun
              );
              match.documentsInsertion = insertResults;
              
              if ((i + 1) % 10 === 0) {
                console.log(`  Traité ${i + 1}/${matches.length} interventions...`);
              }
            }
          }
        }
        
        console.log(`✅ Insertion terminée\n`);
        // Sortir de la fonction après l'insertion
        return;
      } else {
        console.error('❌ Fichier de matches non trouvé. Exécutez d\'abord le matching complet.');
        console.error(`   Fichier attendu: ${path.join(__dirname, '../../../data/docs_imports/intervention-folder-matches.json')}`);
        process.exit(1);
      }
    }

    // 2. Récupérer toutes les interventions via l'API v2 (pour le cache)
    const interventionsCache = await getAllInterventions();

    // 3. Faire le matching pour chaque dossier
    console.log('🔗 Matching des dossiers avec les interventions...\n');
    
    const matches = [];
    const unmatched = [];
    const stats = {
      total: foldersWithId.length,
      exact: 0,
      none: 0
    };

    // Phase 1 : Matching (séquentiel mais rapide car utilise le cache)
    console.log('🔗 Phase 1: Matching des dossiers avec les interventions (cache local)...\n');
    const matchResults = [];
    for (let i = 0; i < foldersWithId.length; i++) {
      const folder = foldersWithId[i];
      // Utiliser interventionId pour le matching (correspond à id_inter)
      // Utilise le cache en priorité, donc très rapide
      const matchResult = await findMatchingIntervention(folder.interventionId, interventionsCache);
      matchResults.push({ folder, matchResult });
      
      if ((i + 1) % 100 === 0 || (i + 1) === foldersWithId.length) {
        console.log(`  Matching: ${i + 1}/${foldersWithId.length} dossiers traités...`);
      }
    }

    // Phase 2 : Récupération des documents (parallélisé par batches)
    // Récupérer les documents pour tous les matchs (même en mode skipInsert pour sauvegarder dans JSON)
    console.log('\n📄 Phase 2: Récupération des documents depuis Google Drive (parallélisé)...\n');
    const foldersToProcess = matchResults.filter(r => r.matchResult.intervention && drive && r.folder.folderId);
    const DOC_BATCH_SIZE = 5; // Traiter 5 dossiers en parallèle pour éviter les limites API
    
    for (let i = 0; i < foldersToProcess.length; i += DOC_BATCH_SIZE) {
      const batch = foldersToProcess.slice(i, i + DOC_BATCH_SIZE);
      
      const batchResults = await Promise.all(
        batch.map(async ({ folder, matchResult }) => {
          try {
            const driveDocuments = await listDocumentsInFolder(drive, folder.folderId);
            return { folder, matchResult, driveDocuments, error: null };
          } catch (error) {
            console.warn(`  ⚠️ Erreur lors de la récupération des documents pour "${folder.originalName}": ${error.message}`);
            return { folder, matchResult, driveDocuments: [], error: error.message };
          }
        })
      );
      
      // Traiter les résultats du batch
      for (const { folder, matchResult, driveDocuments, error } of batchResults) {
        const matchInfo = {
          folderName: folder.originalName,
          interventionId: folder.interventionId,
          factureNumber: folder.factureNumber,
          folderId: folder.folderId,
          monthFolder: folder.monthFolder,
          documentCount: folder.documentCount || 0,
          matchType: matchResult.matchType,
          reason: matchResult.reason,
          intervention: matchResult.intervention ? {
            id: matchResult.intervention.id,
            id_inter: matchResult.intervention.id_inter,
            date: matchResult.intervention.date,
            adresse: matchResult.intervention.adresse,
            ville: matchResult.intervention.ville,
            code_postal: matchResult.intervention.code_postal,
            statut_id: matchResult.intervention.statut_id
          } : null,
          documents: null,
          documentsInsertion: null
        };

        if (error) {
          // En cas d'erreur, ajouter quand même le matchInfo mais sans documents
          matches.push(matchInfo);
          stats[matchResult.matchType]++;
          continue;
        }

        if (driveDocuments.length > 0) {
          // Préparer les documents (tous avec kind = "a_classe")
          const preparedDocuments = prepareDocumentsForInsertion(driveDocuments);
          matchInfo.documents = preparedDocuments.map(d => ({
            id: d.id,
            name: d.name,
            kind: d.kind,
            mimeType: d.mimeType,
            size: d.size,
            driveUrl: d.driveUrl
          }));

          // Insérer les documents en base seulement si pas en mode skipInsert
          if (!skipInsert) {
            const interventionId = matchResult.intervention.id;
            const insertionResults = await insertInterventionDocuments(
              interventionId,
              preparedDocuments,
              drive,
              dryRun
            );
            
            matchInfo.documentsInsertion = {
              total: insertionResults.total,
              inserted: insertionResults.inserted,
              errors: insertionResults.errors
            };
          } else {
            // En mode skipInsert, juste marquer le nombre de documents trouvés
            matchInfo.documentsInsertion = {
              total: preparedDocuments.length,
              inserted: 0,
              errors: 0
            };
          }
        }

        matches.push(matchInfo);
        stats[matchResult.matchType]++;
      }
      
      if ((i + DOC_BATCH_SIZE) % 25 === 0 || i + DOC_BATCH_SIZE >= foldersToProcess.length) {
        const processed = Math.min(i + DOC_BATCH_SIZE, foldersToProcess.length);
        console.log(`  Documents récupérés: ${processed}/${foldersToProcess.length} dossiers...`);
      }
    }

    // Ajouter les matchs qui n'ont pas pu être traités (pas de folderId ou pas de drive)
    const processedFolderIds = new Set(foldersToProcess.map(r => r.folder.folderId));
    matchResults.forEach(({ folder, matchResult }) => {
      if (matchResult.intervention && !processedFolderIds.has(folder.folderId)) {
        // Match trouvé mais pas de documents à récupérer (pas de folderId ou pas de drive)
        matches.push({
          folderName: folder.originalName,
          interventionId: folder.interventionId,
          factureNumber: folder.factureNumber,
          folderId: folder.folderId,
          monthFolder: folder.monthFolder,
          documentCount: folder.documentCount || 0,
          matchType: matchResult.matchType,
          reason: matchResult.reason,
          intervention: {
            id: matchResult.intervention.id,
            id_inter: matchResult.intervention.id_inter,
            date: matchResult.intervention.date,
            adresse: matchResult.intervention.adresse,
            ville: matchResult.intervention.ville,
            code_postal: matchResult.intervention.code_postal,
            statut_id: matchResult.intervention.statut_id
          },
          documents: null,
          documentsInsertion: null
        });
        stats[matchResult.matchType]++;
      } else if (!matchResult.intervention) {
        // Non-matchés
        unmatched.push({
          folderName: folder.originalName,
          interventionId: folder.interventionId,
          factureNumber: folder.factureNumber,
          folderId: folder.folderId,
          monthFolder: folder.monthFolder,
          documentCount: folder.documentCount || 0,
          matchType: matchResult.matchType,
          reason: matchResult.reason,
          intervention: null,
          documents: null,
          documentsInsertion: null
        });
        stats.none++;
      }
    });

    // 4. Calculer les statistiques d'insertion
    const insertionStats = {
      totalDocuments: 0,
      insertedDocuments: 0,
      errorDocuments: 0,
      interventionsWithDocuments: 0
    };

    matches.forEach(match => {
      if (match.documentsInsertion) {
        insertionStats.totalDocuments += match.documentsInsertion.total;
        insertionStats.insertedDocuments += match.documentsInsertion.inserted;
        insertionStats.errorDocuments += match.documentsInsertion.errors;
        if (match.documentsInsertion.inserted > 0) {
          insertionStats.interventionsWithDocuments++;
        }
      }
    });

    // 5. Afficher les statistiques
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('📊 STATISTIQUES DE MATCHING');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log(`Total dossiers traités: ${stats.total}`);
    console.log(`Matchs exacts: ${stats.exact} (${((stats.exact / stats.total) * 100).toFixed(2)}%)`);
    console.log(`Non matchés: ${stats.none} (${((stats.none / stats.total) * 100).toFixed(2)}%)\n`);

    if (!skipInsert && !dryRun) {
      console.log('═══════════════════════════════════════════════════════════');
      console.log('📊 STATISTIQUES D\'INSERTION DES DOCUMENTS');
      console.log('═══════════════════════════════════════════════════════════\n');
      console.log(`Interventions avec documents: ${insertionStats.interventionsWithDocuments}`);
      console.log(`Total documents traités: ${insertionStats.totalDocuments}`);
      console.log(`Documents insérés: ${insertionStats.insertedDocuments} (${insertionStats.totalDocuments > 0 ? ((insertionStats.insertedDocuments / insertionStats.totalDocuments) * 100).toFixed(2) : 0}%)`);
      console.log(`Erreurs d'insertion: ${insertionStats.errorDocuments} (${insertionStats.totalDocuments > 0 ? ((insertionStats.errorDocuments / insertionStats.totalDocuments) * 100).toFixed(2) : 0}%)\n`);
    } else if (dryRun) {
      console.log('═══════════════════════════════════════════════════════════');
      console.log('📊 STATISTIQUES D\'INSERTION (DRY RUN)');
      console.log('═══════════════════════════════════════════════════════════\n');
      console.log(`Total documents qui seraient insérés: ${insertionStats.totalDocuments}\n`);
    }

    // 5. Afficher quelques exemples de non matchés
    if (unmatched.length > 0) {
      console.log(`⚠️  Premiers 10 dossiers non matchés:`);
      unmatched.slice(0, 10).forEach((m, i) => {
        console.log(`  ${i + 1}. "${m.folderName}" (ID: ${m.interventionId || 'N/A'})`);
        console.log(`     Raison: ${m.reason}`);
      });
      if (unmatched.length > 10) {
        console.log(`  ... et ${unmatched.length - 10} autres`);
      }
      console.log('');
    }

    // 6. Sauvegarder les résultats
    const outputDir = path.join(__dirname, '../../../data/docs_imports/');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const resultsData = {
      generatedAt: new Date().toISOString(),
      firstMonthOnly: firstMonthOnly,
      monthsProcessed: monthsToProcess.map(m => m.monthFolder),
      stats: stats,
      matches: matches,
      unmatched: unmatched
    };

    const resultsPath = path.join(outputDir, 'intervention-folder-matches.json');
    fs.writeFileSync(resultsPath, JSON.stringify(resultsData, null, 2));
    console.log(`💾 Résultats sauvegardés dans: ${resultsPath}`);

    // CSV pour analyse
    const csvPath = path.join(outputDir, 'intervention-folder-matches.csv');
    const csvHeader = 'Dossier,ID intervention,ID facture (id_inter),Mois,Match type,Intervention ID,Date intervention,Adresse,Ville,Code postal\n';
    const csvRows = [...matches, ...unmatched].map(m => {
      const intervention = m.intervention;
      return `"${m.folderName}",${m.interventionId || ''},"${m.factureNumber || ''}","${m.monthFolder}","${m.matchType}",${intervention?.id || ''},"${intervention?.date || ''}","${intervention?.adresse || ''}","${intervention?.ville || ''}","${intervention?.code_postal || ''}"`;
    }).join('\n');
    fs.writeFileSync(csvPath, csvHeader + csvRows);
    console.log(`💾 CSV sauvegardé dans: ${csvPath}\n`);

    console.log('✅ Matching terminé avec succès !\n');

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
  findMatchingIntervention,
  getAllInterventions
};

