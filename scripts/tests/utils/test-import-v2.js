const { GoogleSheetsImportCleanV2 } = require('./google-sheets-import-clean-v2');
const { DatabaseManager } = require('./database/database-manager-v2');

class ImportV2TestSuite {
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
    console.log(`${prefix} [IMPORT-V2-TEST] ${message}`);
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

  async testImportInstanceCreation() {
    await this.runTest('Import Instance Creation', async () => {
      const instance = new GoogleSheetsImportCleanV2();
      if (!instance) {
        throw new Error('Failed to create import instance');
      }
    });
  }

  async testDatabaseManagerCreation() {
    await this.runTest('Database Manager Creation', async () => {
      const dbManager = new DatabaseManager();
      if (!dbManager) {
        throw new Error('Failed to create database manager');
      }
    });
  }

  async testDryRunMode() {
    await this.runTest('Dry Run Mode', async () => {
      const instance = new GoogleSheetsImportCleanV2({ dryRun: true });
      if (!instance.options.dryRun) {
        throw new Error('Dry run mode not properly set');
      }
    });
  }

  async testVerboseMode() {
    await this.runTest('Verbose Mode', async () => {
      const instance = new GoogleSheetsImportCleanV2({ verbose: true });
      if (!instance.options.verbose) {
        throw new Error('Verbose mode not properly set');
      }
    });
  }

  async testBatchSizeConfiguration() {
    await this.runTest('Batch Size Configuration', async () => {
      const instance = new GoogleSheetsImportCleanV2({ batchSize: 100 });
      if (instance.options.batchSize !== 100) {
        throw new Error('Batch size not properly set');
      }
    });
  }

  async testConfigurationValidation() {
    await this.runTest('Configuration Validation', async () => {
      const instance = new GoogleSheetsImportCleanV2();
      const isValid = await instance.validateConfiguration();
      if (typeof isValid !== 'boolean') {
        throw new Error('Configuration validation should return a boolean');
      }
    });
  }

  async testConnectionTest() {
    await this.runTest('Connection Test', async () => {
      const instance = new GoogleSheetsImportCleanV2();
      const isConnected = await instance.testConnection();
      if (typeof isConnected !== 'boolean') {
        throw new Error('Connection test should return a boolean');
      }
    });
  }

  async testApiImports() {
    await this.runTest('API Imports', async () => {
      const { usersApi, interventionsApi, artisansApi, clientsApi } = require('../../../src/lib/api/v2');
      
      if (!usersApi) {
        throw new Error('usersApi not imported');
      }
      
      if (!interventionsApi) {
        throw new Error('interventionsApi not imported');
      }
      
      if (!artisansApi) {
        throw new Error('artisansApi not imported');
      }
      
      if (!clientsApi) {
        throw new Error('clientsApi not imported');
      }
    });
  }

  async testApiCompatibility() {
    await this.runTest('API Compatibility', async () => {
      const { usersApiV2, interventionsApiV2, artisansApiV2 } = require('../../../src/lib/api/v2');
      
      if (!usersApiV2) {
        throw new Error('usersApiV2 alias not available');
      }
      
      if (!interventionsApiV2) {
        throw new Error('interventionsApiV2 alias not available');
      }
      
      if (!artisansApiV2) {
        throw new Error('artisansApiV2 alias not available');
      }
    });
  }

  async testErrorHandling() {
    await this.runTest('Error Handling', async () => {
      const instance = new GoogleSheetsImportCleanV2();
      
      try {
        // Test avec des données invalides
        await instance.importAll();
      } catch (error) {
        // L'erreur est attendue, on vérifie juste que l'erreur est gérée
        if (typeof error.message !== 'string') {
          throw new Error('Error message should be a string');
        }
      }
    });
  }

  async runAllTests() {
    this.log('🚀 Démarrage des tests des scripts d\'import V2', 'info');
    
    try {
      // Tests de base
      await this.testImportInstanceCreation();
      await this.testDatabaseManagerCreation();
      
      // Tests de configuration
      await this.testDryRunMode();
      await this.testVerboseMode();
      await this.testBatchSizeConfiguration();
      
      // Tests de fonctionnalité
      await this.testConfigurationValidation();
      await this.testConnectionTest();
      
      // Tests d'API
      await this.testApiImports();
      await this.testApiCompatibility();
      
      // Tests d'erreur
      await this.testErrorHandling();
      
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
    
    this.log('📊 Rapport des tests des scripts d\'import V2:', 'info');
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

async function runImportV2Tests() {
  const testSuite = new ImportV2TestSuite();
  await testSuite.runAllTests();
}

// ===== EXPORTS =====

module.exports = {
  ImportV2TestSuite,
  runImportV2Tests
};

// ===== SCRIPT PRINCIPAL =====

if (require.main === module) {
  async function main() {
    try {
      const args = process.argv.slice(2);
      
      if (args.includes('--help')) {
        console.log(`
🧪 Test Suite Scripts d'Import V2

Usage:
  node test-import-v2.js                    # Tests complets
  node test-import-v2.js --help              # Aide

Ce script teste:
  - Création des instances d'import
  - Configuration des options
  - Validation de la configuration
  - Tests de connexion
  - Imports des APIs
  - Compatibilité des alias
  - Gestion d'erreurs

Exemples:
  node test-import-v2.js
        `);
        return;
      }
      
      await runImportV2Tests();
      
    } catch (error) {
      console.error('❌ Erreur fatale:', error.message);
      process.exit(1);
    }
  }

  main();
}
