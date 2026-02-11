const fs = require('fs');
const path = require('path');

class ImportMigrationTestSuite {
  constructor() {
    this.results = {
      passed: 0,
      failed: 0,
      errors: []
    };
  }

  log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = level === 'error' ? '❌' : level === 'warning' ? '⚠️' : '✅';
    console.log(`${prefix} [MIGRATION-TEST] ${message}`);
  }

  async runTest(testName, testFunction) {
    try {
      this.log(`🧪 Test: ${testName}`, 'info');
      await testFunction();
      this.results.passed++;
      this.log(`✅ ${testName} - PASSED`, 'success');
    } catch (error) {
      this.results.failed++;
      this.results.errors.push({ test: testName, error: error.message });
      this.log(`❌ ${testName} - FAILED: ${error.message}`, 'error');
    }
  }

  async testV2ScriptsExist() {
    await this.runTest('V2 Scripts Exist', async () => {
      const v2Scripts = [
        'scripts/imports/google-sheets-import-clean-v2.js',
        'scripts/imports/database/database-manager-v2.js'
      ];
      
      for (const script of v2Scripts) {
        if (!fs.existsSync(script)) {
          throw new Error(`V2 script not found: ${script}`);
        }
      }
    });
  }

  async testV2ScriptsStructure() {
    await this.runTest('V2 Scripts Structure', async () => {
      const v2Script = 'scripts/imports/google-sheets-import-clean-v2.js';
      const content = fs.readFileSync(v2Script, 'utf8');
      
      // Vérifier que le script utilise la nouvelle API
      if (!content.includes('src/lib/api/v2')) {
        throw new Error('V2 script does not use the new API structure');
      }
      
      // Vérifier que le script n'utilise plus l'ancienne API
      if (content.includes('supabase-api-v2')) {
        throw new Error('V2 script still uses the old API');
      }
    });
  }

  async testV2DatabaseManager() {
    await this.runTest('V2 Database Manager', async () => {
      const dbManagerScript = 'scripts/imports/database/database-manager-v2.js';
      const content = fs.readFileSync(dbManagerScript, 'utf8');
      
      // Vérifier que le gestionnaire utilise la nouvelle API
      if (!content.includes('src/lib/api/v2')) {
        throw new Error('V2 database manager does not use the new API structure');
      }
      
      // Vérifier que le gestionnaire n'utilise plus l'ancienne API
      if (content.includes('supabase-api-v2')) {
        throw new Error('V2 database manager still uses the old API');
      }
    });
  }

  async testLegacyScriptsStillExist() {
    await this.runTest('Legacy Scripts Still Exist', async () => {
      const legacyScripts = [
        'scripts/imports/google-sheets-import-clean.js',
        'scripts/imports/database/database-manager-clean.js'
      ];
      
      for (const script of legacyScripts) {
        if (!fs.existsSync(script)) {
          throw new Error(`Legacy script not found: ${script}`);
        }
      }
    });
  }

  async testLegacyScriptsUseOldAPI() {
    await this.runTest('Legacy Scripts Use Old API', async () => {
      const legacyScript = 'scripts/imports/google-sheets-import-clean.js';
      const content = fs.readFileSync(legacyScript, 'utf8');
      
      // Vérifier que le script legacy utilise encore l'ancienne API
      if (!content.includes('supabase-api-v2')) {
        throw new Error('Legacy script does not use the old API structure');
      }
    });
  }

  async testV2ScriptsCanBeRequired() {
    await this.runTest('V2 Scripts Can Be Required', async () => {
      try {
        const { GoogleSheetsImportCleanV2 } = require('../imports/google-sheets-import-clean-v2');
        const { DatabaseManager } = require('../imports/database/database-manager-v2');
        
        if (!GoogleSheetsImportCleanV2) {
          throw new Error('GoogleSheetsImportCleanV2 not exported');
        }
        
        if (!DatabaseManager) {
          throw new Error('DatabaseManager not exported');
        }
      } catch (error) {
        throw new Error(`Failed to require V2 scripts: ${error.message}`);
      }
    });
  }

  async testV2ScriptsHaveCorrectExports() {
    await this.runTest('V2 Scripts Have Correct Exports', async () => {
      const v2Script = 'scripts/imports/google-sheets-import-clean-v2.js';
      const content = fs.readFileSync(v2Script, 'utf8');
      
      // Vérifier que le script exporte les bonnes classes
      if (!content.includes('GoogleSheetsImportCleanV2')) {
        throw new Error('V2 script does not export GoogleSheetsImportCleanV2');
      }
      
      if (!content.includes('module.exports')) {
        throw new Error('V2 script does not have module.exports');
      }
    });
  }

  async testV2ScriptsHaveCorrectImports() {
    await this.runTest('V2 Scripts Have Correct Imports', async () => {
      const v2Script = 'scripts/imports/google-sheets-import-clean-v2.js';
      const content = fs.readFileSync(v2Script, 'utf8');
      
      // Vérifier que le script importe les bonnes APIs
      if (!content.includes('artisansApi')) {
        throw new Error('V2 script does not import artisansApi');
      }
      
      if (!content.includes('interventionsApi')) {
        throw new Error('V2 script does not import interventionsApi');
      }
      
      if (!content.includes('clientsApi')) {
        throw new Error('V2 script does not import clientsApi');
      }
    });
  }

  async testV2ScriptsHaveCorrectOptions() {
    await this.runTest('V2 Scripts Have Correct Options', async () => {
      const v2Script = 'scripts/imports/google-sheets-import-clean-v2.js';
      const content = fs.readFileSync(v2Script, 'utf8');
      
      // Vérifier que le script a les bonnes options
      if (!content.includes('dryRun')) {
        throw new Error('V2 script does not have dryRun option');
      }
      
      if (!content.includes('verbose')) {
        throw new Error('V2 script does not have verbose option');
      }
      
      if (!content.includes('batchSize')) {
        throw new Error('V2 script does not have batchSize option');
      }
    });
  }

  async testV2ScriptsHaveCorrectMethods() {
    await this.runTest('V2 Scripts Have Correct Methods', async () => {
      const v2Script = 'scripts/imports/google-sheets-import-clean-v2.js';
      const content = fs.readFileSync(v2Script, 'utf8');
      
      // Vérifier que le script a les bonnes méthodes
      if (!content.includes('importAll')) {
        throw new Error('V2 script does not have importAll method');
      }
      
      if (!content.includes('importArtisansOnly')) {
        throw new Error('V2 script does not have importArtisansOnly method');
      }
      
      if (!content.includes('importInterventionsOnly')) {
        throw new Error('V2 script does not have importInterventionsOnly method');
      }
    });
  }

  async testV2ScriptsHaveCorrectErrorHandling() {
    await this.runTest('V2 Scripts Have Correct Error Handling', async () => {
      const v2Script = 'scripts/imports/google-sheets-import-clean-v2.js';
      const content = fs.readFileSync(v2Script, 'utf8');
      
      // Vérifier que le script a la gestion d'erreurs
      if (!content.includes('try')) {
        throw new Error('V2 script does not have try-catch blocks');
      }
      
      if (!content.includes('catch')) {
        throw new Error('V2 script does not have catch blocks');
      }
      
      if (!content.includes('error')) {
        throw new Error('V2 script does not handle errors');
      }
    });
  }

  async runAllTests() {
    this.log('🚀 Démarrage des tests de migration des scripts d\'import', 'info');
    
    try {
      // Tests de base
      await this.testV2ScriptsExist();
      await this.testV2ScriptsStructure();
      await this.testV2DatabaseManager();
      
      // Tests de compatibilité
      await this.testLegacyScriptsStillExist();
      await this.testLegacyScriptsUseOldAPI();
      
      // Tests de fonctionnalité
      await this.testV2ScriptsCanBeRequired();
      await this.testV2ScriptsHaveCorrectExports();
      await this.testV2ScriptsHaveCorrectImports();
      await this.testV2ScriptsHaveCorrectOptions();
      await this.testV2ScriptsHaveCorrectMethods();
      await this.testV2ScriptsHaveCorrectErrorHandling();
      
      // Rapport final
      this.generateReport();
      
    } catch (error) {
      this.log(`❌ Erreur critique lors des tests: ${error.message}`, 'error');
      throw error;
    }
  }

  generateReport() {
    const total = this.results.passed + this.results.failed;
    const successRate = total > 0 ? ((this.results.passed / total) * 100).toFixed(2) : 0;
    
    this.log('📊 Rapport des tests de migration des scripts d\'import:', 'info');
    this.log(`✅ Tests réussis: ${this.results.passed}`, 'success');
    this.log(`❌ Tests échoués: ${this.results.failed}`, 'error');
    this.log(`📈 Taux de succès: ${successRate}%`, 'info');
    
    if (this.results.errors.length > 0) {
      this.log('🔍 Détails des erreurs:', 'warning');
      this.results.errors.forEach(({ test, error }) => {
        this.log(`  - ${test}: ${error}`, 'error');
      });
    }
    
    if (this.results.failed === 0) {
      this.log('🎉 Tous les tests sont passés avec succès!', 'success');
    } else {
      this.log(`⚠️ ${this.results.failed} test(s) ont échoué`, 'warning');
    }
  }
}

// ===== FONCTIONS UTILITAIRES =====

async function runImportMigrationTests() {
  const testSuite = new ImportMigrationTestSuite();
  await testSuite.runAllTests();
}

// ===== EXPORTS =====

module.exports = {
  ImportMigrationTestSuite,
  runImportMigrationTests
};

// ===== SCRIPT PRINCIPAL =====

if (require.main === module) {
  async function main() {
    try {
      const args = process.argv.slice(2);
      
      if (args.includes('--help')) {
        console.log(`
🧪 Test Suite Migration Scripts d'Import

Usage:
  node test-import-migration.js                    # Tests complets
  node test-import-migration.js --help              # Aide

Ce script teste:
  - Existence des scripts V2
  - Structure des scripts V2
  - Compatibilité avec les scripts legacy
  - Fonctionnalités des scripts V2
  - Gestion d'erreurs

Exemples:
  node test-import-migration.js
        `);
        return;
      }
      
      await runImportMigrationTests();
      
    } catch (error) {
      console.error('❌ Erreur fatale:', error.message);
      process.exit(1);
    }
  }

  main();
}