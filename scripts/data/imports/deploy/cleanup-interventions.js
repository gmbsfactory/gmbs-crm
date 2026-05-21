#!/usr/bin/env node

'use strict';

/**
 * cleanup-interventions.js — Suppression ciblée des interventions (+ owner & tenants)
 *
 * Vide les interventions et toutes leurs données rattachées, ainsi que les
 * propriétaires (owner) et locataires (tenants) — qui ne sont référencés QUE par
 * les interventions. Le répertoire des artisans est PRÉSERVÉ.
 *
 * Cas d'usage : remettre à zéro les interventions avant un ré-import CSV, sans
 * toucher aux artisans déjà en base.
 *
 * Usage direct :
 *   node scripts/data/imports/deploy/cleanup-interventions.js
 *   node scripts/data/imports/deploy/cleanup-interventions.js --verbose
 *   node scripts/data/imports/deploy/cleanup-interventions.js --yes      (skip confirmation)
 */

const { deleteBatch } = require('./cleanup-data');

// ── Ordre de suppression (FK enfants → parents) ───────────────────────────────
// Filtres ciblés "intervention" pour les tables partagées (email_logs, tasks,
// comments) afin de ne pas toucher les lignes liées aux artisans.

const CLEANUP_STEPS = [
  // Tables partagées — uniquement les lignes liées aux interventions
  { label: 'email_logs (interventions)',      table: 'email_logs',                      filter: (q) => q.not('intervention_id', 'is', null) },
  { label: 'tasks (interventions)',           table: 'tasks',                           filter: (q) => q.not('intervention_id', 'is', null) },
  { label: 'comments (interventions)',        table: 'comments',                        filter: (q) => q.eq('entity_type', 'intervention') },
  // Reminders
  { label: 'intervention_reminders',          table: 'intervention_reminders',          filter: (q) => q.gte('id', '00000000-0000-0000-0000-000000000000') },
  // Données interventions (enfants d'abord)
  { label: 'intervention_compta_checks',      table: 'intervention_compta_checks',      filter: (q) => q.gte('id', '00000000-0000-0000-0000-000000000000') },
  { label: 'intervention_attachments',        table: 'intervention_attachments',        filter: (q) => q.gte('id', '00000000-0000-0000-0000-000000000000') },
  { label: 'intervention_costs_cache',        table: 'intervention_costs_cache',        filter: (q) => q.gte('intervention_id', '00000000-0000-0000-0000-000000000000') },
  { label: 'intervention_payments',           table: 'intervention_payments',           filter: (q) => q.gte('id', '00000000-0000-0000-0000-000000000000') },
  { label: 'intervention_status_transitions', table: 'intervention_status_transitions', filter: (q) => q.gte('id', '00000000-0000-0000-0000-000000000000') },
  { label: 'intervention_artisans',           table: 'intervention_artisans',           filter: (q) => q.gte('id', '00000000-0000-0000-0000-000000000000') },
  // Les triggers AFTER DELETE sur intervention_costs, intervention_payments,
  // intervention_artisans, intervention_attachments réinsèrent dans intervention_audit_log.
  // On vide donc intervention_audit_log EN DERNIER parmi les enfants, juste avant interventions,
  // avec un double-vidage pour couvrir les insertions de triggers du batch intervention_costs.
  { label: 'intervention_audit_log (1/2)',    table: 'intervention_audit_log',          filter: (q) => q.gte('id', '00000000-0000-0000-0000-000000000000') },
  { label: 'intervention_costs',              table: 'intervention_costs',              filter: (q) => q.gte('id', '00000000-0000-0000-0000-000000000000'), batch: true },
  { label: 'intervention_audit_log (2/2)',    table: 'intervention_audit_log',          filter: (q) => q.gte('id', '00000000-0000-0000-0000-000000000000') },
  { label: 'interventions',                   table: 'interventions',                   filter: (q) => q.gte('id', '00000000-0000-0000-0000-000000000000') },
  // Clients (référencés uniquement par les interventions)
  { label: 'tenants',                         table: 'tenants',                         filter: (q) => q.gte('id', '00000000-0000-0000-0000-000000000000') },
  { label: 'owner',                           table: 'owner',                           filter: (q) => q.gte('id', '00000000-0000-0000-0000-000000000000') },
];

// ── Rapport pré-suppression ────────────────────────────────────────────────────

async function preCleanupReport(client) {
  console.log('\n  SERA SUPPRIMÉ :');
  for (const step of CLEANUP_STEPS) {
    let q = client.from(step.table).select('*', { count: 'exact', head: true });
    // Appliquer le même filtre que la suppression pour un compte exact
    const { count, error } = await step.filter(q);
    if (error) {
      if (error.code === '42P01') continue; // table absente
      console.warn(`  ⚠️  ${step.label}: erreur lecture (${error.message})`);
      continue;
    }
    if (count > 0) {
      console.log(`    ${step.label.padEnd(38)} ${count}`);
    }
  }

  console.log('\n  SERA PRÉSERVÉ : artisans (+ métiers, zones, liaisons) et toutes les autres tables.\n');
}

// ── Suppression ────────────────────────────────────────────────────────────────

async function runCleanup(client, { verbose = false } = {}) {
  const results = { success: 0, errors: 0, details: [] };

  for (const step of CLEANUP_STEPS) {
    try {
      let error, count;

      if (step.batch) {
        ({ error, count } = await deleteBatch(client, step));
      } else {
        ({ error, count } = await step.filter(
          client.from(step.table).delete({ count: 'exact' })
        ));
      }

      if (error) {
        if (error.code === '42P01') {
          if (verbose) console.log(`  ⏭️  ${step.label.padEnd(38)} (table absente, ignorée)`);
          continue;
        }
        console.warn(`  ⚠️  ${step.label.padEnd(38)} ERREUR: ${error.message}`);
        results.errors++;
        results.details.push({ table: step.table, error: error.message });
      } else {
        console.log(`  ✅ ${step.label.padEnd(38)} ${count ?? '?'} ligne(s) supprimée(s)`);
        results.success++;
      }
    } catch (e) {
      console.warn(`  ⚠️  ${step.label.padEnd(38)} EXCEPTION: ${e.message}`);
      results.errors++;
      results.details.push({ table: step.table, error: e.message });
    }
  }

  return results;
}

// ── Export (réutilisable par un orchestrateur) ─────────────────────────────────

module.exports = { preCleanupReport, runCleanup, CLEANUP_STEPS };

// ── Exécution directe ────────────────────────────────────────────────────────

if (require.main === module) {
  const path = require('path');
  const fs = require('fs');
  const readline = require('readline');

  const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
  const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env.local';
  const envPath = path.join(ROOT, envFile);
  if (fs.existsSync(envPath) && !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    require('dotenv').config({ path: envPath });
    console.log(`  📁 Env chargé : ${envFile}`);
  }

  const { getSupabaseClientForNode } = require('../../../../src/lib/api/common/client');
  const verbose = process.argv.includes('--verbose');
  const autoYes = process.argv.includes('--yes');

  function ask(question) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => { rl.question(question, (a) => { rl.close(); resolve(a.trim().toLowerCase()); }); });
  }

  (async () => {
    const client = getSupabaseClientForNode();

    console.log('\n══════════════════════════════════════════');
    console.log('  GMBS CRM — Cleanup INTERVENTIONS (+ owner & tenants)');
    console.log('══════════════════════════════════════════');

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const isLocal = url.includes('localhost') || url.includes('127.0.0.1');
    console.log(`\n  🎯 Cible Supabase : ${url} ${isLocal ? '(LOCAL)' : '(PRODUCTION)'}`);

    await preCleanupReport(client);

    console.warn('⚠️  Cette opération est irréversible. Assurez-vous d\'avoir fait un backup.');
    console.warn('   Les artisans NE seront PAS supprimés.\n');

    if (!autoYes) {
      const answer = await ask('Confirmez-vous la suppression ? (oui / non) : ');
      if (answer !== 'oui') { console.log('\nAnnulé.'); process.exit(0); }
    }

    console.log('');
    const results = await runCleanup(client, { verbose });

    console.log(`\n${results.errors === 0 ? '✅' : '⚠️ '} Terminé — ${results.success} étapes OK, ${results.errors} erreur(s).`);
    if (results.errors > 0) process.exit(1);
  })().catch((e) => { console.error('❌ Erreur fatale:', e.message); process.exit(1); });
}
