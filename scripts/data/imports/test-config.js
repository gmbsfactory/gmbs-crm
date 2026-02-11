#!/usr/bin/env node

/**
 * Script de test unifié pour la configuration Google Sheets
 * 
 * Ce script teste la configuration avec toutes les méthodes possibles :
 * - Variables d'environnement spécifiques au projet
 * - Variables d'environnement génériques
 * - Fichier .env.local
 * - Fichier credentials.json
 * 
 * Usage:
 *   node scripts/imports/test-config.js [options]
 * 
 * Options:
 *   --env-vars        Affiche uniquement les variables d'environnement
 *   --native          Utilise l'API Google Sheets native (googleapis)
 *   --library         Utilise la bibliothèque google-spreadsheet
 *   --verbose         Affichage détaillé
 *   --help            Affiche cette aide
 */

const { google } = require('googleapis');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const fs = require('fs');
const path = require('path');

// Charger les variables d'environnement
require('dotenv').config({ path: '.env.local' });

// Importer la configuration centralisée
const { googleSheetsConfig } = require('./config/google-sheets-config');

class UnifiedConfigTester {
  constructor(options = {}) {
    this.options = {
      verbose: options.verbose || false,
      useNative: options.useNative || false,
      useLibrary: options.useLibrary || false,
      ...options
    };
  }

  /**
   * Affiche les variables d'environnement détectées
   */
  showEnvironmentVariables() {
    console.log('🔧 Variables d\'environnement détectées:\n');
    
    // Variables spécifiques au projet
    const projectVars = [
      'GOOGLE_CREDENTIALS_PATH',
      'GOOGLE_SHEETS_ID',
      'GOOGLE_SHEETS_ARTISANS_RANGE',
      'GOOGLE_SHEETS_INTERVENTIONS_RANGE'
    ];
    
    // Variables génériques
    const genericVars = [
      'GOOGLE_SHEETS_CLIENT_EMAIL',
      'GOOGLE_SHEETS_PRIVATE_KEY',
      'GOOGLE_SHEETS_SPREADSHEET_ID'
    ];
    
    console.log('📋 Variables spécifiques au projet:');
    projectVars.forEach(varName => {
      const value = process.env[varName];
      if (value) {
        console.log(`  ✅ ${varName}: ${value}`);
      } else {
        console.log(`  ❌ ${varName}: Non définie`);
      }
    });
    
    console.log('\n📋 Variables génériques:');
    genericVars.forEach(varName => {
      const value = process.env[varName];
      if (value) {
        if (varName.includes('KEY')) {
          console.log(`  ✅ ${varName}: Définie (${value.length} caractères)`);
        } else {
          console.log(`  ✅ ${varName}: ${value}`);
        }
      } else {
        console.log(`  ❌ ${varName}: Non définie`);
      }
    });
    
    // Afficher la configuration centralisée
    console.log('\n🔧 Configuration centralisée:');
    googleSheetsConfig.displayConfig();
  }

  /**
   * Teste la configuration avec l'API native (googleapis)
   */
  async testWithNativeAPI() {
    console.log('🧪 Test avec l\'API Google Sheets native (googleapis)...\n');
    
    try {
      // Vérifier les variables requises
      const credentialsPath = process.env.GOOGLE_CREDENTIALS_PATH;
      const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
      
      if (!credentialsPath || !spreadsheetId) {
        console.log('❌ Variables GOOGLE_CREDENTIALS_PATH et GOOGLE_SHEETS_ID requises pour l\'API native');
        return false;
      }
      
      // Charger les credentials
      if (!fs.existsSync(credentialsPath)) {
        console.log(`❌ Fichier de credentials introuvable: ${credentialsPath}`);
        return false;
      }
      
      const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
      console.log(`✅ Credentials chargés pour le projet: ${credentials.project_id}`);
      
      // Initialiser l'API avec la nouvelle méthode (sans warning)
      const auth = new google.auth.JWT({
        email: credentials.client_email,
        key: credentials.private_key,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
      });
      
      const sheets = google.sheets({ version: 'v4', auth });
      
      // Tester la connexion
      const response = await sheets.spreadsheets.get({
        spreadsheetId: spreadsheetId
      });
      
      console.log(`✅ Connexion réussie !`);
      console.log(`📄 Document: ${response.data.properties.title}`);
      
      // Lister les feuilles
      console.log('\n📋 Feuilles disponibles:');
      const sheetsList = response.data.sheets.map(sheet => ({
        title: sheet.properties.title,
        rowCount: sheet.properties.gridProperties.rowCount,
        columnCount: sheet.properties.gridProperties.columnCount
      }));
      
      sheetsList.forEach((sheet, index) => {
        console.log(`  ${index + 1}. ${sheet.title} (${sheet.rowCount} lignes, ${sheet.columnCount} colonnes)`);
      });
      
      // Tester la lecture des données
      await this.testDataReading(sheets, spreadsheetId);
      
      return true;
      
    } catch (error) {
      console.log(`❌ Erreur avec l'API native: ${error.message}`);
      return false;
    }
  }

  /**
   * Teste la configuration avec la bibliothèque google-spreadsheet
   */
  async testWithLibrary() {
    console.log('🧪 Test avec la bibliothèque google-spreadsheet...\n');
    
    try {
      const credentials = googleSheetsConfig.getCredentials();
      const spreadsheetId = googleSheetsConfig.getSpreadsheetId();
      
      if (!credentials || !spreadsheetId) {
        console.log('❌ Configuration incomplète pour la bibliothèque');
        return false;
      }
      
      const doc = new GoogleSpreadsheet(spreadsheetId);
      await doc.useServiceAccountAuth(credentials);
      await doc.loadInfo();
      
      console.log(`✅ Connexion réussie !`);
      console.log(`📄 Document: ${doc.title}`);
      
      // Lister les feuilles
      console.log('\n📋 Feuilles disponibles:');
      Object.keys(doc.sheetsByTitle).forEach((title, index) => {
        const sheet = doc.sheetsByTitle[title];
        console.log(`  ${index + 1}. ${title} (${sheet.rowCount} lignes, ${sheet.columnCount} colonnes)`);
      });
      
      return true;
      
    } catch (error) {
      console.log(`❌ Erreur avec la bibliothèque: ${error.message}`);
      return false;
    }
  }

  /**
   * Teste la lecture des données avec l'API native
   */
  async testDataReading(sheets, spreadsheetId) {
    console.log('\n📖 Test de lecture des données...');
    
    // Test des artisans
    if (process.env.GOOGLE_SHEETS_ARTISANS_RANGE) {
      try {
        console.log('🔍 Test des artisans...');
        const artisansData = await sheets.spreadsheets.values.get({
          spreadsheetId: spreadsheetId,
          range: process.env.GOOGLE_SHEETS_ARTISANS_RANGE
        });
        
        if (artisansData.data.values && artisansData.data.values.length > 0) {
          const headers = artisansData.data.values[0];
          const rowCount = artisansData.data.values.length - 1;
          console.log(`✅ Artisans: ${rowCount} lignes, ${headers.length} colonnes`);
          
          if (this.options.verbose) {
            console.log(`   Colonnes: ${headers.slice(0, 5).join(', ')}${headers.length > 5 ? '...' : ''}`);
            
            // Afficher un échantillon
            if (artisansData.data.values.length > 1) {
              console.log('   Échantillon (première ligne):');
              headers.slice(0, 3).forEach((header, i) => {
                const value = artisansData.data.values[1][i] || '(vide)';
                console.log(`     ${header}: ${value}`);
              });
              
              // Afficher spécifiquement la colonne Document Drive si elle existe
              const driveIndex = headers.findIndex(h => h.toLowerCase().includes('document drive') || h.toLowerCase().includes('drive'));
              if (driveIndex !== -1) {
                const rawDriveValue = artisansData.data.values[1][driveIndex] || '(vide)';
                const processedDriveValue = this.processDriveUrl(rawDriveValue);
                console.log(`     📁 Document Drive (brut): ${rawDriveValue}`);
                console.log(`     📁 Document Drive (traité): ${processedDriveValue}`);
              }
            }
          }
        } else {
          console.log('⚠️  Aucune donnée trouvée pour les artisans');
        }
      } catch (error) {
        console.log(`❌ Erreur lecture artisans: ${error.message}`);
      }
    }
    
    // Test des interventions
    if (process.env.GOOGLE_SHEETS_INTERVENTIONS_RANGE) {
      try {
        console.log('\n🔍 Test des interventions...');
        const interventionsData = await sheets.spreadsheets.values.get({
          spreadsheetId: spreadsheetId,
          range: process.env.GOOGLE_SHEETS_INTERVENTIONS_RANGE
        });
        
        if (interventionsData.data.values && interventionsData.data.values.length > 0) {
          const headers = interventionsData.data.values[0];
          const rowCount = interventionsData.data.values.length - 1;
          console.log(`✅ Interventions: ${rowCount} lignes, ${headers.length} colonnes`);
          
          if (this.options.verbose) {
            console.log(`   Colonnes: ${headers.slice(0, 5).join(', ')}${headers.length > 5 ? '...' : ''}`);
            
            // Afficher un échantillon
            if (interventionsData.data.values.length > 1) {
              console.log('   Échantillon (première ligne):');
              headers.slice(0, 3).forEach((header, i) => {
                const value = interventionsData.data.values[1][i] || '(vide)';
                console.log(`     ${header}: ${value}`);
              });
            }
          }
        } else {
          console.log('⚠️  Aucune donnée trouvée pour les interventions');
        }
      } catch (error) {
        console.log(`❌ Erreur lecture interventions: ${error.message}`);
      }
    }
  }

  /**
   * Traite l'URL du Drive Google (même logique que l'importeur)
   */
  processDriveUrl(driveName) {
    if (!driveName || driveName.trim() === '') return null;
    
    // Si c'est déjà une URL complète, la retourner
    if (driveName.startsWith('http')) {
      return driveName;
    }
    
    // Sinon, construire l'URL du Drive
    // Format: https://drive.google.com/drive/folders/FOLDER_ID
    return `https://drive.google.com/drive/folders/${driveName}`;
  }

  /**
   * Test complet de la configuration
   */
  async runFullTest() {
    console.log('🧪 Test complet de configuration Google Sheets...\n');
    
    // 1. Afficher les variables d'environnement
    this.showEnvironmentVariables();
    
    // 2. Tester avec l'API native si demandé
    if (this.options.useNative) {
      const nativeSuccess = await this.testWithNativeAPI();
      if (nativeSuccess) {
        console.log('\n🎉 Test avec l\'API native réussi !');
      }
    }
    
    // 3. Tester avec la bibliothèque si demandé
    if (this.options.useLibrary) {
      const librarySuccess = await this.testWithLibrary();
      if (librarySuccess) {
        console.log('\n🎉 Test avec la bibliothèque réussi !');
      }
    }
    
    // 4. Test automatique (choisir la meilleure méthode)
    if (!this.options.useNative && !this.options.useLibrary) {
      console.log('\n🔍 Test automatique...');
      
      // Essayer d'abord l'API native (plus fiable)
      if (process.env.GOOGLE_CREDENTIALS_PATH && process.env.GOOGLE_SHEETS_ID) {
        const nativeSuccess = await this.testWithNativeAPI();
        if (nativeSuccess) {
          console.log('\n🎉 Configuration validée avec l\'API native !');
          console.log('💡 Vous pouvez maintenant lancer l\'import avec:');
          console.log('   node scripts/imports/google-sheets-import.js --test-connection --verbose');
          return;
        }
      }
      
      // Fallback vers la bibliothèque
      const librarySuccess = await this.testWithLibrary();
      if (librarySuccess) {
        console.log('\n🎉 Configuration validée avec la bibliothèque !');
        console.log('💡 Vous pouvez maintenant lancer l\'import avec:');
        console.log('   node scripts/imports/google-sheets-import.js --test-connection --verbose');
      } else {
        console.log('\n❌ Aucune méthode de connexion n\'a fonctionné');
        console.log('💡 Vérifiez vos credentials et variables d\'environnement');
      }
    }
  }
}

// Fonction principale
function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
📋 Testeur de configuration Google Sheets unifié

Usage:
  node scripts/imports/test-config.js [options]

Options:
  --env-vars        Affiche uniquement les variables d'environnement
  --native          Utilise l'API Google Sheets native (googleapis)
  --library         Utilise la bibliothèque google-spreadsheet
  --verbose         Affichage détaillé
  --help            Affiche cette aide

Exemples:
  # Test complet automatique
  node scripts/imports/test-config.js --verbose
  
  # Voir les variables d'environnement
  node scripts/imports/test-config.js --env-vars
  
  # Test avec l'API native uniquement
  node scripts/imports/test-config.js --native --verbose
  
  # Test avec la bibliothèque uniquement
  node scripts/imports/test-config.js --library --verbose
`);
    process.exit(0);
  }
  
  const options = {
    verbose: args.includes('--verbose'),
    useNative: args.includes('--native'),
    useLibrary: args.includes('--library')
  };
  
  const tester = new UnifiedConfigTester(options);
  
  if (args.includes('--env-vars')) {
    tester.showEnvironmentVariables();
  } else {
    tester.runFullTest().catch(error => {
      console.error('💥 Erreur fatale:', error.message);
      process.exit(1);
    });
  }
}

if (require.main === module) {
  main();
}

module.exports = { UnifiedConfigTester };
