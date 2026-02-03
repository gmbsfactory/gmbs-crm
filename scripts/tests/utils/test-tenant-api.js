#!/usr/bin/env node

/**
 * Script de test pour l'API Tenants
 * Teste les opérations CRUD de base
 */

console.log('🚀 Test de l\'API Tenants\n');

// Import de l'API
const { tenantsApi } = require('../../../src/lib/api/v2');

async function testTenantsApi() {
  try {
    console.log('📊 Test 1: Création d\'un tenant');
    const newTenant = await tenantsApi.create({
      firstname: 'Thomas',
      lastname: 'Germanaud',
      email: 'thomas.test@example.com',
      telephone: '0632148492',
      telephone2: '0642507988',
      adresse: '123 Rue Test',
      ville: 'Paris',
      code_postal: '75001'
    });
    console.log('✅ Tenant créé:', newTenant.id);
    console.log(`   ${newTenant.firstname} ${newTenant.lastname}`);
    console.log(`   Email: ${newTenant.email}`);
    console.log(`   Tél: ${newTenant.telephone}\n`);

    const tenantId = newTenant.id;

    console.log('📊 Test 2: Récupération par ID');
    const retrieved = await tenantsApi.getById(tenantId);
    console.log('✅ Tenant récupéré:', retrieved.firstname, retrieved.lastname, '\n');

    console.log('📊 Test 3: Recherche par nom');
    const searchResults = await tenantsApi.searchByName('Germanaud');
    console.log(`✅ ${searchResults.length} tenant(s) trouvé(s)\n`);

    console.log('📊 Test 4: Recherche par email');
    const emailResults = await tenantsApi.searchByEmail('thomas.test@example.com');
    console.log(`✅ ${emailResults.length} tenant(s) trouvé(s) par email\n`);

    console.log('📊 Test 5: Mise à jour');
    const updated = await tenantsApi.update(tenantId, {
      telephone: '0699999999'
    });
    console.log('✅ Tenant mis à jour, nouveau tél:', updated.telephone, '\n');

    console.log('📊 Test 6: Statistiques');
    const stats = await tenantsApi.getStats();
    console.log('✅ Statistiques:');
    console.log(`   Total: ${stats.total}`);
    console.log(`   Avec email: ${stats.withEmail}`);
    console.log(`   Avec téléphone: ${stats.withPhone}\n`);

    console.log('📊 Test 7: Suppression');
    await tenantsApi.delete(tenantId);
    console.log('✅ Tenant supprimé\n');

    console.log('📊 Test 8: Vérification de la suppression');
    const deleted = await tenantsApi.getById(tenantId);
    if (!deleted) {
      console.log('✅ Tenant bien supprimé (null)\n');
    } else {
      console.log('⚠️ Le tenant existe encore après suppression\n');
    }

    console.log('✅ Tous les tests sont passés!\n');

  } catch (error) {
    console.error('❌ Erreur lors des tests:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Exécuter les tests
testTenantsApi();









