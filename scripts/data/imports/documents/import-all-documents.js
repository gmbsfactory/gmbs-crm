/**
 * Script unifié pour l'import de tous les documents (artisans + interventions)
 * 
 * Ce script exécute séquentiellement :
 * 1. L'import des documents d'artisans
 * 2. L'import des documents d'interventions
 * 
 * Permet d'importer tous les documents en une seule commande
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Exécute un script npm et retourne une promesse
 */
function runNpmScript(scriptName, args = []) {
  return new Promise((resolve, reject) => {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🚀 Exécution: npm run ${scriptName} ${args.join(' ')}`);
    console.log(`${'='.repeat(60)}\n`);

    const npmProcess = spawn('npm', ['run', scriptName, ...args], {
      stdio: 'inherit',
      shell: true,
      cwd: path.join(__dirname, '../../../')
    });

    npmProcess.on('close', (code) => {
      if (code === 0) {
        console.log(`\n✅ ${scriptName} terminé avec succès\n`);
        resolve(code);
      } else {
        console.error(`\n❌ ${scriptName} terminé avec le code d'erreur ${code}\n`);
        reject(new Error(`Script ${scriptName} a échoué avec le code ${code}`));
      }
    });

    npmProcess.on('error', (error) => {
      console.error(`❌ Erreur lors de l'exécution de ${scriptName}:`, error.message);
      reject(error);
    });
  });
}

/**
 * Vérifie si les fichiers de résultats existent et retourne les chemins
 */
function checkExistingFiles() {
  const dataDir = path.join(__dirname, '../../../data/docs_imports');
  
  // Créer le répertoire s'il n'existe pas
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  const artisanMatchesPath = path.join(dataDir, 'folder-artisan-matches.json');
  const interventionMatchesPath = path.join(dataDir, 'intervention-folder-matches.json');
  const artisanSubfoldersPath = path.join(dataDir, 'artisans-subfolders.json');
  const interventionFoldersPath = path.join(dataDir, 'interventions-folders.json');
  
  return {
    dataDir,
    artisanMatches: fs.existsSync(artisanMatchesPath) ? artisanMatchesPath : null,
    interventionMatches: fs.existsSync(interventionMatchesPath) ? interventionMatchesPath : null,
    artisanSubfolders: fs.existsSync(artisanSubfoldersPath) ? artisanSubfoldersPath : null,
    interventionFolders: fs.existsSync(interventionFoldersPath) ? interventionFoldersPath : null,
  };
}

/**
 * Fonction principale
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: npm run drive:import-all-documents [options]

Ce script exécute séquentiellement l'import des documents d'artisans et d'interventions.

Le script détecte automatiquement les fichiers de résultats existants pour optimiser les itérations suivantes.

Options:
  --force-extraction     Forcer l'extraction même si les fichiers existent
  --first-month-only     Traiter uniquement le premier mois pour les interventions (développement)
  --dry-run, -d         Mode simulation (aucune insertion en base)
  --skip-insert, -s     Faire le matching sans insérer les documents
  --artisans-only       Importer uniquement les documents d'artisans
  --interventions-only  Importer uniquement les documents d'interventions
  --help, -h            Afficher cette aide

Exemples:
  npm run drive:import-all-documents                    # Import complet (détection auto des fichiers)
  npm run drive:import-all-documents --dry-run          # Simulation complète
  npm run drive:import-all-documents --force-extraction # Forcer la réextraction complète
  npm run drive:import-all-documents --artisans-only    # Import uniquement des artisans
  npm run drive:import-all-documents --interventions-only # Import uniquement des interventions
`);
    process.exit(0);
  }

  const artisansOnly = args.includes('--artisans-only');
  const interventionsOnly = args.includes('--interventions-only');
  const forceExtraction = args.includes('--force-extraction');
  const firstMonthOnly = args.includes('--first-month-only');
  const dryRun = args.includes('--dry-run') || args.includes('-d');
  const skipInsert = args.includes('--skip-insert') || args.includes('-s');
  
  // Vérifier les fichiers existants
  const existingFiles = checkExistingFiles();
  
  // Détecter automatiquement si on peut utiliser les fichiers existants (flags séparés pour chaque type)
  let useInsertOnlyArtisans = false;
  let useInsertOnlyInterventions = false;
  
  if (!forceExtraction) {
    // Pour les artisans : vérifier si on a les matches complets
    if (!interventionsOnly && existingFiles.artisanMatches) {
      console.log('📋 Fichier de matching artisans trouvé:', existingFiles.artisanMatches);
      console.log('   → Utilisation du mode INSERT ONLY (plus rapide)\n');
      useInsertOnlyArtisans = true;
    } else if (!interventionsOnly && existingFiles.artisanSubfolders) {
      console.log('📋 Fichier d\'extraction artisans trouvé:', existingFiles.artisanSubfolders);
      console.log('   → Le script utilisera automatiquement ce fichier (détection auto)\n');
    }
    
    // Pour les interventions : vérifier si on a les matches complets
    if (!artisansOnly && existingFiles.interventionMatches) {
      console.log('📋 Fichier de matching interventions trouvé:', existingFiles.interventionMatches);
      console.log('   → Utilisation du mode INSERT ONLY (plus rapide)\n');
      useInsertOnlyInterventions = true;
    } else if (!artisansOnly && existingFiles.interventionFolders) {
      console.log('📋 Fichier d\'extraction interventions trouvé:', existingFiles.interventionFolders);
      console.log('   → Le script utilisera automatiquement ce fichier (détection auto)\n');
    }
    
    // Message si aucun fichier de résultats trouvé
    const hasArtisanFiles = existingFiles.artisanMatches || existingFiles.artisanSubfolders;
    const hasInterventionFiles = existingFiles.interventionMatches || existingFiles.interventionFolders;
    if (!hasArtisanFiles && !hasInterventionFiles) {
      console.log('📋 Aucun fichier de résultats trouvé');
      console.log('   → Extraction complète depuis Google Drive\n');
    }
  } else {
    console.log('🔄 Mode FORCE EXTRACTION activé');
    console.log('   → Réextraction complète depuis Google Drive (fichiers existants ignorés)\n');
  }

  console.log('📦 Import unifié de tous les documents depuis Google Drive\n');
  console.log('Ce script va exécuter :');
  if (!interventionsOnly) {
    console.log('  1️⃣  Import des documents d\'artisans');
  }
  if (!artisansOnly) {
    console.log(`  ${interventionsOnly ? '1️⃣' : '2️⃣'}  Import des documents d'interventions`);
  }
  console.log('');

  // Préparer les arguments à passer aux scripts
  const artisanArgs = [];
  const interventionArgs = [];
  
  // Arguments communs
  // Note: --skip-extraction n'est plus nécessaire car les scripts détectent automatiquement les fichiers
  // On le passe seulement si explicitement demandé par l'utilisateur
  if (forceExtraction) {
    artisanArgs.push('--force-extraction');
    interventionArgs.push('--force-extraction');
  }
  if (dryRun) {
    artisanArgs.push('--dry-run');
    interventionArgs.push('--dry-run');
  }
  if (skipInsert) {
    artisanArgs.push('--skip-insert');
    interventionArgs.push('--skip-insert');
  }
  
  // Mode INSERT ONLY si les fichiers de matching existent (utiliser les flags séparés)
  if (useInsertOnlyArtisans && !interventionsOnly) {
    artisanArgs.push('--insert-only');
  }
  if (useInsertOnlyInterventions && !artisansOnly) {
    interventionArgs.push('--insert-only');
  }
  
  // Arguments spécifiques aux interventions
  if (firstMonthOnly) {
    interventionArgs.push('--first-month-only');
  }

  try {
    const startTime = Date.now();
    const errors = [];

    // 1. Import des documents d'artisans
    if (!interventionsOnly) {
      try {
        await runNpmScript('drive:import-documents-artisans', artisanArgs);
      } catch (error) {
        console.error(`\n❌ Erreur lors de l'import des documents d'artisans:`, error.message);
        errors.push('artisans');
        
        // Demander si on continue malgré l'erreur
        if (!artisansOnly) {
          console.log('\n⚠️  Voulez-vous continuer avec l\'import des interventions ?');
          console.log('   (Le script va continuer automatiquement...)');
        }
      }
    }

    // 2. Import des documents d'interventions
    if (!artisansOnly) {
      try {
        await runNpmScript('drive:import-documents-interventions', interventionArgs);
      } catch (error) {
        console.error(`\n❌ Erreur lors de l'import des documents d'interventions:`, error.message);
        errors.push('interventions');
      }
    }

    // Résumé final
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n${'='.repeat(60)}`);
    console.log('📊 RÉSUMÉ DE L\'IMPORT');
    console.log(`${'='.repeat(60)}\n`);
    
    if (errors.length === 0) {
      console.log('✅ Tous les imports ont été effectués avec succès !');
    } else {
      console.log(`⚠️  Import terminé avec ${errors.length} erreur(s):`);
      errors.forEach(err => console.log(`   - ${err}`));
    }
    
    console.log(`⏱️  Durée totale: ${duration} secondes\n`);

    // Exit avec code d'erreur si des erreurs sont survenues
    if (errors.length > 0) {
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ Erreur fatale lors de l\'import:', error);
    process.exit(1);
  }
}

// Exécuter si appelé directement
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };

