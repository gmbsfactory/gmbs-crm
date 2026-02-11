/**
 * Exemple d'utilisation du validateur centralisé
 * 
 * Ce fichier montre comment utiliser le validateur centralisé
 * pour éviter la redondance dans tous les composants.
 */

const { dataValidator } = require('../../data-processing/data-validator');

// ===== EXEMPLE 1: VALIDATION SIMPLE =====

function validateArtisanExample() {
  const artisanData = {
    prenom: 'Jean',
    nom: 'Dupont',
    email: 'jean.dupont@example.com',
    telephone: '0612345678',
    siret: '12345678901234'
  };

  // Utilisation du validateur centralisé
  const validation = dataValidator.validate(artisanData, 'artisan');
  
  console.log('Validation artisan:', validation);
  return validation;
}

// ===== EXEMPLE 2: VALIDATION POUR L'API =====

function validateForApiExample() {
  const artisanData = {
    prenom: 'Marie',
    nom: 'Martin',
    email: 'invalid-email', // Email invalide
    telephone: '123' // Téléphone trop court
  };

  // Validation directement au format API (avec codes d'erreur)
  const apiValidation = dataValidator.validateForApi(artisanData, 'artisan');
  
  console.log('Validation API:', apiValidation);
  return apiValidation;
}

// ===== EXEMPLE 3: VALIDATION EN LOT =====

function validateBatchExample() {
  const artisansData = [
    { prenom: 'Jean', nom: 'Dupont', email: 'jean@example.com' },
    { prenom: 'Marie', nom: 'Martin', email: 'invalid-email' },
    { prenom: '', nom: '', email: 'test@example.com' } // Pas de nom/prénom
  ];

  // Validation en lot
  const batchValidation = dataValidator.validateBatch(artisansData, 'artisan');
  
  console.log('Validation en lot:', batchValidation);
  return batchValidation;
}

// ===== EXEMPLE 4: UTILISATION DES RÈGLES COMMUNES =====

function showCommonRulesExample() {
  const { commonRules } = dataValidator;
  
  // Utiliser directement les règles communes
  const emailValidation = commonRules.validateEmail('test@example.com');
  const phoneValidation = commonRules.validatePhone('0612345678');
  const siretValidation = commonRules.validateSiret('12345678901234');
  
  console.log('Email valide:', emailValidation.isValid);
  console.log('Téléphone valide:', phoneValidation.isValid);
  console.log('SIRET valide:', siretValidation.isValid);
  
  return { emailValidation, phoneValidation, siretValidation };
}

// ===== EXEMPLE 5: GÉNÉRATION DE RAPPORTS =====

function generateReportExample() {
  const artisansData = [
    { prenom: 'Jean', nom: 'Dupont', email: 'jean@example.com' },
    { prenom: 'Marie', nom: 'Martin', email: 'invalid-email' }
  ];

  const batchValidation = dataValidator.validateBatch(artisansData, 'artisan');
  const report = dataValidator.generateReport(batchValidation, 'artisan');
  
  console.log('Rapport de validation:');
  console.log(report);
  return report;
}

// ===== EXEMPLE 6: INTÉGRATION DANS L'API =====

function apiIntegrationExample() {
  // Dans l'API Supabase, au lieu de recréer les règles :
  
  // ❌ AVANT (redondant) :
  // const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  // const isValidPhone = (phone) => phone.replace(/[^\d]/g, '').length >= 8;
  
  // ✅ APRÈS (réutilise le code existant) :
  const { commonRules } = dataValidator;
  const emailValidation = commonRules.validateEmail('test@example.com');
  const phoneValidation = commonRules.validatePhone('0612345678');
  
  return { emailValidation, phoneValidation };
}

// ===== EXEMPLE 7: WORKFLOW COMPLET =====

async function completeWorkflowExample() {
  const artisansData = [
    { prenom: 'Jean', nom: 'Dupont', email: 'jean@example.com', telephone: '0612345678' },
    { prenom: 'Marie', nom: 'Martin', email: 'marie@example.com', telephone: '0698765432' }
  ];

  // 1. Validation en lot
  const validation = dataValidator.validateBatch(artisansData, 'artisan');
  
  // 2. Génération du rapport
  const report = dataValidator.generateReport(validation, 'artisan');
  
  // 3. Validation pour l'API (si nécessaire)
  const validArtisans = validation.valid.map(item => item.artisan);
  const apiValidations = validArtisans.map(artisan => 
    dataValidator.validateForApi(artisan, 'artisan')
  );
  
  console.log('Workflow complet terminé');
  console.log(`Artisans valides: ${validation.validCount}/${validation.total}`);
  
  return {
    validation,
    report,
    apiValidations
  };
}

// ===== EXPORT DES EXEMPLES =====

module.exports = {
  validateArtisanExample,
  validateForApiExample,
  validateBatchExample,
  showCommonRulesExample,
  generateReportExample,
  apiIntegrationExample,
  completeWorkflowExample
};

// ===== EXÉCUTION DES EXEMPLES (si appelé directement) =====

if (require.main === module) {
  console.log('🧪 Exécution des exemples de validation...\n');
  
  console.log('1. Validation simple:');
  validateArtisanExample();
  
  console.log('\n2. Validation pour API:');
  validateForApiExample();
  
  console.log('\n3. Validation en lot:');
  validateBatchExample();
  
  console.log('\n4. Utilisation des règles communes:');
  showCommonRulesExample();
  
  console.log('\n5. Génération de rapport:');
  generateReportExample();
  
  console.log('\n6. Intégration API:');
  apiIntegrationExample();
  
  console.log('\n7. Workflow complet:');
  completeWorkflowExample().then(() => {
    console.log('\n✅ Tous les exemples exécutés avec succès !');
  });
}
