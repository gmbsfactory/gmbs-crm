#!/usr/bin/env node

'use strict';

/**
 * backfill-status-transitions.js — Peuplement post-import de intervention_status_transitions
 *
 * Après un import depuis Google Sheets, les interventions sont insérées directement
 * en base sans passer par l'API. Le trigger sur INSERT crée bien une transition pour
 * le statut final, mais les artisans n'étaient pas encore liés à ce moment-là.
 *
 * Ce script s'assure que :
 *   1. Toute intervention active a au moins une transition (statut courant, date de création)
 *   2. Toute intervention terminée (INTER_TERMINEE + date_termine) a sa transition finale
 *      → ce qui déclenche recalculate_artisan_status via le trigger DB
 *
 * Idempotent : ne crée jamais de doublons.
 *
 * Exports (pour deliver-prod.js) :
 *   runBackfillStatusTransitions(client, { verbose, dryRun }) → { initial, terminee, skipped }
 */

const BATCH_SIZE = 500;

// ── Helpers ───────────────────────────────────────────────────────────────────

const ts  = () => new Date().toLocaleTimeString('fr-FR');
const log  = (msg) => console.log(`[${ts()}] ${msg}`);
const warn = (msg) => console.log(`[${ts()}] ⚠️  ${msg}`);
const err  = (msg) => console.error(`[${ts()}] ❌ ${msg}`);

async function insertBatched(client, rows, label) {
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await client.from('intervention_status_transitions').insert(batch);
    if (error) {
      err(`Erreur insertion batch ${label} (offset ${i}) : ${error.message}`);
    } else {
      inserted += batch.length;
    }
  }
  return inserted;
}

// ── Export principal ──────────────────────────────────────────────────────────

async function runBackfillStatusTransitions(client, { verbose = false, dryRun = false } = {}) {
  const results = { initial: 0, terminee: 0, skipped: 0 };

  // 1. Charger tous les statuts
  const { data: statuses, error: statusErr } = await client
    .from('intervention_statuses')
    .select('id, code');
  if (statusErr) throw new Error(`Impossible de charger intervention_statuses : ${statusErr.message}`);

  const statusById   = Object.fromEntries(statuses.map(s => [s.id,   s]));
  const statusByCode = Object.fromEntries(statuses.map(s => [s.code, s]));
  const terminatedId = statusByCode['INTER_TERMINEE']?.id;

  // 2. Charger toutes les interventions actives
  const { data: interventions, error: interErr } = await client
    .from('interventions')
    .select('id, statut_id, created_at, date, date_termine')
    .eq('is_active', true);
  if (interErr) throw new Error(`Impossible de charger les interventions : ${interErr.message}`);

  if (verbose) log(`  ${interventions.length} interventions actives chargées`);

  // 3. Charger les transitions existantes (intervention_id + to_status_id)
  const { data: existing, error: transErr } = await client
    .from('intervention_status_transitions')
    .select('intervention_id, to_status_id');
  if (transErr) throw new Error(`Impossible de charger intervention_status_transitions : ${transErr.message}`);

  // Sets pour lookup O(1)
  const withAnyTransition     = new Set(existing.map(t => t.intervention_id));
  const withTermineeTransition = new Set(
    existing
      .filter(t => t.to_status_id === terminatedId)
      .map(t => t.intervention_id)
  );

  if (verbose) log(`  ${withAnyTransition.size} interventions ont déjà au moins une transition`);

  // ── Étape A : transition initiale ─────────────────────────────────────────
  // Pour chaque intervention sans aucune transition, créer la transition vers son statut courant.

  const needsInitial = interventions.filter(i =>
    !withAnyTransition.has(i.id) &&
    i.statut_id &&
    statusById[i.statut_id]
  );

  if (verbose) log(`  ${needsInitial.length} interventions sans transition → backfill initial`);

  if (needsInitial.length > 0) {
    if (dryRun) {
      log(`  [DRY-RUN] ${needsInitial.length} transitions initiales seraient créées`);
      results.initial = needsInitial.length;
    } else {
      const rows = needsInitial.map(i => ({
        intervention_id:    i.id,
        from_status_id:     null,
        to_status_id:       i.statut_id,
        from_status_code:   null,
        to_status_code:     statusById[i.statut_id].code,
        changed_by_user_id: null,
        transition_date:    i.created_at ?? i.date ?? new Date().toISOString(),
        source:             'trigger',
        metadata: {
          backfilled:    true,
          backfill_date: new Date().toISOString(),
          note:          'Post-import backfill — transition initiale',
        },
      }));
      results.initial = await insertBatched(client, rows, 'initial');
      log(`  ✅ ${results.initial} transitions initiales créées`);
    }
  } else {
    log('  ✅ Toutes les interventions ont déjà une transition initiale');
  }

  // ── Étape B : transition INTER_TERMINEE ───────────────────────────────────
  // Pour les interventions terminées (statut = INTER_TERMINEE + date_termine),
  // s'assurer qu'une transition vers INTER_TERMINEE existe.
  // C'est cette insertion qui déclenche le trigger trg_recalculate_artisan_on_transition.

  if (!terminatedId) {
    warn('Statut INTER_TERMINEE introuvable — étape B ignorée');
  } else {
    const needsTerminee = interventions.filter(i =>
      i.statut_id === terminatedId &&
      i.date_termine &&
      !withTermineeTransition.has(i.id)
    );

    if (verbose) log(`  ${needsTerminee.length} interventions terminées sans transition INTER_TERMINEE`);

    if (needsTerminee.length > 0) {
      if (dryRun) {
        log(`  [DRY-RUN] ${needsTerminee.length} transitions INTER_TERMINEE seraient créées`);
        results.terminee = needsTerminee.length;
      } else {
        const rows = needsTerminee.map(i => ({
          intervention_id:    i.id,
          from_status_id:     i.statut_id,
          to_status_id:       terminatedId,
          from_status_code:   statusById[i.statut_id]?.code ?? null,
          to_status_code:     'INTER_TERMINEE',
          changed_by_user_id: null,
          transition_date:    i.date_termine,
          source:             'trigger',
          metadata: {
            backfilled:    true,
            backfill_date: new Date().toISOString(),
            note:          'Post-import backfill — transition vers INTER_TERMINEE',
          },
        }));
        results.terminee = await insertBatched(client, rows, 'terminee');
        log(`  ✅ ${results.terminee} transitions INTER_TERMINEE créées (recalcul artisans déclenché)`);
      }
    } else {
      log('  ✅ Toutes les interventions terminées ont déjà leur transition INTER_TERMINEE');
    }
  }

  results.skipped = interventions.length - needsInitial?.length - (terminatedId ? 0 : 0);
  return results;
}

module.exports = { runBackfillStatusTransitions };

// ── Exécution directe ─────────────────────────────────────────────────────────

if (require.main === module) {
  const path = require('path');
  const fs   = require('fs');

  const ROOT    = path.resolve(__dirname, '..', '..', '..', '..');
  const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env.local';
  const envPath = path.join(ROOT, envFile);
  if (fs.existsSync(envPath)) require('dotenv').config({ path: envPath });

  const { getSupabaseClientForNode } = require(path.join(ROOT, 'src/lib/api/v2/common/client.ts'));
  const args    = process.argv.slice(2);
  const verbose = args.includes('--verbose');
  const dryRun  = args.includes('--dry-run');

  const client = getSupabaseClientForNode();

  runBackfillStatusTransitions(client, { verbose, dryRun })
    .then(r => {
      console.log(`\n✅ Backfill terminé — initial: ${r.initial}, terminee: ${r.terminee}`);
    })
    .catch(e => {
      console.error(`\n❌ Erreur : ${e.message}`);
      process.exit(1);
    });
}
