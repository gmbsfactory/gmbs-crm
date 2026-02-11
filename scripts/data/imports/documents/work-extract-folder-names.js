/**
 * Script de travail - Extraction des noms de dossiers depuis Google Drive
 * 
 * Ce script liste tous les noms de dossiers dans le dossier "artisans"
 * et les sauvegarde dans un fichier pour analyse
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
 * Trouve le dossier racine "artisans" dans Google Drive
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
    const query = rootFolderId 
      ? `'${rootFolderId}' in parents and name='artisans' and mimeType='application/vnd.google-apps.folder' and trashed=false`
      : `name='artisans' and mimeType='application/vnd.google-apps.folder' and trashed=false and 'root' in parents`;

    const response = await drive.files.list({
      q: query,
      fields: 'files(id, name, mimeType)',
      pageSize: 1
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
 * Liste tous les sous-dossiers dans le dossier artisans
 */
async function listArtisanFolders(drive, artisansFolderId) {
  try {
    const folders = [];
    let nextPageToken = null;

    do {
      const query = `'${artisansFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
      
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
    console.error('❌ Erreur lors de la liste des dossiers artisans:', error.message);
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
 * Fonction principale
 */
async function main() {
  console.log('📁 Extraction des noms de dossiers depuis Google Drive...\n');

  // Vérifier la configuration
  if (!googleDriveConfig.isValid()) {
    console.error('❌ Configuration Google Drive invalide');
    googleDriveConfig.displayConfig();
    process.exit(1);
  }

  // Initialiser Google Drive API avec la même méthode que google-sheets-import-clean-v2.js
  console.log('🔐 Initialisation de l\'authentification Google Drive...');
  
  const credentials = googleDriveConfig.getCredentials();
  
  if (!credentials || !credentials.client_email || !credentials.private_key) {
    console.error('\n❌ Configuration Google Drive incomplète.');
    console.error('   Vérifiez que les variables d\'environnement sont correctement définies dans .env.local');
    console.error('   Variables requises:');
    console.error('     - GOOGLE_CREDENTIALS_PATH (chemin vers credentials.json)');
    console.error('     - OU GOOGLE_SHEETS_CLIENT_EMAIL et GOOGLE_SHEETS_PRIVATE_KEY');
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
  
  console.log('✅ Authentification Google Drive initialisée');

  try {
    // 1. Trouver le dossier artisans
    console.log('🔍 Recherche du dossier artisans...');
    const rootFolderId = googleDriveConfig.getRootFolderId();
    const artisansFolder = await findArtisansFolder(drive, rootFolderId);

    if (!artisansFolder) {
      console.error('❌ Dossier "artisans" non trouvé dans Google Drive');
      console.log('\n💡 Suggestions:');
      console.log('   - Vérifiez que le dossier "artisans" existe dans Google Drive');
      console.log('   - Vérifiez que le Service Account a accès au dossier');
      console.log('   - Spécifiez GOOGLE_DRIVE_ROOT_FOLDER_ID dans .env.local si le dossier a un nom différent');
      process.exit(1);
    }

    console.log(`✅ Dossier racine trouvé: ${artisansFolder.name} (ID: ${artisansFolder.id})\n`);

    // 2. Lister tous les dossiers dans le dossier racine
    console.log('📂 Liste des dossiers dans le dossier racine...');
    const rootFolders = await listArtisanFolders(drive, artisansFolder.id);
    console.log(`✅ ${rootFolders.length} dossiers trouvés\n`);

    // 3. Chercher le dossier "Artisans" dans les résultats
    console.log('🔍 Recherche du dossier "Artisans"...');
    const artisansSubFolder = rootFolders.find(f => 
      normalizeName(f.name) === 'artisans' || f.name === 'Artisans'
    );

    let artisansSubFolders = [];
    let artisansSubFolderData = [];

    if (artisansSubFolder) {
      console.log(`✅ Dossier "Artisans" trouvé: ${artisansSubFolder.name} (ID: ${artisansSubFolder.id})\n`);
      
      // 4. Lister les sous-dossiers dans "Artisans"
      console.log('📂 Liste des sous-dossiers dans "Artisans"...');
      artisansSubFolders = await listArtisanFolders(drive, artisansSubFolder.id);
      console.log(`✅ ${artisansSubFolders.length} sous-dossiers trouvés dans "Artisans"\n`);

      // 5. Extraire les informations pour chaque sous-dossier d'Artisans
      console.log('📊 Extraction des informations des sous-dossiers d\'Artisans...');
      
      for (let i = 0; i < artisansSubFolders.length; i++) {
        const folder = artisansSubFolders[i];
        const documents = await countDocumentsInFolder(drive, folder.id);

        artisansSubFolderData.push({
          name: folder.name,
          normalizedName: normalizeName(folder.name),
          folderId: folder.id,
          documentCount: documents.length,
          createdTime: folder.createdTime,
          modifiedTime: folder.modifiedTime,
          documents: documents.map(d => ({
            name: d.name,
            mimeType: d.mimeType,
            size: d.size
          }))
        });

        if ((i + 1) % 10 === 0) {
          console.log(`  Traité ${i + 1}/${artisansSubFolders.length} sous-dossiers...`);
        }
      }
      
      console.log(`✅ Extraction des sous-dossiers d'Artisans terminée\n`);
    } else {
      console.log('⚠️  Dossier "Artisans" non trouvé dans les sous-dossiers du dossier racine\n');
    }

    // 6. Extraire les informations pour chaque dossier du niveau racine
    console.log('📊 Extraction des informations des dossiers du niveau racine...');
    const folderData = [];

    for (let i = 0; i < rootFolders.length; i++) {
      const folder = rootFolders[i];
      const documents = await countDocumentsInFolder(drive, folder.id);

      folderData.push({
        name: folder.name,
        normalizedName: normalizeName(folder.name),
        folderId: folder.id,
        documentCount: documents.length,
        createdTime: folder.createdTime,
        modifiedTime: folder.modifiedTime,
        documents: documents.map(d => ({
          name: d.name,
          mimeType: d.mimeType,
          size: d.size
        }))
      });

      if ((i + 1) % 10 === 0) {
        console.log(`  Traité ${i + 1}/${rootFolders.length} dossiers...`);
      }
    }

    console.log(`✅ Extraction terminée\n`);

    // 7. Préparer les données pour export
    const exportData = {
      extractedAt: new Date().toISOString(),
      rootFolder: {
        id: artisansFolder.id,
        name: artisansFolder.name
      },
      totalFolders: rootFolders.length,
      folders: folderData.map(f => ({
        name: f.name,
        normalizedName: f.normalizedName,
        documentCount: f.documentCount,
        createdTime: f.createdTime,
        modifiedTime: f.modifiedTime
      })),
      foldersWithDetails: folderData,
      artisansSubFolder: artisansSubFolder ? {
        id: artisansSubFolder.id,
        name: artisansSubFolder.name,
        totalSubFolders: artisansSubFolders.length,
        subFolders: artisansSubFolderData.map(f => ({
          name: f.name,
          normalizedName: f.normalizedName,
          documentCount: f.documentCount,
          createdTime: f.createdTime,
          modifiedTime: f.modifiedTime
        })),
        subFoldersWithDetails: artisansSubFolderData
      } : null
    };

    // 8. Sauvegarder dans différents formats
    const outputDir = path.join(__dirname, '../../../data/docs_imports/');
    
    // S'assurer que le dossier existe
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // JSON complet
    const jsonPath = path.join(outputDir, 'drive-folder-names.json');
    fs.writeFileSync(jsonPath, JSON.stringify(exportData, null, 2));
    console.log(`💾 Données complètes sauvegardées dans: ${jsonPath}`);

    // Liste simple des noms du niveau racine (un par ligne)
    const txtPath = path.join(outputDir, 'drive-folder-names.txt');
    const namesList = folderData.map(f => f.name).join('\n');
    fs.writeFileSync(txtPath, namesList);
    console.log(`💾 Liste des noms du niveau racine sauvegardée dans: ${txtPath}`);

    // CSV simple du niveau racine
    const csvPath = path.join(outputDir, 'drive-folder-names.csv');
    const csvHeader = 'Nom,Nom normalisé,Nombre de documents,Date création,Date modification\n';
    const csvRows = folderData.map(f => 
      `"${f.name}","${f.normalizedName}",${f.documentCount},"${f.createdTime}","${f.modifiedTime}"`
    ).join('\n');
    fs.writeFileSync(csvPath, csvHeader + csvRows);
    console.log(`💾 CSV du niveau racine sauvegardé dans: ${csvPath}`);

    // Si on a trouvé le dossier Artisans, sauvegarder aussi ses sous-dossiers
    if (artisansSubFolder && artisansSubFolderData.length > 0) {
      // JSON des sous-dossiers d'Artisans
      const artisansJsonPath = path.join(outputDir, 'artisans-subfolders.json');
      const artisansExportData = {
        extractedAt: new Date().toISOString(),
        artisansFolder: {
          id: artisansSubFolder.id,
          name: artisansSubFolder.name
        },
        totalSubFolders: artisansSubFolders.length,
        subFolders: artisansSubFolderData.map(f => ({
          name: f.name,
          normalizedName: f.normalizedName,
          documentCount: f.documentCount,
          createdTime: f.createdTime,
          modifiedTime: f.modifiedTime
        })),
        subFoldersWithDetails: artisansSubFolderData
      };
      fs.writeFileSync(artisansJsonPath, JSON.stringify(artisansExportData, null, 2));
      console.log(`💾 Sous-dossiers d'Artisans sauvegardés dans: ${artisansJsonPath}`);

      // Liste simple des noms des sous-dossiers d'Artisans
      const artisansTxtPath = path.join(outputDir, 'artisans-subfolders.txt');
      const artisansNamesList = artisansSubFolderData.map(f => f.name).join('\n');
      fs.writeFileSync(artisansTxtPath, artisansNamesList);
      console.log(`💾 Liste des sous-dossiers d'Artisans sauvegardée dans: ${artisansTxtPath}`);

      // CSV des sous-dossiers d'Artisans
      const artisansCsvPath = path.join(outputDir, 'artisans-subfolders.csv');
      const artisansCsvHeader = 'Nom,Nom normalisé,Nombre de documents,Date création,Date modification\n';
      const artisansCsvRows = artisansSubFolderData.map(f => 
        `"${f.name}","${f.normalizedName}",${f.documentCount},"${f.createdTime}","${f.modifiedTime}"`
      ).join('\n');
      fs.writeFileSync(artisansCsvPath, artisansCsvHeader + artisansCsvRows);
      console.log(`💾 CSV des sous-dossiers d'Artisans sauvegardé dans: ${artisansCsvPath}`);
    }

    // 9. Afficher un résumé
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('📊 RÉSUMÉ');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log(`📁 Dossier racine: ${artisansFolder.name}`);
    console.log(`Total dossiers au niveau racine: ${rootFolders.length}`);
    console.log(`Total documents au niveau racine: ${folderData.reduce((sum, f) => sum + f.documentCount, 0)}`);
    
    if (artisansSubFolder) {
      console.log(`\n📂 Dossier "Artisans": ${artisansSubFolder.name}`);
      console.log(`Total sous-dossiers dans "Artisans": ${artisansSubFolders.length}`);
      console.log(`Total documents dans les sous-dossiers d'Artisans: ${artisansSubFolderData.reduce((sum, f) => sum + f.documentCount, 0)}`);
      
      console.log(`\nPremiers 10 sous-dossiers d'Artisans:`);
      artisansSubFolderData.slice(0, 10).forEach((f, i) => {
        console.log(`  ${i + 1}. ${f.name} (${f.documentCount} document(s))`);
      });
      if (artisansSubFolders.length > 10) {
        console.log(`  ... et ${artisansSubFolders.length - 10} autres`);
      }
    }
    
    console.log(`\nPremiers 10 dossiers du niveau racine:`);
    folderData.slice(0, 10).forEach((f, i) => {
      console.log(`  ${i + 1}. ${f.name} (${f.documentCount} document(s))`);
    });
    if (rootFolders.length > 10) {
      console.log(`  ... et ${rootFolders.length - 10} autres`);
    }

    console.log('\n✅ Extraction terminée avec succès!');
    console.log(`\n📝 Fichiers générés:`);
    console.log(`   - ${jsonPath}`);
    console.log(`   - ${txtPath}`);
    console.log(`   - ${csvPath}`);
    if (artisansSubFolder && artisansSubFolderData.length > 0) {
      console.log(`   - ${path.join(outputDir, 'artisans-subfolders.json')}`);
      console.log(`   - ${path.join(outputDir, 'artisans-subfolders.txt')}`);
      console.log(`   - ${path.join(outputDir, 'artisans-subfolders.csv')}`);
    }

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
  findArtisansFolder,
  listArtisanFolders,
  countDocumentsInFolder,
  normalizeName
};

