/**
 * Adaptateur Google Sheets API natif
 * 
 * Ce module utilise l'API Google Sheets native (googleapis)
 * comme dans l'ancien script de test qui fonctionnait bien.
 */

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

class GoogleSheetsNativeAdapter {
  constructor(options = {}) {
    this.options = {
      verbose: options.verbose || false,
      ...options
    };
    
    this.sheets = null;
    this.auth = null;
  }

  /**
   * Initialise la connexion avec l'API Google Sheets
   */
  async initialize() {
    try {
      // Charger les credentials depuis la configuration
      const { googleSheetsConfig } = require('./config/google-sheets-config');
      const credentials = googleSheetsConfig.getCredentials();
      const spreadsheetId = googleSheetsConfig.getSpreadsheetId();
      
      if (!credentials) {
        throw new Error('Aucune configuration Google Sheets trouvée');
      }
      
      if (!spreadsheetId) {
        throw new Error('ID de spreadsheet requis');
      }

      // Initialiser l'authentification avec la nouvelle méthode (sans warning)
      this.auth = new google.auth.JWT({
        email: credentials.client_email,
        key: credentials.private_key,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
      });
      
      // Initialiser l'API Sheets
      this.sheets = google.sheets({ version: 'v4', auth: this.auth });
      
      // Tester la connexion
      const response = await this.sheets.spreadsheets.get({
        spreadsheetId: spreadsheetId
      });
      
      this.log('✅ Connexion Google Sheets API native établie', 'success');
      this.log(`📄 Document: ${response.data.properties.title}`, 'info');
      this.log(`🔗 Spreadsheet ID: ${spreadsheetId}`, 'info');
      
      return {
        title: response.data.properties.title,
        spreadsheetId: spreadsheetId
      };
      
    } catch (error) {
      this.log(`❌ Erreur initialisation Google Sheets API: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Lit les données d'une feuille avec range spécifique
   */
  async readSheetData(sheetName, range = null) {
    try {
      const { googleSheetsConfig } = require('./config/google-sheets-config');
      const spreadsheetId = googleSheetsConfig.getSpreadsheetId();
      
      // Déterminer le range à utiliser
      let finalRange = range;
      if (!finalRange) {
        // Utiliser les ranges depuis les variables d'environnement
        if (sheetName.includes('ARTISANS') || sheetName.includes('Artisans')) {
          finalRange = process.env.GOOGLE_SHEETS_ARTISANS_RANGE || `${sheetName}!A1:Z`;
        } else if (sheetName.includes('INTER') || sheetName.includes('Interventions')) {
          finalRange = process.env.GOOGLE_SHEETS_INTERVENTIONS_RANGE || `${sheetName}!A1:Z`;
        } else {
          finalRange = `${sheetName}!A1:Z`;
        }
      }
      
      this.log(`📖 Lecture de la feuille: ${sheetName} (range: ${finalRange})`, 'info');
      
      // Récupérer les données
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: spreadsheetId,
        range: finalRange
      });
      
      const rows = response.data.values;
      if (!rows || rows.length === 0) {
        this.log(`⚠️  Aucune donnée trouvée dans la feuille ${sheetName}`, 'warn');
        return [];
      }
      
      // Convertir en format objet
      const headers = rows[0];
      const data = rows.slice(1).map((row, index) => {
        const obj = {};
        headers.forEach((header, i) => {
          obj[header] = row[i] || '';
        });
        obj._rowIndex = index + 2; // +2 car on commence à la ligne 2 (après les headers)
        return obj;
      });
      
      this.log(`✅ ${data.length} lignes lues depuis ${sheetName}`, 'success');
      
      // Afficher les colonnes disponibles pour debug
      if (this.options.verbose) {
        this.log(`📋 Colonnes disponibles (${headers.length}): ${headers.join(', ')}`, 'verbose');
        
        // Afficher un échantillon
        if (data.length > 0) {
          this.log('🔍 Échantillon de données (première ligne):', 'verbose');
          headers.slice(0, 5).forEach(header => {
            this.log(`  ${header}: ${data[0][header] || '(vide)'}`, 'verbose');
          });
          
          // Afficher spécifiquement la colonne Document Drive si elle existe
          const driveHeader = headers.find(h => h.toLowerCase().includes('document drive') || h.toLowerCase().includes('drive'));
          if (driveHeader) {
            const rawDriveValue = data[0][driveHeader] || '(vide)';
            const processedDriveValue = this.processDriveUrl(rawDriveValue);
            this.log(`  📁 Document Drive (brut): ${rawDriveValue}`, 'verbose');
            this.log(`  📁 Document Drive (traité): ${processedDriveValue}`, 'verbose');
          }
        }
      }
      
      return data;
      
    } catch (error) {
      this.log(`❌ Erreur lecture feuille ${sheetName}: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Lit les données des artisans
   */
  async readArtisansData() {
    return await this.readSheetData('BASE de DONNÉE SST ARTISANS');
  }

  /**
   * Lit les données des interventions
   */
  async readInterventionsData() {
    return await this.readSheetData('SUIVI_INTER_GMBS_2025');
  }

  /**
   * Liste toutes les feuilles disponibles
   */
  async listSheets() {
    try {
      const { googleSheetsConfig } = require('./config/google-sheets-config');
      const spreadsheetId = googleSheetsConfig.getSpreadsheetId();
      
      const response = await this.sheets.spreadsheets.get({
        spreadsheetId: spreadsheetId
      });
      
      const sheets = response.data.sheets.map(sheet => ({
        title: sheet.properties.title,
        sheetId: sheet.properties.sheetId,
        rowCount: sheet.properties.gridProperties.rowCount,
        columnCount: sheet.properties.gridProperties.columnCount
      }));
      
      this.log('📋 Feuilles disponibles:', 'info');
      sheets.forEach((sheet, index) => {
        this.log(`  ${index + 1}. ${sheet.title} (${sheet.rowCount} lignes, ${sheet.columnCount} colonnes)`, 'info');
      });
      
      return sheets;
      
    } catch (error) {
      this.log(`❌ Erreur lors de la liste des feuilles: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Teste la connexion et le parsing
   */
  async testConnection() {
    this.log('🧪 Test de connexion Google Sheets API native...', 'info');
    
    try {
      // 1. Initialiser la connexion
      const docInfo = await this.initialize();
      
      // 2. Lister les feuilles
      await this.listSheets();
      
      // 3. Tester la lecture des artisans
      try {
        const artisansData = await this.readArtisansData();
        this.log(`✅ ${artisansData.length} artisans parsés avec succès`, 'success');
      } catch (error) {
        this.log(`⚠️  Erreur lecture artisans: ${error.message}`, 'warn');
      }
      
      // 4. Tester la lecture des interventions
      try {
        const interventionsData = await this.readInterventionsData();
        this.log(`✅ ${interventionsData.length} interventions parsées avec succès`, 'success');
      } catch (error) {
        this.log(`⚠️  Erreur lecture interventions: ${error.message}`, 'warn');
      }
      
      this.log('\n🎉 Test de connexion API native réussi !', 'success');
      
      return {
        success: true,
        document: docInfo
      };
      
    } catch (error) {
      this.log(`❌ Erreur lors du test: ${error.message}`, 'error');
      return {
        success: false,
        error: error.message
      };
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
   * Méthode de logging
   */
  log(message, level = 'info') {
    if (!this.options.verbose && level === 'verbose') return;
    
    const prefix = `[GOOGLE-SHEETS-NATIVE]`;
    
    switch (level) {
      case 'error':
        console.error(`❌ ${prefix} ${message}`);
        break;
      case 'warn':
        console.warn(`⚠️  ${prefix} ${message}`);
        break;
      case 'success':
        console.log(`✅ ${prefix} ${message}`);
        break;
      case 'verbose':
        console.log(`🔍 ${prefix} ${message}`);
        break;
      default:
        console.log(`ℹ️  ${prefix} ${message}`);
    }
  }
}

module.exports = { GoogleSheetsNativeAdapter };
