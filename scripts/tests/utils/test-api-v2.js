const { usersApi, interventionsApi, artisansApi, clientsApi, documentsApi, commentsApi, rolesApi, permissionsApi, utilsApi } = require('../../../src/lib/api/v2');

class ApiV2TestSuite {
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
    console.log(`${prefix} [API-V2-TEST] ${message}`);
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

  async testUsersApi() {
    await this.runTest('Users API - getAll', async () => {
      const users = await usersApi.getAll({ limit: 5 });
      if (!Array.isArray(users)) {
        throw new Error('getAll should return an array');
      }
    });

    await this.runTest('Users API - getStats', async () => {
      const stats = await usersApi.getStats();
      if (typeof stats !== 'object' || typeof stats.total !== 'number') {
        throw new Error('getStats should return an object with total count');
      }
    });
  }

  async testInterventionsApi() {
    await this.runTest('Interventions API - getAll', async () => {
      const interventions = await interventionsApi.getAll({ limit: 5 });
      if (!Array.isArray(interventions)) {
        throw new Error('getAll should return an array');
      }
    });

    await this.runTest('Interventions API - getByStatus', async () => {
      const interventions = await interventionsApi.getByStatus('pending', { limit: 5 });
      if (!Array.isArray(interventions)) {
        throw new Error('getByStatus should return an array');
      }
    });
  }

  async testArtisansApi() {
    await this.runTest('Artisans API - getAll', async () => {
      const artisans = await artisansApi.getAll({ limit: 5 });
      if (!Array.isArray(artisans)) {
        throw new Error('getAll should return an array');
      }
    });

    await this.runTest('Artisans API - getByStatus', async () => {
      const artisans = await artisansApi.getByStatus('active', { limit: 5 });
      if (!Array.isArray(artisans)) {
        throw new Error('getByStatus should return an array');
      }
    });
  }

  async testClientsApi() {
    await this.runTest('Clients API - getAll', async () => {
      const clients = await clientsApi.getAll({ limit: 5 });
      if (!Array.isArray(clients)) {
        throw new Error('getAll should return an array');
      }
    });

    await this.runTest('Clients API - getStats', async () => {
      const stats = await clientsApi.getStats();
      if (typeof stats !== 'object' || typeof stats.total !== 'number') {
        throw new Error('getStats should return an object with total count');
      }
    });
  }

  async testDocumentsApi() {
    await this.runTest('Documents API - getAll', async () => {
      const documents = await documentsApi.getAll({ limit: 5 });
      if (!Array.isArray(documents)) {
        throw new Error('getAll should return an array');
      }
    });

    await this.runTest('Documents API - getSupportedTypes', async () => {
      const types = await documentsApi.getSupportedTypes();
      if (!Array.isArray(types)) {
        throw new Error('getSupportedTypes should return an array');
      }
    });
  }

  async testCommentsApi() {
    await this.runTest('Comments API - getAll', async () => {
      const comments = await commentsApi.getAll({ limit: 5 });
      if (!Array.isArray(comments)) {
        throw new Error('getAll should return an array');
      }
    });

    await this.runTest('Comments API - getStats', async () => {
      const stats = await commentsApi.getStats();
      if (typeof stats !== 'object' || typeof stats.total !== 'number') {
        throw new Error('getStats should return an object with total count');
      }
    });
  }

  async testRolesApi() {
    await this.runTest('Roles API - getAll', async () => {
      const roles = await rolesApi.getAll();
      if (!Array.isArray(roles)) {
        throw new Error('getAll should return an array');
      }
    });

    await this.runTest('Roles API - getByName', async () => {
      const role = await rolesApi.getByName('admin');
      if (role && typeof role !== 'object') {
        throw new Error('getByName should return an object or null');
      }
    });
  }

  async testPermissionsApi() {
    await this.runTest('Permissions API - getAll', async () => {
      const permissions = await permissionsApi.getAll();
      if (!Array.isArray(permissions)) {
        throw new Error('getAll should return an array');
      }
    });

    await this.runTest('Permissions API - getByKey', async () => {
      const permission = await permissionsApi.getByKey('users.read');
      if (permission && typeof permission !== 'object') {
        throw new Error('getByKey should return an object or null');
      }
    });
  }

  async testUtilsApi() {
    await this.runTest('Utils API - isValidEmail', async () => {
      const valid = utilsApi.isValidEmail('test@example.com');
      const invalid = utilsApi.isValidEmail('invalid-email');
      
      if (valid !== true || invalid !== false) {
        throw new Error('isValidEmail should return correct boolean values');
      }
    });

    await this.runTest('Utils API - isValidUsername', async () => {
      const valid = utilsApi.isValidUsername('testuser');
      const invalid = utilsApi.isValidUsername('invalid username');
      
      if (valid !== true || invalid !== false) {
        throw new Error('isValidUsername should return correct boolean values');
      }
    });

    await this.runTest('Utils API - generateSecurePassword', async () => {
      const password = utilsApi.generateSecurePassword();
      if (typeof password !== 'string' || password.length < 8) {
        throw new Error('generateSecurePassword should return a string with at least 8 characters');
      }
    });
  }

  async testApiCompatibility() {
    await this.runTest('API Compatibility - Alias imports', async () => {
      // Test des alias pour la compatibilité
      const { usersApiV2, interventionsApiV2, artisansApiV2 } = require('../../../src/lib/api/v2');
      
      if (usersApiV2 !== usersApi) {
        throw new Error('usersApiV2 alias should point to usersApi');
      }
      
      if (interventionsApiV2 !== interventionsApi) {
        throw new Error('interventionsApiV2 alias should point to interventionsApi');
      }
      
      if (artisansApiV2 !== artisansApi) {
        throw new Error('artisansApiV2 alias should point to artisansApi');
      }
    });
  }

  async runAllTests() {
    this.log('🚀 Démarrage des tests de l\'API Modulaire V2', 'info');
    
    try {
      // Tests des APIs individuelles
      await this.testUsersApi();
      await this.testInterventionsApi();
      await this.testArtisansApi();
      await this.testClientsApi();
      await this.testDocumentsApi();
      await this.testCommentsApi();
      await this.testRolesApi();
      await this.testPermissionsApi();
      await this.testUtilsApi();
      
      // Tests de compatibilité
      await this.testApiCompatibility();
      
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
    
    this.log('📊 Rapport des tests API Modulaire V2:', 'info');
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

async function runApiV2Tests() {
  const testSuite = new ApiV2TestSuite();
  await testSuite.runAllTests();
}

async function testSpecificApi(apiName) {
  const testSuite = new ApiV2TestSuite();
  
  switch (apiName.toLowerCase()) {
    case 'users':
      await testSuite.testUsersApi();
      break;
    case 'interventions':
      await testSuite.testInterventionsApi();
      break;
    case 'artisans':
      await testSuite.testArtisansApi();
      break;
    case 'clients':
      await testSuite.testClientsApi();
      break;
    case 'documents':
      await testSuite.testDocumentsApi();
      break;
    case 'comments':
      await testSuite.testCommentsApi();
      break;
    case 'roles':
      await testSuite.testRolesApi();
      break;
    case 'permissions':
      await testSuite.testPermissionsApi();
      break;
    case 'utils':
      await testSuite.testUtilsApi();
      break;
    default:
      console.log('❌ API non reconnue. APIs disponibles: users, interventions, artisans, clients, documents, comments, roles, permissions, utils');
      return;
  }
  
  testSuite.generateReport();
}

// ===== EXPORTS =====

module.exports = {
  ApiV2TestSuite,
  runApiV2Tests,
  testSpecificApi
};

// ===== SCRIPT PRINCIPAL =====

if (require.main === module) {
  async function main() {
    try {
      const args = process.argv.slice(2);
      
      if (args.length === 0) {
        // Tests complets
        await runApiV2Tests();
      } else if (args[0] === '--api' && args[1]) {
        // Test d'une API spécifique
        await testSpecificApi(args[1]);
      } else if (args[0] === '--help') {
        console.log(`
🧪 Test Suite API Modulaire V2

Usage:
  node test-api-v2.js                    # Tests complets
  node test-api-v2.js --api <name>        # Test d'une API spécifique
  node test-api-v2.js --help              # Aide

APIs disponibles:
  - users
  - interventions
  - artisans
  - clients
  - documents
  - comments
  - roles
  - permissions
  - utils

Exemples:
  node test-api-v2.js --api users
  node test-api-v2.js --api interventions
        `);
      } else {
        console.log('❌ Arguments invalides. Utilisez --help pour voir l\'aide.');
      }
      
    } catch (error) {
      console.error('❌ Erreur fatale:', error.message);
      process.exit(1);
    }
  }

  main();
}
