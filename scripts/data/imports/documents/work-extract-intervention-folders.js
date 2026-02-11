/**
 * Script d'extraction des dossiers d'interventions depuis Google Drive
 * 
 * Ce script liste tous les dossiers d'interventions dans "Interventions 2025 GMBS"
 * et extrait les IDs d'interventions depuis les noms de dossiers
 * 
 * Structure attendue:
 * Interventions 2025 GMBS/
 *   9-SEPTEMBRE 2025/
 *     INTER 1831 ID 11778/
 *     INTER 3319 FACTURE 1858/
 *   10-OCTOBRE 2025/
 *     ...
 */

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

// Charger les variables d'environnement depuis .env.local
require('dotenv').config({ path: '.env.local' });

const { googleDriveConfig } = require('../config/google-drive-config');

// Recharger la configuration après le chargement de dotenv
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
 * Formats supportés:
 * - "INTER 1831 ID 11778" → ID = 11778
 * - "INTER 3319 FACTURE 1858" → ID = 3319 (le premier nombre après INTER)
 * - "INTE 1234 ID 5678" → ID = 5678 (si ID présent) ou 1234
 * - "INTER 1234" → ID = 1234
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
 * Fonction principale
 */
async function main() {
  console.log('📁 Extraction des dossiers d\'interventions depuis Google Drive...\n');

  // Vérifier la configuration
  if (!googleDriveConfig.isValid()) {
    console.error('❌ Configuration Google Drive invalide');
    googleDriveConfig.displayConfig();
    process.exit(1);
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

  // Créer l'authentification JWT
  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ['https://www.googleapis.com/auth/drive.readonly']
  });

  const drive = google.drive({ version: 'v3', auth });
  console.log('✅ Authentification Google Drive initialisée\n');

  try {
    // 1. Trouver le dossier racine (GMBS)
    console.log('🔍 Recherche du dossier racine (GMBS)...');
    const rootFolderId = googleDriveConfig.getRootFolderId();
    const rootFolder = await findRootFolder(drive, rootFolderId);

    if (!rootFolder) {
      console.error('❌ Dossier racine (GMBS) non trouvé dans Google Drive');
      console.log('\n💡 Suggestions:');
      console.log('   - Vérifiez que le dossier GMBS existe dans Google Drive');
      console.log('   - Vérifiez que le Service Account a accès au dossier');
      console.log('   - Spécifiez GOOGLE_DRIVE_ROOT_FOLDER_ID dans .env.local');
      process.exit(1);
    }

    console.log(`✅ Dossier racine trouvé: ${rootFolder.name} (ID: ${rootFolder.id})\n`);

    // 2. Trouver le dossier "Interventions 2025 GMBS" dans le dossier racine
    console.log('🔍 Recherche du dossier "Interventions 2025 GMBS"...');
    const interventionsFolder = await findInterventionsFolder(drive, rootFolder.id);

    if (!interventionsFolder) {
      console.error('❌ Dossier "Interventions 2025 GMBS" non trouvé dans le dossier racine');
      console.log('\n💡 Suggestions:');
      console.log('   - Vérifiez que le dossier "Interventions 2025 GMBS" existe dans GMBS');
      console.log('   - Vérifiez que le Service Account a accès au dossier');
      process.exit(1);
    }

    console.log(`✅ Dossier trouvé: ${interventionsFolder.name} (ID: ${interventionsFolder.id})\n`);

    // 3. Lister les dossiers de mois (9-SEPTEMBRE 2025, 10-OCTOBRE 2025, etc.)
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

      // Compter les documents dans chaque dossier INTER
      console.log(`   📊 Analyse de ${parsedFolders.length} dossier(s) INTER...`);
      for (let j = 0; j < parsedFolders.length; j++) {
        const folder = parsedFolders[j];
        const documents = await countDocumentsInFolder(drive, folder.folderId);
        folder.documentCount = documents.length;
        
        if ((j + 1) % 10 === 0) {
          console.log(`     Traité ${j + 1}/${parsedFolders.length} dossiers...`);
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

    // 4. Statistiques globales
    console.log('📊 Statistiques globales:');
    console.log(`   Total dossiers INTER: ${allInterventionFolders.length}`);
    console.log(`   Dossiers avec ID extrait: ${allInterventionFolders.filter(f => f.hasId).length}`);
    console.log(`   Dossiers sans ID: ${allInterventionFolders.filter(f => !f.hasId).length}`);
    console.log(`   Total documents: ${allInterventionFolders.reduce((sum, f) => sum + (f.documentCount || 0), 0)}`);
    
    // Afficher quelques exemples de dossiers sans ID pour debug
    const foldersWithoutId = allInterventionFolders.filter(f => !f.hasId);
    if (foldersWithoutId.length > 0) {
      console.log(`\n⚠️  Exemples de dossiers sans ID extrait:`);
      foldersWithoutId.slice(0, 5).forEach(f => {
        console.log(`   - "${f.originalName}"`);
      });
      if (foldersWithoutId.length > 5) {
        console.log(`   ... et ${foldersWithoutId.length - 5} autres`);
      }
    }
    console.log('');

    // 5. Sauvegarder les données
    const outputDir = path.join(__dirname, '../../../data/docs_imports/');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const exportData = {
      extractedAt: new Date().toISOString(),
      rootFolder: {
        id: rootFolder.id,
        name: rootFolder.name
      },
      interventionsFolder: {
        id: interventionsFolder.id,
        name: interventionsFolder.name
      },
      totalMonths: monthData.length,
      totalInterFolders: allInterventionFolders.length,
      foldersWithId: allInterventionFolders.filter(f => f.hasId).length,
      foldersWithoutId: allInterventionFolders.filter(f => !f.hasId).length,
      months: monthData,
      allFolders: allInterventionFolders
    };

    // JSON complet
    const jsonPath = path.join(outputDir, 'interventions-folders.json');
    fs.writeFileSync(jsonPath, JSON.stringify(exportData, null, 2));
    console.log(`💾 Données complètes sauvegardées dans: ${jsonPath}`);

    // CSV simplifié
    const csvPath = path.join(outputDir, 'interventions-folders.csv');
    const csvHeader = 'Mois,Nom dossier,ID intervention,Numéro facture,Nombre documents,Format,Folder ID\n';
    const csvRows = allInterventionFolders.map(f => 
      `"${f.monthFolder}","${f.originalName}",${f.interventionId || ''},"${f.factureNumber || ''}",${f.documentCount || 0},"${f.format}","${f.folderId}"`
    ).join('\n');
    fs.writeFileSync(csvPath, csvHeader + csvRows);
    console.log(`💾 CSV sauvegardé dans: ${csvPath}`);

    // Liste simple des IDs extraits
    const idsPath = path.join(outputDir, 'interventions-ids.txt');
    const idsList = allInterventionFolders
      .filter(f => f.interventionId)
      .map(f => f.interventionId)
      .sort((a, b) => a - b)
      .join('\n');
    fs.writeFileSync(idsPath, idsList);
    console.log(`💾 Liste des IDs sauvegardée dans: ${idsPath}`);

    console.log('\n✅ Extraction terminée avec succès !\n');

  } catch (error) {
    console.error('❌ Erreur lors de l\'extraction:', error);
    process.exit(1);
  }
}

// Exécuter si appelé directement
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  findInterventionsFolder,
  listFolders,
  countDocumentsInFolder,
  parseInterventionId,
  parseInterventionFolder,
  normalizeName
};

