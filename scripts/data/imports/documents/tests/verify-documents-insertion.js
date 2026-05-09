/**
 * Script de vérification des documents insérés en base de données
 * 
 * Ce script vérifie que les documents ont bien été insérés dans la table artisan_attachments
 * et affiche des statistiques détaillées
 */

const fs = require('fs');
const path = require('path');

// Charger les variables d'environnement depuis .env.local
require('dotenv').config({ path: '.env.local' });

// Utiliser l'API v2 centralisée
let documentsApi, artisansApi;
try {
  const apiV2 = require('../../../../src/lib/api');
  documentsApi = apiV2.documentsApi;
  artisansApi = apiV2.artisansApi;
} catch (error) {
  console.error('❌ Erreur lors du chargement de l\'API v2:', error.message);
  console.error('   Assurez-vous d\'utiliser tsx pour exécuter ce script');
  process.exit(1);
}

/**
 * Vérifie les documents d'un artisan spécifique
 */
async function verifyArtisanDocuments(artisanId, artisanName) {
  try {
    const result = await documentsApi.getByArtisan(artisanId);
    
    if (result.data && result.data.length > 0) {
      console.log(`\n✅ ${artisanName} (${artisanId.substring(0, 8)}...)`);
      console.log(`   📄 ${result.data.length} document(s) trouvé(s)`);
      
      // Grouper par kind
      const byKind = {};
      result.data.forEach(doc => {
        byKind[doc.kind] = (byKind[doc.kind] || 0) + 1;
      });
      
      Object.entries(byKind).forEach(([kind, count]) => {
        console.log(`      - ${kind}: ${count}`);
      });
      
      // Afficher quelques exemples
      console.log(`\n   Exemples de documents:`);
      result.data.slice(0, 3).forEach(doc => {
        console.log(`      • ${doc.filename || 'Sans nom'} (${doc.kind})`);
        console.log(`        URL: ${doc.url.substring(0, 60)}...`);
      });
      
      return result.data;
    } else {
      console.log(`\n⚠️  ${artisanName} (${artisanId.substring(0, 8)}...)`);
      console.log(`   Aucun document trouvé`);
      return [];
    }
  } catch (error) {
    console.error(`❌ Erreur pour ${artisanName}:`, error.message);
    return [];
  }
}

/**
 * Vérifie les documents depuis le fichier de matches
 */
async function verifyFromMatchesFile() {
  const matchesPath = path.join(__dirname, '../../../data/docs_imports/folder-artisan-matches.json');
  
  if (!fs.existsSync(matchesPath)) {
    console.error(`❌ Fichier non trouvé: ${matchesPath}`);
    console.error('   Exécutez d\'abord le script de matching');
    process.exit(1);
  }

  console.log('📖 Lecture du fichier de matches...\n');
  const matchesData = JSON.parse(fs.readFileSync(matchesPath, 'utf8'));
  const matches = matchesData.matches || [];

  console.log(`✅ ${matches.length} match(s) chargé(s)\n`);

  // Filtrer les matches avec des documents
  const matchesWithDocs = matches.filter(m => 
    m.artisan && 
    m.documents && 
    m.documents.length > 0 &&
    m.insertResults &&
    m.insertResults.inserted > 0
  );

  console.log(`📊 ${matchesWithDocs.length} artisan(s) avec documents insérés\n`);

  // Statistiques globales
  const stats = {
    totalArtisans: matchesWithDocs.length,
    totalDocuments: 0,
    byKind: {},
    errors: 0,
    verified: 0
  };

  // Vérifier les 10 premiers artisans (ou tous si --all)
  const args = process.argv.slice(2);
  const verifyAll = args.includes('--all') || args.includes('-a');
  const limit = verifyAll ? matchesWithDocs.length : Math.min(10, matchesWithDocs.length);

  console.log(`🔍 Vérification des documents pour ${limit} artisan(s)...\n`);

  for (let i = 0; i < limit; i++) {
    const match = matchesWithDocs[i];
    const artisanId = match.artisan.id;
    const artisanName = match.artisan.plain_nom || `${match.artisan.prenom} ${match.artisan.nom}`;

    const documents = await verifyArtisanDocuments(artisanId, artisanName);

    if (documents.length > 0) {
      stats.verified++;
      stats.totalDocuments += documents.length;
      
      documents.forEach(doc => {
        stats.byKind[doc.kind] = (stats.byKind[doc.kind] || 0) + 1;
      });
    }

    // Petit délai pour éviter de surcharger l'API
    if (i < limit - 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  // Afficher les statistiques
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('📊 STATISTIQUES DE VÉRIFICATION');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log(`Artisans vérifiés: ${stats.verified}/${limit}`);
  console.log(`Total documents trouvés: ${stats.totalDocuments}`);
  console.log(`\nRépartition par kind:`);
  Object.entries(stats.byKind)
    .sort((a, b) => b[1] - a[1])
    .forEach(([kind, count]) => {
      console.log(`  - ${kind}: ${count}`);
    });

  if (!verifyAll && matchesWithDocs.length > limit) {
    console.log(`\n💡 Pour vérifier tous les artisans, utilisez: --all`);
  }
}

/**
 * Fonction principale
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: npm run drive:verify-documents [options]

Options:
  --all, -a        Vérifier tous les artisans (par défaut: 10 premiers)
  --help, -h       Afficher cette aide

Exemples:
  npm run drive:verify-documents           # Vérifie les 10 premiers artisans
  npm run drive:verify-documents --all     # Vérifie tous les artisans
`);
    process.exit(0);
  }

  console.log('🔍 Vérification des documents insérés en base de données...\n');
  
  try {
    await verifyFromMatchesFile();
  } catch (error) {
    console.error('❌ Erreur lors de la vérification:', error);
    process.exit(1);
  }
}

// Exécuter si appelé directement
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  verifyArtisanDocuments,
  verifyFromMatchesFile
};

