/**
 * Test complet pour les transitions automatiques de statuts via l'API v2
 *
 * Ce test vérifie que les transitions automatiques fonctionnent correctement pour :
 * 1. INSERT via interventionsApi.create
 * 2. UPDATE via interventionsApi.update
 * 3. UPSERT via interventionsApi.upsertDirect
 *
 * Usage:
 *   npx tsx scripts/test-api/test-automatic-transitions-api-v2.ts
 */

import dotenv from 'dotenv';
import { interventionsApi } from '../../src/lib/api/v2/interventionsApi';
import { supabase } from '../../src/lib/supabase-client';

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
// Test 1: INSERT via interventionsApi.create
// ========================================

async function testCreateWithFinalStatus() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  Test 1: INSERT via interventionsApi.create              ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  const agencyId = await getActiveAgency();
  const statusId = await getStatusId('INTER_TERMINEE');

  // 1. Créer l'intervention via l'API v2
  console.log('\n📥 Création intervention avec statut INTER_TERMINEE via API v2...');
  const intervention = await interventionsApi.create({
    id_inter: `TEST_API_CREATE_${Date.now()}`,
    contexte_intervention: 'Test CREATE API v2 - Transitions automatiques',
    adresse: '123 Rue Test',
    ville: 'Paris',
    code_postal: '75001',
    statut_id: statusId,
    agence_id: agencyId,
    date: new Date().toISOString(),
    is_active: true
  });

  console.log('✅ Intervention créée:', intervention.id);

  // 2. Vérifier les transitions
  const transitions = await getTransitions(intervention.id);
  printTransitions(transitions);

  const isValid = validateChain(transitions, EXPECTED_FULL_CHAIN);

  // 3. Nettoyer
  await cleanupIntervention(intervention.id);

  if (!isValid) {
    throw new Error('❌ Test CREATE échoué: chaîne invalide');
  }

  console.log('\n✅ Test CREATE réussi !');
  return true;
}

// ========================================
// Test 2: UPDATE via interventionsApi.update
// ========================================

async function testUpdateWithChain() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  Test 2: UPDATE via interventionsApi.update               ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  const agencyId = await getActiveAgency();
  const demandeStatusId = await getStatusId('DEMANDE');
  const interTermineeStatusId = await getStatusId('INTER_TERMINEE');

  // 1. Créer une intervention avec DEMANDE via l'API v2
  console.log('\n📝 Création intervention avec statut DEMANDE via API v2...');
  const initialIntervention = await interventionsApi.create({
    id_inter: `TEST_API_UPDATE_${Date.now()}`,
    contexte_intervention: 'Test UPDATE API v2 - Transitions automatiques',
    adresse: '456 Avenue Test',
    ville: 'Lyon',
    code_postal: '69001',
    statut_id: demandeStatusId,
    agence_id: agencyId,
    date: new Date().toISOString(),
    is_active: true
  });

  console.log('✅ Intervention créée:', initialIntervention.id);

  // 2. Mettre à jour vers INTER_TERMINEE via l'API v2
  console.log('🔄 UPDATE vers INTER_TERMINEE via interventionsApi.update...');
  const updatedIntervention = await interventionsApi.update(initialIntervention.id, {
    statut_id: interTermineeStatusId
  });

  console.log('✅ Intervention mise à jour:', updatedIntervention.id);

  // 3. Vérifier les transitions
  const transitions = await getTransitions(updatedIntervention.id);
  printTransitions(transitions);

  // Pour UPDATE, on attend:
  // - NULL → DEMANDE (créée par le trigger lors de l'INSERT initial)
  // - DEMANDE → DEVIS_ENVOYE → ... → INTER_TERMINEE (créées par automaticTransitionService via l'API)
  // = Chaîne complète de 6 transitions
  const isValid = validateChain(transitions, EXPECTED_FULL_CHAIN);

  // 4. Nettoyer
  await cleanupIntervention(updatedIntervention.id);

  if (!isValid) {
    throw new Error('❌ Test UPDATE échoué: chaîne invalide');
  }

  console.log('\n✅ Test UPDATE réussi !');
  return true;
}

// ========================================
// Test 3: UPSERT via interventionsApi.upsertDirect
// ========================================

async function testUpsertDirectWithFinalStatus() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  Test 3: UPSERT via interventionsApi.upsertDirect         ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  const agencyId = await getActiveAgency();
  const demandeStatusId = await getStatusId('DEMANDE');
  const interTermineeStatusId = await getStatusId('INTER_TERMINEE');
  const idInter = `TEST_API_UPSERT_${Date.now()}`;

  // 1. Créer une intervention existante avec DEMANDE via l'API v2
  console.log('\n📝 Création intervention initiale avec DEMANDE via API v2...');
  const initialIntervention = await interventionsApi.create({
    id_inter: idInter,
    contexte_intervention: 'Test UPSERT API v2 - Initial',
    adresse: '789 Boulevard Test',
    ville: 'Marseille',
    code_postal: '13001',
    statut_id: demandeStatusId,
    agence_id: agencyId,
    date: new Date().toISOString(),
    is_active: true
  });

  console.log('✅ Intervention initiale créée:', initialIntervention.id);

  // 2. UPSERT avec INTER_TERMINEE via l'API v2
  console.log('🔄 UPSERT vers INTER_TERMINEE via interventionsApi.upsertDirect...');
  const upsertedIntervention = await interventionsApi.upsertDirect({
    id_inter: idInter,
    contexte_intervention: 'Test UPSERT API v2 - Mis à jour',
    adresse: '789 Boulevard Test',
    ville: 'Marseille',
    code_postal: '13001',
    statut_id: interTermineeStatusId,
    agence_id: agencyId,
    date: new Date().toISOString(),
    is_active: true
  });

  console.log('✅ Intervention upsertée:', upsertedIntervention.id);

  // 3. Vérifier les transitions
  const transitions = await getTransitions(upsertedIntervention.id);
  printTransitions(transitions);

  // Pour UPSERT d'un UPDATE, on attend:
  // - NULL → DEMANDE (créée par le trigger lors de l'INSERT initial)
  // - DEMANDE → DEVIS_ENVOYE → ... → INTER_TERMINEE (créées par automaticTransitionService via l'API)
  // = Chaîne complète de 6 transitions
  const isValid = validateChain(transitions, EXPECTED_FULL_CHAIN);

  // 4. Nettoyer
  await cleanupIntervention(upsertedIntervention.id);

  if (!isValid) {
    throw new Error('❌ Test UPSERT échoué: chaîne invalide');
  }

  console.log('\n✅ Test UPSERT réussi !');
  return true;
}

// ========================================
// Test 4: UPSERT INSERT (nouvelle intervention)
// ========================================

async function testUpsertDirectInsert() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  Test 4: UPSERT INSERT via interventionsApi.upsertDirect  ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  const agencyId = await getActiveAgency();
  const statusId = await getStatusId('INTER_TERMINEE');
  const idInter = `TEST_API_UPSERT_INSERT_${Date.now()}`;

  // 1. UPSERT direct avec INTER_TERMINEE (simulant un import de nouvelle intervention)
  console.log('\n📥 UPSERT INSERT avec statut INTER_TERMINEE via API v2...');
  const intervention = await interventionsApi.upsertDirect({
    id_inter: idInter,
    contexte_intervention: 'Test UPSERT INSERT API v2 - Transitions automatiques',
    adresse: '321 Rue Test Insert',
    ville: 'Toulouse',
    code_postal: '31000',
    statut_id: statusId,
    agence_id: agencyId,
    date: new Date().toISOString(),
    is_active: true
  });

  console.log('✅ Intervention créée via UPSERT:', intervention.id);

  // 2. Vérifier les transitions
  const transitions = await getTransitions(intervention.id);
  printTransitions(transitions);

  const isValid = validateChain(transitions, EXPECTED_FULL_CHAIN);

  // 3. Nettoyer
  await cleanupIntervention(intervention.id);

  if (!isValid) {
    throw new Error('❌ Test UPSERT INSERT échoué: chaîne invalide');
  }

  console.log('\n✅ Test UPSERT INSERT réussi !');
  return true;
}

// ========================================
// Test principal
// ========================================

async function runTests() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  Test Automatique - Transitions de Statuts (API v2)       ║');
  console.log('║  Teste CREATE, UPDATE, et UPSERT via API v2                ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  try {
    await testCreateWithFinalStatus();
    await testUpdateWithChain();
    await testUpsertDirectWithFinalStatus();
    await testUpsertDirectInsert();

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

