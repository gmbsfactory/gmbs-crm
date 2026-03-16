#!/usr/bin/env node

'use strict';

/**
 * cleanup-data.js — Suppression des données de test en production
 *
 * Peut être appelé directement ou via deliver-prod.js.
 *
 * Usage direct :
 *   node scripts/data/imports/deploy/cleanup-data.js
 *   node scripts/data/imports/deploy/cleanup-data.js --verbose
 *
 * Exports (pour deliver-prod.js) :
 *   preCleanupReport(client) → affiche les counts avant suppression
 *   runCleanup(client, { verbose }) → exécute les suppressions, retourne { success, errors }
 *   validateCoverage(client) → détecte les tables non couvertes
 */

// ── Tables préservées (référence, config, auth, système) ────────────────────
// Toute table publique absente de cette liste ET de CLEANUP_STEPS sera signalée.

const PRESERVED_TABLES = new Set([
  // Référentiel métier
  'metiers',
  'zones',
  'artisan_statuses',
  'intervention_statuses',
  'task_statuses',
  // Auth & utilisateurs
  'users',
  'roles',
  'permissions',
  'user_roles',
  'user_permissions',
  'user_preferences',
  'user_page_permissions',
  'user_page_sessions',
  'auth_providers',
  'auth_user_mapping',
  'password_reset_tokens',
  // Config & agences
  'agencies',
  'agency_config',
  'lateness_email_config',
  // Système & billing
  'gestionnaire_targets',
  'podium_periods',
  'app_updates',
  'app_update_views',
  'billing_state',
  'payment_methods',
  'subscriptions',
  'orders',
  'usage_events',
  'search_views_refresh_flags',
]);

// ── Ordre de suppression (FK enfants → parents) ───────────────────────────────

const CLEANUP_STEPS = [
  // Logs & audit (sauf intervention_audit_log, déplacé juste avant interventions)
  { label: 'email_logs',                   table: 'email_logs',                   filter: (q) => q.not('intervention_id', 'is', null).or('artisan_id.not.is.null') },
  { label: 'sync_logs',                    table: 'sync_logs',                    filter: (q) => q.gte('id', '00000000-0000-0000-0000-000000000000') },
  { label: 'artisan_audit_log',            table: 'artisan_audit_log',            filter: (q) => q.gte('id', '00000000-0000-0000-0000-000000000000') },
  // IA & conversations
  { label: 'message_attachments',          table: 'message_attachments',          filter: (q) => q.gte('id', '00000000-0000-0000-0000-000000000000') },
  { label: 'messages',                     table: 'messages',                     filter: (q) => q.gte('id', '00000000-0000-0000-0000-000000000000') },
  { label: 'conversation_participants',    table: 'conversation_participants',    filter: (q) => q.gte('id', '00000000-0000-0000-0000-000000000000') },
  { label: 'conversations',                table: 'conversations',                filter: (q) => q.gte('id', '00000000-0000-0000-0000-000000000000') },
  { label: 'chat_messages',                table: 'chat_messages',                filter: (q) => q.gte('id', '00000000-0000-0000-0000-000000000000') },
  { label: 'chat_sessions',                table: 'chat_sessions',                filter: (q) => q.gte('id', '00000000-0000-0000-0000-000000000000') },
  { label: 'ai_assistants',                table: 'ai_assistants',                filter: (q) => q.gte('id', '00000000-0000-0000-0000-000000000000') },
  // Reminders & tâches
  { label: 'intervention_reminders',       table: 'intervention_reminders',       filter: (q) => q.gte('id', '00000000-0000-0000-0000-000000000000') },
  { label: 'tasks',                        table: 'tasks',                        filter: (q) => q.not('intervention_id', 'is', null).or('artisan_id.not.is.null') },
  // Commentaires
  { label: 'comments',                     table: 'comments',                     filter: (q) => q.in('entity_type', ['intervention', 'artisan', 'client']) },
  // Données interventions (enfants d'abord)
  { label: 'intervention_compta_checks',   table: 'intervention_compta_checks',   filter: (q) => q.gte('id', '00000000-0000-0000-0000-000000000000') },
  { label: 'intervention_attachments',     table: 'intervention_attachments',     filter: (q) => q.gte('id', '00000000-0000-0000-0000-000000000000') },
  { label: 'intervention_costs_cache',     table: 'intervention_costs_cache',     filter: (q) => q.gte('intervention_id', '00000000-0000-0000-0000-000000000000') },
  { label: 'intervention_payments',        table: 'intervention_payments',        filter: (q) => q.gte('id', '00000000-0000-0000-0000-000000000000') },
  { label: 'intervention_status_transitions', table: 'intervention_status_transitions', filter: (q) => q.gte('id', '00000000-0000-0000-0000-000000000000') },
  { label: 'intervention_artisans',        table: 'intervention_artisans',        filter: (q) => q.gte('id', '00000000-0000-0000-0000-000000000000') },
  // Les triggers AFTER DELETE sur intervention_costs, intervention_payments,
  // intervention_artisans, intervention_attachments réinsèrent dans intervention_audit_log.
  // On vide donc intervention_audit_log EN DERNIER parmi les enfants, juste avant interventions,
  // pour capturer toutes les insertions de triggers. Un double-vidage est utilisé pour couvrir
  // le cas où intervention_costs (batch) génère des insertions après le premier vidage.
  { label: 'intervention_audit_log (1/2)', table: 'intervention_audit_log',       filter: (q) => q.gte('id', '00000000-0000-0000-0000-000000000000') },
  { label: 'intervention_costs',           table: 'intervention_costs',           filter: (q) => q.gte('id', '00000000-0000-0000-0000-000000000000'), batch: true },
  { label: 'intervention_audit_log (2/2)', table: 'intervention_audit_log',       filter: (q) => q.gte('id', '00000000-0000-0000-0000-000000000000') },
  { label: 'interventions',                table: 'interventions',                filter: (q) => q.gte('id', '00000000-0000-0000-0000-000000000000') },
  // Données artisans (enfants d'abord)
  { label: 'artisan_attachments',          table: 'artisan_attachments',          filter: (q) => q.gte('id', '00000000-0000-0000-0000-000000000000') },
  { label: 'artisan_absences',             table: 'artisan_absences',             filter: (q) => q.gte('id', '00000000-0000-0000-0000-000000000000') },
  { label: 'artisan_status_history',       table: 'artisan_status_history',       filter: (q) => q.gte('id', '00000000-0000-0000-0000-000000000000') },
  { label: 'artisan_metiers',              table: 'artisan_metiers',              filter: (q) => q.gte('id', '00000000-0000-0000-0000-000000000000') },
  { label: 'artisan_zones',                table: 'artisan_zones',                filter: (q) => q.gte('id', '00000000-0000-0000-0000-000000000000') },
  { label: 'artisans',                     table: 'artisans',                     filter: (q) => q.gte('id', '00000000-0000-0000-0000-000000000000') },
  // Clients
  { label: 'tenants',                      table: 'tenants',                      filter: (q) => q.gte('id', '00000000-0000-0000-0000-000000000000') },
  { label: 'owner',                        table: 'owner',                        filter: (q) => q.gte('id', '00000000-0000-0000-0000-000000000000') },
];

// ── Validation de couverture ────────────────────────────────────────────────

const CLEANUP_TABLE_NAMES = new Set(CLEANUP_STEPS.map((s) => s.table));

// Tables spéciales (vues matérialisées, tables gérées par triggers, etc.)
// qui n'ont pas besoin d'être dans CLEANUP_STEPS ni dans PRESERVED_TABLES
const IGNORED_TABLES = new Set([
  'interventions_ca',         // Vue matérialisée, recalculée automatiquement
  'interventions_search_mv',  // Vue matérialisée full-text search
  'artisans_search_mv',       // Vue matérialisée full-text search
  'global_search_mv',         // Vue matérialisée full-text search
]);

async function validateCoverage(client) {
  const { data, error } = await client.rpc('get_public_tables');

  if (error) {
    // Fallback : requête directe sur information_schema
    const { data: fallback, error: fbErr } = await client
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_type', 'BASE TABLE');

    if (fbErr) {
      console.warn('  ⚠️  Impossible de lister les tables (RPC et fallback échoués).');
      console.warn(`      RPC: ${error.message}`);
      console.warn(`      Fallback: ${fbErr.message}`);
      return { uncovered: [], ok: true };
    }

    return checkCoverage(fallback.map((r) => r.table_name));
  }

  return checkCoverage(data.map((r) => r.table_name));
}

function checkCoverage(tableNames) {
  const uncovered = tableNames.filter(
    (t) => !CLEANUP_TABLE_NAMES.has(t) && !PRESERVED_TABLES.has(t) && !IGNORED_TABLES.has(t)
  );

  if (uncovered.length > 0) {
    console.warn('\n  ⚠️  Tables non couvertes (ni supprimées, ni préservées, ni ignorées) :');
    uncovered.forEach((t) => console.warn(`      - ${t}`));
    console.warn('      → Ajoutez-les à CLEANUP_STEPS, PRESERVED_TABLES, ou IGNORED_TABLES.\n');
  }

  return { uncovered, ok: uncovered.length === 0 };
}

// ── Rapport pré-suppression (dynamique) ─────────────────────────────────────

async function preCleanupReport(client) {
  console.log('\n  SERA SUPPRIMÉ :');
  for (const step of CLEANUP_STEPS) {
    const { count, error } = await client.from(step.table).select('*', { count: 'exact', head: true });
    if (error) {
      if (error.code === '42P01') continue; // table absente
      console.warn(`  ⚠️  ${step.label}: erreur lecture (${error.message})`);
      continue;
    }
    if (count > 0) {
      console.log(`    ${step.label.padEnd(35)} ${count}`);
    }
  }

  console.log('\n  SERA PRÉSERVÉ :');
  for (const table of PRESERVED_TABLES) {
    const { count, error } = await client.from(table).select('*', { count: 'exact', head: true });
    if (error) {
      if (error.code === '42P01') continue;
      console.warn(`  ⚠️  ${table}: erreur lecture (${error.message})`);
      continue;
    }
    console.log(`    ${table.padEnd(35)} ${count ?? 0}`);
  }

  console.log('');
}

// ── Suppression ───────────────────────────────────────────────────────────────

const BATCH_SIZE = 50;

async function deleteBatch(client, step) {
  let totalDeleted = 0;
  let pass = 0;

  while (true) {
    // Sélectionner un lot d'IDs à supprimer
    const { data: rows, error: selError } = await client
      .from(step.table)
      .select('id')
      .limit(BATCH_SIZE);

    if (selError) return { error: selError, count: totalDeleted };
    if (!rows || rows.length === 0) break;

    const ids = rows.map((r) => r.id);
    const { error: delError, count } = await client
      .from(step.table)
      .delete({ count: 'exact' })
      .in('id', ids);

    if (delError) return { error: delError, count: totalDeleted };

    totalDeleted += count ?? ids.length;
    pass++;

    if (rows.length < BATCH_SIZE) break; // dernier lot
  }

  return { error: null, count: totalDeleted };
}

async function runCleanup(client, { verbose = false } = {}) {
  const results = { success: 0, errors: 0, details: [] };

  for (const step of CLEANUP_STEPS) {
    try {
      let error, count;

      if (step.batch) {
        // Suppression par lots pour les grandes tables sujettes aux timeouts
        ({ error, count } = await deleteBatch(client, step));
      } else {
        ({ error, count } = await step.filter(
          client.from(step.table).delete({ count: 'exact' })
        ));
      }

      if (error) {
        if (error.code === '42P01') {
          if (verbose) console.log(`  ⏭️  ${step.label.padEnd(35)} (table absente, ignorée)`);
          continue;
        }
        console.warn(`  ⚠️  ${step.label.padEnd(35)} ERREUR: ${error.message}`);
        results.errors++;
        results.details.push({ table: step.table, error: error.message });
      } else {
        console.log(`  ✅ ${step.label.padEnd(35)} ${count ?? '?'} ligne(s) supprimée(s)`);
        results.success++;
      }
    } catch (e) {
      console.warn(`  ⚠️  ${step.label.padEnd(35)} EXCEPTION: ${e.message}`);
      results.errors++;
      results.details.push({ table: step.table, error: e.message });
    }
  }

  return results;
}

// ── Export (utilisé par deliver-prod.js) ─────────────────────────────────────

module.exports = { preCleanupReport, runCleanup, validateCoverage };

// ── Exécution directe ─────────────────────────────────────────────────────────

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

  const { getSupabaseClientForNode } = require('../../../../src/lib/api/v2/common/client');
  const verbose = process.argv.includes('--verbose');

  function ask(question) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => { rl.question(question, (a) => { rl.close(); resolve(a.trim().toLowerCase()); }); });
  }

  (async () => {
    const client = getSupabaseClientForNode();

    console.log('\n══════════════════════════════════════');
    console.log('  GMBS CRM — Cleanup données production');
    console.log('══════════════════════════════════════\n');

    // Validation de couverture
    const coverage = await validateCoverage(client);
    if (!coverage.ok) {
      console.warn('⚠️  Des tables ne sont pas couvertes. Vérifiez la configuration ci-dessus.\n');
    }

    await preCleanupReport(client);

    console.warn('⚠️  Cette opération est irréversible. Assurez-vous d\'avoir fait un backup.\n');
    const answer = await ask('Confirmez-vous la suppression ? (oui / non) : ');
    if (answer !== 'oui') { console.log('\nAnnulé.'); process.exit(0); }

    console.log('');
    const results = await runCleanup(client, { verbose });

    console.log(`\n${results.errors === 0 ? '✅' : '⚠️ '} Terminé — ${results.success} étapes OK, ${results.errors} erreur(s).`);
    if (results.errors > 0) process.exit(1);
  })().catch((e) => { console.error('❌ Erreur fatale:', e.message); process.exit(1); });
}
