/**
 * Script principal d'import de documents depuis Google Drive
 * 
 * Importe les documents depuis Google Drive pour les artisans
 * Structure attendue: artisans/nom_artisan/doc1.pdf
 */

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const { googleDriveConfig } = require('./config/google-drive-config');
const { supabaseAdmin } = require('../../lib/supabase-client');
const { classifyDocument, getDocumentTypeLabel } = require('./documents/document-classifier');
const { findArtisansFolder, listArtisanFolders, countDocumentsInFolder, normalizeName } = require('./analyze-drive-structure');

// Configuration
const DRY_RUN = process.argv.includes('--dry-run');
const SKIP_EXISTING = process.argv.includes('--skip-existing');
const LIMIT_ARTISANS = process.argv.includes('--limit') 
  ? parseInt(process.argv[process.argv.indexOf('--limit') + 1]) 
  : null;

/**
 * Obtient l'URL de l'API Supabase Functions
 */
function getSupabaseFunctionsUrl() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
  let sanitized = rawUrl.replace(/\/$/, '').replace(/127\.0\.0\.1/g, 'localhost');
  
  if (sanitized.endsWith('/rest/v1')) {
    return sanitized.replace(/\/rest\/v1$/, '/functions/v1');
  }
  
  return `${sanitized}/functions/v1`;
}

/**
 * Télécharge un fichier depuis Google Drive
 */
async function downloadFile(drive, fileId) {
  try {
    const response = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'arraybuffer' }
    );
    return Buffer.from(response.data);
  } catch (error) {
    throw new Error(`Erreur lors du téléchargement du fichier ${fileId}: ${error.message}`);
  }
}

/**
 * Convertit un buffer en base64
 */
function bufferToBase64(buffer, mimeType) {
  const base64 = buffer.toString('base64');
  return `data:${mimeType};base64,${base64}`;
}

/**
 * Upload un document vers Supabase via l'API documents
 */
async function uploadDocumentToSupabase(documentData) {
  const functionsUrl = getSupabaseFunctionsUrl();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!anonKey && !serviceRoleKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY ou SUPABASE_SERVICE_ROLE_KEY requis');
  }

  const headers = {
    'apikey': serviceRoleKey || anonKey,
    'Authorization': `Bearer ${serviceRoleKey || anonKey}`,
    'Content-Type': 'application/json',
  };

  const response = await fetch(`${functionsUrl}/documents/documents/upload`, {
    method: 'POST',
    headers,
    body: JSON.stringify(documentData),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }

  return response.json();
}

/**
 * Vérifie si un document existe déjà pour un artisan
 */
async function documentExists(artisanId, kind, filename) {
  const { data, error } = await supabaseAdmin
    .from('artisan_attachments')
    .select('id')
    .eq('artisan_id', artisanId)
    .eq('kind', kind)
    .eq('filename', filename)
    .limit(1);

  if (error) {
    console.warn(`⚠️  Erreur lors de la vérification des doublons: ${error.message}`);
    return false;
  }

  return data && data.length > 0;
}

/**
 * Récupère tous les artisans de la base de données
 */
async function getArtisansFromDB() {
  const { data, error } = await supabaseAdmin
    .from('artisans')
    .select('id, nom, prenom, plain_nom, email')
    .order('plain_nom');

  if (error) {
    throw error;
  }

  return data || [];
}

/**
 * Trouve l'artisan correspondant à un nom de dossier
 */
function findMatchingArtisan(folderName, artisans) {
  const normalizedFolderName = normalizeName(folderName);
  
  // Recherche exacte
  let match = artisans.find(a => normalizeName(a.plain_nom) === normalizedFolderName);
  if (match) return { artisan: match, matchType: 'exact' };

  // Recherche partielle
  match = artisans.find(a => {
    const normalizedPlainNom = normalizeName(a.plain_nom);
    return normalizedFolderName.includes(normalizedPlainNom) || 
           normalizedPlainNom.includes(normalizedFolderName);
  });
  if (match) return { artisan: match, matchType: 'partial' };

  return { artisan: null, matchType: 'none' };
}

/**
 * Traite un document pour un artisan
 */
async function processDocument(drive, artisan, document, stats) {
  try {
    // Classifier le document
    const documentKind = classifyDocument(document.name);
    
    // Si le type est "autre", on ne le remplit pas (selon les spécifications)
    if (documentKind === 'autre') {
      stats.skippedOther++;
      return { success: false, reason: 'Type "autre" non importé' };
    }

    // Vérifier les doublons si option activée
    if (SKIP_EXISTING) {
      const exists = await documentExists(artisan.id, documentKind, document.name);
      if (exists) {
        stats.skippedDuplicates++;
        return { success: false, reason: 'Document déjà existant' };
      }
    }

    if (DRY_RUN) {
      stats.dryRunProcessed++;
      return { success: true, dryRun: true };
    }

    // Télécharger le fichier depuis Google Drive
    const fileBuffer = await downloadFile(drive, document.id);
    const base64Content = bufferToBase64(fileBuffer, document.mimeType);

    // Préparer les données pour l'upload
    const uploadData = {
      entity_id: artisan.id,
      entity_type: 'artisan',
      kind: documentKind,
      filename: document.name,
      mime_type: document.mimeType,
      file_size: fileBuffer.length,
      content: base64Content
    };

    // Upload vers Supabase
    const result = await uploadDocumentToSupabase(uploadData);

    stats.imported++;
    return { success: true, data: result };

  } catch (error) {
    stats.errors++;
    return { success: false, error: error.message };
  }
}

/**
 * Traite tous les documents d'un artisan
 */
async function processArtisanDocuments(drive, artisan, documents, stats) {
  const results = [];

  for (const document of documents) {
    const result = await processDocument(drive, artisan, document, stats);
    results.push({
      documentName: document.name,
      documentId: document.id,
      ...result
    });

    // Petit délai pour éviter de surcharger l'API
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return results;
}

/**
 * Fonction principale
 */
async function main() {
  console.log('🚀 Import de documents depuis Google Drive\n');

  if (DRY_RUN) {
    console.log('⚠️  MODE DRY-RUN: Aucun document ne sera importé\n');
  }

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

  // Statistiques
  const stats = {
    totalFolders: 0,
    matchedFolders: 0,
    unmatchedFolders: 0,
    totalDocuments: 0,
    imported: 0,
    skippedOther: 0,
    skippedDuplicates: 0,
    errors: 0,
    dryRunProcessed: 0
  };

  const report = {
    matched: [],
    unmatched: [],
    errors: []
  };

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
    
    if (LIMIT_ARTISANS) {
      console.log(`⚠️  Limite de ${LIMIT_ARTISANS} artisans appliquée`);
      folders.splice(LIMIT_ARTISANS);
    }
    
    stats.totalFolders = folders.length;
    console.log(`✅ ${folders.length} dossiers trouvés\n`);

    // 3. Récupérer les artisans de la base de données
    console.log('🗄️  Récupération des artisans depuis la base de données...');
    const artisans = await getArtisansFromDB();
    console.log(`✅ ${artisans.length} artisans trouvés en base de données\n`);

    // 4. Traiter chaque dossier
    console.log('🔄 Traitement des dossiers et import des documents...\n');

    for (let i = 0; i < folders.length; i++) {
      const folder = folders[i];
      const documents = await countDocumentsInFolder(drive, folder.id);
      
      stats.totalDocuments += documents.length;

      const match = findMatchingArtisan(folder.name, artisans);

      if (!match.artisan) {
        stats.unmatchedFolders++;
        report.unmatched.push({
          folderName: folder.name,
          documentCount: documents.length
        });
        console.log(`⚠️  [${i + 1}/${folders.length}] ${folder.name}: Artisan non trouvé (${documents.length} document(s))`);
        continue;
      }

      stats.matchedFolders++;
      const artisan = match.artisan;

      console.log(`📁 [${i + 1}/${folders.length}] ${folder.name} → ${artisan.plain_nom || `${artisan.prenom || ''} ${artisan.nom || ''}`.trim()} (${documents.length} document(s))`);

      if (documents.length === 0) {
        console.log(`   ℹ️  Aucun document à traiter\n`);
        continue;
      }

      // Traiter les documents
      const results = await processArtisanDocuments(drive, artisan, documents, stats);

      // Compter les résultats
      const successCount = results.filter(r => r.success).length;
      const errorCount = results.filter(r => !r.success).length;

      console.log(`   ✅ ${successCount} document(s) traité(s)`);
      if (errorCount > 0) {
        console.log(`   ❌ ${errorCount} erreur(s)`);
      }
      console.log('');

      // Ajouter au rapport
      report.matched.push({
        folderName: folder.name,
        artisanId: artisan.id,
        artisanName: artisan.plain_nom || `${artisan.prenom || ''} ${artisan.nom || ''}`.trim(),
        documentCount: documents.length,
        successCount,
        errorCount,
        results: results.filter(r => !r.success && r.error)
      });

      // Délai entre les dossiers pour éviter de surcharger
      if (i < folders.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    // 5. Afficher le rapport final
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('📊 RAPPORT D\'IMPORT');
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log('📈 Statistiques:');
    console.log(`  • Total dossiers: ${stats.totalFolders}`);
    console.log(`  • Dossiers matchés: ${stats.matchedFolders}`);
    console.log(`  • Dossiers non matchés: ${stats.unmatchedFolders}`);
    console.log(`  • Total documents trouvés: ${stats.totalDocuments}`);
    
    if (DRY_RUN) {
      console.log(`  • Documents traités (dry-run): ${stats.dryRunProcessed}`);
    } else {
      console.log(`  • Documents importés: ${stats.imported}`);
      console.log(`  • Documents ignorés (type "autre"): ${stats.skippedOther}`);
      if (SKIP_EXISTING) {
        console.log(`  • Documents ignorés (doublons): ${stats.skippedDuplicates}`);
      }
    }
    
    console.log(`  • Erreurs: ${stats.errors}\n`);

    if (report.unmatched.length > 0) {
      console.log('⚠️  Dossiers non matchés (premiers 10):');
      report.unmatched.slice(0, 10).forEach(f => {
        console.log(`  • ${f.folderName} (${f.documentCount} document(s))`);
      });
      if (report.unmatched.length > 10) {
        console.log(`  ... et ${report.unmatched.length - 10} autres`);
      }
      console.log('');
    }

    // 6. Sauvegarder le rapport
    const reportPath = path.join(__dirname, '../../drive-import-report.json');
    fs.writeFileSync(reportPath, JSON.stringify({
      stats,
      report,
      timestamp: new Date().toISOString(),
      dryRun: DRY_RUN
    }, null, 2));
    console.log(`💾 Rapport sauvegardé dans: ${reportPath}`);

    console.log('\n✅ Import terminé avec succès!');

  } catch (error) {
    console.error('❌ Erreur lors de l\'import:', error);
    process.exit(1);
  }
}

// Exécuter si appelé directement
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  processDocument,
  processArtisanDocuments,
  downloadFile,
  uploadDocumentToSupabase
};

