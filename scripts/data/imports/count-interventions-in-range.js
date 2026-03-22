#!/usr/bin/env node

/**
 * Compte les interventions dans une plage de dates depuis Google Sheets
 *
 * Usage:
 *   node scripts/data/imports/count-interventions-in-range.js --date-start=01/01/2026 --date-end=01/04/2026
 *
 * Options:
 *   --date-start=DD/MM/YYYY   Date de début (incluse)
 *   --date-end=DD/MM/YYYY     Date de fin (incluse)
 *   --verbose                 Affichage détaillé
 */

const fs = require('fs');
const path = require('path');

// Charger les variables d'environnement
const envFilePath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envFilePath)) {
  require('dotenv').config({ path: envFilePath });
}

const { google } = require('googleapis');
const { googleSheetsConfig } = require('./config/google-sheets-config');

// ===== Date utilities (reused from main import script) =====

function parseDateFromCSV(dateValue) {
  if (!dateValue || String(dateValue).trim() === '') return null;
  const strValue = String(dateValue).trim();

  const euMatch = strValue.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}):(\d{2}))?/);
  if (euMatch) {
    const [, day, month, year, hour = '00', minute = '00', second = '00'] = euMatch;
    const isoString = `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;
    const parsed = new Date(isoString);
    return Number.isNaN(parsed.getTime()) ? null : isoString;
  }

  const isoMatch = strValue.match(/^(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{2}):(\d{2}):(\d{2}))?/);
  if (isoMatch) {
    const [, year, month, day, hour = '00', minute = '00', second = '00'] = isoMatch;
    const isoString = `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;
    const parsed = new Date(isoString);
    return Number.isNaN(parsed.getTime()) ? null : isoString;
  }

  if (/^\d+$/.test(strValue) || typeof dateValue === 'number') {
    const serial = Number(strValue);
    if (Number.isFinite(serial) && serial > 0) {
      const excelEpoch = new Date('1899-12-30T00:00:00Z').getTime();
      const date = new Date(excelEpoch + (serial - 1) * 24 * 60 * 60 * 1000);
      if (!Number.isNaN(date.getTime())) return date.toISOString();
    }
  }

  return null;
}

function parseDateFilter(dateStr) {
  if (!dateStr) return null;
  const str = String(dateStr).trim();

  if (/^\d{2}\/\d{2}\/\d{4}/.test(str)) {
    const euMatch = str.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}):(\d{2}))?/);
    if (euMatch) {
      const [, day, month, year, hour = '00', minute = '00', second = '00'] = euMatch;
      return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`);
    }
  }

  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{2}):(\d{2}):(\d{2}))?/);
    if (isoMatch) {
      const [, year, month, day, hour = '00', minute = '00', second = '00'] = isoMatch;
      return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`);
    }
  }

  return null;
}

function isDateInRange(dateValue, dateStart, dateEnd) {
  if (!dateValue) return false;
  const parsedDate = parseDateFromCSV(dateValue);
  if (!parsedDate) return false;
  const date = new Date(parsedDate);
  if (Number.isNaN(date.getTime())) return false;

  const startDate = parseDateFilter(dateStart);
  const endDate = parseDateFilter(dateEnd);
  if (endDate) endDate.setHours(23, 59, 59, 999);

  if (startDate && date < startDate) return false;
  if (endDate && date > endDate) return false;
  return true;
}

// ===== Main =====

async function main() {
  const args = process.argv.slice(2);
  const verbose = args.includes('--verbose');

  const dateStartArg = args.find(a => a.startsWith('--date-start='));
  const dateEndArg = args.find(a => a.startsWith('--date-end='));
  const dateStart = dateStartArg ? dateStartArg.split('=')[1] : null;
  const dateEnd = dateEndArg ? dateEndArg.split('=')[1] : null;

  if (!dateStart && !dateEnd) {
    console.error('❌ Veuillez spécifier au moins --date-start ou --date-end');
    console.error('   Exemple: node count-interventions-in-range.js --date-start=01/01/2026 --date-end=01/04/2026');
    process.exit(1);
  }

  console.log('\n📅 Comptage des interventions Google Sheets');
  if (dateStart) console.log(`   Date de début : ${dateStart}`);
  if (dateEnd)   console.log(`   Date de fin   : ${dateEnd}`);

  // Auth Google Sheets
  const credentials = googleSheetsConfig.getCredentials();
  if (!credentials?.client_email || !credentials?.private_key) {
    console.error('❌ Configuration Google Sheets manquante. Vérifiez les variables d\'environnement.');
    process.exit(1);
  }

  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheetId = googleSheetsConfig.getSpreadsheetId();

  if (!spreadsheetId) {
    console.error('❌ ID du spreadsheet non défini (GOOGLE_SHEETS_ID ou GOOGLE_SHEETS_SPREADSHEET_ID)');
    process.exit(1);
  }

  const range = process.env.GOOGLE_SHEETS_INTERVENTIONS_RANGE || 'Interventions!A:Z';
  console.log(`\n📊 Lecture de la plage : ${range}`);

  // Fetch header row
  const headerResponse = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: range.replace(/:\w+$/, ':1'), // First row only
  });

  const headers = (headerResponse.data.values?.[0] || []).map(h => String(h).trim());

  // Fetch all data
  const dataResponse = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });

  const allRows = dataResponse.data.values || [];
  // Skip header row
  const dataRows = allRows.slice(1);

  console.log(`   ${dataRows.length} lignes totales dans le sheet`);

  // Count interventions in date range
  let inRange = 0;
  let noDate = 0;
  let outOfRange = 0;

  // Date column candidates (same as main import script)
  const dateCols = ['745', 'FErn', 'Date ', 'Date', "Date d'intervention"];

  for (const row of dataRows) {
    const interventionObj = {};
    headers.forEach((header, index) => {
      interventionObj[header] = row[index] || '';
    });

    const dateValue = dateCols.map(c => interventionObj[c]).find(v => v && v.trim() !== '');

    if (!dateValue) {
      noDate++;
      continue;
    }

    if (isDateInRange(dateValue, dateStart, dateEnd)) {
      inRange++;
      if (verbose) {
        console.log(`   ✅ ${dateValue}`);
      }
    } else {
      outOfRange++;
    }
  }

  console.log('\n📈 Résultats:');
  console.log(`   ✅ Dans la période  : ${inRange}`);
  console.log(`   ⏭️  Hors période     : ${outOfRange}`);
  console.log(`   ⚠️  Sans date        : ${noDate}`);
  console.log(`   📋 Total lignes     : ${dataRows.length}`);
}

main().catch(err => {
  console.error('❌ Erreur:', err.message);
  process.exit(1);
});
