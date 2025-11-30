/**
 * Test pour vérifier que l'import crée bien la chaîne complète de transitions
 * 
 * Ce test vérifie que lorsqu'une intervention est importée avec un statut INTER_TERMINEE,
 * toutes les transitions intermédiaires sont créées automatiquement.
 * 
 * Usage:
 *   npm run test:import-transitions
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import {
  displayTransitions,
  validateChain,
  cleanupTestIntervention,
  EXPECTED_FULL_CHAIN,
  printTestSummary
} from './test-helpers.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Charger les variables d'environnement
dotenv.config({ path: join(__dirname, '../../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ ERREUR: Variables d\'environnement manquantes');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✅' : '❌');
  console.error('   NEXT_PUBLIC_SUPABASE_ANON_KEY:', supabaseAnonKey ? '✅' : '❌');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Simule EXACTEMENT ce que fait upsertDirect() lors d'un import
 *
 * IMPORTANT: On simule ici ce que ferait upsertDirect() en JavaScript/Node:
 * 1. INSERT direct avec INTER_TERMINEE (comme le vrai import)
 * 2. Appel manuel à createAutomaticTransitions (comme upsertDirect modifié)
 *
 * Note: On ne peut pas appeler directement interventionsApi.upsertDirect()
 * car ce fichier est .mjs et l'API est TypeScript
 */
async function simulateImport(interventionData) {
  console.log('\n📥 Simulation de l\'import (upsertDirect)...');

  // Récupérer l'ID du statut INTER_TERMINEE
  const { data: status } = await supabase
    .from('intervention_statuses')
    .select('id, code')
    .eq('code', 'INTER_TERMINEE')
    .limit(1);

  if (!status?.[0]) {
    throw new Error('Statut INTER_TERMINEE non trouvé');
  }

  // Récupérer une agence active
  const { data: agency } = await supabase
    .from('agencies')
    .select('id')
    .eq('is_active', true)
    .limit(1);

  if (!agency?.[0]) {
    throw new Error('Aucune agence active trouvée');
  }

  // === Partie 1: UPSERT (comme upsertDirect ligne 884-893) ===
  const { data: intervention, error: insertError } = await supabase
    .from('interventions')
    .upsert({
      id_inter: interventionData.id_inter,
      contexte_intervention: interventionData.contexte_intervention,
      adresse: interventionData.adresse,
      ville: interventionData.ville,
      code_postal: interventionData.code_postal || '75001',
      statut_id: status[0].id, // ⚠️ INTER_TERMINEE directement (comme le vrai import)
      agence_id: agency[0].id,
      date: interventionData.date || new Date().toISOString(),
      is_active: true
    }, {
      onConflict: 'id_inter',
      ignoreDuplicates: false
    })
    .select()
    .single();

  if (insertError) throw insertError;

  console.log('✅ Intervention insérée:', intervention.id);
  console.log('   Statut: INTER_TERMINEE (INSERT direct)');

  // === Partie 2: Créer les transitions (comme upsertDirect ligne 902-913) ===
  console.log('🔗 Création des transitions automatiques...');

  // Simuler automaticTransitionService.createAutomaticTransitions()
  // qui appelle executeTransition() avec fromStatus = null (création)
  const { data: transitionResult, error: transitionError } = await supabase
    .rpc('create_automatic_transitions_for_insert', {
      p_intervention_id: intervention.id,
      p_to_status_id: status[0].id,
      p_user_id: null,
      p_metadata: {
        updated_via: 'upsertDirect',
        import_operation: true,
        id_inter: interventionData.id_inter
      }
    });

  if (transitionError) {
    console.warn('⚠️  Erreur lors de la création des transitions:', transitionError.message);
    console.warn('   Les transitions ne seront pas créées automatiquement');
  } else {
    console.log('   Transitions créées:', transitionResult?.transitions_created || 0);
  }

  return intervention;
}

/**
 * Vérifie les transitions d'une intervention importée
 */
async function checkImportedIntervention(interventionId) {
  console.log('\n🔍 Vérification des transitions...');
  
  const transitions = await displayTransitions(supabase, interventionId);
  
  // Vérifier qu'il y a plus d'une transition (chaîne complète)
  if (transitions.length === 1) {
    const transition = transitions[0];
    if (transition.from_status_code === null && transition.to_status_code === 'INTER_TERMINEE') {
      console.log('\n❌ PROBLÈME DÉTECTÉ:');
      console.log('   L\'intervention n\'a qu\'une seule transition directe vers INTER_TERMINEE');
      console.log('   Aucune chaîne intermédiaire n\'a été créée');
      return { isValid: false, transitions, issue: 'missing_chain' };
    }
  }
  
  // Vérifier la chaîne complète
  const isValid = validateChain(transitions, EXPECTED_FULL_CHAIN);
  
  return { isValid, transitions, issue: isValid ? null : 'incomplete_chain' };
}

/**
 * Test principal
 */
async function runTest() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  Test Import - Vérification des transitions               ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  
  let intervention = null;
  
  try {
    // 1. Simuler l'import d'une intervention avec INTER_TERMINEE
    intervention = await simulateImport({
      id_inter: `TEST_IMPORT_${Date.now()}`,
      contexte_intervention: 'Test Import - Vérification transitions',
      adresse: '123 Rue de Test',
      ville: 'Paris',
      code_postal: '75001',
      date: new Date().toISOString()
    });
    
    // 2. Vérifier les transitions
    const checkResult = await checkImportedIntervention(intervention.id);
    
    // 3. Nettoyer
    await cleanupTestIntervention(supabase, intervention.id);
    
    // 4. Résumé
    if (checkResult.isValid) {
      printTestSummary(true, 'Import crée la chaîne complète');
      process.exit(0);
    } else {
      printTestSummary(false, 'Import ne crée PAS la chaîne complète');
      console.log('\n💡 SOLUTION:');
      console.log('   L\'import doit utiliser update_intervention_status_with_chain()');
      console.log('   ou interventionsApi.update() au lieu de upsertDirect()');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('\n❌ ERREUR:', error.message);
    
    // Afficher plus de détails pour les erreurs
    if (error.details) {
      console.error('   Détails:', error.details);
    }
    if (error.hint) {
      console.error('   Indice:', error.hint);
    }
    
    if (intervention) {
      try {
        await cleanupTestIntervention(supabase, intervention.id);
      } catch (cleanupError) {
        console.error('⚠️  Erreur lors du nettoyage:', cleanupError.message);
      }
    }
    
    process.exit(1);
  }
}

// Exécuter le test
runTest();

