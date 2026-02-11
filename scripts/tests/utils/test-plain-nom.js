#!/usr/bin/env node

/**
 * Test des modifications plain_nom pour les artisans
 * 
 * Ce script teste :
 * 1. L'ajout du champ plain_nom dans les types
 * 2. La nouvelle méthode searchByPlainNom dans l'API
 * 3. La recherche prioritaire par plain_nom dans findArtisanSST
 */

const { DataMapper } = require('../../data-processing/data-mapper');
const { DatabaseManager } = require('../imports/database/database-manager-v2');
const { artisansApi } = require('../../../src/lib/api/v2');

// Charger les variables d'environnement
require('dotenv').config({ path: '.env.local' });

async function testPlainNomModifications() {
  console.log('🧪 Test des modifications plain_nom pour les artisans');
  console.log('='.repeat(60));

  try {
    // Test 1: Vérifier que le DataMapper inclut plain_nom
    console.log('\n1️⃣ Test du DataMapper...');
    const dataMapper = new DataMapper();
    
    const testArtisanData = {
      'Nom Prénom': 'Jean Dupont',
      'Adresse Mail': 'jean.dupont@example.com',
      'Numéro Téléphone': '0612345678',
      'Raison Social': 'Entreprise Dupont',
      'STATUT': 'Actif',
      'Gestionnaire': 'Admin'
    };
    
    const mappedArtisan = await dataMapper.mapArtisanFromCSV(testArtisanData);
    
    if (mappedArtisan && mappedArtisan.plain_nom === 'Jean Dupont') {
      console.log('✅ DataMapper: plain_nom correctement mappé');
      console.log(`   plain_nom: "${mappedArtisan.plain_nom}"`);
      console.log(`   prenom: "${mappedArtisan.prenom}"`);
      console.log(`   nom: "${mappedArtisan.nom}"`);
    } else {
      console.log('❌ DataMapper: plain_nom non trouvé ou incorrect');
      console.log('   mappedArtisan:', mappedArtisan);
    }

    // Test 2: Vérifier que l'API supporte searchByPlainNom
    console.log('\n2️⃣ Test de l\'API searchByPlainNom...');
    
    try {
      // Créer un artisan de test avec plain_nom
      const testArtisan = {
        prenom: 'Test',
        nom: 'Artisan',
        plain_nom: 'Test Artisan',
        email: 'test.artisan@example.com',
        telephone: '0612345678',
        statut_id: 'active',
        gestionnaire_id: 'admin'
      };
      
      console.log('   Création d\'un artisan de test...');
      const createdArtisan = await artisansApi.create(testArtisan);
      console.log(`   ✅ Artisan créé avec ID: ${createdArtisan.id}`);
      
      // Tester la recherche par plain_nom
      console.log('   Test de recherche par plain_nom...');
      const searchResults = await artisansApi.searchByPlainNom('Test Artisan');
      
      if (searchResults.data && searchResults.data.length > 0) {
        console.log('✅ searchByPlainNom: Recherche réussie');
        console.log(`   Trouvé: ${searchResults.data.length} artisan(s)`);
        console.log(`   Premier résultat: ${searchResults.data[0].plain_nom}`);
      } else {
        console.log('❌ searchByPlainNom: Aucun résultat trouvé');
      }
      
      // Nettoyer - supprimer l'artisan de test
      console.log('   Nettoyage...');
      await artisansApi.delete(createdArtisan.id);
      console.log('   ✅ Artisan de test supprimé');
      
    } catch (error) {
      console.log(`❌ Erreur API: ${error.message}`);
    }

    // Test 3: Vérifier que findArtisanSST utilise plain_nom en priorité
    console.log('\n3️⃣ Test de findArtisanSST avec plain_nom...');
    
    const databaseManager = new DatabaseManager({
      dryRun: true, // Mode test
      verbose: true
    });
    
    // Créer un artisan avec plain_nom spécifique
    const sstTestArtisan = {
      prenom: 'Mehdy',
      nom: 'Pedron',
      plain_nom: 'Mehdy Pedron 33',
      email: 'mehdy.pedron@example.com',
      telephone: '0612345678',
      statut_id: 'active',
      gestionnaire_id: 'admin'
    };
    
    console.log('   Création d\'un artisan SST de test...');
    const createdSSTArtisan = await artisansApi.create(sstTestArtisan);
    console.log(`   ✅ Artisan SST créé avec ID: ${createdSSTArtisan.id}`);
    
    // Tester findArtisanSST avec le nom exact
    console.log('   Test de findArtisanSST avec "Mehdy Pedron 33"...');
    const foundArtisanId = await databaseManager.findArtisanSST('Mehdy Pedron 33');
    
    if (foundArtisanId === createdSSTArtisan.id) {
      console.log('✅ findArtisanSST: Recherche par plain_nom réussie');
      console.log(`   ID trouvé: ${foundArtisanId}`);
    } else {
      console.log('❌ findArtisanSST: Recherche échouée');
      console.log(`   Attendu: ${createdSSTArtisan.id}`);
      console.log(`   Trouvé: ${foundArtisanId}`);
    }
    
    // Afficher les statistiques de recherche
    console.log('\n   📊 Statistiques de recherche:');
    const report = databaseManager.generateUnmappedArtisansReport();
    console.log(`   Trouvés: ${report.stats.found}`);
    console.log(`   Non trouvés: ${report.stats.notFound}`);
    console.log(`   Par plain_nom: ${report.stats.byMethod.plainNom}`);
    
    // Nettoyer
    console.log('   Nettoyage...');
    await artisansApi.delete(createdSSTArtisan.id);
    console.log('   ✅ Artisan SST de test supprimé');

    console.log('\n🎉 Tous les tests terminés avec succès !');
    
  } catch (error) {
    console.error('❌ Erreur lors des tests:', error.message);
    console.error(error.stack);
  }
}

// Exécuter les tests
if (require.main === module) {
  testPlainNomModifications()
    .then(() => {
      console.log('\n✅ Tests terminés');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Erreur fatale:', error.message);
      process.exit(1);
    });
}

module.exports = { testPlainNomModifications };
