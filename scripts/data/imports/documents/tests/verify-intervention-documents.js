/**
 * Script de vérification des documents d'interventions insérés depuis Google Drive
 * 
 * Ce script lit les résultats de matching depuis intervention-folder-matches.json
 * et vérifie que les documents ont bien été insérés en base de données
 */

const fs = require('fs');
const path = require('path');

// Charger les variables d'environnement depuis .env.local
require('dotenv').config({ path: '.env.local' });

// Utiliser l'API v2 centralisée
let documentsApi;
try {
  const apiV2 = require('../../../../src/lib/api');
  documentsApi = apiV2.documentsApi;
} catch (error) {
  console.error('❌ Erreur lors du chargement de l\'API v2:', error.message);
  console.error('   Assurez-vous d\'utiliser tsx pour exécuter ce script');
  process.exit(1);
}

/**
 * Fonction principale
 */
async function main() {
  const args = process.argv.slice(2);
  const showAll = args.includes('--all') || args.includes('-a');

  console.log('🔍 Vérification des documents d\'interventions insérés depuis Google Drive...\n');

  try {
    // 1. Charger les résultats de matching
    const jsonPath = path.join(__dirname, '../../../data/docs_imports/intervention-folder-matches.json');
    
    if (!fs.existsSync(jsonPath)) {
      console.error(`❌ Fichier non trouvé: ${jsonPath}`);
      console.error('   Exécutez d\'abord match-folders-to-interventions.js pour générer ce fichier');
      process.exit(1);
    }

    console.log(`📖 Lecture de ${jsonPath}...`);
    const matchData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    
    const matches = matchData.matches || [];
    const matchesWithDocuments = matches.filter(m => m.documents && m.documents.length > 0);
    
    console.log(`✅ ${matches.length} intervention(s) matchée(s)`);
    console.log(`   ${matchesWithDocuments.length} avec documents à vérifier\n`);

    if (matchesWithDocuments.length === 0) {
      console.log('ℹ️  Aucun document à vérifier\n');
      return;
    }

    // 2. Vérifier chaque intervention
    console.log('🔍 Vérification des documents en base de données...\n');
    
    const stats = {
      totalInterventions: matchesWithDocuments.length,
      interventionsWithAllDocuments: 0,
      interventionsWithPartialDocuments: 0,
      interventionsWithNoDocuments: 0,
      totalDocumentsExpected: 0,
      totalDocumentsFound: 0,
      totalDocumentsMissing: 0
    };

    const results = [];

    for (let i = 0; i < matchesWithDocuments.length; i++) {
      const match = matchesWithDocuments[i];
      const interventionId = match.intervention?.id;
      
      if (!interventionId) {
        console.warn(`⚠️  Intervention sans ID pour "${match.folderName}"`);
        continue;
      }

      const expectedDocuments = match.documents || [];
      stats.totalDocumentsExpected += expectedDocuments.length;

      // Récupérer les documents depuis la base de données
      let dbDocuments = [];
      try {
        const result = await documentsApi.getByIntervention(interventionId, { limit: 1000 });
        dbDocuments = result.data || [];
      } catch (error) {
        console.error(`❌ Erreur lors de la récupération des documents pour "${match.folderName}":`, error.message);
        continue;
      }

      stats.totalDocumentsFound += dbDocuments.length;

      // Comparer les documents attendus avec ceux trouvés
      const foundFilenames = new Set(dbDocuments.map(d => d.filename));
      const expectedFilenames = expectedDocuments.map(d => d.name);
      const missingDocuments = expectedFilenames.filter(name => !foundFilenames.has(name));

      stats.totalDocumentsMissing += missingDocuments.length;

      const resultItem = {
        interventionId: interventionId,
        folderName: match.folderName,
        idInter: match.intervention?.id_inter,
        expectedCount: expectedDocuments.length,
        foundCount: dbDocuments.length,
        missingCount: missingDocuments.length,
        missingDocuments: missingDocuments,
        allFound: missingDocuments.length === 0
      };

      results.push(resultItem);

      if (resultItem.allFound) {
        stats.interventionsWithAllDocuments++;
      } else if (resultItem.foundCount > 0) {
        stats.interventionsWithPartialDocuments++;
      } else {
        stats.interventionsWithNoDocuments++;
      }

      // Afficher la progression
      if ((i + 1) % 50 === 0 || (i + 1) === matchesWithDocuments.length) {
        console.log(`  Vérifié ${i + 1}/${matchesWithDocuments.length} interventions...`);
      }
    }

    // 3. Afficher les statistiques
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('📊 STATISTIQUES DE VÉRIFICATION');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log(`Interventions vérifiées: ${stats.totalInterventions}`);
    console.log(`Interventions avec tous les documents: ${stats.interventionsWithAllDocuments} (${((stats.interventionsWithAllDocuments / stats.totalInterventions) * 100).toFixed(2)}%)`);
    console.log(`Interventions avec documents partiels: ${stats.interventionsWithPartialDocuments} (${((stats.interventionsWithPartialDocuments / stats.totalInterventions) * 100).toFixed(2)}%)`);
    console.log(`Interventions sans documents: ${stats.interventionsWithNoDocuments} (${((stats.interventionsWithNoDocuments / stats.totalInterventions) * 100).toFixed(2)}%)\n`);
    console.log(`Documents attendus: ${stats.totalDocumentsExpected}`);
    console.log(`Documents trouvés: ${stats.totalDocumentsFound} (${((stats.totalDocumentsFound / stats.totalDocumentsExpected) * 100).toFixed(2)}%)`);
    console.log(`Documents manquants: ${stats.totalDocumentsMissing} (${((stats.totalDocumentsMissing / stats.totalDocumentsExpected) * 100).toFixed(2)}%)\n`);

    // 4. Afficher les interventions avec des problèmes
    const interventionsWithProblems = results.filter(r => !r.allFound);
    
    if (interventionsWithProblems.length > 0) {
      console.log('⚠️  Interventions avec des documents manquants:\n');
      
      const toShow = showAll ? interventionsWithProblems : interventionsWithProblems.slice(0, 20);
      
      toShow.forEach((item, idx) => {
        console.log(`  ${idx + 1}. "${item.folderName}" (ID INTER: ${item.idInter || 'N/A'})`);
        console.log(`     Documents attendus: ${item.expectedCount}, trouvés: ${item.foundCount}, manquants: ${item.missingCount}`);
        if (item.missingDocuments.length > 0 && item.missingDocuments.length <= 5) {
          console.log(`     Manquants: ${item.missingDocuments.join(', ')}`);
        } else if (item.missingDocuments.length > 5) {
          console.log(`     Manquants: ${item.missingDocuments.slice(0, 3).join(', ')} ... et ${item.missingDocuments.length - 3} autres`);
        }
        console.log('');
      });

      if (!showAll && interventionsWithProblems.length > 20) {
        console.log(`  ... et ${interventionsWithProblems.length - 20} autres interventions avec problèmes`);
        console.log(`  Utilisez --all pour voir toutes les interventions\n`);
      }
    } else {
      console.log('✅ Tous les documents ont été insérés avec succès !\n');
    }

    // 5. Afficher quelques exemples d'interventions complètes
    const completeInterventions = results.filter(r => r.allFound).slice(0, 5);
    if (completeInterventions.length > 0) {
      console.log('✅ Exemples d\'interventions complètes:\n');
      completeInterventions.forEach((item, idx) => {
        console.log(`  ${idx + 1}. "${item.folderName}" (ID INTER: ${item.idInter || 'N/A'})`);
        console.log(`     ${item.foundCount} document(s) trouvé(s)\n`);
      });
    }

    // 6. Sauvegarder les résultats détaillés
    const outputDir = path.join(__dirname, '../../../data/docs_imports/');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const verificationResults = {
      verifiedAt: new Date().toISOString(),
      stats: stats,
      results: results,
      interventionsWithProblems: interventionsWithProblems.map(r => ({
        interventionId: r.interventionId,
        folderName: r.folderName,
        idInter: r.idInter,
        expectedCount: r.expectedCount,
        foundCount: r.foundCount,
        missingCount: r.missingCount,
        missingDocuments: r.missingDocuments
      }))
    };

    const resultsPath = path.join(outputDir, 'intervention-documents-verification.json');
    fs.writeFileSync(resultsPath, JSON.stringify(verificationResults, null, 2));
    console.log(`💾 Résultats détaillés sauvegardés dans: ${resultsPath}\n`);

    console.log('✅ Vérification terminée !\n');

  } catch (error) {
    console.error('❌ Erreur lors de la vérification:', error);
    process.exit(1);
  }
}

// Exécuter si appelé directement
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };

