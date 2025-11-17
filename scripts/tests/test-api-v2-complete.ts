#!/usr/bin/env node

// ===== SCRIPT DE TEST DE L'API V2 =====
// Ce script teste toutes les fonctionnalités de l'API v2

import {
    artisansApiV2,
    commentsApi,
    documentsApi,
    interventionsApiV2
} from '../../src/lib/supabase-api-v2.js';

// Configuration
const TEST_CONFIG = {
  SUPABASE_URL: process.env.SUPABASE_URL || 'http://127.0.0.1:54321',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  TEST_TIMEOUT: 30000 // 30 secondes
};

// Utilitaires de test
const log = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
  const colors = {
    info: '\x1b[36m',    // Cyan
    success: '\x1b[32m',  // Vert
    error: '\x1b[31m'     // Rouge
  };
  const reset = '\x1b[0m';
  const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
  console.log(`${colors[type]}${icon} ${message}${reset}`);
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Tests
async function testInterventionsAPI() {
  log('🧪 Test des Interventions API');
  
  try {
    // Test 1: Créer une intervention
    log('Test 1: Création d\'intervention');
    const intervention = await interventionsApiV2.create({
      contexte_intervention: 'Test API v2 - Intervention de test',
      adresse: '123 Rue de Test',
      ville: 'Paris',
      code_postal: '75001',
      statut_id: 'DEMANDE',
      date: new Date().toISOString()
    });
    
    log(`Intervention créée avec l'ID: ${intervention.id}`, 'success');
    
    // Test 2: Récupérer toutes les interventions
    log('Test 2: Récupération des interventions');
    const interventions = await interventionsApiV2.getAll({ limit: 10 });
    log(`${interventions.data.length} interventions récupérées`, 'success');
    
    // Test 3: Récupérer une intervention par ID
    log('Test 3: Récupération par ID');
    const interventionById = await interventionsApiV2.getById(intervention.id);
    log(`Intervention récupérée: ${interventionById.contexte_intervention}`, 'success');
    
    // Test 4: Mettre à jour une intervention
    log('Test 4: Mise à jour d\'intervention');
    const updatedIntervention = await interventionsApiV2.update(intervention.id, {
      statut_id: 'EN_COURS',
      contexte_intervention: 'Test API v2 - Intervention mise à jour'
    });
    log(`Intervention mise à jour: ${updatedIntervention.statut_id}`, 'success');
    
    // Test 5: Supprimer une intervention
    log('Test 5: Suppression d\'intervention');
    await interventionsApiV2.delete(intervention.id);
    log('Intervention supprimée', 'success');
    
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log(`Erreur dans les tests d'interventions: ${message}`, 'error');
    return false;
  }
}

async function testArtisansAPI() {
  log('🧪 Test des Artisans API');
  
  try {
    // Test 1: Créer un artisan
    log('Test 1: Création d\'artisan');
    const artisan = await artisansApiV2.create({
      raison_sociale: 'Test API v2 - Artisan Test',
      siret: `1234567890123${Date.now().toString().slice(-2)}`, // SIRET unique
      email: `test.${Date.now()}@example.com`,
      telephone: '0123456789',
      adresse_siege_social: '456 Avenue Test',
      ville_siege_social: 'Lyon',
      code_postal_siege_social: '69000',
      statut_id: 'ACTIF'
    });
    
    log(`Artisan créé avec l'ID: ${artisan.id}`, 'success');
    
    // Test 2: Récupérer tous les artisans
    log('Test 2: Récupération des artisans');
    const artisans = await artisansApiV2.getAll({ limit: 10 });
    log(`${artisans.data.length} artisans récupérés`, 'success');
    
    // Test 3: Récupérer un artisan par ID
    log('Test 3: Récupération par ID');
    const artisanById = await artisansApiV2.getById(artisan.id);
    log(`Artisan récupéré: ${artisanById.raison_sociale}`, 'success');
    
    // Test 4: Mettre à jour un artisan
    log('Test 4: Mise à jour d\'artisan');
    const updatedArtisan = await artisansApiV2.update(artisan.id, {
      statut_id: 'INACTIF',
      raison_sociale: 'Test API v2 - Artisan mis à jour'
    });
    log(`Artisan mis à jour: ${updatedArtisan.statut_id}`, 'success');
    
    // Test 5: Supprimer un artisan
    log('Test 5: Suppression d\'artisan');
    await artisansApiV2.delete(artisan.id);
    log('Artisan supprimé', 'success');
    
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log(`Erreur dans les tests d'artisans: ${message}`, 'error');
    return false;
  }
}

async function testCommentsAPI() {
  log('🧪 Test des Commentaires API');
  
  try {
    // Créer une intervention pour tester les commentaires
    const intervention = await interventionsApiV2.create({
      contexte_intervention: 'Test Commentaires API',
      adresse: '789 Rue Commentaire',
      ville: 'Marseille',
      statut_id: 'DEMANDE',
      date: new Date().toISOString()
    });
    
    // Test 1: Créer un commentaire
    log('Test 1: Création de commentaire');
    const comment = await commentsApi.create({
      entity_id: intervention.id,
      entity_type: 'intervention',
      content: 'Ceci est un commentaire de test pour l\'API v2',
      comment_type: 'internal'
    });
    
    log(`Commentaire créé avec l'ID: ${comment.id}`, 'success');
    
    // Test 2: Récupérer les commentaires d'une intervention
    log('Test 2: Récupération des commentaires');
    const commentsResponse = await commentsApi.getAll({
      entity_type: 'intervention',
      entity_id: intervention.id
    });
    const comments = commentsResponse.data ?? [];
    log(`${comments.length} commentaires récupérés`, 'success');
    
    // Test 3: Mettre à jour un commentaire
    log('Test 3: Mise à jour de commentaire');
    const updatedComment = await commentsApi.update(comment.id, {
      content: 'Commentaire mis à jour via API v2'
    });
    log(`Commentaire mis à jour: ${updatedComment.content}`, 'success');
    
    // Test 4: Supprimer un commentaire
    log('Test 4: Suppression de commentaire');
    await commentsApi.delete(comment.id);
    log('Commentaire supprimé', 'success');
    
    // Nettoyer l'intervention de test
    await interventionsApiV2.delete(intervention.id);
    
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log(`Erreur dans les tests de commentaires: ${message}`, 'error');
    return false;
  }
}

async function testDocumentsAPI() {
  log('🧪 Test des Documents API');
  
  try {
    // Créer une intervention pour tester les documents
    const intervention = await interventionsApiV2.create({
      contexte_intervention: 'Test Documents API',
      adresse: '321 Rue Document',
      ville: 'Toulouse',
      statut_id: 'DEMANDE',
      date: new Date().toISOString()
    });
    
    // Test 1: Créer un document fictif (simulation)
    log('Test 1: Création de document');
    
    // Créer un fichier de test en mémoire et le convertir en base64
    const testContent = 'Ceci est un document de test pour l\'API v2';
    const testContentBuffer = Buffer.from(testContent, 'utf-8');
    const testContentBase64 = testContentBuffer.toString('base64');
    
    const document = await documentsApi.upload({
      entity_id: intervention.id,
      entity_type: 'intervention',
      kind: 'devis',
      filename: 'test-document.txt',
      mime_type: 'text/plain',
      file_size: testContentBuffer.length,
      content: testContentBase64
    });
    log(`Document créé avec l'ID: ${document.id}`, 'success');
    
    // Test 2: Récupérer les documents d'une intervention
    log('Test 2: Récupération des documents');
    const documentsResponse = await documentsApi.getAll({
      entity_id: intervention.id,
      entity_type: 'intervention'
    });
    const documents = documentsResponse.data ?? [];
    log(`${documents.length} documents récupérés`, 'success');
    
    // Test 3: Supprimer un document
    log('Test 3: Suppression de document');
    await documentsApi.delete(document.id);
    log('Document supprimé', 'success');
    
    // Nettoyer l'intervention de test
    await interventionsApiV2.delete(intervention.id);
    
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log(`Erreur dans les tests de documents: ${message}`, 'error');
    return false;
  }
}

async function testWorkflowComplet() {
  log('🧪 Test du Workflow Complet');
  
  try {
    // Étape 1: Créer un artisan
    log('Étape 1: Création d\'artisan');
    const artisan = await artisansApiV2.create({
      raison_sociale: 'Workflow Test - Artisan',
      siret: `9876543210987${Date.now().toString().slice(-2)}`,
      email: `workflow.${Date.now()}@test.com`,
      telephone: '0987654321',
      adresse_siege_social: '999 Rue Workflow',
      ville_siege_social: 'Nice',
      code_postal_siege_social: '06000',
      statut_id: 'ACTIF'
    });
    
    // Étape 2: Créer une intervention
    log('Étape 2: Création d\'intervention');
    const intervention = await interventionsApiV2.create({
      contexte_intervention: 'Workflow Test - Intervention complète',
      adresse: '888 Avenue Workflow',
      ville: 'Nice',
      code_postal: '06000',
      statut_id: 'DEMANDE',
      date: new Date().toISOString()
    });
    
    // Étape 3: Assigner l'artisan à l'intervention
    log('Étape 3: Assignation d\'artisan');
    const assignment = await interventionsApiV2.assignArtisan(
      intervention.id, 
      artisan.id, 
      'primary'
    );
    log(`Artisan assigné avec l'ID: ${assignment.id}`, 'success');
    
    // Étape 4: Ajouter un commentaire
    log('Étape 4: Ajout de commentaire');
    const comment = await commentsApi.create({
      entity_id: intervention.id,
      entity_type: 'intervention',
      content: 'Commentaire du workflow complet - API v2',
      comment_type: 'internal'
    });
    log(`Commentaire ajouté avec l'ID: ${comment.id}`, 'success');
    
    // Étape 5: Changer le statut de l'intervention
    log('Étape 5: Changement de statut');
    const updatedIntervention = await interventionsApiV2.update(intervention.id, {
      statut_id: 'EN_COURS'
    });
    log(`Statut changé vers: ${updatedIntervention.statut_id}`, 'success');
    
    // Étape 6: Nettoyer (supprimer dans l'ordre inverse)
    log('Étape 6: Nettoyage');
    await commentsApi.delete(comment.id);
    await interventionsApiV2.delete(intervention.id);
    await artisansApiV2.delete(artisan.id);
    log('Workflow complet terminé avec succès', 'success');
    
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log(`Erreur dans le workflow complet: ${message}`, 'error');
    return false;
  }
}

// Fonction principale
async function runAllTests() {
  log('🚀 DÉMARRAGE DES TESTS DE L\'API V2', 'info');
  log(`URL Supabase: ${TEST_CONFIG.SUPABASE_URL}`, 'info');
  log(`Clé Service Role: ${TEST_CONFIG.SUPABASE_SERVICE_ROLE_KEY ? '✅ Configurée' : '❌ Manquante'}`, 'info');
  
  if (!TEST_CONFIG.SUPABASE_SERVICE_ROLE_KEY) {
    log('❌ SUPABASE_SERVICE_ROLE_KEY manquante. Arrêt des tests.', 'error');
    process.exit(1);
  }
  
  const startTime = Date.now();
  const results = {
    interventions: false,
    artisans: false,
    comments: false,
    documents: false,
    workflow: false
  };
  
  try {
    // Tests individuels
    results.interventions = await testInterventionsAPI();
    await sleep(1000); // Pause entre les tests
    
    results.artisans = await testArtisansAPI();
    await sleep(1000);
    
    results.comments = await testCommentsAPI();
    await sleep(1000);
    
    results.documents = await testDocumentsAPI();
    await sleep(1000);
    
    // Test du workflow complet
    results.workflow = await testWorkflowComplet();
    
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log(`Erreur générale: ${message}`, 'error');
  }
  
  const endTime = Date.now();
  const duration = endTime - startTime;
  
  // Résumé des résultats
  log('\n📊 RÉSUMÉ DES TESTS', 'info');
  log(`Durée totale: ${duration}ms`, 'info');
  
  const passedTests = Object.values(results).filter(Boolean).length;
  const totalTests = Object.keys(results).length;
  
  log(`Tests réussis: ${passedTests}/${totalTests}`, passedTests === totalTests ? 'success' : 'error');
  
  Object.entries(results).forEach(([test, passed]) => {
    log(`${test}: ${passed ? '✅ Réussi' : '❌ Échoué'}`, passed ? 'success' : 'error');
  });
  
  if (passedTests === totalTests) {
    log('\n🎉 TOUS LES TESTS SONT PASSÉS ! L\'API V2 FONCTIONNE PARFAITEMENT !', 'success');
    process.exit(0);
  } else {
    log('\n⚠️  CERTAINS TESTS ONT ÉCHOUÉ. VÉRIFIEZ LA CONFIGURATION.', 'error');
    process.exit(1);
  }
}

// Exécution si le script est lancé directement
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests().catch(console.error);
}

export { runAllTests };
