#!/usr/bin/env node

/**
 * Test des nouvelles statistiques de batch pour l'import d'interventions
 * 
 * Ce script teste les nouvelles fonctionnalités ajoutées au DatabaseManager :
 * - Comptage des artisans SST liés par batch
 * - Comptage des statuts correctement mappés par batch
 * - Affichage des statistiques dans les logs de batch
 */

const { DatabaseManager } = require('../imports/database/database-manager-v2');

async function testBatchStats() {
  console.log('🧪 Test des statistiques de batch...\n');
  
  // Créer une instance du DatabaseManager en mode dry-run
  const dbManager = new DatabaseManager({
    dryRun: true,
    verbose: true,
    batchSize: 3 // Petit batch pour tester
  });
  
  // Données de test simulées
  const testInterventions = [
    {
      id_inter: 'TEST-001',
      statut_id: 'status-1', // Statut mappé
      date: '2024-01-01',
      adresse: '123 Test Street',
      artisanSST: 'Jean Dupont', // Artisan SST à lier
      tenant: { firstname: 'John', lastname: 'Doe', email: 'john@test.com' },
      costs: { sst: 100, materiel: 50 }
    },
    {
      id_inter: 'TEST-002',
      statut_id: 'status-2', // Statut mappé
      date: '2024-01-02',
      adresse: '456 Test Avenue',
      artisanSST: 'Marie Martin', // Artisan SST à lier
      tenant: { firstname: 'Jane', lastname: 'Smith', email: 'jane@test.com' },
      costs: { sst: 150, materiel: 75 }
    },
    {
      id_inter: 'TEST-003',
      // Pas de statut_id - ne sera pas compté comme mappé
      date: '2024-01-03',
      adresse: '789 Test Boulevard',
      // Pas d'artisanSST - ne sera pas lié
      tenant: { firstname: 'Bob', lastname: 'Wilson', email: 'bob@test.com' },
      costs: { sst: 200 }
    },
    {
      id_inter: 'TEST-004',
      statut_id: 'status-3', // Statut mappé
      date: '2024-01-04',
      adresse: '321 Test Road',
      artisanSST: 'Pierre Durand', // Artisan SST à lier
      tenant: { firstname: 'Alice', lastname: 'Brown', email: 'alice@test.com' },
      costs: { sst: 80, materiel: 40 }
    },
    {
      id_inter: 'TEST-005',
      statut_id: 'status-4', // Statut mappé
      date: '2024-01-05',
      adresse: '654 Test Lane',
      artisanSST: 'Sophie Leroy', // Artisan SST à lier
      tenant: { firstname: 'Charlie', lastname: 'Davis', email: 'charlie@test.com' },
      costs: { sst: 120, materiel: 60 }
    }
  ];
  
  console.log(`📊 Test avec ${testInterventions.length} interventions en batch de ${dbManager.options.batchSize}\n`);
  
  try {
    // Simuler l'insertion des interventions
    const results = await dbManager.insertInterventions(testInterventions);
    
    console.log('\n📈 Résultats du test:');
    console.log(`✅ Interventions traitées: ${results.success}`);
    console.log(`❌ Erreurs: ${results.errors}`);
    
    // Vérifier les statistiques globales
    console.log('\n📊 Statistiques globales:');
    console.log(`👷 Artisans liés: ${dbManager.batchStats.artisansLinked}`);
    console.log(`📋 Statuts mappés: ${dbManager.batchStats.statusesMapped}`);
    
    // Calculer les pourcentages attendus
    const expectedArtisansLinked = 4; // TEST-001, TEST-002, TEST-004, TEST-005 ont des artisanSST
    const expectedStatusesMapped = 4; // TEST-001, TEST-002, TEST-004, TEST-005 ont des statut_id
    
    console.log('\n🔍 Vérification:');
    console.log(`👷 Artisans liés attendus: ${expectedArtisansLinked}, obtenus: ${dbManager.batchStats.artisansLinked}`);
    console.log(`📋 Statuts mappés attendus: ${expectedStatusesMapped}, obtenus: ${dbManager.batchStats.statusesMapped}`);
    
    if (dbManager.batchStats.artisansLinked === expectedArtisansLinked && 
        dbManager.batchStats.statusesMapped === expectedStatusesMapped) {
      console.log('\n✅ Test réussi ! Les statistiques sont correctes.');
    } else {
      console.log('\n❌ Test échoué ! Les statistiques ne correspondent pas aux attentes.');
    }
    
  } catch (error) {
    console.error('❌ Erreur lors du test:', error.message);
  }
}

// Exécuter le test si le script est appelé directement
if (require.main === module) {
  testBatchStats().catch(console.error);
}

module.exports = { testBatchStats };

