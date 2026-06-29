#!/usr/bin/env node

/**
 * check-columns.js — Vérification pré-import des colonnes Google Sheets
 *
 * Lit la ligne d'en-têtes (A1:Z1) des feuilles Artisans et Interventions et
 * la compare aux colonnes attendues par les mappers d'import. Signale :
 *   - les colonnes REQUISES manquantes (bloquant)
 *   - les colonnes recommandées manquantes (avertissement)
 *   - les colonnes inconnues présentes dans le sheet (information)
 *
 * Aucune écriture en base : lecture seule.
 *
 * Usage:
 *   node scripts/data/imports/check-columns.js
 *   node scripts/data/imports/check-columns.js --artisans-only
 *   node scripts/data/imports/check-columns.js --interventions-only
 *
 * Code de sortie : 0 si OK, 1 si au moins une colonne requise manque.
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ── Charger les variables d'environnement ─────────────────────────────────────
const ROOT = path.resolve(__dirname, '..', '..', '..');
const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env.local';
const envPath = path.join(ROOT, envFile);
if (fs.existsSync(envPath) && !process.env.GOOGLE_SHEETS_PRIVATE_KEY && !process.env.GOOGLE_CREDENTIALS_PATH) {
  require('dotenv').config({ path: envPath });
}

const { google } = require('googleapis');
const { googleSheetsConfig } = require('./config/google-sheets-config');

// ── Définition des colonnes attendues ─────────────────────────────────────────
// Chaque entrée : { aliases: [...noms acceptés...], level: 'required' | 'recommended' | 'optional', desc }
// Source de vérité : scripts/data-processing/mappers/*.js + parsers/extractors associés.

const ARTISAN_COLUMNS = [
  { key: 'Nom Prénom',            aliases: ['Nom Prénom'],                                   level: 'required',    desc: 'Identité (prenom/nom/plain_nom)' },
  { key: 'STATUT',                aliases: ['STATUT'],                                       level: 'recommended', desc: 'statut_id artisan' },
  { key: 'Adresse Mail',          aliases: ['Adresse Mail'],                                 level: 'recommended', desc: 'email' },
  { key: 'Numéro Téléphone',      aliases: ['Numéro Téléphone'],                             level: 'recommended', desc: 'telephone / telephone2' },
  { key: 'Adresse Postale',       aliases: ['Adresse Postale'],                              level: 'recommended', desc: 'adresse/ville/CP siège social' },
  { key: 'MÉTIER',                aliases: ['MÉTIER', 'Métier', 'metier', 'METIER'],         level: 'recommended', desc: 'métiers' },
  { key: 'Gestionnaire',          aliases: ['Gestionnaire'],                                 level: 'optional',    desc: 'gestionnaire_id' },
  { key: 'Raison Social',         aliases: ['Raison Social'],                                level: 'optional',    desc: 'raison_sociale' },
  { key: 'Siret',                 aliases: ['Siret'],                                        level: 'optional',    desc: 'siret' },
  { key: 'STATUT JURIDIQUE',      aliases: ['STATUT JURIDIQUE'],                             level: 'optional',    desc: 'statut_juridique' },
  { key: 'ZONE',                  aliases: ['ZONE', 'Zone', 'zone', 'ZONES'],                level: 'optional',    desc: 'zones' },
  { key: 'SUIVI DES RELANCES DOCS', aliases: ['SUIVI DES RELANCES DOCS'],                    level: 'optional',    desc: 'suivi_relances_docs' },
  { key: "DATE D'AJOUT",          aliases: ["DATE D'AJOUT"],                                 level: 'optional',    desc: 'created_at' },
  { key: 'Document Drive',        aliases: ['Document Drive'],                               level: 'optional',    desc: 'documents (Drive)' },
];

const INTERVENTION_COLUMNS = [
  { key: 'ID',                    aliases: ['ID'],                                                          level: 'required',    desc: 'id_inter — clé de déduplication (create-or-update)' },
  { key: 'Statut',                aliases: ['Statut', ' Statut', 'Statut ', 'STATUT', 'diag fenetr', 'diagnostic fenetre', 'status'], level: 'recommended', desc: 'statut_id' },
  { key: 'Date',                  aliases: ['Date ', 'Date', 'FErn', '745', "Date d'intervention"],         level: 'recommended', desc: 'date intervention' },
  { key: "Adresse d'intervention", aliases: ["Adresse d'intervention", 'Adresse'],                          level: 'recommended', desc: 'adresse/code_postal/ville' },
  { key: "Contexte d'intervention", aliases: ["Contexte d'intervention", "Contexte d'intervention "],       level: 'recommended', desc: 'contexte_intervention' },
  { key: 'Artisan',               aliases: ['Artisan', 'Technicien', 'Technicien ', 'SST'],                 level: 'recommended', desc: 'artisanSST (rapprochement SST)' },
  { key: 'Agence',                aliases: ['Agence'],                                                      level: 'optional',    desc: 'agence_id (défaut: DEFAUT)' },
  { key: 'Gest.',                 aliases: ['Gest.'],                                                       level: 'optional',    desc: 'assigned_user_id' },
  { key: "Date d'intervention",   aliases: ["Date d'intervention"],                                         level: 'optional',    desc: 'date_prevue' },
  { key: 'COMMENTAIRE',           aliases: ['COMMENTAIRE'],                                                 level: 'optional',    desc: 'commentaire_agent' },
  { key: 'COUT SST',              aliases: ['COUT SST'],                                                    level: 'optional',    desc: 'coût SST' },
  { key: 'COÛT MATERIEL',         aliases: ['COÛT MATERIEL'],                                               level: 'optional',    desc: 'coût matériel' },
  { key: 'COUT INTER',            aliases: ['COUT INTER'],                                                  level: 'optional',    desc: 'coût intervention' },
  { key: 'Locataire',             aliases: ['Locataire'],                                                   level: 'optional',    desc: 'tenant (nom)' },
  { key: 'Em@il Locataire',       aliases: ['Em@il Locataire'],                                             level: 'optional',    desc: 'tenant.email' },
  { key: 'TEL LOC',               aliases: ['TEL LOC'],                                                     level: 'optional',    desc: 'tenant.telephone' },
  { key: 'PROPRIO',               aliases: ['PROPRIO'],                                                     level: 'optional',    desc: 'owner (propriétaire)' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
const norm = (s) => String(s || '').toLowerCase().trim();
const sep = () => console.log('─'.repeat(64));

// Toutes les valeurs d'alias connues, pour détecter les colonnes "inconnues"
function knownAliasSet(columns) {
  const set = new Set();
  columns.forEach((c) => c.aliases.forEach((a) => set.add(norm(a))));
  return set;
}

async function readHeaders(sheets, spreadsheetId, range) {
  const sheetName = range.split('!')[0];
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A1:Z1`,
  });
  return { sheetName, headers: (res.data.values && res.data.values[0]) || [] };
}

/**
 * Diagnostic : imprime les lignes 1 et 2 brutes de chaque feuille, cellule par
 * cellule (avec délimiteurs pour voir les espaces parasites). Permet de savoir
 * sur quelle ligne se trouvent réellement les en-têtes.
 */
async function dumpHeaders(sheets, spreadsheetId, range) {
  const sheetName = range.split('!')[0];
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A1:Z2`,
  });
  const rows = res.data.values || [];
  console.log('');
  sep();
  console.log(`  DUMP — feuille "${sheetName}" (range import: ${range})`);
  sep();
  ['Ligne 1', 'Ligne 2'].forEach((label, r) => {
    const row = rows[r] || [];
    console.log(`\n  ${label} (${row.length} cellules) :`);
    row.forEach((cell, i) => {
      const col = String.fromCharCode(65 + i); // A, B, C...
      console.log(`     ${col}: »${cell}«`);
    });
  });
}

function checkSheet(label, sheetName, headers, columns) {
  console.log('');
  sep();
  console.log(`  ${label} — feuille "${sheetName}" (${headers.length} colonnes détectées)`);
  sep();

  const headerSet = new Set(headers.map(norm));
  const missing = { required: [], recommended: [], optional: [] };

  for (const col of columns) {
    const found = col.aliases.find((a) => headerSet.has(norm(a)));
    if (found) {
      const via = norm(found) === norm(col.key) ? '' : ` (via "${found}")`;
      console.log(`  ✅ ${col.key}${via}`);
    } else {
      missing[col.level].push(col);
    }
  }

  const printMissing = (arr, icon, title) => {
    if (arr.length === 0) return;
    console.log(`\n  ${icon} ${title} :`);
    arr.forEach((c) => {
      const alts = c.aliases.length > 1 ? ` [alias acceptés : ${c.aliases.join(', ')}]` : '';
      console.log(`     - ${c.key} → ${c.desc}${alts}`);
    });
  };

  printMissing(missing.required,    '❌', 'Colonnes REQUISES manquantes (BLOQUANT)');
  printMissing(missing.recommended, '⚠️ ', 'Colonnes recommandées manquantes');
  printMissing(missing.optional,    'ℹ️ ', 'Colonnes optionnelles absentes');

  // Colonnes du sheet non reconnues par l'import
  const known = knownAliasSet(columns);
  const unknown = headers.filter((h) => h && !known.has(norm(h)));
  if (unknown.length > 0) {
    console.log(`\n  📎 Colonnes présentes mais non utilisées par l'import :`);
    unknown.forEach((h) => console.log(`     - "${h}"`));
  }

  return missing.required.length === 0;
}

/**
 * Vérifie les colonnes des feuilles. Réutilisable depuis l'import.
 *
 * @param {object} opts
 * @param {object} [opts.sheets]          Client google.sheets déjà authentifié. Si absent, en crée un.
 * @param {string} [opts.spreadsheetId]   ID du spreadsheet. Si absent, lu depuis la config.
 * @param {boolean} [opts.artisansOnly]
 * @param {boolean} [opts.interventionsOnly]
 * @returns {Promise<{ok: boolean, requiredMissing: string[]}>}
 */
async function runColumnCheck(opts = {}) {
  const { artisansOnly = false, interventionsOnly = false, dumpHeaders: doDump = false } = opts;

  console.log('\n' + '═'.repeat(64));
  console.log('  GMBS CRM — Vérification des colonnes Google Sheets (lecture seule)');
  console.log('═'.repeat(64));

  let sheets = opts.sheets;
  let spreadsheetId = opts.spreadsheetId;

  if (!sheets || !spreadsheetId) {
    googleSheetsConfig.reloadConfig();
    const credentials = googleSheetsConfig.getCredentials();
    spreadsheetId = spreadsheetId || googleSheetsConfig.getSpreadsheetId();

    if (!credentials || !credentials.client_email || !credentials.private_key) {
      throw new Error('Configuration Google Sheets incomplète (credentials manquants).');
    }
    if (!spreadsheetId) {
      throw new Error('GOOGLE_SHEETS_ID / GOOGLE_SHEETS_SPREADSHEET_ID non défini.');
    }

    const auth = new google.auth.JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    sheets = google.sheets({ version: 'v4', auth });
  }

  const artisansRange = process.env.GOOGLE_SHEETS_ARTISANS_RANGE || 'Artisans!A:Z';
  const interRange = process.env.GOOGLE_SHEETS_INTERVENTIONS_RANGE || 'Interventions!A:Z';

  if (doDump) {
    if (!interventionsOnly) await dumpHeaders(sheets, spreadsheetId, artisansRange);
    if (!artisansOnly) await dumpHeaders(sheets, spreadsheetId, interRange);
    return { ok: true, requiredMissing: [] };
  }

  const requiredMissing = [];
  let ok = true;

  if (!interventionsOnly) {
    const { sheetName, headers } = await readHeaders(sheets, spreadsheetId, artisansRange);
    const sheetOk = checkSheet('ARTISANS', sheetName, headers, ARTISAN_COLUMNS);
    if (!sheetOk) requiredMissing.push('artisans');
    ok = sheetOk && ok;
  }

  if (!artisansOnly) {
    const { sheetName, headers } = await readHeaders(sheets, spreadsheetId, interRange);
    const sheetOk = checkSheet('INTERVENTIONS', sheetName, headers, INTERVENTION_COLUMNS);
    if (!sheetOk) requiredMissing.push('interventions');
    ok = sheetOk && ok;
  }

  console.log('');
  sep();
  if (ok) {
    console.log('  ✅ Toutes les colonnes requises sont présentes. Import possible.');
  } else {
    console.log('  ❌ Colonnes requises manquantes — corriger le sheet avant l\'import.');
  }
  sep();

  return { ok, requiredMissing };
}

module.exports = {
  runColumnCheck,
  checkSheet,
  readHeaders,
  ARTISAN_COLUMNS,
  INTERVENTION_COLUMNS,
};

// Exécution directe en CLI
if (require.main === module) {
  const args = process.argv.slice(2);
  runColumnCheck({
    artisansOnly: args.includes('--artisans-only'),
    interventionsOnly: args.includes('--interventions-only'),
    dumpHeaders: args.includes('--dump-headers'),
  })
    .then(({ ok }) => process.exit(ok ? 0 : 1))
    .catch((e) => {
      console.error(`\n❌ Erreur fatale : ${e.message}`);
      process.exit(2);
    });
}
