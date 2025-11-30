/**
 * Test complet pour les transitions automatiques de statuts
 *
 * Ce test vérifie que les transitions automatiques fonctionnent correctement pour :
 * 1. INSERT via upsertDirect (import)
 * 2. UPDATE via interventionsApi.update
 * 3. UPSERT via interventionsApi.upsertDirect
 *
 * Usage:
 *   npx tsx scripts/test-api/test-automatic-transitions.ts
 */

import dotenv from 'dotenv';
import { automaticTransitionService } from '../../src/lib/interventions/automatic-transition-service';
import { supabase } from '../../src/lib/supabase-client';
import type { InterventionStatusKey } from '../../src/config/interventions';

// Charger les variables d'environnement
dotenv.config({ path: '.env.local' });

const EXPECTED_FULL_CHAIN = [
  'DEMANDE',
  'DEVIS_ENVOYE',
  'VISITE_TECHNIQUE',
  'ACCEPTE',
  'INTER_EN_COURS',
  'INTER_TERMINEE'
];

// ========================================
// Helpers
// ========================================

async function getStatusId(code: string): Promise<string> {
  const { data, error } = await supabase
    .from('intervention_statuses')
    .select('id')
    .eq('code', code)
    .single();

  if (error || !data) {
    throw new Error(`Statut ${code} non trouvé`);
  }

  return data.id;
}

async function getActiveAgency(): Promise<string> {
  const { data, error } = await supabase
    .from('agencies')
    .select('id')
    .eq('is_active', true)
    .limit(1)
    .single();

  if (error || !data) {
    throw new Error('Aucune agence active trouvée');
  }

  return data.id;
}

async function getTransitions(interventionId: string) {
  const { data, error } = await supabase
    .from('intervention_status_transitions')
    .select(`
      id,
      from_status_id,
      to_status_id,
      transition_date,
      source,
      metadata,
      from_status:intervention_statuses!from_status_id(code),
      to_status:intervention_statuses!to_status_id(code)
    `)
    .eq('intervention_id', interventionId)
    .order('transition_date', { ascending: true });

  if (error) throw error;

  return data.map((t: any) => ({
    from: t.from_status?.code || null,
    to: t.to_status?.code,
    source: t.source,
    metadata: t.metadata
  }));
}

async function cleanupIntervention(interventionId: string) {
  // Supprimer les transitions
  await supabase
    .from('intervention_status_transitions')
    .delete()
    .eq('intervention_id', interventionId);

  // Supprimer l'intervention
  await supabase
    .from('interventions')
    .delete()
    .eq('id', interventionId);
}

function validateChain(transitions: any[], expected: string[]): boolean {
  if (transitions.length !== expected.length) {
    console.log(`   ❌ Nombre de transitions incorrect: ${transitions.length} au lieu de ${expected.length}`);
    return false;
  }

  for (let i = 0; i < expected.length; i++) {
    const transition = transitions[i];
    const expectedTo = expected[i];

    if (transition.to !== expectedTo) {
      console.log(`   ❌ Transition ${i + 1} incorrecte: ${transition.to} au lieu de ${expectedTo}`);
      return false;
    }

    // Vérifier le from
    if (i === 0) {
      if (transition.from !== null) {
        console.log(`   ❌ Première transition devrait partir de NULL, pas de ${transition.from}`);
        return false;
      }
    } else {
      if (transition.from !== expected[i - 1]) {
        console.log(`   ❌ Transition ${i + 1} devrait partir de ${expected[i - 1]}, pas de ${transition.from}`);
        return false;
      }
    }
  }

  return true;
}

function printTransitions(transitions: any[]) {
  console.log('\n   Transitions créées:');
  transitions.forEach((t, i) => {
    const fromStr = t.from || 'NULL';
    console.log(`   ${i + 1}. ${fromStr} → ${t.to}`);
  });
}

// ========================================
// Test 1: INSERT direct avec INTER_TERMINEE (simulant un import)
// ========================================

async function testInsertWithFinalStatus() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  Test 1: INSERT direct avec INTER_TERMINEE (import)       ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  const agencyId = await getActiveAgency();
  const statusId = await getStatusId('INTER_TERMINEE');

  // 1. INSERT direct dans la DB (comme le fait upsertDirect ligne 884-893)
  console.log('\n📥 INSERT direct avec statut INTER_TERMINEE...');
  const { data: intervention, error: insertError } = await supabase
    .from('interventions')
    .insert({
      id_inter: `TEST_INSERT_${Date.now()}`,
      contexte_intervention: 'Test INSERT - Transitions automatiques',
      adresse: '123 Rue Test',
      ville: 'Paris',
      code_postal: '75001',
      statut_id: statusId,
      agence_id: agencyId,
      date: new Date().toISOString(),
      is_active: true
    })
    .select()
    .single();

  if (insertError) throw insertError;

  console.log('✅ Intervention créée:', intervention.id);

  // 2. Supprimer la transition créée par le trigger (comme upsertDirect ligne 901-906)
  await supabase
    .from('intervention_status_transitions')
    .delete()
    .eq('intervention_id', intervention.id)
    .eq('source', 'trigger');

  // 3. Créer les transitions automatiques (comme upsertDirect ligne 913)
  console.log('🔗 Création des transitions via automaticTransitionService...');
  const result = await automaticTransitionService.createAutomaticTransitions(
    intervention.id,
    statusId,
    null, // fromStatusId = null pour INSERT
    undefined, // userId
    {
      updated_via: 'test_insert',
      import_operation: true
    }
  );

  console.log('   Résultat:', result.success ? '✅ Succès' : '❌ Échec');
  console.log('   Transitions créées:', result.transitionsCreated);

  // 3. Vérifier les transitions
  const transitions = await getTransitions(intervention.id);
  printTransitions(transitions);

  const isValid = validateChain(transitions, EXPECTED_FULL_CHAIN);

  // 4. Nettoyer
  await cleanupIntervention(intervention.id);

  if (!isValid) {
    throw new Error('❌ Test INSERT échoué: chaîne invalide');
  }

  console.log('\n✅ Test INSERT réussi !');
  return true;
}

// ========================================
// Test 2: UPDATE de DEMANDE vers INTER_TERMINEE
// ========================================

async function testUpdateWithChain() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  Test 2: UPDATE de DEMANDE vers INTER_TERMINEE            ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  const agencyId = await getActiveAgency();
  const demandeStatusId = await getStatusId('DEMANDE');
  const interTermineeStatusId = await getStatusId('INTER_TERMINEE');

  // 1. Créer une intervention avec DEMANDE
  console.log('\n📝 Création intervention avec statut DEMANDE...');
  const { data: intervention, error: insertError } = await supabase
    .from('interventions')
    .insert({
      id_inter: `TEST_UPDATE_${Date.now()}`,
      contexte_intervention: 'Test UPDATE - Transitions automatiques',
      adresse: '456 Avenue Test',
      ville: 'Lyon',
      code_postal: '69001',
      statut_id: demandeStatusId,
      agence_id: agencyId,
      date: new Date().toISOString(),
      is_active: true
    })
    .select()
    .single();

  if (insertError) throw insertError;

  console.log('✅ Intervention créée:', intervention.id);

  // 2. Créer les transitions vers INTER_TERMINEE (comme interventionsApi.update ligne 362)
  console.log('🔄 UPDATE vers INTER_TERMINEE via automaticTransitionService...');
  const result = await automaticTransitionService.executeTransition(
    intervention.id,
    'DEMANDE' as InterventionStatusKey,
    'INTER_TERMINEE' as InterventionStatusKey,
    undefined, // userId
    {
      updated_via: 'test_update'
    }
  );

  console.log('   Résultat:', result.success ? '✅ Succès' : '❌ Échec');
  console.log('   Transitions créées:', result.transitionsCreated);

  // 3. UPDATE le statut dans la DB (comme interventionsApi.update ligne 401)
  await supabase
    .from('interventions')
    .update({ statut_id: interTermineeStatusId })
    .eq('id', intervention.id);

  // 4. Vérifier les transitions
  const transitions = await getTransitions(intervention.id);
  printTransitions(transitions);

  // Pour UPDATE, on attend:
  // - NULL → DEMANDE (créée par le trigger lors de l'INSERT initial)
  // - DEMANDE → DEVIS_ENVOYE → ... → INTER_TERMINEE (créées par automaticTransitionService)
  // = Chaîne complète de 6 transitions
  const isValid = validateChain(transitions, EXPECTED_FULL_CHAIN);

  // 5. Nettoyer
  await cleanupIntervention(intervention.id);

  if (!isValid) {
    throw new Error('❌ Test UPDATE échoué: chaîne invalide');
  }

  console.log('\n✅ Test UPDATE réussi !');
  return true;
}

// ========================================
// Test 3: UPSERT avec statut final (comme import qui met à jour)
// ========================================

async function testUpsertWithFinalStatus() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  Test 3: UPSERT avec INTER_TERMINEE (import update)       ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  const agencyId = await getActiveAgency();
  const demandeStatusId = await getStatusId('DEMANDE');
  const interTermineeStatusId = await getStatusId('INTER_TERMINEE');
  const idInter = `TEST_UPSERT_${Date.now()}`;

  // 1. Créer une intervention existante avec DEMANDE
  console.log('\n📝 Création intervention initiale avec DEMANDE...');
  const { data: initialIntervention } = await supabase
    .from('interventions')
    .insert({
      id_inter: idInter,
      contexte_intervention: 'Test UPSERT - Initial',
      adresse: '789 Boulevard Test',
      ville: 'Marseille',
      code_postal: '13001',
      statut_id: demandeStatusId,
      agence_id: agencyId,
      date: new Date().toISOString(),
      is_active: true
    })
    .select()
    .single();

  if (!initialIntervention) throw new Error('Impossible de créer l\'intervention initiale');

  console.log('✅ Intervention initiale créée:', initialIntervention.id);

  // 2. UPSERT avec INTER_TERMINEE (comme upsertDirect ligne 884)
  console.log('🔄 UPSERT vers INTER_TERMINEE...');
  const { data: intervention } = await supabase
    .from('interventions')
    .upsert({
      id_inter: idInter,
      contexte_intervention: 'Test UPSERT - Mis à jour',
      adresse: '789 Boulevard Test',
      ville: 'Marseille',
      code_postal: '13001',
      statut_id: interTermineeStatusId,
      agence_id: agencyId,
      date: new Date().toISOString(),
      is_active: true
    }, {
      onConflict: 'id_inter',
      ignoreDuplicates: false
    })
    .select()
    .single();

  if (!intervention) throw new Error('UPSERT échoué');

  // 3. Supprimer la transition DEMANDE → INTER_TERMINEE créée par le trigger UPDATE
  // (comme upsertDirect ne supprime que pour INSERT, pas pour UPDATE, mais le test doit nettoyer)
  await supabase
    .from('intervention_status_transitions')
    .delete()
    .eq('intervention_id', intervention.id)
    .eq('from_status_id', demandeStatusId)
    .eq('to_status_id', interTermineeStatusId)
    .eq('source', 'trigger');

  // 4. Créer les transitions automatiques (comme upsertDirect ligne 913)
  console.log('🔗 Création des transitions via automaticTransitionService...');
  const result = await automaticTransitionService.createAutomaticTransitions(
    intervention.id,
    interTermineeStatusId,
    demandeStatusId, // fromStatusId = ancien statut pour UPDATE
    undefined,
    {
      updated_via: 'test_upsert',
      upsert_operation: true
    }
  );

  console.log('   Résultat:', result.success ? '✅ Succès' : '❌ Échec');
  console.log('   Transitions créées:', result.transitionsCreated);

  // 4. Vérifier les transitions
  const transitions = await getTransitions(intervention.id);
  printTransitions(transitions);

  // Pour UPSERT d'un UPDATE, on attend:
  // - NULL → DEMANDE (créée par le trigger lors de l'INSERT initial)
  // - DEMANDE → DEVIS_ENVOYE → ... → INTER_TERMINEE (créées par automaticTransitionService)
  // = Chaîne complète de 6 transitions
  const isValid = validateChain(transitions, EXPECTED_FULL_CHAIN);

  // 5. Nettoyer
  await cleanupIntervention(intervention.id);

  if (!isValid) {
    throw new Error('❌ Test UPSERT échoué: chaîne invalide');
  }

  console.log('\n✅ Test UPSERT réussi !');
  return true;
}

// ========================================
// Test principal
// ========================================

async function runTests() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  Test Automatique - Transitions de Statuts                ║');
  console.log('║  Teste INSERT, UPDATE, et UPSERT                           ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  try {
    await testInsertWithFinalStatus();
    await testUpdateWithChain();
    await testUpsertWithFinalStatus();

    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║  ✅ TOUS LES TESTS RÉUSSIS !                                  ║');
    console.log('╚════════════════════════════════════════════════════════════╝');

    process.exit(0);
  } catch (error: any) {
    console.error('\n╔════════════════════════════════════════════════════════════╗');
    console.error('║  ❌ ERREUR LORS DES TESTS                                     ║');
    console.error('╚════════════════════════════════════════════════════════════╝');
    console.error('\n', error.message);
    if (error.stack) {
      console.error('\nStack trace:', error.stack);
    }

    process.exit(1);
  }
}

// Exécuter les tests
runTests();
