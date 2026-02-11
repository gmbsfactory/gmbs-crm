#!/usr/bin/env node

/**
 * Script de test pour valider le mapping CSV avec les données réelles
 * 
 * Ce script teste le mapping des colonnes CSV vers les champs de base de données
 * avec des données d'exemple basées sur la structure réelle du CSV.
 * 
 * Usage:
 *   node scripts/test-csv-mapping.js
 */

const { 
  preprocessInterventionData, 
  preprocessArtisanData,
  processNumber,
  processDate,
  processString
} = require('../data-preprocessor');

// Données d'exemple basées sur la structure réelle du CSV
const sampleInterventionData = {
  'Date': '04/04/2024',
  'Agence': 'AFEDIM',
  'Adresse d\'intervention': '3 A RUE DE LA DIVISION LECLERC 67120 DORLISHEIM',
  'ID': '3615',
  'Statut': 'Accepté',
  'Contexte d\'intervention': 'acompte ok 1550€  18 juillet / RENOVATION SUITE DDE\nBonjour, Pouvez-vous chiffrer la reprise de la salle de bains suite à un sinistre, mur, plafond, meubles...(double vassque lagreur 140 hauteur standard(blanc)  // le miroir le meuble et le caisson a refaire, il y a des endroit e nettoyer avec un produit car sale ( sdb la ou y a du carrelage sur mur)',
  'Métier': 'Renovation',
  'Gest.': 'B',
  'SST': '',
  'COUT SST': '2976,55 dire 2900',
  'COÛT MATERIEL': '',
  'Numéro SST': '',
  'COUT INTER': '3 525,06',
  '% SST': '',
  'PROPRIO': 'Afedim gestion',
  'Date d\'intervention': '',
  'TEL LOC': '06 58 94 45 48',
  'Locataire': 'MME FATIMA HERNANDEZ',
  'Em@il Locataire': '',
  'COMMENTAIRE': '',
  'Truspilot': '',
  'Demande d\'intervention ✅': '',
  'Demande Devis ✅': '',
  'Demande TrustPilot ✅': ''
};

const sampleArtisanData = {
  'Prénom': 'Jean',
  'Nom': 'Dupont',
  'Téléphone': '01 23 45 67 89',
  'Email': 'jean.dupont@example.com',
  'Raison sociale': 'SARL Dupont Renovation',
  'SIRET': '12345678901234',
  'Statut juridique': 'SARL',
  'Statut dossier': 'COMPLET',
  'Statut artisan': 'ACTIF',
  'Adresse siège social': '123 Rue de la Paix 75001 Paris',
  'Ville siège social': 'Paris',
  'Code postal siège social': '75001',
  'Adresse intervention': '456 Avenue des Champs 75008 Paris',
  'Ville intervention': 'Paris',
  'Code postal intervention': '75008',
  'Latitude intervention': '48.8566',
  'Longitude intervention': '2.3522',
  'Nom prénom': 'Dupont Jean',
  'Numéro associé': 'A001',
  'Date ajout': '01/01/2024',
  'Suivi relances docs': 'En cours',
  'Nombre interventions': '5',
  'Coût SST': '1500,50',
  'Coût intervention': '2000,75',
  'Coût matériel': '500,25',
  'Gain brut': '1000,00',
  'Pourcentage SST': '75,5',
  'Métier': 'Renovation'
};

// Fonction pour logger
function log(message, level = 'info') {
  const timestamp = new Date().toISOString();
  
  switch (level) {
    case 'error':
      console.error(`❌ ${message}`);
      break;
    case 'warn':
      console.warn(`⚠️  ${message}`);
      break;
    case 'success':
      console.log(`✅ ${message}`);
      break;
    default:
      console.log(`ℹ️  ${message}`);
  }
}

// Fonction pour tester le préprocessing des interventions
function testInterventionPreprocessing() {
  log('🧪 Test du préprocessing des interventions', 'info');
  
  try {
    const processed = preprocessInterventionData(sampleInterventionData, true);
    
    log('Résultat du préprocessing:', 'info');
    console.log(JSON.stringify(processed, null, 2));
    
    // Vérifications spécifiques
    log('\nVérifications:', 'info');
    
    if (processed.id_facture === 3615) {
      log('✅ ID facture correctement mappé', 'success');
    } else {
      log(`❌ ID facture incorrect: ${processed.id_facture}`, 'error');
    }
    
    if (processed.date && processed.date.includes('2024-04-04T00:00:00.000Z')) {
      log('✅ Date correctement convertie en UTC', 'success');
    } else {
      log(`❌ Date incorrecte: ${processed.date}`, 'error');
    }
    
    if (processed.agence === 'AFEDIM') {
      log('✅ Agence correctement mappée', 'success');
    } else {
      log(`❌ Agence incorrecte: ${processed.agence}`, 'error');
    }
    
    if (processed.cout_sst === 2976.55) {
      log('✅ Coût SST correctement converti (virgule -> point)', 'success');
    } else {
      log(`❌ Coût SST incorrect: ${processed.cout_sst}`, 'error');
    }
    
    if (processed.cout_intervention === 3525.06) {
      log('✅ Coût intervention correctement converti (espaces supprimés)', 'success');
    } else {
      log(`❌ Coût intervention incorrect: ${processed.cout_intervention}`, 'error');
    }
    
    if (processed.code_postal === '67120') {
      log('✅ Code postal extrait de l\'adresse', 'success');
    } else {
      log(`❌ Code postal incorrect: ${processed.code_postal}`, 'error');
    }
    
    if (processed.ville === 'DORLISHEIM') {
      log('✅ Ville extraite de l\'adresse', 'success');
    } else {
      log(`❌ Ville incorrecte: ${processed.ville}`, 'error');
    }
    
    if (processed.tel_loc === '0658944548') {
      log('✅ Téléphone locataire nettoyé (espaces supprimés)', 'success');
    } else {
      log(`❌ Téléphone locataire incorrect: ${processed.tel_loc}`, 'error');
    }
    
    return true;
  } catch (error) {
    log(`❌ Erreur lors du test des interventions: ${error.message}`, 'error');
    return false;
  }
}

// Fonction pour tester le préprocessing des artisans
function testArtisanPreprocessing() {
  log('\n🧪 Test du préprocessing des artisans', 'info');
  
  try {
    const processed = preprocessArtisanData(sampleArtisanData, true);
    
    log('Résultat du préprocessing:', 'info');
    console.log(JSON.stringify(processed, null, 2));
    
    // Vérifications spécifiques
    log('\nVérifications:', 'info');
    
    if (processed.prenom === 'Jean') {
      log('✅ Prénom correctement mappé', 'success');
    } else {
      log(`❌ Prénom incorrect: ${processed.prenom}`, 'error');
    }
    
    if (processed.nom === 'Dupont') {
      log('✅ Nom correctement mappé', 'success');
    } else {
      log(`❌ Nom incorrect: ${processed.nom}`, 'error');
    }
    
    if (processed.telephone === '0123456789') {
      log('✅ Téléphone correctement nettoyé', 'success');
    } else {
      log(`❌ Téléphone incorrect: ${processed.telephone}`, 'error');
    }
    
    if (processed.email === 'jean.dupont@example.com') {
      log('✅ Email correctement validé', 'success');
    } else {
      log(`❌ Email incorrect: ${processed.email}`, 'error');
    }
    
    if (processed.siret === '12345678901234') {
      log('✅ SIRET correctement validé', 'success');
    } else {
      log(`❌ SIRET incorrect: ${processed.siret}`, 'error');
    }
    
    if (processed.cout_sst === 1500.50) {
      log('✅ Coût SST correctement converti', 'success');
    } else {
      log(`❌ Coût SST incorrect: ${processed.cout_sst}`, 'error');
    }
    
    return true;
  } catch (error) {
    log(`❌ Erreur lors du test des artisans: ${error.message}`, 'error');
    return false;
  }
}

// Fonction pour tester les fonctions de conversion individuelles
function testConversionFunctions() {
  log('\n🧪 Test des fonctions de conversion individuelles', 'info');
  
  // Test des nombres
  log('Test des nombres:', 'info');
  const numberTests = [
    { input: '2976,55 dire 2900', expected: 2976.55, name: 'Nombre avec virgule et texte' },
    { input: '3 525,06', expected: 3525.06, name: 'Nombre avec espaces et virgule' },
    { input: '1 234,56', expected: 1234.56, name: 'Nombre avec espaces de milliers' },
    { input: '1500.50', expected: 1500.50, name: 'Nombre avec point décimal' },
    { input: '', expected: null, name: 'Valeur vide' },
    { input: 'abc', expected: null, name: 'Texte non numérique' }
  ];
  
  numberTests.forEach(test => {
    const result = processNumber(test.input, 'test', true);
    if (result === test.expected) {
      log(`✅ ${test.name}: ${test.input} -> ${result}`, 'success');
    } else {
      log(`❌ ${test.name}: ${test.input} -> ${result} (attendu: ${test.expected})`, 'error');
    }
  });
  
  // Test des dates
  log('\nTest des dates:', 'info');
  const dateTests = [
    { input: '04/04/2024', expected: '2024-04-04', name: 'Date DD/MM/YYYY' },
    { input: '2024-04-04', expected: '2024-04-04', name: 'Date YYYY-MM-DD' },
    { input: '25/12/2023', expected: '2023-12-25', name: 'Date de Noël' },
    { input: '', expected: null, name: 'Date vide' },
    { input: 'invalid', expected: null, name: 'Date invalide' }
  ];
  
  dateTests.forEach(test => {
    const result = processDate(test.input, 'test', true);
    if (result && result.includes(test.expected)) {
      log(`✅ ${test.name}: ${test.input} -> ${result}`, 'success');
    } else {
      log(`❌ ${test.name}: ${test.input} -> ${result} (attendu: ${test.expected})`, 'error');
    }
  });
  
  // Test des chaînes
  log('\nTest des chaînes:', 'info');
  const stringTests = [
    { input: 'AFEDIM', expected: 'AFEDIM', name: 'Chaîne simple' },
    { input: '  Espaces  ', expected: 'Espaces', name: 'Chaîne avec espaces' },
    { input: '', expected: null, name: 'Chaîne vide' },
    { input: 'null', expected: null, name: 'Chaîne "null"' }
  ];
  
  stringTests.forEach(test => {
    const result = processString(test.input, 'test', 100, true);
    if (result === test.expected) {
      log(`✅ ${test.name}: "${test.input}" -> "${result}"`, 'success');
    } else {
      log(`❌ ${test.name}: "${test.input}" -> "${result}" (attendu: "${test.expected}")`, 'error');
    }
  });
  
  // Test des téléphones
  log('\nTest des téléphones:', 'info');
  const phoneTests = [
    { input: '06 58 94 45 48', expected: '0658944548', name: 'Téléphone avec espaces' },
    { input: '01.23.45.67.89', expected: '0123456789', name: 'Téléphone avec points' },
    { input: '01-23-45-67-89', expected: '0123456789', name: 'Téléphone avec tirets' },
    { input: '+33 1 23 45 67 89', expected: '33123456789', name: 'Téléphone international' },
    { input: '0123456789', expected: '0123456789', name: 'Téléphone déjà propre' },
    { input: '123', expected: null, name: 'Téléphone trop court' },
    { input: '', expected: null, name: 'Téléphone vide' }
  ];
  
  const { processPhone } = require('../data-preprocessor');
  phoneTests.forEach(test => {
    const result = processPhone(test.input, 'test', true);
    if (result === test.expected) {
      log(`✅ ${test.name}: "${test.input}" -> "${result}"`, 'success');
    } else {
      log(`❌ ${test.name}: "${test.input}" -> "${result}" (attendu: "${test.expected}")`, 'error');
    }
  });
}

// Fonction principale
async function main() {
  try {
    log('🚀 Début des tests de mapping CSV', 'info');
    
    let allTestsPassed = true;
    
    // Test des interventions
    log('\n--- Test: Préprocessing des interventions ---', 'info');
    const interventionTestPassed = testInterventionPreprocessing();
    allTestsPassed = allTestsPassed && interventionTestPassed;
    
    // Test des artisans
    log('\n--- Test: Préprocessing des artisans ---', 'info');
    const artisanTestPassed = testArtisanPreprocessing();
    allTestsPassed = allTestsPassed && artisanTestPassed;
    
    // Test des fonctions de conversion
    log('\n--- Test: Fonctions de conversion ---', 'info');
    const conversionTestPassed = testConversionFunctions();
    allTestsPassed = allTestsPassed && conversionTestPassed;
    
    // Résumé
    log('\n🎯 Résumé des tests', 'info');
    if (allTestsPassed) {
      log(`\n🎉 Tous les tests sont passés ! Le mapping CSV est correct.`, 'success');
    } else {
      log(`\n⚠️  Certains tests ont échoué. Vérifiez le mapping des colonnes.`, 'warn');
    }
  } catch (error) {
    log(`💥 Erreur fatale: ${error.message}`, 'error');
    throw error;
  }
}

// Lancer les tests
if (require.main === module) {
  main().catch(error => {
    log(`💥 Erreur fatale: ${error.message}`, 'error');
    process.exit(1);
  });
}

module.exports = { main };
