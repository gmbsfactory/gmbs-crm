#!/usr/bin/env node

/**
 * Script utilitaire pour générer un exemple de fichier .env.local
 * 
 * Ce script génère un fichier .env.local.example avec les variables
 * nécessaires pour la configuration Google Sheets.
 */

const fs = require('fs');
const path = require('path');
const { googleSheetsConfig } = require('./config/google-sheets-config');

function generateEnvExample() {
  const envExamplePath = path.join(process.cwd(), '.env.local.example');
  const envExampleContent = googleSheetsConfig.generateEnvExample();
  
  try {
    fs.writeFileSync(envExamplePath, envExampleContent, 'utf8');
    console.log('✅ Fichier .env.local.example généré avec succès !');
    console.log(`📄 Chemin: ${envExamplePath}`);
    console.log('\n💡 Prochaines étapes:');
    console.log('1. Copiez .env.local.example vers .env.local');
    console.log('2. Remplissez les valeurs avec vos credentials Google Sheets');
    console.log('3. Lancez l\'import avec: node scripts/imports/google-sheets-import.js --test --verbose');
    
  } catch (error) {
    console.error('❌ Erreur lors de la génération du fichier .env.local.example:', error.message);
    process.exit(1);
  }
}

function showCurrentConfig() {
  console.log('🔧 Configuration actuelle:');
  googleSheetsConfig.displayConfig();
  
  if (!googleSheetsConfig.isValid()) {
    console.log('\n💡 Pour configurer Google Sheets:');
    console.log('1. Lancez: node scripts/imports/generate-env-example.js');
    console.log('2. Copiez .env.local.example vers .env.local');
    console.log('3. Remplissez les valeurs avec vos credentials');
  }
}

function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
📋 Générateur de configuration Google Sheets

Usage:
  node scripts/imports/generate-env-example.js [options]

Options:
  --generate    Génère le fichier .env.local.example
  --show        Affiche la configuration actuelle
  --help        Affiche cette aide

Exemples:
  # Générer l'exemple de configuration
  node scripts/imports/generate-env-example.js --generate
  
  # Voir la configuration actuelle
  node scripts/imports/generate-env-example.js --show
`);
    process.exit(0);
  }
  
  if (args.includes('--generate')) {
    generateEnvExample();
  } else if (args.includes('--show')) {
    showCurrentConfig();
  } else {
    // Par défaut, générer l'exemple
    generateEnvExample();
  }
}

if (require.main === module) {
  main();
}

module.exports = { generateEnvExample, showCurrentConfig };

