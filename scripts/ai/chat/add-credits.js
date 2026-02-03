/**
 * Script pour ajouter 200 crédits IA dans la table billing_state
 * Date: 2025-10-16
 * ATTENTION: Ce script ajoute les crédits, il ne reset PAS la base de données
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Configuration Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variables d\'environnement manquantes:');
  console.error('   - NEXT_PUBLIC_SUPABASE_URL');
  console.error('   - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function addCredits() {
  console.log('🚀 Ajout de 200 crédits IA...\n');

  try {
    // Étape 1: Vérifier l'état actuel
    console.log('📊 État actuel des crédits:');
    const { data: currentState, error: checkError } = await supabase
      .from('billing_state')
      .select('id, user_id, requests_remaining, updated_at')
      .is('user_id', null)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('❌ Erreur lors de la vérification:', checkError);
      throw checkError;
    }

    if (currentState) {
      console.log(`   Crédits actuels: ${currentState.requests_remaining}`);
      console.log(`   Dernière mise à jour: ${currentState.updated_at}\n`);
    } else {
      console.log('   Aucun pool global trouvé. Création en cours...\n');
    }

    // Étape 2: Ajouter les crédits via usage_events (utilise le trigger automatique)
    console.log('💳 Ajout de 200 crédits via usage_events...');
    const { data: usageEvent, error: insertError } = await supabase
      .from('usage_events')
      .insert({
        user_id: null, // Pool global
        delta: 200,
        reason: 'Ajout manuel de 200 crédits IA',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (insertError) {
      console.error('❌ Erreur lors de l\'ajout:', insertError);
      throw insertError;
    }

    console.log('✅ Usage event créé:', usageEvent.id);

    // Étape 3: Vérifier le résultat
    console.log('\n⏳ Attente de la mise à jour du trigger...');
    await new Promise(resolve => setTimeout(resolve, 1000)); // Attendre 1 seconde

    const { data: newState, error: finalError } = await supabase
      .from('billing_state')
      .select('id, user_id, requests_remaining, updated_at')
      .is('user_id', null);

    if (finalError) {
      console.error('❌ Erreur lors de la vérification finale:', finalError);
      throw finalError;
    }

    console.log('\n📊 État final des crédits:');
    if (newState && newState.length > 0) {
      const state = newState[0];
      console.log(`   Crédits actuels: ${state.requests_remaining}`);
      console.log(`   Dernière mise à jour: ${state.updated_at}`);
      
      if (currentState) {
        const difference = state.requests_remaining - currentState.requests_remaining;
        console.log(`   Différence: +${difference} crédits`);
      }
    } else {
      console.log('   ⚠️  Aucun billing_state trouvé.');
      console.log('   Le trigger mettra à jour billing_state lors du prochain usage.');
    }

    console.log('\n✅ Opération terminée avec succès!');
    console.log('   200 crédits IA ont été ajoutés.\n');

  } catch (error) {
    console.error('\n❌ Erreur:', error.message);
    process.exit(1);
  }
}

// Exécution
addCredits();

