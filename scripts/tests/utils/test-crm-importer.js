#!/usr/bin/env node

/**
 * Script de test pour la nouvelle architecture CRM Importer
 * 
 * Usage:
 * node scripts/test-crm-importer.js [--dry-run] [--verbose]
 */

const { CRMImporter } = require('../crm-importer');

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const verbose = args.includes('--verbose');
  
  console.log('🧪 Test de la nouvelle architecture CRM Importer');
  console.log(`📋 Mode: ${dryRun ? 'DRY-RUN' : 'RÉEL'}`);
  console.log(`🔍 Verbose: ${verbose ? 'OUI' : 'NON'}`);
  console.log('');

  try {
    const importer = new CRMImporter({
      dryRun,
      verbose
    });

    const results = await importer.importAll();
    
    console.log('\n📊 Résultats finaux:');
    console.log(`✅ Interventions: ${results.interventions.success} succès, ${results.interventions.errors} erreurs`);
    console.log(`✅ Artisans: ${results.artisans.success} succès, ${results.artisans.errors} erreurs`);
    
  } catch (error) {
    console.error('❌ Erreur lors du test:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}
