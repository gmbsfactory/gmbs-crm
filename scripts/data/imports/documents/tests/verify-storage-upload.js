/**
 * Script de vérification complète des documents uploadés dans Supabase Storage
 * 
 * Ce script vérifie :
 * 1. Que les documents sont bien en base de données
 * 2. Que les URLs pointent vers Supabase Storage (pas Google Drive)
 * 3. Que les fichiers sont accessibles via HTTP
 * 4. Que les fichiers existent réellement dans Storage
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// Charger les variables d'environnement depuis .env.local
require('dotenv').config({ path: '.env.local' });

// Utiliser l'API v2 centralisée
let documentsApi;
let supabaseClient;
try {
  const apiV2 = require('../../../../src/lib/api/v2');
  documentsApi = apiV2.documentsApi;
  
  // Créer un client Supabase pour vérifier Storage
  const { createClient } = require('@supabase/supabase-js');
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (supabaseUrl && serviceRoleKey) {
    supabaseClient = createClient(supabaseUrl, serviceRoleKey);
  }
} catch (error) {
  console.error('❌ Erreur lors du chargement de l\'API v2:', error.message);
  console.error('   Assurez-vous d\'utiliser tsx pour exécuter ce script');
  process.exit(1);
}

/**
 * Teste l'accessibilité d'une URL via HTTP HEAD
 */
function testUrlAccessibility(url) {
  return new Promise((resolve) => {
    const client = url.startsWith('https') ? https : http;
    const timeout = 5000; // 5 secondes
    
    const req = client.get(url, { timeout }, (res) => {
      resolve({
        accessible: res.statusCode === 200,
        statusCode: res.statusCode,
        contentType: res.headers['content-type'],
        contentLength: res.headers['content-length']
      });
      res.destroy();
    });
    
    req.on('error', (error) => {
      resolve({
        accessible: false,
        error: error.message
      });
    });
    
    req.on('timeout', () => {
      req.destroy();
      resolve({
        accessible: false,
        error: 'Timeout'
      });
    });
  });
}

/**
 * Vérifie qu'un fichier existe dans Supabase Storage
 */
async function checkFileInStorage(storagePath) {
  if (!supabaseClient) {
    return { exists: null, error: 'Client Supabase non initialisé' };
  }
  
  try {
    const { data, error } = await supabaseClient.storage
      .from('documents')
      .list(storagePath.split('/').slice(0, -1).join('/'), {
        limit: 1000,
        search: storagePath.split('/').pop()
      });
    
    if (error) {
      return { exists: false, error: error.message };
    }
    
    const fileName = storagePath.split('/').pop();
    const fileExists = data && data.some(file => file.name === fileName);
    
    return { exists: fileExists, size: fileExists ? data.find(f => f.name === fileName)?.metadata?.size : null };
  } catch (error) {
    return { exists: false, error: error.message };
  }
}

/**
 * Extrait le chemin Storage depuis une URL Supabase
 */
function extractStoragePath(url) {
  // Format: http://127.0.0.1:54321/storage/v1/object/public/documents/intervention/{id}/...
  const match = url.match(/\/storage\/v1\/object\/public\/documents\/(.+)$/);
  return match ? match[1] : null;
}

/**
 * Vérifie les documents d'une entité (artisan ou intervention)
 */
async function verifyEntityDocuments(entityType, entityId, limit = 100) {
  console.log(`\n🔍 Vérification des documents pour ${entityType} ${entityId}...`);
  
  let dbDocuments = [];
  try {
    if (entityType === 'artisan') {
      const result = await documentsApi.getByArtisan(entityId, { limit });
      dbDocuments = result.data || [];
    } else {
      const result = await documentsApi.getByIntervention(entityId, { limit });
      dbDocuments = result.data || [];
    }
  } catch (error) {
    console.error(`❌ Erreur lors de la récupération: ${error.message}`);
    return null;
  }
  
  if (dbDocuments.length === 0) {
    console.log(`   ℹ️  Aucun document trouvé`);
    return {
      total: 0,
      inStorage: 0,
      accessible: 0,
      googleDrive: 0,
      errors: []
    };
  }
  
  console.log(`   📄 ${dbDocuments.length} document(s) trouvé(s) en base`);
  
  const stats = {
    total: dbDocuments.length,
    inStorage: 0,
    accessible: 0,
    googleDrive: 0,
    errors: []
  };
  
  // Vérifier chaque document
  for (let i = 0; i < dbDocuments.length; i++) {
    const doc = dbDocuments[i];
    
    // Vérifier si l'URL pointe vers Google Drive ou Supabase Storage
    if (doc.url && doc.url.includes('drive.google.com')) {
      stats.googleDrive++;
      stats.errors.push({
        filename: doc.filename,
        issue: 'URL Google Drive (pas dans Storage)',
        url: doc.url
      });
      continue;
    }
    
    // Vérifier si l'URL pointe vers Supabase Storage
    if (doc.url && (doc.url.includes('/storage/v1/object/public/documents/') || doc.url.includes('supabase'))) {
      stats.inStorage++;
      
      // Tester l'accessibilité
      const urlTest = await testUrlAccessibility(doc.url);
      if (urlTest.accessible) {
        stats.accessible++;
      } else {
        stats.errors.push({
          filename: doc.filename,
          issue: `URL non accessible (${urlTest.statusCode || urlTest.error})`,
          url: doc.url
        });
      }
      
      // Vérifier dans Storage si possible
      const storagePath = extractStoragePath(doc.url);
      if (storagePath && supabaseClient) {
        const storageCheck = await checkFileInStorage(storagePath);
        if (!storageCheck.exists && storageCheck.exists !== null) {
          stats.errors.push({
            filename: doc.filename,
            issue: `Fichier non trouvé dans Storage`,
            url: doc.url,
            storagePath: storagePath
          });
        }
      }
    } else {
      stats.errors.push({
        filename: doc.filename,
        issue: 'URL non reconnue (ni Google Drive ni Supabase Storage)',
        url: doc.url
      });
    }
    
    // Afficher la progression tous les 10 documents
    if ((i + 1) % 10 === 0) {
      process.stdout.write(`   Vérifié ${i + 1}/${dbDocuments.length} documents...\r`);
    }
  }
  
  console.log(`   ✅ ${stats.accessible}/${stats.total} document(s) accessible(s)`);
  if (stats.googleDrive > 0) {
    console.log(`   ⚠️  ${stats.googleDrive} document(s) avec URL Google Drive`);
  }
  if (stats.errors.length > 0 && stats.errors.length <= 5) {
    console.log(`   ⚠️  ${stats.errors.length} problème(s) détecté(s)`);
  }
  
  return stats;
}

/**
 * Fonction principale
 */
async function main() {
  const args = process.argv.slice(2);
  const entityType = args.find(arg => arg === '--artisan' || arg === '--intervention')?.replace('--', '') || null;
  const entityId = args.find(arg => arg.startsWith('--id='))?.split('=')[1] || null;
  const sampleSize = parseInt(args.find(arg => arg.startsWith('--sample='))?.split('=')[1] || '10');
  
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔍 VÉRIFICATION DES DOCUMENTS DANS SUPABASE STORAGE');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  if (!supabaseClient) {
    console.warn('⚠️  Client Supabase non initialisé - certaines vérifications seront limitées');
    console.warn('   Vérifiez que NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont définis\n');
  }
  
  try {
    // Si un ID spécifique est fourni, vérifier uniquement cet entité
    if (entityId && entityType) {
      const stats = await verifyEntityDocuments(entityType, entityId);
      
      if (stats && stats.errors.length > 0) {
        console.log('\n⚠️  Problèmes détectés:');
        stats.errors.slice(0, 10).forEach((error, idx) => {
          console.log(`   ${idx + 1}. ${error.filename}: ${error.issue}`);
        });
        if (stats.errors.length > 10) {
          console.log(`   ... et ${stats.errors.length - 10} autres problèmes`);
        }
      }
      
      return;
    }
    
    // Sinon, vérifier un échantillon de documents récents
    console.log(`📊 Analyse d'un échantillon de ${sampleSize} documents récents...\n`);
    
    let recentDocuments = [];
    try {
      const result = await documentsApi.getAll({ limit: sampleSize * 2 });
      recentDocuments = (result.data || []).slice(0, sampleSize);
    } catch (error) {
      console.error(`❌ Erreur lors de la récupération des documents: ${error.message}`);
      process.exit(1);
    }
    
    if (recentDocuments.length === 0) {
      console.log('ℹ️  Aucun document trouvé en base de données\n');
      return;
    }
    
    console.log(`✅ ${recentDocuments.length} document(s) récent(s) trouvé(s)\n`);
    
    const globalStats = {
      total: recentDocuments.length,
      inStorage: 0,
      accessible: 0,
      googleDrive: 0,
      errors: []
    };
    
    // Vérifier chaque document
    for (let i = 0; i < recentDocuments.length; i++) {
      const doc = recentDocuments[i];
      
      console.log(`\n📄 Document ${i + 1}/${recentDocuments.length}: ${doc.filename || 'Sans nom'}`);
      console.log(`   Type: ${doc.kind || 'N/A'}`);
      console.log(`   URL: ${doc.url ? doc.url.substring(0, 80) + '...' : 'N/A'}`);
      
      // Vérifier si l'URL pointe vers Google Drive
      if (doc.url && doc.url.includes('drive.google.com')) {
        globalStats.googleDrive++;
        console.log(`   ⚠️  URL Google Drive (pas dans Storage)`);
        continue;
      }
      
      // Vérifier si l'URL pointe vers Supabase Storage
      if (doc.url && (doc.url.includes('/storage/v1/object/public/documents/') || doc.url.includes('supabase'))) {
        globalStats.inStorage++;
        console.log(`   ✅ URL Supabase Storage`);
        
        // Tester l'accessibilité
        const urlTest = await testUrlAccessibility(doc.url);
        if (urlTest.accessible) {
          globalStats.accessible++;
          console.log(`   ✅ Fichier accessible (${urlTest.statusCode}, ${urlTest.contentLength ? (parseInt(urlTest.contentLength) / 1024).toFixed(2) + ' KB' : 'taille inconnue'})`);
        } else {
          console.log(`   ❌ Fichier non accessible: ${urlTest.statusCode || urlTest.error}`);
          globalStats.errors.push({
            filename: doc.filename,
            issue: `Non accessible: ${urlTest.statusCode || urlTest.error}`,
            url: doc.url
          });
        }
        
        // Vérifier dans Storage si possible
        const storagePath = extractStoragePath(doc.url);
        if (storagePath && supabaseClient) {
          const storageCheck = await checkFileInStorage(storagePath);
          if (storageCheck.exists) {
            console.log(`   ✅ Fichier présent dans Storage`);
          } else if (storageCheck.exists === false) {
            console.log(`   ⚠️  Fichier non trouvé dans Storage`);
            globalStats.errors.push({
              filename: doc.filename,
              issue: 'Non trouvé dans Storage',
              url: doc.url,
              storagePath: storagePath
            });
          }
        }
      } else {
        console.log(`   ⚠️  URL non reconnue`);
        globalStats.errors.push({
          filename: doc.filename,
          issue: 'URL non reconnue',
          url: doc.url
        });
      }
    }
    
    // Afficher les statistiques globales
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('📊 STATISTIQUES GLOBALES');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log(`Total de documents vérifiés: ${globalStats.total}`);
    console.log(`Documents dans Supabase Storage: ${globalStats.inStorage} (${((globalStats.inStorage / globalStats.total) * 100).toFixed(1)}%)`);
    console.log(`Documents accessibles: ${globalStats.accessible} (${((globalStats.accessible / globalStats.total) * 100).toFixed(1)}%)`);
    console.log(`Documents avec URL Google Drive: ${globalStats.googleDrive} (${((globalStats.googleDrive / globalStats.total) * 100).toFixed(1)}%)`);
    console.log(`Problèmes détectés: ${globalStats.errors.length} (${((globalStats.errors.length / globalStats.total) * 100).toFixed(1)}%)\n`);
    
    if (globalStats.errors.length > 0) {
      console.log('⚠️  Problèmes détectés:\n');
      globalStats.errors.slice(0, 10).forEach((error, idx) => {
        console.log(`   ${idx + 1}. ${error.filename || 'Sans nom'}: ${error.issue}`);
      });
      if (globalStats.errors.length > 10) {
        console.log(`   ... et ${globalStats.errors.length - 10} autres problèmes`);
      }
      console.log('');
    }
    
    // Recommandations
    if (globalStats.googleDrive > 0) {
      console.log('💡 Recommandation:');
      console.log('   Certains documents ont encore des URLs Google Drive.');
      console.log('   Relancez l\'import pour télécharger ces fichiers dans Supabase Storage.\n');
    }
    
    if (globalStats.accessible < globalStats.inStorage) {
      console.log('💡 Recommandation:');
      console.log('   Certains fichiers dans Storage ne sont pas accessibles.');
      console.log('   Vérifiez la configuration du bucket "documents" (doit être public).\n');
    }
    
    console.log('✅ Vérification terminée !\n');
    
  } catch (error) {
    console.error('❌ Erreur lors de la vérification:', error);
    process.exit(1);
  }
}

// Afficher l'aide
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
Usage: npx tsx scripts/imports/documents/verify-storage-upload.js [options]

Options:
  --artisan --id=<id>     Vérifier les documents d'un artisan spécifique
  --intervention --id=<id> Vérifier les documents d'une intervention spécifique
  --sample=<n>            Nombre de documents récents à vérifier (défaut: 10)
  --help, -h               Afficher cette aide

Exemples:
  # Vérifier 10 documents récents
  npx tsx scripts/imports/documents/verify-storage-upload.js

  # Vérifier 50 documents récents
  npx tsx scripts/imports/documents/verify-storage-upload.js --sample=50

  # Vérifier les documents d'une intervention spécifique
  npx tsx scripts/imports/documents/verify-storage-upload.js --intervention --id=<intervention_id>

  # Vérifier les documents d'un artisan spécifique
  npx tsx scripts/imports/documents/verify-storage-upload.js --artisan --id=<artisan_id>
`);
  process.exit(0);
}

// Exécuter si appelé directement
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main, verifyEntityDocuments, testUrlAccessibility };

