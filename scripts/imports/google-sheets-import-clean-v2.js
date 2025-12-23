#!/usr/bin/env node

/**
 * Script Principal d'Import Google Sheets V2 - GMBS CRM
 * 
 * Version refactorisée utilisant l'API modulaire V2 pour l'import des données 
 * depuis Google Sheets vers la base de données Supabase.
 * 
 * Usage:
 *   node scripts/imports/google-sheets-import-clean-v2.js [options]
 * 
 * Options:
 *   --test                 Mode test (génère rapport dans data/imports/processed)
 *   --artisans-only        Importer uniquement les artisans
 *   --interventions-only   Importer uniquement les interventions
 *   --dry-run              Mode test sans écriture en base
 *   --verbose              Affichage détaillé
 *   --limit=N              Limiter le nombre d'interventions/artisans (pour debug)
 *   --batch-size=N         Taille des lots (défaut: 50)
 *   --credentials=PATH     Chemin vers credentials.json (défaut: ./credentials.json)
 *   --spreadsheet-id=ID    ID du Google Spreadsheet
 *   --help                 Afficher cette aide
 */

// ===== CHARGER LES VARIABLES D'ENVIRONNEMENT EN PREMIER =====
// IMPORTANT: Doit être chargé AVANT tous les imports qui utilisent Supabase
// car env.ts lit les variables au moment du chargement du module
const fs = require('fs');
const path = require('path');

const envFile = process.env.NODE_ENV === 'production' 
  ? '.env.production' 
  : '.env.local';

// Utiliser un chemin absolu depuis la racine du projet
const envFilePath = path.resolve(process.cwd(), envFile);

// Vérifier si les variables essentielles sont déjà définies (exportées par le shell)
const essentialVarsDefined = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY;

// Charger le fichier seulement s'il existe et si les variables essentielles ne sont pas déjà définies
if (fs.existsSync(envFilePath) && !essentialVarsDefined) {
  require('dotenv').config({ path: envFilePath });
  if (process.env.VERBOSE || process.argv.includes('--verbose')) {
    console.log(`📝 Variables chargées depuis: ${envFilePath}`);
  }
} else if (essentialVarsDefined) {
  if (process.env.VERBOSE || process.argv.includes('--verbose')) {
    console.log(`📝 Variables déjà définies dans l'environnement (depuis le shell)`);
    console.log(`   NEXT_PUBLIC_SUPABASE_URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅' : '❌'}`);
    console.log(`   SUPABASE_SERVICE_ROLE_KEY: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ (' + process.env.SUPABASE_SERVICE_ROLE_KEY.length + ' caractères)' : '❌'}`);
  }
} else if (!fs.existsSync(envFilePath)) {
  console.warn(`⚠️  Fichier ${envFilePath} non trouvé et variables essentielles non définies`);
  console.warn(`   Assurez-vous que NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont définies`);
}

// Maintenant on peut importer les modules qui dépendent de Supabase
const { google } = require('googleapis');
const { DatabaseManager } = require('./database/database-manager-v2');

// Imports des modules de traitement existants
const { DataMapper } = require('../data-processing/data-mapper');
const { dataValidator } = require('../data-processing/data-validator');
const { googleSheetsConfig } = require('./config/google-sheets-config');
const { ReportGenerator } = require('./reporting/report-generator');

class GoogleSheetsImportCleanV2 {
  constructor(options = {}) {
    this.options = {
      test: options.test || false,
      artisansOnly: options.artisansOnly || false,
      interventionsOnly: options.interventionsOnly || false,
      dryRun: options.dryRun || false,
      verbose: options.verbose || false,
      limit: options.limit || null, // Limite pour debug
      batchSize: options.batchSize || 100,
      credentialsPath: options.credentialsPath || './credentials.json',
      spreadsheetId: options.spreadsheetId || null,
      upsert: options.upsert || false,
      dateStart: options.dateStart || null, // Format: "DD/MM/YYYY" ou "YYYY-MM-DD"
      dateEnd: options.dateEnd || null,     // Format: "DD/MM/YYYY" ou "YYYY-MM-DD"
      ...options
    };
    
    this.sheets = null;
    this.auth = null;
    
    // Déterminer le type d'import pour le DataMapper
    const importType = this.options.artisansOnly ? 'artisans' 
                    : this.options.interventionsOnly ? 'interventions'
                    : 'parsing';
    this.dataMapper = new DataMapper({ importType });
    
    // Utiliser le nouveau DatabaseManager V2 avec l'API modulaire
    this.databaseManager = new DatabaseManager({
      dryRun: this.options.dryRun,
      verbose: this.options.verbose,
      batchSize: this.options.batchSize,
      upsert: this.options.upsert,
      dataMapper: this.dataMapper // Passer la référence au DataMapper
    });
    
    this.reportGenerator = new ReportGenerator({
      dryRun: this.options.dryRun,
      verbose: this.options.verbose
    });
    
    this.results = {
      artisans: { processed: 0, valid: 0, invalid: 0, inserted: 0, errors: 0, withoutName: [] },
      interventions: { processed: 0, valid: 0, invalid: 0, inserted: 0, errors: 0 },
      clients: { processed: 0, valid: 0, invalid: 0, inserted: 0, errors: 0 },
      costs: { processed: 0, valid: 0, invalid: 0, inserted: 0, errors: 0 }
    };
  }

  // ===== AFFICHAGE DE LA CONFIGURATION =====

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

  // ===== INITIALISATION =====

  /**
   * Initialise l'authentification Google Sheets
   */
  async initializeAuth() {
    try {
      console.log('🔐 Initialisation de l\'authentification Google Sheets...');
      
      // Utiliser la configuration centralisée
      const credentials = googleSheetsConfig.getCredentials();
      
      if (!credentials || !credentials.client_email || !credentials.private_key) {
        throw new Error('Configuration Google Sheets incomplète. Vérifiez les variables d\'environnement.');
      }
      
      // Créer l'authentification JWT avec la syntaxe correcte
      this.auth = new google.auth.JWT({
        email: credentials.client_email,
        key: credentials.private_key,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
      });
      
      // Initialiser l'API Sheets
      this.sheets = google.sheets({ version: 'v4', auth: this.auth });
      
      console.log('✅ Authentification Google Sheets initialisée');
      return true;
      
    } catch (error) {
      console.error('❌ Erreur lors de l\'initialisation de l\'authentification:', error.message);
      return false;
    }
  }

  /**
   * Teste la connexion à Google Sheets
   */
  async testConnectionToSheets() {
    try {
      console.log('🔌 Test de connexion à Google Sheets...');
      
      const spreadsheetId = googleSheetsConfig.getSpreadsheetId();
      
      if (!spreadsheetId) {
        throw new Error('ID du spreadsheet non défini');
      }
      
      // Test simple de lecture
      const response = await this.sheets.spreadsheets.get({
        spreadsheetId: spreadsheetId,
        fields: 'properties.title'
      });
      
      console.log(`✅ Connexion réussie - Spreadsheet: "${response.data.properties.title}"`);
      return true;
      
    } catch (error) {
      console.error('❌ Erreur de connexion:', error.message);
      return false;
    }
  }

  // ===== IMPORT DES DONNÉES =====

  /**
   * Importe les artisans depuis Google Sheets
   */
  async importArtisans() {
    // Protection: ne pas importer les artisans si on est en mode interventions-only
    if (this.options.interventionsOnly) {
      console.log('⚠️ Mode --interventions-only activé: import des artisans ignoré');
      return { success: 0, errors: 0, invalid: [] };
    }
    
    try {
      console.log('👷 Import des artisans...');
      
      const spreadsheetId = googleSheetsConfig.getSpreadsheetId();
      const range = process.env.GOOGLE_SHEETS_ARTISANS_RANGE || 'Artisans!A:Z';
      
      // Extraire le nom de la feuille
      const sheetName = range.split('!')[0];
      
      // Étape 1: Toujours lire A1 pour avoir les vrais headers
      const headerRange = `${sheetName}!A1:Z1`;
      const headerResponse = await this.sheets.spreadsheets.values.get({
        spreadsheetId: spreadsheetId,
        range: headerRange
      });
      const headersFromA1 = headerResponse.data.values?.[0] || [];
      
      // Étape 2: Lire les données selon le range spécifié
      const dataResponse = await this.sheets.spreadsheets.values.get({
        spreadsheetId: spreadsheetId,
        range: range
      });
      const rows = dataResponse.data.values || [];
      
      if (!rows || rows.length === 0) {
        console.log('⚠️ Aucune donnée d\'artisan trouvée');
        return { success: 0, errors: 0 };
      }
      
      // Étape 3: Double vérification - déterminer où sont vraiment les headers
      let headers;
      let dataRows;
      
      // Vérifier si le range commence à A2
      const rangeStartsAtA2 = range.includes('!A2:') || range.includes('!A2:Z');
      
      if (rangeStartsAtA2) {
        // Range commence à A2, utiliser les headers depuis A1
        console.log('📋 Range commence à A2, utilisation des headers depuis A1');
        headers = headersFromA1;
        dataRows = rows; // Les données commencent déjà à A2
        
        // Vérifier si la première ligne ressemble aux headers (doublon)
        if (dataRows.length > 0 && headers.length > 0) {
          const firstRow = dataRows[0];
          const similarity = this.compareRowToHeaders(firstRow, headers);
          if (similarity > 0.8) { // 80% de similarité = probablement un doublon
            console.log(`⚠️ Première ligne détectée comme doublon des headers (${Math.round(similarity * 100)}% similaire), elle sera ignorée`);
            dataRows = dataRows.slice(1);
          }
        }
      } else {
        // Range commence à A1, vérifier si la première ligne est vraiment les headers
        const firstRow = rows[0];
        const similarityToA1Headers = this.compareRowToHeaders(firstRow, headersFromA1);
        
        // Si la première ligne ressemble beaucoup aux headers A1, alors A1 contient les vrais headers
        if (similarityToA1Headers > 0.8) {
          console.log('📋 Headers détectés à A1 (première ligne du range)');
          headers = firstRow;
          dataRows = rows.slice(1);
        } else {
          // La première ligne ne ressemble pas aux headers A1, vérifier si elle ressemble à des données
          // Si A1 a des headers valides et la première ligne ressemble à des données, utiliser A1
          if (headersFromA1.length > 0 && this.looksLikeDataRow(firstRow)) {
            console.log('📋 Headers détectés à A1 (première ligne du range ressemble à des données)');
            headers = headersFromA1;
            dataRows = rows; // Utiliser toutes les lignes car les headers sont à A1
          } else {
            // Par défaut, utiliser la première ligne comme headers
            console.log('📋 Utilisation de la première ligne du range comme headers (par défaut)');
            headers = firstRow;
            dataRows = rows.slice(1);
          }
        }
      }
      
      // Validation finale des headers
      if (!headers || headers.length === 0) {
        console.error('❌ Impossible de déterminer les headers');
        return { success: 0, errors: 1 };
      }
      
      // Afficher les headers et les premières lignes en mode verbose
      if (this.options.verbose) {
        console.log('\n📋 Headers détectés:');
        console.log(`   ${headers.slice(0, 10).join(' | ')}${headers.length > 10 ? ' ...' : ''}`);
        console.log(`   Total: ${headers.length} colonnes`);
        
        if (dataRows.length > 0) {
          console.log('\n📋 Première ligne de données brute:');
          const firstRow = dataRows[0];
          console.log(`   ${firstRow.slice(0, 10).map((val, idx) => `[${headers[idx]}]=${val || '(vide)'}`).join(' | ')}${firstRow.length > 10 ? ' ...' : ''}`);
          
          // Afficher aussi la deuxième ligne si disponible
          if (dataRows.length > 1) {
            console.log('\n📋 Deuxième ligne de données brute:');
            const secondRow = dataRows[1];
            console.log(`   ${secondRow.slice(0, 10).map((val, idx) => `[${headers[idx]}]=${val || '(vide)'}`).join(' | ')}${secondRow.length > 10 ? ' ...' : ''}`);
          }
        }
      }
      
      // Appliquer la limite si spécifiée (pour debug)
      if (this.options.limit && this.options.limit > 0) {
        console.log(`⚠️  MODE DEBUG: Limitation à ${this.options.limit} artisans`);
        dataRows = dataRows.slice(0, this.options.limit);
      }
      
      console.log(`📊 ${dataRows.length} lignes d'artisans à traiter`);
      
      // Conversion des données en objets
      const validArtisans = [];
      const invalidArtisans = [];
      
      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        
        // Créer un objet à partir des headers et de la row
        const artisanObj = {};
        headers.forEach((header, index) => {
          artisanObj[header] = row[index] || '';
        });
        
        try {
          // Afficher les données brutes pour les premières lignes en mode verbose
          if (this.options.verbose && i < 3) {
            console.log(`\n🔍 Ligne ${i + 2} - Données brutes (premiers champs):`);
            const sampleKeys = Object.keys(artisanObj).slice(0, 5);
            sampleKeys.forEach(key => {
              const value = artisanObj[key];
              console.log(`   ${key}: ${value !== undefined && value !== null ? `"${value}"` : '(undefined/null)'}`);
            });
          }
          
          // Mapper les données avec le DataMapper
          const mappedArtisan = await this.dataMapper.mapArtisanFromCSV(artisanObj, i);
          
          if (mappedArtisan) {
            // Afficher le résultat du mapping pour les premières lignes
            if (this.options.verbose && validArtisans.length < 3) {
              console.log(`\n✅ Ligne ${i + 2} - Artisan mappé avec succès:`);
              console.log(`   Nom: ${mappedArtisan.nom || '(vide)'}`);
              console.log(`   Prénom: ${mappedArtisan.prenom || '(vide)'}`);
              console.log(`   Email: ${mappedArtisan.email || '(vide)'}`);
              console.log(`   Téléphone: ${mappedArtisan.telephone || '(vide)'}`);
            }
            validArtisans.push(mappedArtisan);
            this.results.artisans.valid++;
          } else {
            // Afficher pourquoi la ligne est considérée comme invalide
            if (this.options.verbose && invalidArtisans.length < 3) {
              console.log(`\n⚠️  Ligne ${i + 2} - Rejetée (ligne vide ou invalide)`);
              const nomPrenom = artisanObj["Nom"] || artisanObj["Nom Prénom"];
              console.log(`   Nom/Prénom trouvé: ${nomPrenom || '(aucun)'}`);
            }
            invalidArtisans.push({ row: i + 2, reason: 'Ligne vide ou invalide' });
            this.results.artisans.invalid++;
          }
        } catch (error) {
          invalidArtisans.push({ row: i + 2, error: error.message });
          this.results.artisans.invalid++;
          // Afficher seulement les 10 premières erreurs pour éviter le spam
          if (this.options.verbose && invalidArtisans.length <= 10) {
            console.log(`❌ Erreur mapping ligne ${i + 2}: ${error.message}`);
          }
        }
        
        this.results.artisans.processed++;
        
        // Afficher la progression tous les 100 artisans
        if ((i + 1) % 100 === 0) {
          console.log(`  📊 Progression: ${i + 1}/${dataRows.length} lignes traitées (${validArtisans.length} valides, ${invalidArtisans.length} invalides)`);
        }
      }
      
      console.log(`\n📊 Résumé du mapping:`);
      console.log(`   ✅ Artisans valides mappés: ${validArtisans.length}`);
      console.log(`   ❌ Artisans invalides: ${invalidArtisans.length}`);
      
      // Insertion en base de données
      if (validArtisans.length > 0) {
        console.log(`\n💾 Insertion de ${validArtisans.length} artisans en base de données...`);
        const insertResults = await this.databaseManager.insertArtisans(validArtisans);
        this.results.artisans.inserted += insertResults.success;
        this.results.artisans.errors += insertResults.errors;
        // Stocker les artisans sans nom détectés (rejetés)
        if (insertResults.withoutName && insertResults.withoutName.length > 0) {
          this.results.artisans.withoutName = insertResults.withoutName;
          // Ajuster les compteurs : les artisans rejetés sont comptés dans errors
          // mais doivent aussi être retirés des valid car ils n'ont pas été insérés
          this.results.artisans.valid -= insertResults.withoutName.length;
        }
        
        // Afficher les détails des erreurs si présentes
        if (insertResults.errors > 0 && insertResults.details) {
          const errorDetails = insertResults.details.filter(d => d.error);
          if (errorDetails.length > 0) {
            console.log(`\n⚠️  Détails des erreurs d'insertion (premières 10):`);
            errorDetails.slice(0, 10).forEach((detail, idx) => {
              const artisan = detail.artisan;
              const artisanName = artisan ? `${artisan.prenom || ''} ${artisan.nom || ''}`.trim() : 'Inconnu';
              console.log(`   ${idx + 1}. Ligne ${detail.index + 1} (${artisanName}): ${detail.error}`);
            });
            if (errorDetails.length > 10) {
              console.log(`   ... et ${errorDetails.length - 10} autres erreurs`);
            }
          }
        }
      } else {
        console.log(`\n⚠️  Aucun artisan valide à insérer !`);
        if (invalidArtisans.length > 0 && invalidArtisans.length <= 20) {
          console.log(`\n   Exemples d'artisans invalides:`);
          invalidArtisans.slice(0, 10).forEach(inv => {
            console.log(`   - Ligne ${inv.row}: ${inv.reason || inv.error}`);
          });
        }
      }
      
      console.log(`\n✅ Artisans importés: ${this.results.artisans.inserted} succès, ${this.results.artisans.errors} erreurs`);
      
      return {
        success: this.results.artisans.inserted,
        errors: this.results.artisans.errors,
        invalid: invalidArtisans
      };
      
    } catch (error) {
      console.error('❌ Erreur lors de l\'import des artisans:', error.message);
      return { success: 0, errors: 1 };
    }
  }

  /**
   * Importe les interventions depuis Google Sheets
   */
  async importInterventions() {
    try {
      console.log('🔧 Import des interventions...');
      
      const spreadsheetId = googleSheetsConfig.getSpreadsheetId();
      const range = process.env.GOOGLE_SHEETS_INTERVENTIONS_RANGE || 'Interventions!A:Z';
      
      // Détecter si le range commence à A2 (sans headers) ou A1 (avec headers)
      const rangeStartsAtA2 = range.includes('!A2:') || range.includes('!A2:Z');
      
      let headers;
      let dataRows;
      
      if (rangeStartsAtA2) {
        // Le range commence à A2, il faut lire les headers séparément depuis A1
        console.log('📋 Range commence à A2, lecture des headers depuis A1...');
        const sheetName = range.split('!')[0];
        const headerRange = `${sheetName}!A1:Z1`;
        
        const headerResponse = await this.sheets.spreadsheets.values.get({
          spreadsheetId: spreadsheetId,
          range: headerRange
        });
        
        headers = headerResponse.data.values?.[0] || [];
        
        // Maintenant lire les données depuis A2
        const dataResponse = await this.sheets.spreadsheets.values.get({
          spreadsheetId: spreadsheetId,
          range: range
        });
        
        dataRows = dataResponse.data.values || [];
      } else {
        // Le range commence à A1, les headers sont dans la première ligne
        const response = await this.sheets.spreadsheets.values.get({
          spreadsheetId: spreadsheetId,
          range: range
        });
        
        const rows = response.data.values;
        if (!rows || rows.length <= 1) {
          console.log('⚠️ Aucune donnée d\'intervention trouvée');
          return { success: 0, errors: 0 };
        }
        
        headers = rows[0];
        dataRows = rows.slice(1);
      }
      
      if (!headers || headers.length === 0) {
        console.log('⚠️ Aucun header trouvé');
        return { success: 0, errors: 0 };
      }
      
      if (!dataRows || dataRows.length === 0) {
        console.log('⚠️ Aucune donnée d\'intervention trouvée');
        return { success: 0, errors: 0 };
      }
      
      // Vérifier si la première ligne de données correspond aux headers (doublon)
      // Cela peut arriver si les headers sont dupliqués dans Google Sheets
      if (dataRows.length > 0) {
        const firstRow = dataRows[0];
        const isHeaderRow = headers.every((header, index) => {
          const firstRowValue = String(firstRow[index] || '').trim();
          const headerValue = String(header || '').trim();
          return firstRowValue === headerValue || firstRowValue === '';
        });
        
        if (isHeaderRow && firstRow.some(cell => cell && String(cell).trim() !== '')) {
          console.log('⚠️ Première ligne détectée comme doublon des headers, elle sera ignorée');
          dataRows = dataRows.slice(1);
        }
      }
      
      // DEBUG: Afficher les headers pour voir le nom exact de la colonne Statut
      if (this.options.verbose) {
        console.log(`\n📋 Headers bruts depuis Google Sheets (${headers.length} colonnes):`);
        headers.forEach((header, index) => {
          const hasStatut = header && header.toLowerCase().includes('statut');
          const marker = hasStatut ? ' 👈 STATUT' : '';
          console.log(`   [${index}] "${header}"${marker}`);
        });
        
        // Chercher spécifiquement la colonne Statut
        const statutHeaderIndex = headers.findIndex(h => h && h.toLowerCase().includes('statut'));
        if (statutHeaderIndex >= 0) {
          console.log(`\n✅ Colonne Statut trouvée à l'index ${statutHeaderIndex}: "${headers[statutHeaderIndex]}"`);
          // Afficher quelques valeurs de cette colonne
          console.log(`   Valeurs de la colonne Statut (5 premières lignes):`);
          dataRows.slice(0, 5).forEach((row, i) => {
            const value = row[statutHeaderIndex] || '(vide)';
            console.log(`     Ligne ${i + 2}: "${value}"`);
          });
        } else {
          console.log(`\n❌ Aucune colonne contenant "statut" trouvée dans les headers !`);
        }
      }
      
      // Appliquer la limite si spécifiée (pour debug)
      if (this.options.limit && this.options.limit > 0) {
        console.log(`⚠️  MODE DEBUG: Limitation à ${this.options.limit} interventions`);
        dataRows = dataRows.slice(0, this.options.limit);
      }
      
      console.log(`📊 ${dataRows.length} lignes d'interventions à traiter`);
      
      // Conversion des données en objets
      const validInterventions = [];
      const invalidInterventions = [];
      
      // Afficher le filtre de date si activé
      if (this.options.dateStart || this.options.dateEnd) {
        console.log(`📅 Filtre par période activé:`);
        if (this.options.dateStart) {
          console.log(`   Date de début: ${this.options.dateStart}`);
        }
        if (this.options.dateEnd) {
          console.log(`   Date de fin: ${this.options.dateEnd}`);
        }
      }
      
      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        
        // Créer un objet à partir des headers et de la row
        const interventionObj = {};
        headers.forEach((header, index) => {
          interventionObj[header] = row[index] || '';
        });
        
        // Filtrer par période si les options sont définies
        if (this.options.dateStart || this.options.dateEnd) {
          // Chercher la date dans plusieurs colonnes possibles (FErn est le nom utilisé dans certains sheets)
          const dateValue = interventionObj["FErn"] || interventionObj["Date "] || interventionObj["Date"] || interventionObj["Date d'intervention"];
          if (!this.isDateInRange(dateValue, this.options.dateStart, this.options.dateEnd)) {
            // Ignorer cette intervention (ne pas compter comme traitée)
            continue;
          }
        }
        
        try {
          // Mapper les données avec le DataMapper
          const mappedIntervention = await this.dataMapper.mapInterventionFromCSV(interventionObj, this.options.verbose, i);
          
          if (mappedIntervention) {
            // Stocker la ligne CSV originale pour l'extraction des coûts après insertion
            mappedIntervention._originalCSVRow = interventionObj;
            validInterventions.push(mappedIntervention);
            this.results.interventions.valid++;
          } else {
            invalidInterventions.push({ row: i + 2, reason: 'Ligne vide ou invalide' });
            this.results.interventions.invalid++;
          }
        } catch (error) {
          invalidInterventions.push({ row: i + 2, error: error.message });
          this.results.interventions.invalid++;
        }
        
        this.results.interventions.processed++;
      }
      
      // Insertion en base de données
      if (validInterventions.length > 0) {
        const insertResults = await this.databaseManager.insertInterventions(validInterventions);
        this.results.interventions.inserted += insertResults.success;
        this.results.interventions.errors += insertResults.errors;
      }
      
      console.log(`✅ Interventions importées: ${this.results.interventions.inserted} succès, ${this.results.interventions.errors} erreurs`);
      
      return {
        success: this.results.interventions.inserted,
        errors: this.results.interventions.errors,
        invalid: invalidInterventions
      };
      
    } catch (error) {
      console.error('❌ Erreur lors de l\'import des interventions:', error.message);
      return { success: 0, errors: 1 };
    }
  }

  // ===== IMPORT PRINCIPAL =====

  /**
   * Lance l'import complet
   */
  async importAll() {
    try {
      console.log('🚀 Démarrage de l\'import Google Sheets V2...');
      
      // Test de connexion (l'auth est déjà initialisée)
      if (!await this.testConnectionToSheets()) {
        throw new Error('Échec du test de connexion');
      }
      
      // Import selon les options
      if (this.options.artisansOnly) {
        await this.importArtisans();
      } else if (this.options.interventionsOnly) {
        await this.importInterventions();
      } else {
        // Import complet
        await this.importArtisans();
        await this.importInterventions();
      }
      
      // Génération du rapport
      await this.generateReport();
      
      console.log('✅ Import terminé avec succès!');
      
    } catch (error) {
      console.error('❌ Erreur lors de l\'import:', error.message);
      throw error;
    }
  }

  /**
   * Génère le rapport final
   */
  async generateReport() {
    try {
      console.log('\n📊 Rapport d\'import:');
      console.log('='.repeat(50));
      
      console.log('👷 Artisans:');
      console.log(`  - Traités: ${this.results.artisans.processed}`);
      console.log(`  - Valides: ${this.results.artisans.valid}`);
      console.log(`  - Invalides: ${this.results.artisans.invalid}`);
      console.log(`  - Insérés: ${this.results.artisans.inserted}`);
      console.log(`  - Erreurs: ${this.results.artisans.errors}`);
      
      console.log('\n🔧 Interventions:');
      console.log(`  - Traitées: ${this.results.interventions.processed}`);
      console.log(`  - Valides: ${this.results.interventions.valid}`);
      console.log(`  - Invalides: ${this.results.interventions.invalid}`);
      console.log(`  - Insérées: ${this.results.interventions.inserted}`);
      console.log(`  - Erreurs: ${this.results.interventions.errors}`);
      
      console.log('\n👥 Clients:');
      console.log(`  - Traités: ${this.results.clients.processed}`);
      console.log(`  - Valides: ${this.results.clients.valid}`);
      console.log(`  - Invalides: ${this.results.clients.invalid}`);
      console.log(`  - Insérés: ${this.results.clients.inserted}`);
      console.log(`  - Erreurs: ${this.results.clients.errors}`);
      
      // Afficher les artisans sans nom si disponibles
      if (this.results.artisans.withoutName && this.results.artisans.withoutName.length > 0) {
        console.log('\n⚠️ Artisans rejetés (sans nom):');
        console.log(`  - Total rejeté: ${this.results.artisans.withoutName.length}`);
        if (this.options.verbose) {
          console.log('  - Détails des artisans rejetés:');
          this.results.artisans.withoutName.slice(0, 10).forEach((item, idx) => {
            console.log(`    ${idx + 1}. Ligne ${item.index + 1}: ${item.prenom || 'N/A'} (tél: ${item.telephone || 'N/A'}, email: ${item.email || 'N/A'})`);
          });
          if (this.results.artisans.withoutName.length > 10) {
            console.log(`    ... et ${this.results.artisans.withoutName.length - 10} autre(s)`);
          }
        }
      }
      
      // Générer le rapport détaillé si demandé
      if (this.options.test || this.options.verbose) {
        try {
          // Vérifier si la méthode existe avant de l'appeler
          if (this.reportGenerator && typeof this.reportGenerator.generateDetailedReport === 'function') {
            await this.reportGenerator.generateDetailedReport(this.results);
          } else {
            console.log('ℹ️ Rapport détaillé non disponible (méthode non implémentée)');
          }
        } catch (reportError) {
          console.log('⚠️ Impossible de générer le rapport détaillé:', reportError.message);
        }
      }
      
    } catch (error) {
      console.error('❌ Erreur lors de la génération du rapport:', error.message);
    }
  }

  // ===== MÉTHODES DE CONFIGURATION =====

  setDryRun(enabled = true) {
    this.options.dryRun = enabled;
    this.databaseManager.options.dryRun = enabled;
    console.log(`🔧 Mode dry-run ${enabled ? 'activé' : 'désactivé'}`);
  }

  setVerbose(enabled = true) {
    this.options.verbose = enabled;
    this.databaseManager.options.verbose = enabled;
    console.log(`🔧 Mode verbose ${enabled ? 'activé' : 'désactivé'}`);
  }

  setBatchSize(size) {
    this.options.batchSize = size;
    this.databaseManager.options.batchSize = size;
    console.log(`🔧 Taille des lots définie à ${size}`);
  }

  // ===== MÉTHODES DE DIAGNOSTIC =====

  async testConnection() {
    console.log('🔌 Test de connexion à la base de données...');
    
    try {
      // Test simple avec la nouvelle API
      const { usersApi } = require('../../src/lib/api/v2');
      const users = await usersApi.getAll({ limit: 1 });
      
      console.log('✅ Connexion à la base de données réussie');
      return true;
    } catch (error) {
      console.log(`❌ Erreur de connexion: ${error.message}`);
      return false;
    }
  }

  // ===== MÉTHODES UTILITAIRES POUR DÉTECTION DES HEADERS =====

  /**
   * Compare une ligne aux headers pour déterminer la similarité
   * Retourne un score entre 0 et 1 (1 = identique)
   */
  compareRowToHeaders(row, headers) {
    if (!row || !headers || row.length === 0 || headers.length === 0) {
      return 0;
    }
    
    let matches = 0;
    const minLength = Math.min(row.length, headers.length);
    
    for (let i = 0; i < minLength; i++) {
      const rowVal = String(row[i] || '').trim().toLowerCase();
      const headerVal = String(headers[i] || '').trim().toLowerCase();
      
      if (rowVal === headerVal) {
        matches++;
      } else if (rowVal && headerVal && (rowVal.includes(headerVal) || headerVal.includes(rowVal))) {
        matches += 0.5; // Correspondance partielle
      }
    }
    
    return matches / minLength;
  }
  
  /**
   * Détermine si une ligne ressemble à des données plutôt qu'à des headers
   * Les headers ont généralement des noms de colonnes courts et descriptifs
   * Les données ont souvent des valeurs plus longues, des emails, des numéros, etc.
   */
  looksLikeDataRow(row) {
    if (!row || row.length === 0) return false;
    
    // Compter les indices de "données"
    let dataIndicators = 0;
    
    row.forEach(cell => {
      const value = String(cell || '').trim();
      
      // Email = données
      if (value.includes('@')) dataIndicators++;
      
      // Numéro de téléphone = données
      if (/[\d\s\+\-\(\)]{8,}/.test(value)) dataIndicators++;
      
      // SIRET = données
      if (/^\d{14}$/.test(value)) dataIndicators++;
      
      // Code postal = données
      if (/^\d{5}$/.test(value)) dataIndicators++;
      
      // Valeur très longue (> 30 caractères) = probablement des données
      if (value.length > 30) dataIndicators++;
    });
    
    // Si plus de 30% des cellules ressemblent à des données, c'est probablement une ligne de données
    return dataIndicators / row.length > 0.3;
  }

  // ===== MÉTHODES UTILITAIRES POUR FILTRE PAR DATE =====

  /**
   * Vérifie si une date CSV est dans la plage spécifiée
   * @param {string} dateValue - Date au format CSV (DD/MM/YYYY)
   * @param {string} dateStart - Date de début (DD/MM/YYYY ou YYYY-MM-DD)
   * @param {string} dateEnd - Date de fin (DD/MM/YYYY ou YYYY-MM-DD)
   * @returns {boolean} - True si la date est dans la plage
   */
  isDateInRange(dateValue, dateStart, dateEnd) {
    if (!dateValue) return false; // Si pas de date, exclure par défaut
    
    // Parser la date du CSV (format DD/MM/YYYY)
    const parsedDate = this.parseDateFromCSV(dateValue);
    if (!parsedDate) return false;
    
    const date = new Date(parsedDate);
    
    // Parser les dates de filtrage
    const startDate = dateStart ? this.parseDateFilter(dateStart) : null;
    const endDate = dateEnd ? this.parseDateFilter(dateEnd) : null;
    
    // Si date de fin, inclure le jour complet (fin de journée)
    if (endDate) {
      endDate.setHours(23, 59, 59, 999);
    }
    
    if (startDate && date < startDate) return false;
    if (endDate && date > endDate) return false;
    
    return true;
  }

  /**
   * Parse une date depuis le CSV (format DD/MM/YYYY)
   * @param {string} dateValue - Date au format CSV
   * @returns {string|null} - Date au format ISO ou null
   */
  parseDateFromCSV(dateValue) {
    if (!dateValue || String(dateValue).trim() === "") return null;
    
    const strValue = String(dateValue).trim();
    
    // Format DD/MM/YYYY
    if (/^\d{2}\/\d{2}\/\d{4}/.test(strValue)) {
      const parts = strValue.split("/");
      if (parts.length >= 3) {
        const day = parts[0].padStart(2, "0");
        const month = parts[1].padStart(2, "0");
        const year = parts[2];
        return `${year}-${month}-${day}T00:00:00Z`;
      }
    }
    
    // Format YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}/.test(strValue)) {
      return `${strValue}T00:00:00Z`;
    }
    
    return null;
  }

  /**
   * Parse une date de filtre (accepte DD/MM/YYYY ou YYYY-MM-DD)
   * @param {string} dateStr - Date au format DD/MM/YYYY ou YYYY-MM-DD
   * @returns {Date|null} - Objet Date ou null
   */
  parseDateFilter(dateStr) {
    if (!dateStr) return null;
    
    const str = String(dateStr).trim();
    
    // Format DD/MM/YYYY
    if (/^\d{2}\/\d{2}\/\d{4}/.test(str)) {
      const parts = str.split("/");
      if (parts.length >= 3) {
        return new Date(`${parts[2]}-${parts[1]}-${parts[0]}T00:00:00Z`);
      }
    }
    
    // Format YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
      return new Date(`${str}T00:00:00Z`);
    }
    
    return null;
  }

  async validateConfiguration() {
    console.log('⚙️ Validation de la configuration...');
    
    const issues = [];
    
    // Vérifier la configuration Google Sheets
    const config = googleSheetsConfig.getConfig();
    if (!config.clientEmail || !config.privateKey) {
      issues.push('Configuration Google Sheets manquante');
    }
    
    // Vérifier la configuration de la base de données
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
      issues.push('Configuration base de données manquante');
    }
    
    if (issues.length > 0) {
      console.log(`⚠️ Problèmes de configuration détectés: ${issues.join(', ')}`);
      return false;
    }
    
    console.log('✅ Configuration validée');
    return true;
  }
}

// ===== FONCTIONS UTILITAIRES =====

function createImportInstance(options = {}) {
  return new GoogleSheetsImportCleanV2(options);
}

function createDryRunInstance() {
  return new GoogleSheetsImportCleanV2({
    dryRun: true,
    verbose: true
  });
}

function createVerboseInstance() {
  return new GoogleSheetsImportCleanV2({
    verbose: true
  });
}

// ===== EXPORTS =====

module.exports = {
  GoogleSheetsImportCleanV2,
  createImportInstance,
  createDryRunInstance,
  createVerboseInstance
};

// ===== SCRIPT PRINCIPAL =====

if (require.main === module) {
  async function main() {
    try {
      const args = process.argv.slice(2);
      
      // Afficher l'aide si demandé
      if (args.includes('--help') || args.includes('-h')) {
        console.log(`
🚀 Script d'Import Google Sheets V2 - GMBS CRM

Usage:
  npx tsx scripts/imports/google-sheets-import-clean-v2.js [options]

Options:
  --help, -h                 Afficher cette aide
  --test                     Mode test (génère rapport dans data/imports/processed)
  --artisans-only            Importer uniquement les artisans
  --interventions-only       Importer uniquement les interventions
  --dry-run                  Mode test sans écriture en base
  --verbose                  Affichage détaillé
  --upsert                   Mode upsert (met à jour les enregistrements existants au lieu de créer des doublons)
  --limit=N                  Limiter le nombre d'interventions/artisans (pour debug)
  --batch-size=N             Taille des lots (défaut: 50)
  --date-start=DD/MM/YYYY    Filtrer les interventions à partir de cette date (inclus)
  --date-end=DD/MM/YYYY      Filtrer les interventions jusqu'à cette date (inclus)
  --credentials=PATH         Chemin vers credentials.json (défaut: ./credentials.json)
  --spreadsheet-id=ID        ID du Google Spreadsheet
  --test-connection          Tester la connexion à la base de données
  --validate-config          Valider la configuration

Exemples:
  # Import complet
  npx tsx scripts/imports/google-sheets-import-clean-v2.js

  # Import en mode upsert (évite les doublons, met à jour les données existantes)
  npx tsx scripts/imports/google-sheets-import-clean-v2.js --upsert --verbose

  # Import en mode dry-run avec verbose
  npx tsx scripts/imports/google-sheets-import-clean-v2.js --dry-run --verbose

  # Import des artisans uniquement
  npx tsx scripts/imports/google-sheets-import-clean-v2.js --artisans-only

  # Import rapide pour debug (10 premières interventions)
  npx tsx scripts/imports/google-sheets-import-clean-v2.js --interventions-only --limit=10 --verbose

  # Import des interventions d'une période spécifique
  npx tsx scripts/imports/google-sheets-import-clean-v2.js --interventions-only --date-start=01/01/2025 --date-end=31/01/2025

  # Import des interventions depuis une date
  npx tsx scripts/imports/google-sheets-import-clean-v2.js --interventions-only --date-start=01/01/2025

  # Test de connexion
  npx tsx scripts/imports/google-sheets-import-clean-v2.js --test-connection
        `);
        return;
      }
      
      const options = {};

      // Parsing des arguments
      if (args.includes('--dry-run')) options.dryRun = true;
      if (args.includes('--verbose')) options.verbose = true;
      if (args.includes('--test')) options.test = true;
      if (args.includes('--artisans-only')) options.artisansOnly = true;
      if (args.includes('--interventions-only')) options.interventionsOnly = true;
      if (args.includes('--upsert')) options.upsert = true;
      
      // Limite pour debug
      const limitArg = args.find(arg => arg.startsWith('--limit='));
      if (limitArg) {
        options.limit = parseInt(limitArg.split('=')[1]) || null;
      }
      
      // Filtre par date
      const dateStartArg = args.find(arg => arg.startsWith('--date-start='));
      if (dateStartArg) {
        options.dateStart = dateStartArg.split('=')[1];
      }
      
      const dateEndArg = args.find(arg => arg.startsWith('--date-end='));
      if (dateEndArg) {
        options.dateEnd = dateEndArg.split('=')[1];
      }
      
      // Taille des lots
      const batchSizeArg = args.find(arg => arg.startsWith('--batch-size='));
      if (batchSizeArg) {
        options.batchSize = parseInt(batchSizeArg.split('=')[1]) || 50;
      }
      
      // Credentials
      const credentialsArg = args.find(arg => arg.startsWith('--credentials='));
      if (credentialsArg) {
        options.credentialsPath = credentialsArg.split('=')[1];
      }
      
      // Spreadsheet ID
      const spreadsheetArg = args.find(arg => arg.startsWith('--spreadsheet-id='));
      if (spreadsheetArg) {
        options.spreadsheetId = spreadsheetArg.split('=')[1];
      }

      // Tests de connexion et configuration
      if (args.includes('--test-connection')) {
        const instance = new GoogleSheetsImportCleanV2(options);
        await instance.testConnection();
        return;
      }
      if (args.includes('--validate-config')) {
        const instance = new GoogleSheetsImportCleanV2(options);
        await instance.validateConfiguration();
        return;
      }

      // Déterminer le type d'import
      const instance = new GoogleSheetsImportCleanV2(options);
      
      // Initialiser l'authentification pour tous les types d'import
      if (!await instance.initializeAuth()) {
        throw new Error('Échec de l\'initialisation de l\'authentification');
      }
      
      if (args.includes('--artisans-only')) {
        await instance.importArtisans();
      } else if (args.includes('--interventions-only')) {
        await instance.importInterventions();
      } else {
        // Import complet
        await instance.importAll();
      }
      
      // Afficher les rapports si les méthodes existent
      if (typeof instance.databaseManager.displayInvalidInterventionsReport === 'function') {
        instance.databaseManager.displayInvalidInterventionsReport();
      }
      
      if (typeof instance.databaseManager.displayUnmappedArtisansReport === 'function') {
        instance.databaseManager.displayUnmappedArtisansReport();
      }
      
      if (typeof instance.databaseManager.displayCostsDebugReport === 'function') {
        instance.databaseManager.displayCostsDebugReport();
      }
      
      // Sauvegarder les rapports si les méthodes existent
      if (typeof instance.databaseManager.saveInvalidInterventionsReport === 'function') {
        const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
        const invalidInterventionsPath = `./data/imports/reports/invalid-interventions-${timestamp}.json`;
        await instance.databaseManager.saveInvalidInterventionsReport(invalidInterventionsPath);
      }
      
      if (typeof instance.databaseManager.saveUnmappedArtisansReport === 'function') {
        const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
        const unmappedArtisansPath = `./data/imports/reports/unmapped-artisans-${timestamp}.json`;
        await instance.databaseManager.saveUnmappedArtisansReport(unmappedArtisansPath);
      }

      // Post-import: Peupler agency_config (BR-AGN-001)
      console.log('\n🔧 Peuplement de agency_config...');
      try {
        const { createClient } = require('@supabase/supabase-js');
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
        
        if (supabaseKey) {
          const supabase = createClient(supabaseUrl, supabaseKey);
          
          const { data: agencies, error: fetchError } = await supabase
            .from('agencies')
            .select('id, label')
            .or('label.ilike.%ImoDirect%,label.ilike.%AFEDIM%,label.ilike.%Oqoro%');

          if (!fetchError && agencies && agencies.length > 0) {
            const { error: insertError } = await supabase
              .from('agency_config')
              .upsert(
                agencies.map(agency => ({
                  agency_id: agency.id,
                  requires_reference: true,
                })),
                { onConflict: 'agency_id' }
              );

            if (!insertError) {
              console.log(`✅ agency_config peuplé (${agencies.length} agences: ${agencies.map(a => a.label).join(', ')})`);
            } else {
              console.warn('⚠️  Erreur lors du peuplement agency_config:', insertError.message);
            }
          }
        }
      } catch (error) {
        console.warn('⚠️  Erreur post-import agency_config:', error.message);
      }

    } catch (error) {
      console.error('❌ Erreur fatale:', error.message);
      process.exit(1);
    }
  }

  main();
}