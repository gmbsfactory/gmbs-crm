/**
 * Script d'analyse préliminaire de la structure Google Drive
 * 
 * Analyse la structure du dossier artisans/ dans Google Drive et compare
 * avec les artisans en base de données pour générer un rapport de matching
 */

const { google } = require('googleapis');
const { googleDriveConfig } = require('./config/google-drive-config');
const { supabaseAdmin } = require('../../lib/supabase-client');

/**
 * Normalise un nom pour la comparaison (comme dans la DB)
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
 * Récupère tous les artisans de la base de données
 */
async function getArtisansFromDB() {
  try {
    const { data, error } = await supabaseAdmin
      .from('artisans')
      .select('id, nom, prenom, plain_nom, email')
      .order('plain_nom');

    if (error) {
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('❌ Erreur lors de la récupération des artisans:', error.message);
    throw error;
  }
}

/**
 * Trouve l'artisan correspondant à un nom de dossier
 */
function findMatchingArtisan(folderName, artisans) {
  const normalizedFolderName = normalizeName(folderName);
  
  // Recherche exacte
  let match = artisans.find(a => normalizeName(a.plain_nom) === normalizedFolderName);
  if (match) return { artisan: match, matchType: 'exact' };

  // Recherche partielle (le nom du dossier contient le plain_nom ou vice versa)
  match = artisans.find(a => {
    const normalizedPlainNom = normalizeName(a.plain_nom);
    return normalizedFolderName.includes(normalizedPlainNom) || 
           normalizedPlainNom.includes(normalizedFolderName);
  });
  if (match) return { artisan: match, matchType: 'partial' };

  return { artisan: null, matchType: 'none' };
}

/**
 * Génère un rapport d'analyse
 */
function generateReport(results) {
  const report = {
    summary: {
      totalFolders: results.folders.length,
      matchedFolders: results.folders.filter(f => f.match).length,
      unmatchedFolders: results.folders.filter(f => !f.match).length,
      totalDocuments: results.folders.reduce((sum, f) => sum + f.documentCount, 0),
      documentsInMatchedFolders: results.folders
        .filter(f => f.match)
        .reduce((sum, f) => sum + f.documentCount, 0)
    },
    matchedFolders: results.folders.filter(f => f.match).map(f => ({
      folderName: f.folderName,
      artisanId: f.artisanId,
      artisanName: f.artisanName,
      documentCount: f.documentCount,
      matchType: f.matchType
    })),
    unmatchedFolders: results.folders.filter(f => !f.match).map(f => ({
      folderName: f.folderName,
      documentCount: f.documentCount
    })),
    documentsByType: results.documentsByType
  };

  return report;
}

/**
 * Fonction principale
 */
async function main() {
  console.log('🔍 Analyse de la structure Google Drive...\n');

  // Vérifier la configuration
  if (!googleDriveConfig.isValid()) {
    console.error('❌ Configuration Google Drive invalide');
    googleDriveConfig.displayConfig();
    process.exit(1);
  }

  // Initialiser Google Drive API
  const auth = new google.auth.GoogleAuth({
    credentials: googleDriveConfig.getCredentials(),
    scopes: ['https://www.googleapis.com/auth/drive.readonly']
  });

  const drive = google.drive({ version: 'v3', auth });

  try {
    // 1. Trouver le dossier artisans
    console.log('📁 Recherche du dossier artisans...');
    const rootFolderId = googleDriveConfig.getRootFolderId();
    const artisansFolder = await findArtisansFolder(drive, rootFolderId);

    if (!artisansFolder) {
      console.error('❌ Dossier "artisans" non trouvé dans Google Drive');
      process.exit(1);
    }

    console.log(`✅ Dossier artisans trouvé: ${artisansFolder.name} (ID: ${artisansFolder.id})\n`);

    // 2. Lister tous les dossiers artisans
    console.log('📂 Liste des dossiers artisans...');
    const folders = await listArtisanFolders(drive, artisansFolder.id);
    console.log(`✅ ${folders.length} dossiers trouvés\n`);

    // 3. Récupérer les artisans de la base de données
    console.log('🗄️  Récupération des artisans depuis la base de données...');
    const artisans = await getArtisansFromDB();
    console.log(`✅ ${artisans.length} artisans trouvés en base de données\n`);

    // 4. Analyser chaque dossier
    console.log('🔍 Analyse des dossiers et comptage des documents...');
    const results = {
      folders: [],
      documentsByType: {}
    };

    for (let i = 0; i < folders.length; i++) {
      const folder = folders[i];
      const documents = await countDocumentsInFolder(drive, folder.id);
      
      const match = findMatchingArtisan(folder.name, artisans);
      
      results.folders.push({
        folderName: folder.name,
        folderId: folder.id,
        documentCount: documents.length,
        match: match.artisan !== null,
        artisanId: match.artisan?.id || null,
        artisanName: match.artisan ? `${match.artisan.prenom || ''} ${match.artisan.nom || ''}`.trim() : null,
        matchType: match.matchType,
        documents: documents.map(d => ({
          name: d.name,
          mimeType: d.mimeType,
          size: d.size
        }))
      });

      // Compter les documents par type MIME
      documents.forEach(doc => {
        const mimeType = doc.mimeType || 'unknown';
        results.documentsByType[mimeType] = (results.documentsByType[mimeType] || 0) + 1;
      });

      if ((i + 1) % 10 === 0) {
        console.log(`  Traité ${i + 1}/${folders.length} dossiers...`);
      }
    }

    console.log(`✅ Analyse terminée\n`);

    // 5. Générer le rapport
    const report = generateReport(results);

    // 6. Afficher le rapport
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 RAPPORT D\'ANALYSE');
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log('📈 Résumé:');
    console.log(`  • Total dossiers trouvés: ${report.summary.totalFolders}`);
    console.log(`  • Dossiers matchés: ${report.summary.matchedFolders} (${Math.round(report.summary.matchedFolders / report.summary.totalFolders * 100)}%)`);
    console.log(`  • Dossiers non matchés: ${report.summary.unmatchedFolders} (${Math.round(report.summary.unmatchedFolders / report.summary.totalFolders * 100)}%)`);
    console.log(`  • Total documents: ${report.summary.totalDocuments}`);
    console.log(`  • Documents dans dossiers matchés: ${report.summary.documentsInMatchedFolders}\n`);

    if (report.unmatchedFolders.length > 0) {
      console.log('⚠️  Dossiers non matchés (premiers 20):');
      report.unmatchedFolders.slice(0, 20).forEach(f => {
        console.log(`  • ${f.folderName} (${f.documentCount} document(s))`);
      });
      if (report.unmatchedFolders.length > 20) {
        console.log(`  ... et ${report.unmatchedFolders.length - 20} autres`);
      }
      console.log('');
    }

    console.log('📄 Types de documents trouvés:');
    Object.entries(report.documentsByType)
      .sort((a, b) => b[1] - a[1])
      .forEach(([mimeType, count]) => {
        console.log(`  • ${mimeType}: ${count}`);
      });
    console.log('');

    // 7. Sauvegarder le rapport dans un fichier JSON
    const fs = require('fs');
    const path = require('path');
    const reportPath = path.join(__dirname, '../../drive-analysis-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`💾 Rapport sauvegardé dans: ${reportPath}`);

    console.log('\n✅ Analyse terminée avec succès!');

  } catch (error) {
    console.error('❌ Erreur lors de l\'analyse:', error);
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
  findMatchingArtisan,
  normalizeName
};

