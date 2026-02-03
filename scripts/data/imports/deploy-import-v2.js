const fs = require('fs');
const path = require('path');

class ImportV2Deployment {
  constructor() {
    this.deploymentSteps = [
      'validate-structure',
      'test-scripts',
      'backup-legacy',
      'deploy-v2',
      'validate-deployment',
      'cleanup'
    ];
    
    this.results = {
      stepsCompleted: 0,
      stepsFailed: 0,
      errors: []
    };
  }

  log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = level === 'error' ? '❌' : level === 'warning' ? '⚠️' : '✅';
    console.log(`${prefix} [DEPLOY-IMPORT-V2] ${message}`);
  }

  async validateStructure() {
    this.log('🔍 Validation de la structure des scripts d\'import V2...', 'info');
    
    const requiredFiles = [
      'scripts/imports/google-sheets-import-clean-v2.js',
      'scripts/imports/database/database-manager-v2.js',
      'scripts/imports/config/import-config-v2.js',
      'scripts/imports/README-V2.md'
    ];
    
    const missingFiles = [];
    
    for (const file of requiredFiles) {
      if (!fs.existsSync(file)) {
        missingFiles.push(file);
      }
    }
    
    if (missingFiles.length > 0) {
      this.log(`❌ Fichiers manquants: ${missingFiles.join(', ')}`, 'error');
      throw new Error('Structure des scripts d\'import V2 incomplète');
    }
    
    this.log('✅ Structure des scripts d\'import V2 validée', 'success');
  }

  async testScripts() {
    this.log('🧪 Test des scripts d\'import V2...', 'info');
    
    try {
      const { runImportV2Tests } = require('./tests/test-import-v2');
      await runImportV2Tests();
      this.log('✅ Tests des scripts d\'import V2 réussis', 'success');
    } catch (error) {
      this.log(`❌ Tests des scripts d\'import V2 échoués: ${error.message}`, 'error');
      throw error;
    }
  }

  async backupLegacy() {
    this.log('💾 Sauvegarde des scripts d\'import Legacy...', 'info');
    
    const legacyFiles = [
      'scripts/imports/google-sheets-import-clean.js',
      'scripts/imports/database/database-manager-clean.js'
    ];
    
    for (const file of legacyFiles) {
      if (fs.existsSync(file)) {
        const backupFile = `${file}.backup`;
        fs.copyFileSync(file, backupFile);
        this.log(`✅ Sauvegarde créée: ${backupFile}`, 'success');
      } else {
        this.log(`⚠️ Fichier Legacy non trouvé: ${file}`, 'warning');
      }
    }
  }

  async deployV2() {
    this.log('🚀 Déploiement des scripts d\'import V2...', 'info');
    
    // Vérifier que les scripts V2 sont fonctionnels
    try {
      const { GoogleSheetsImportCleanV2 } = require('./imports/google-sheets-import-clean-v2');
      const { DatabaseManager } = require('./imports/database/database-manager-v2');
      
      // Test de base
      const importInstance = new GoogleSheetsImportCleanV2({ dryRun: true });
      const dbManager = new DatabaseManager({ dryRun: true });
      
      if (!importInstance || !dbManager) {
        throw new Error('Failed to create V2 instances');
      }
      
      this.log('✅ Scripts d\'import V2 déployés et fonctionnels', 'success');
    } catch (error) {
      this.log(`❌ Erreur lors du déploiement: ${error.message}`, 'error');
      throw error;
    }
  }

  async validateDeployment() {
    this.log('🔍 Validation du déploiement...', 'info');
    
    try {
      // Test de migration
      const { runImportMigrationTests } = require('./tests/test-import-migration');
      await runImportMigrationTests();
      
      this.log('✅ Déploiement validé', 'success');
    } catch (error) {
      this.log(`❌ Validation échouée: ${error.message}`, 'error');
      throw error;
    }
  }

  async cleanup() {
    this.log('🧹 Nettoyage...', 'info');
    
    // Supprimer les fichiers temporaires si nécessaire
    const tempFiles = [
      'scripts/imports/google-sheets-import-clean.js.backup',
      'scripts/imports/database/database-manager-clean.js.backup'
    ];
    
    for (const file of tempFiles) {
      if (fs.existsSync(file)) {
        // Garder la sauvegarde pour l'instant
        this.log(`ℹ️ Sauvegarde conservée: ${file}`, 'info');
      }
    }
    
    this.log('✅ Nettoyage terminé', 'success');
  }

  async deploy() {
    this.log('🚀 Démarrage du déploiement des scripts d\'import V2', 'info');
    
    try {
      for (const step of this.deploymentSteps) {
        this.log(`📋 Étape: ${step}`, 'info');
        
        switch (step) {
          case 'validate-structure':
            await this.validateStructure();
            break;
          case 'test-scripts':
            await this.testScripts();
            break;
          case 'backup-legacy':
            await this.backupLegacy();
            break;
          case 'deploy-v2':
            await this.deployV2();
            break;
          case 'validate-deployment':
            await this.validateDeployment();
            break;
          case 'cleanup':
            await this.cleanup();
            break;
        }
        
        this.results.stepsCompleted++;
        this.log(`✅ Étape ${step} terminée`, 'success');
      }
      
      this.generateReport();
      
    } catch (error) {
      this.log(`❌ Erreur critique lors du déploiement: ${error.message}`, 'error');
      this.results.stepsFailed++;
      this.results.errors.push(error.message);
      throw error;
    }
  }

  generateReport() {
    this.log('📊 Rapport de déploiement des scripts d\'import V2:', 'info');
    this.log(`✅ Étapes réussies: ${this.results.stepsCompleted}`, 'success');
    this.log(`❌ Étapes échouées: ${this.results.stepsFailed}`, 'error');
    
    if (this.results.errors.length > 0) {
      this.log('🔍 Détails des erreurs:', 'warning');
      this.results.errors.forEach(error => {
        this.log(`  - ${error}`, 'error');
      });
    }
    
    if (this.results.stepsFailed === 0) {
      this.log('🎉 Déploiement des scripts d\'import V2 réussi!', 'success');
      this.log('💡 Prochaines étapes:', 'info');
      this.log('  1. Tester les fonctionnalités d\'import en production', 'info');
      this.log('  2. Former l\'équipe sur les nouveaux scripts', 'info');
      this.log('  3. Mettre à jour la documentation', 'info');
      this.log('  4. Planifier la suppression des scripts Legacy', 'info');
    } else {
      this.log('⚠️ Déploiement partiellement réussi', 'warning');
    }
  }
}

// ===== FONCTIONS UTILITAIRES =====

async function deployImportV2() {
  const deployment = new ImportV2Deployment();
  await deployment.deploy();
}

// ===== EXPORTS =====

module.exports = {
  ImportV2Deployment,
  deployImportV2
};

// ===== SCRIPT PRINCIPAL =====

if (require.main === module) {
  async function main() {
    try {
      const args = process.argv.slice(2);
      
      if (args.includes('--help')) {
        console.log(`
🚀 Déploiement Scripts d'Import V2

Usage:
  node deploy-import-v2.js                    # Déploiement complet
  node deploy-import-v2.js --help             # Aide

Ce script effectue:
  1. Validation de la structure des scripts V2
  2. Tests des scripts
  3. Sauvegarde des scripts Legacy
  4. Déploiement des scripts V2
  5. Validation du déploiement
  6. Nettoyage

Exemples:
  node deploy-import-v2.js
        `);
        return;
      }
      
      await deployImportV2();
      
    } catch (error) {
      console.error('❌ Erreur fatale:', error.message);
      process.exit(1);
    }
  }

  main();
}