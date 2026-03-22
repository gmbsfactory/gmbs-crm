#!/usr/bin/env node

/**
 * deliver-prod.js — Orchestrateur de livraison production GMBS CRM
 *
 * Enchaîne dans l'ordre sécurisé :
 *   1. Vérification de l'environnement
 *   2. Rapport pré-suppression (ce qui va être effacé)
 *   3. Confirmation interactive
 *   4. Cleanup des données de test
 *   5. Import depuis Google Sheets
 *   6. Affichage du rapport d'erreurs
 *
 * Usage:
 *   node scripts/data/imports/deploy/deliver-prod.js
 *   node scripts/data/imports/deploy/deliver-prod.js --artisans-only
 *   node scripts/data/imports/deploy/deliver-prod.js --interventions-only
 *   node scripts/data/imports/deploy/deliver-prod.js --dry-run                         (import sans écriture, skip cleanup)
 *   node scripts/data/imports/deploy/deliver-prod.js --skip-cleanup                    (import seul, sans suppression)
 *   node scripts/data/imports/deploy/deliver-prod.js --skip-geocoding                  (import seul, sans géocodage)
 *   node scripts/data/imports/deploy/deliver-prod.js --import-start-date=01/01/2025    (filtrer à partir de cette date)
 *   node scripts/data/imports/deploy/deliver-prod.js --import-end-date=31/12/2025      (filtrer jusqu'à cette date)
 *
 * Formats de date acceptés : DD/MM/YYYY ou YYYY-MM-DD
 */

'use strict';

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { execSync } = require('child_process');

// ── Charger les variables d'environnement ─────────────────────────────────────

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env.local';
const envPath = path.join(ROOT, envFile);

if (fs.existsSync(envPath) && !process.env.NEXT_PUBLIC_SUPABASE_URL) {
  require('dotenv').config({ path: envPath });
  console.log(`  📁 Env chargé : ${envFile}`);
}

const clientPath = path.join(ROOT, 'src/lib/api/v2/common/client.ts');
console.log('🔍 Chemin client:', clientPath);
const { getSupabaseClientForNode } = require(clientPath);

const cleanupPath = path.join(__dirname, 'cleanup-data');
console.log('🔍 Chemin cleanup:', cleanupPath);
const { preCleanupReport, runCleanup, validateCoverage } = require(cleanupPath);

// ── Options CLI ───────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const isDryRun          = args.includes('--dry-run');
const skipCleanup       = args.includes('--skip-cleanup') || isDryRun;
const skipGeocoding     = args.includes('--skip-geocoding');
const artisansOnly      = args.includes('--artisans-only');
const interventionsOnly = args.includes('--interventions-only');
const verbose           = args.includes('--verbose');

// Filtres de dates — mappés vers --date-start / --date-end du script d'import
const importStartDateArg = args.find(a => a.startsWith('--import-start-date='));
const importEndDateArg   = args.find(a => a.startsWith('--import-end-date='));
const importStartDate    = importStartDateArg ? importStartDateArg.split('=')[1] : null;
const importEndDate      = importEndDateArg   ? importEndDateArg.split('=')[1]   : null;

// ── Helpers ───────────────────────────────────────────────────────────────────

const ts = () => new Date().toLocaleTimeString('fr-FR');
const log  = (msg) => console.log(`[${ts()}] ${msg}`);
const warn = (msg) => console.log(`[${ts()}] ⚠️  ${msg}`);
const err  = (msg) => console.error(`[${ts()}] ❌ ${msg}`);
const sep  = () => console.log('─'.repeat(60));

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

// ── Étape 1 : Vérification environnement ─────────────────────────────────────

function checkEnvironment() {
  sep();
  log('ÉTAPE 1 — Vérification de l\'environnement');
  sep();

  const required = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };

  const optional = {
    GOOGLE_SHEETS_ID: process.env.GOOGLE_SHEETS_ID || process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
    IMPORT_USER_EMAIL: process.env.IMPORT_USER_EMAIL,
  };

  let hasError = false;

  for (const [key, val] of Object.entries(required)) {
    if (val) {
      log(`  ✅ ${key} = ${val}`);
    } else {
      err(`  ${key} — NON DÉFINIE (obligatoire)`);
      hasError = true;
    }
  }

  for (const [key, val] of Object.entries(optional)) {
    if (val) {
      log(`  ✅ ${key} = ${val}`);
    } else {
      warn(`  ${key} — non définie (optionnelle)`);
    }
  }

  if (hasError) {
    err('\nVariables obligatoires manquantes. Vérifiez votre fichier .env.local.');
    process.exit(1);
  }

  // Afficher la cible Supabase pour éviter les erreurs d'environnement
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const isLocal = url.includes('localhost') || url.includes('127.0.0.1');
  log(`\n  🎯 Cible Supabase : ${url} ${isLocal ? '(LOCAL)' : '(PRODUCTION)'}`);
  log(`  📁 Fichier env   : ${envFile}`);

  log('\n✅ Environnement OK');
}

// ── Étape 2 : Rapport pré-suppression ─────────────────────────────────────────

async function stepPreCleanupReport(client) {
  sep();
  log('ÉTAPE 2 — Rapport pré-suppression');
  sep();
  await preCleanupReport(client);
}

// ── Étape 3 : Confirmation ────────────────────────────────────────────────────

async function stepConfirmCleanup() {
  sep();
  log('ÉTAPE 3 — Confirmation');
  sep();

  warn('Cette opération va supprimer définitivement les données listées ci-dessus.');
  warn('Assurez-vous d\'avoir fait un backup depuis le Dashboard Supabase.\n');

  const answer = await ask('  Confirmez-vous la suppression ? (oui / non) : ');
  if (answer !== 'oui') {
    log('\nOpération annulée. Aucune donnée supprimée.');
    process.exit(0);
  }
}

// ── Étape 4 : Cleanup ─────────────────────────────────────────────────────────

async function stepRunCleanup(client) {
  sep();
  log('ÉTAPE 4 — Cleanup des données');
  sep();

  const results = await runCleanup(client, { verbose });

  if (results.errors > 0) {
    err('\nDes erreurs sont survenues pendant le cleanup. Vérifiez les messages ci-dessus.');
    const cont = await ask('  Continuer quand même vers l\'import ? (oui / non) : ');
    if (cont !== 'oui') process.exit(1);
  } else {
    log('\n✅ Cleanup terminé sans erreur.');
  }
}

// ── Étape 5 : Import Google Sheets ────────────────────────────────────────────

async function runImport() {
  sep();
  log('ÉTAPE 5 — Import depuis Google Sheets');
  sep();

  const importScript = path.join(__dirname, '..', 'google-sheets-import-clean-v2.js');

  if (!fs.existsSync(importScript)) {
    err(`Script d'import introuvable : ${importScript}`);
    process.exit(1);
  }

  const importArgs = [];
  if (isDryRun)          importArgs.push('--dry-run');
  if (artisansOnly)      importArgs.push('--artisans-only');
  if (interventionsOnly) importArgs.push('--interventions-only');
  if (verbose)           importArgs.push('--verbose');
  if (importStartDate)   importArgs.push(`--date-start=${importStartDate}`);
  if (importEndDate)     importArgs.push(`--date-end=${importEndDate}`);

  const cmd = `npx tsx "${importScript}" ${importArgs.join(' ')}`;
  log(`  Commande : ${cmd}\n`);

  try {
    execSync(cmd, { stdio: 'inherit', cwd: ROOT });
    log('\n✅ Import terminé.');
  } catch (e) {
    err(`\nL'import a retourné une erreur (code ${e.status}).`);
    process.exit(e.status ?? 1);
  }
}

// ── Étape 6 : Géocodage des artisans ──────────────────────────────────────

async function runGeocoding() {
  sep();
  log('ÉTAPE 6 — Géocodage des artisans');
  sep();

  const geocodeScript = path.join(__dirname, '..', '..', 'geocode', 'geocode-artisans.ts');

  if (!fs.existsSync(geocodeScript)) {
    err(`Script de géocodage introuvable : ${geocodeScript}`);
    process.exit(1);
  }

  const geocodeArgs = [];
  if (verbose) geocodeArgs.push('--verbose');

  const cmd = `npx tsx \"${geocodeScript}\" ${geocodeArgs.join(' ')}`;
  log(`  Commande : ${cmd}\n`);

  try {
    execSync(cmd, { stdio: 'inherit', cwd: ROOT });
    log('\n✅ Géocodage terminé.');
  } catch (e) {
    err(`\nLe géocodage a retourné une erreur (code ${e.status}).`);
    const cont = await ask('  Continuer quand même ? (oui / non) : ');
    if (cont !== 'oui') process.exit(e.status ?? 1);
  }
}

// ── Étape 7 : Rapport final ───────────────────────────────────────────────────

function showReportLocation() {
  sep();
  log('ÉTAPE 7 — Rapport');
  sep();

  const reportsDir = path.join(ROOT, 'data', 'imports', 'processed');

  if (!fs.existsSync(reportsDir)) {
    log('  Dossier de rapports non trouvé — aucun rapport généré.');
    return;
  }

  const files = fs.readdirSync(reportsDir)
    .filter(f => f.startsWith('import-report-'))
    .sort()
    .reverse()
    .slice(0, 2); // Les 2 plus récents (txt + json)

  if (files.length === 0) {
    log('  Aucun rapport trouvé.');
  } else {
    log('  Derniers rapports générés :');
    files.forEach(f => log(`    📄 ${path.join(reportsDir, f)}`));
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n' + '═'.repeat(60));
  console.log('  GMBS CRM — Orchestrateur de livraison production');
  if (isDryRun)      console.log('  MODE : DRY-RUN (aucune écriture en base)');
  if (skipCleanup)   console.log('  MODE : SKIP-CLEANUP (import seul)');
  if (skipGeocoding) console.log('  MODE : SKIP-GEOCODING (pas de géocodage)');
  console.log('═'.repeat(60) + '\n');

  // Étape 1 — Environnement
  checkEnvironment();

  // Créer le client Supabase via le point d'entrée centralisé de l'API V2
  // getSupabaseClientForNode() retourne un client service role (bypass RLS) en Node.js
  const client = getSupabaseClientForNode();

  // Validation de couverture — détecte les tables non couvertes
  const coverage = await validateCoverage(client);
  if (!coverage.ok) {
    warn(`${coverage.uncovered.length} table(s) non couvertes détectées (voir ci-dessus).`);
  }

  if (!skipCleanup) {
    // Étape 2 — Rapport pré-suppression
    await stepPreCleanupReport(client);

    // Étape 3 — Confirmation
    await stepConfirmCleanup();

    // Étape 4 — Cleanup
    await stepRunCleanup(client);
  } else {
    log('⏭️  Cleanup ignoré (--skip-cleanup ou --dry-run)');
  }

  // Étape 5 — Import
  await runImport();

  // Étape 6 — Géocodage (si artisans importés et pas de skip)
  if (skipGeocoding) {
    log('⏭️  Géocodage ignoré (--skip-geocoding)');
  } else if (interventionsOnly) {
    log('⏭️  Géocodage ignoré (--interventions-only seulement)');
  } else {
    // Géocoder seulement si on a importé des artisans (par défaut ou via --artisans-only)
    await runGeocoding();
  }

  // Étape 7 — Rapport
  showReportLocation();

  sep();
  log('✅ Livraison terminée.');
  sep();
  console.log('');
}

main().catch((e) => {
  err(`Erreur fatale : ${e.message}`);
  if (verbose) console.error(e);
  process.exit(1);
});
