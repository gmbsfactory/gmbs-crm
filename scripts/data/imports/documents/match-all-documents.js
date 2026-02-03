/**
 * Script unifié pour l'import de tous les documents depuis Google Drive
 * 
 * Ce script fusionne les fonctionnalités de :
 * - match-folders-to-interventions.js (documents d'interventions)
 * - match-folders-to-artisans.js (documents d'artisans)
 * 
 * Options disponibles :
 * --interventions-only    Traiter uniquement les documents d'interventions
 * --artisans-only         Traiter uniquement les documents d'artisans
 * (par défaut, traite les deux)
 * 
 * Les autres options des scripts individuels sont également supportées :
 * --dry-run, -d           Mode simulation (aucune insertion en base)
 * --skip-insert, -s       Faire le matching sans insérer les documents
 * --insert-only, -i       Insérer uniquement les documents déjà matchés
 * --first-month-only      (interventions uniquement) Traiter uniquement le premier mois
 * --help, -h              Afficher cette aide
 */

const { spawn } = require('child_process');
const path = require('path');

/**
 * Affiche l'aide du script
 */
function showHelp() {
  console.log(`
Usage: npm run drive:match-all [options]

Options principales:
  --interventions-only    Traiter uniquement les documents d'interventions
  --artisans-only         Traiter uniquement les documents d'artisans
  (par défaut, traite les deux types de documents)

Options communes:
  --dry-run, -d           Mode simulation (aucune insertion en base)
  --skip-insert, -s       Faire le matching sans insérer les documents
  --insert-only, -i       Insérer uniquement les documents déjà matchés
  --first-month-only      (interventions uniquement) Traiter uniquement le premier mois
  --help, -h              Afficher cette aide

Exemples:
  npm run drive:match-all                          # Traite interventions + artisans
  npm run drive:match-all --interventions-only     # Traite uniquement les interventions
  npm run drive:match-all --artisans-only          # Traite uniquement les artisans
  npm run drive:match-all --dry-run                # Simulation complète
  npm run drive:match-all --skip-insert           # Matching sans insertion
`);
}

/**
 * Exécute un script avec les arguments donnés
 */
function runScript(scriptPath, args = []) {
  return new Promise((resolve, reject) => {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🚀 Exécution de: ${path.basename(scriptPath)}`);
    console.log(`${'='.repeat(60)}\n`);

    const child = spawn('npx', ['tsx', scriptPath, ...args], {
      stdio: 'inherit',
      shell: true,
      cwd: process.cwd()
    });

    child.on('close', (code) => {
      if (code === 0) {
        console.log(`\n✅ ${path.basename(scriptPath)} terminé avec succès\n`);
        resolve();
      } else {
        console.error(`\n❌ ${path.basename(scriptPath)} terminé avec le code d'erreur ${code}\n`);
        reject(new Error(`Script ${scriptPath} a échoué avec le code ${code}`));
      }
    });

    child.on('error', (error) => {
      console.error(`\n❌ Erreur lors de l'exécution de ${scriptPath}:`, error);
      reject(error);
    });
  });
}

/**
 * Fonction principale
 */
async function main() {
  const args = process.argv.slice(2);

  // Afficher l'aide si demandé
  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    process.exit(0);
  }

  // Déterminer quels scripts exécuter
  const interventionsOnly = args.includes('--interventions-only');
  const artisansOnly = args.includes('--artisans-only');

  // Filtrer les arguments pour ne garder que ceux pertinents pour chaque script
  const commonArgs = args.filter(arg => 
    !['--interventions-only', '--artisans-only'].includes(arg)
  );

  const interventionsScript = path.join(__dirname, 'match-folders-to-interventions.js');
  const artisansScript = path.join(__dirname, 'match-folders-to-artisans.js');

  const scriptsToRun = [];

  if (interventionsOnly && artisansOnly) {
    console.error('❌ Erreur: --interventions-only et --artisans-only ne peuvent pas être utilisés ensemble');
    console.error('   Utilisez l\'un ou l\'autre, ou aucun pour traiter les deux');
    process.exit(1);
  }

  if (interventionsOnly) {
    scriptsToRun.push({ path: interventionsScript, name: 'Interventions' });
  } else if (artisansOnly) {
    scriptsToRun.push({ path: artisansScript, name: 'Artisans' });
  } else {
    // Par défaut, exécuter les deux
    scriptsToRun.push(
      { path: interventionsScript, name: 'Interventions' },
      { path: artisansScript, name: 'Artisans' }
    );
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('📦 IMPORT UNIFIÉ DES DOCUMENTS DEPUIS GOOGLE DRIVE');
  console.log('═══════════════════════════════════════════════════════════\n');

  if (interventionsOnly) {
    console.log('📋 Mode: Interventions uniquement\n');
  } else if (artisansOnly) {
    console.log('📋 Mode: Artisans uniquement\n');
  } else {
    console.log('📋 Mode: Interventions + Artisans\n');
  }

  // Afficher les options communes
  if (commonArgs.length > 0) {
    console.log('🔧 Options communes:', commonArgs.join(' '), '\n');
  }

  try {
    // Exécuter les scripts dans l'ordre
    for (let i = 0; i < scriptsToRun.length; i++) {
      const script = scriptsToRun[i];
      
      console.log(`\n[${i + 1}/${scriptsToRun.length}] Traitement des documents: ${script.name}`);
      
      await runScript(script.path, commonArgs);
      
      // Petite pause entre les scripts pour la lisibilité
      if (i < scriptsToRun.length - 1) {
        console.log('\n⏳ Pause avant le prochain script...\n');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('✅ IMPORT UNIFIÉ TERMINÉ AVEC SUCCÈS');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    console.log(`📊 Résumé:`);
    scriptsToRun.forEach((script, idx) => {
      console.log(`   ${idx + 1}. ${script.name} ✅`);
    });
    console.log('');

  } catch (error) {
    console.error('\n═══════════════════════════════════════════════════════════');
    console.error('❌ ERREUR LORS DE L\'IMPORT UNIFIÉ');
    console.error('═══════════════════════════════════════════════════════════\n');
    console.error('Erreur:', error.message);
    process.exit(1);
  }
}

// Exécuter si appelé directement
if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Erreur fatale:', error);
    process.exit(1);
  });
}

module.exports = { main };







