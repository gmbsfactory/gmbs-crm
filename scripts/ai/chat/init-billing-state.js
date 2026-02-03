/**
 * Script pour initialiser le billing_state et vérifier les crédits
 * Date: 2025-10-16
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variables d\'environnement manquantes');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function initBillingState() {
  console.log('🚀 Initialisation du billing_state...\n');

  try {
    // Vérifier si billing_state existe
    const { data: existingState, error: checkError } = await supabase
      .from('billing_state')
      .select('*')
      .is('user_id', null);

    if (checkError) {
      console.error('❌ Erreur lors de la vérification:', checkError);
      throw checkError;
    }

    if (existingState && existingState.length > 0) {
      console.log('✅ billing_state existe déjà:');
      console.log(`   ID: ${existingState[0].id}`);
      console.log(`   Crédits: ${existingState[0].requests_remaining}`);
      console.log(`   Dernière mise à jour: ${existingState[0].updated_at}\n`);
      return;
    }

    // Calculer le total des crédits depuis usage_events
    const { data: events, error: eventsError } = await supabase
      .from('usage_events')
      .select('delta')
      .is('user_id', null);

    if (eventsError) {
      console.error('❌ Erreur lors de la récupération des events:', eventsError);
      throw eventsError;
    }

    const totalCredits = events.reduce((sum, event) => sum + event.delta, 0);
    console.log(`📊 Total des crédits calculés depuis usage_events: ${totalCredits}\n`);

    // Créer le billing_state initial
    console.log('💳 Création du billing_state...');
    const { data: newState, error: insertError } = await supabase
      .from('billing_state')
      .insert({
        user_id: null,
        current_plan_id: 'free',
        cadence: 'monthly',
        status: 'active',
        requests_remaining: totalCredits,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (insertError) {
      console.error('❌ Erreur lors de la création:', insertError);
      throw insertError;
    }

    console.log('✅ billing_state créé avec succès:');
    console.log(`   ID: ${newState.id}`);
    console.log(`   Crédits: ${newState.requests_remaining}`);
    console.log(`   Plan: ${newState.current_plan_id}`);
    console.log(`   Status: ${newState.status}\n`);

    console.log('🎉 Opération terminée avec succès!\n');

  } catch (error) {
    console.error('\n❌ Erreur:', error.message);
    process.exit(1);
  }
}

initBillingState();






