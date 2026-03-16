#!/usr/bin/env node

/**
 * Script de préanalyse Google Sheets
 * Parse les codes gestionnaires uniques des feuilles Interventions et Artisans avant l'import
 *
 * Usage:
 *   node scripts/data/imports/parse-gestionnaires.js [options]
 *
 * Options:
 *   --date-start=DD/MM/YYYY    Filtrer interventions à partir de cette date (optionnel)
 *   --date-end=DD/MM/YYYY      Filtrer interventions jusqu'à cette date (optionnel)
 *   --verbose                  Affichage détaillé
 *   --help                     Afficher cette aide
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env.local') });

const { google } = require('googleapis');
const { googleSheetsConfig } = require('./config/google-sheets-config');
const { GESTIONNAIRE_CODE_MAP } = require('../../data-processing/mapping-constants');

class GestionnaireParser {
  constructor(options = {}) {
    this.options = {
      verbose: options.verbose || false,
      ...options
    };
    this.sheets = null;
    this.auth = null;
  }

  /**
   * Initialise l'authentification Google Sheets
   */
  async initializeAuth() {
    try {
      console.log('🔐 Initialisation de l\'authentification Google Sheets...');

      const credentials = googleSheetsConfig.getCredentials();

      if (!credentials || !credentials.client_email || !credentials.private_key) {
        throw new Error('Configuration Google Sheets incomplète');
      }

      this.auth = new google.auth.JWT({
        email: credentials.client_email,
        key: credentials.private_key,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
      });

      this.sheets = google.sheets({ version: 'v4', auth: this.auth });
      console.log('✅ Authentification réussie\n');
      return true;

    } catch (error) {
      console.error('❌ Erreur d\'authentification:', error.message);
      return false;
    }
  }

  /**
   * Récupère les données du sheet
   */
  async fetchSheetData(range) {
    try {
      const spreadsheetId = googleSheetsConfig.getSpreadsheetId();
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: spreadsheetId,
        range: range
      });
      return response.data.values || [];
    } catch (error) {
      console.error('❌ Erreur lors de la lecture du sheet:', error.message);
      return [];
    }
  }


  /**
   * Parse les codes gestionnaires uniques du sheet.
   * @param {string|null} dateStart - Date de début DD/MM/YYYY (optionnel)
   * @param {string|null} dateEnd   - Date de fin DD/MM/YYYY (optionnel)
   */
  async parseGestionnairesUniques(dateStart = null, dateEnd = null) {
    const periodInfo = dateStart || dateEnd
      ? `\nPériode: ${dateStart || '*'} → ${dateEnd || '*'}`
      : '\n(Toutes les interventions)';

    console.log(`📋 Parsing des codes gestionnaires${periodInfo}\n`);

    const range = process.env.GOOGLE_SHEETS_INTERVENTIONS_RANGE || 'Interventions!A:Z';
    const sheetName = range.split('!')[0];
    const headerRange = `${sheetName}!A1:Z1`;

    // Récupérer les headers
    const headerRows = await this.fetchSheetData(headerRange);
    const headers = headerRows[0] || [];

    // Trouver l'index de la colonne Gest.
    const gestHeaderIndex = headers.findIndex(h => h && h.toLowerCase().includes('gest'));

    if (gestHeaderIndex === -1) {
      console.error('❌ Colonne "Gest." non trouvée');
      return;
    }

    // Récupérer les données
    const dataRows = await this.fetchSheetData(range);
    if (dataRows.length <= 1) {
      console.log('⚠️  Aucune donnée trouvée');
      return;
    }

    const startIdx = dataRows[0][0] === headers[0] ? 1 : 0;
    const gestionnairesCount = {};
    const gestionnairesFirst = {}; // { gest: { date, id, row } }
    let totalProcessed = 0;

    // Chercher les colonnes date et ID (toujours, pour la première intervention)
    const dateHeaderIndex = headers.findIndex(h => h && (h.toLowerCase().includes('date') || h.toLowerCase().includes('fern')));
    const idHeaderIndex = headers.findIndex(h => h && h.toUpperCase() === 'ID');

    if ((dateStart || dateEnd) && dateHeaderIndex === -1) {
      console.warn('⚠️  Colonne "Date" non trouvée - filtre de date ignoré\n');
    }

    for (let i = startIdx; i < dataRows.length; i++) {
      const row = dataRows[i];
      const gestValue = (row[gestHeaderIndex] || '').trim();
      const dateValue = dateHeaderIndex >= 0 ? (row[dateHeaderIndex] || '') : '';
      const idValue = idHeaderIndex >= 0 ? (row[idHeaderIndex] || '') : '';

      // Appliquer le filtre de date si défini
      if ((dateStart || dateEnd) && dateHeaderIndex >= 0) {
        const parsedDate = this.parseDate(dateValue);
        if (!parsedDate || !this.isInRange(parsedDate, dateStart, dateEnd)) {
          continue;
        }
      }

      totalProcessed++;

      if (gestValue) {
        gestionnairesCount[gestValue] = (gestionnairesCount[gestValue] || 0) + 1;

        // Enregistrer la première intervention rencontrée pour ce gestionnaire
        if (!gestionnairesFirst[gestValue]) {
          gestionnairesFirst[gestValue] = {
            date: dateValue,
            id: idValue,
            row: i + startIdx + 1
          };
        }
      }
    }

    // Afficher les résultats
    console.log('═'.repeat(80));
    console.log('📊 CODES GESTIONNAIRES');
    console.log('═'.repeat(80));
    console.log(`\nLignes traitées: ${totalProcessed}`);
    console.log(`Codes uniques: ${Object.keys(gestionnairesCount).length}\n`);

    const sorted = Object.entries(gestionnairesCount)
      .sort((a, b) => b[1] - a[1]);

    console.log('Code            | Occ | Mappé vers    | 1ère date    | 1er ID         | Statut');
    console.log('─'.repeat(80));

    let unmappedCount = 0;
    const unmappedCodes = [];

    sorted.forEach(([gest, count]) => {
      const normalizedGest = gest.trim().toLowerCase();
      const mappedTo = GESTIONNAIRE_CODE_MAP[normalizedGest];
      const status = mappedTo ? '✅' : '❌';
      const first = gestionnairesFirst[gest] || {};

      if (!mappedTo) {
        unmappedCount++;
        unmappedCodes.push(gest);
      }

      const displayGest = gest.length > 15 ? gest.substring(0, 12) + '...' : gest;
      const displayMapped = (mappedTo || '(non mappé)').padEnd(13);
      const displayDate = (first.date || '-').padEnd(12);
      const displayId = (first.id || '-').padEnd(14);

      console.log(`${displayGest.padEnd(15)} | ${String(count).padEnd(3)} | ${displayMapped} | ${displayDate} | ${displayId} | ${status}`);
    });

    console.log('─'.repeat(80));

    if (unmappedCount > 0) {
      console.log(`\n⚠️  ${unmappedCount} code(s) non mappé(s):`);
      unmappedCodes.forEach(code => {
        console.log(`   - "${code}"`);
      });
    } else {
      console.log(`\n✅ Tous les codes sont mappés !`);
    }
  }

  /**
   * Parse une date (supporte DD/MM/YYYY et nombres Excel)
   */
  parseDate(dateValue) {
    if (!dateValue) return null;

    const str = String(dateValue).trim();

    // Format DD/MM/YYYY
    const euMatch = str.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (euMatch) {
      return new Date(`${euMatch[3]}-${euMatch[2]}-${euMatch[1]}`);
    }

    // Format YYYY-MM-DD
    const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      return new Date(`${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`);
    }

    // Excel serial
    if (/^\d+$/.test(str)) {
      const serial = Number(str);
      const excelEpoch = new Date('1899-12-30').getTime();
      const date = new Date(excelEpoch + (serial - 1) * 24 * 60 * 60 * 1000);
      if (!Number.isNaN(date.getTime())) return date;
    }

    return null;
  }

  /**
   * Parse les codes gestionnaires uniques de la feuille Artisans.
   */
  async parseGestionnairesArtisans() {
    console.log('\n\n📋 Parsing des codes gestionnaires - Feuille ARTISANS\n');

    const range = process.env.GOOGLE_SHEETS_ARTISANS_RANGE || 'BASE de DONNÉE SST ARTISANS!A2:Z';
    const sheetName = range.split('!')[0];
    const headerRange = `${sheetName}!A1:Z1`;

    // Récupérer les headers
    const headerRows = await this.fetchSheetData(headerRange);
    const headers = headerRows[0] || [];

    // Trouver l'index de la colonne Gestionnaire
    const gestHeaderIndex = headers.findIndex(h => h && (
      h.toLowerCase().includes('gest') || h.toLowerCase().includes('gestionnaire')
    ));

    if (gestHeaderIndex === -1) {
      console.error('❌ Colonne "Gestionnaire" non trouvée dans la feuille Artisans');
      console.log('   Colonnes disponibles:', headers.join(', '));
      return;
    }

    console.log(`   Colonne trouvée: "${headers[gestHeaderIndex]}" (index ${gestHeaderIndex})\n`);

    // Récupérer les données
    const dataRows = await this.fetchSheetData(range);
    if (dataRows.length === 0) {
      console.log('⚠️  Aucune donnée trouvée');
      return;
    }

    const startIdx = dataRows[0][0] === headers[0] ? 1 : 0;
    const gestionnairesCount = {};
    let totalProcessed = 0;

    for (let i = startIdx; i < dataRows.length; i++) {
      const row = dataRows[i];
      const gestValue = (row[gestHeaderIndex] || '').trim();
      totalProcessed++;

      if (gestValue) {
        gestionnairesCount[gestValue] = (gestionnairesCount[gestValue] || 0) + 1;
      }
    }

    // Afficher les résultats
    console.log('═'.repeat(60));
    console.log('📊 CODES GESTIONNAIRES - ARTISANS');
    console.log('═'.repeat(60));
    console.log(`\nLignes traitées: ${totalProcessed}`);
    console.log(`Codes uniques: ${Object.keys(gestionnairesCount).length}\n`);

    const sorted = Object.entries(gestionnairesCount)
      .sort((a, b) => b[1] - a[1]);

    console.log('Code            | Occ | Mappé vers    | Statut');
    console.log('─'.repeat(60));

    let unmappedCount = 0;
    const unmappedCodes = [];

    sorted.forEach(([gest, count]) => {
      const normalizedGest = gest.trim().toLowerCase();
      const mappedTo = GESTIONNAIRE_CODE_MAP[normalizedGest];
      const status = mappedTo ? '✅' : '❌';

      if (!mappedTo) {
        unmappedCount++;
        unmappedCodes.push(gest);
      }

      const displayGest = gest.length > 15 ? gest.substring(0, 12) + '...' : gest;
      const displayMapped = (mappedTo || '(non mappé)').padEnd(13);

      console.log(`${displayGest.padEnd(15)} | ${String(count).padEnd(3)} | ${displayMapped} | ${status}`);
    });

    console.log('─'.repeat(60));

    if (unmappedCount > 0) {
      console.log(`\n⚠️  ${unmappedCount} code(s) non mappé(s) dans la feuille Artisans:`);
      unmappedCodes.forEach(code => {
        console.log(`   - "${code}"`);
      });
    } else {
      console.log(`\n✅ Tous les codes artisans sont mappés !`);
    }
  }

  /**
   * Vérifie si une date est dans la plage
   */
  isInRange(date, startStr, endStr) {
    const start = this.parseDate(startStr);
    const end = this.parseDate(endStr);

    if (start && date < start) return false;
    if (end && date > end) return false;

    return true;
  }
}

// ===== SCRIPT PRINCIPAL =====

if (require.main === module) {
  async function main() {
    try {
      const args = process.argv.slice(2);

      if (args.includes('--help') || args.includes('-h')) {
        console.log(`
🔍 Parser Google Sheets - Préanalyse avant import

Usage:
  node scripts/data/imports/parse-gestionnaires.js [options]

Options:
  --date-start=DD/MM/YYYY    Filtrer interventions à partir de cette date (optionnel)
  --date-end=DD/MM/YYYY      Filtrer interventions jusqu'à cette date (optionnel)
  --verbose                  Affichage détaillé

Exemples:
  # Tous les codes gestionnaires du sheet
  node scripts/data/imports/parse-gestionnaires.js

  # Codes gestionnaires pour une période spécifique
  node scripts/data/imports/parse-gestionnaires.js --date-start=01/01/2025 --date-end=31/01/2025
        `);
        return;
      }

      // Extraire les dates (optionnelles)
      const dateStartArg = args.find(arg => arg.startsWith('--date-start='));
      const dateEndArg = args.find(arg => arg.startsWith('--date-end='));

      const dateStart = dateStartArg ? dateStartArg.split('=')[1] : null;
      const dateEnd = dateEndArg ? dateEndArg.split('=')[1] : null;

      const options = {
        verbose: args.includes('--verbose')
      };

      const parser = new GestionnaireParser(options);

      if (!await parser.initializeAuth()) {
        throw new Error('Authentification échouée');
      }

      await parser.parseGestionnairesUniques(dateStart, dateEnd);
      await parser.parseGestionnairesArtisans();

    } catch (error) {
      console.error('❌ Erreur:', error.message);
      process.exit(1);
    }
  }

  main();
}

module.exports = { GestionnaireParser };
