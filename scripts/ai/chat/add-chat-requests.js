#!/usr/bin/env node

/**
 * Script pour ajouter des requêtes de chat aux utilisateurs
 * Usage: node scripts/add-chat-requests.js [nombre_requetes] [user_email]
 */

const { createClient } = require('@supabase/supabase-js');

// Configuration Supabase
const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});

/**
 * Ajoute des requêtes au pool global
 */
async function addGlobalRequests(amount) {
  try {
    console.log(`🔄 Ajout de ${amount} requêtes au pool global...`);

    // Vérifier s'il existe déjà un billing_state global
    const { data: existingBilling, error: fetchError } = await supabase
      .from('billing_state')
      .select('*')
      .is('user_id', null)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('❌ Erreur lors de la récupération du billing global:', fetchError.message);
      return false;
    }

    if (existingBilling) {
      // Mettre à jour le billing existant
      const { error: updateError } = await supabase
        .from('billing_state')
        .update({ 
          requests_remaining: existingBilling.requests_remaining + amount,
          updated_at: new Date().toISOString()
        })
        .is('user_id', null);

      if (updateError) {
        console.error('❌ Erreur lors de la mise à jour du billing global:', updateError.message);
        return false;
      }

      console.log(`✅ Pool global mis à jour: ${existingBilling.requests_remaining} → ${existingBilling.requests_remaining + amount} requêtes`);
    } else {
      // Créer un nouveau billing_state global
      const { error: insertError } = await supabase
        .from('billing_state')
        .insert({
          user_id: null,
          current_plan_id: 'starter',
          cadence: null,
          status: 'active',
          requests_remaining: amount,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (insertError) {
        console.error('❌ Erreur lors de la création du billing global:', insertError.message);
        return false;
      }

      console.log(`✅ Pool global créé avec ${amount} requêtes`);
    }

    return true;
  } catch (error) {
    console.error('❌ Erreur générale:', error.message);
    return false;
  }
}

/**
 * Ajoute des requêtes à un utilisateur spécifique
 */
async function addUserRequests(userEmail, amount) {
  try {
    console.log(`🔄 Ajout de ${amount} requêtes pour ${userEmail}...`);

    // Récupérer l'utilisateur
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, auth_user_id')
      .eq('email', userEmail)
      .single();

    if (userError) {
      console.error(`❌ Utilisateur ${userEmail} non trouvé:`, userError.message);
      return false;
    }

    // Vérifier s'il existe déjà un billing_state pour cet utilisateur
    const { data: existingBilling, error: fetchError } = await supabase
      .from('billing_state')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('❌ Erreur lors de la récupération du billing utilisateur:', fetchError.message);
      return false;
    }

    if (existingBilling) {
      // Mettre à jour le billing existant
      const { error: updateError } = await supabase
        .from('billing_state')
        .update({ 
          requests_remaining: existingBilling.requests_remaining + amount,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id);

      if (updateError) {
        console.error('❌ Erreur lors de la mise à jour du billing utilisateur:', updateError.message);
        return false;
      }

      console.log(`✅ Billing utilisateur mis à jour: ${existingBilling.requests_remaining} → ${existingBilling.requests_remaining + amount} requêtes`);
    } else {
      // Créer un nouveau billing_state pour l'utilisateur
      const { error: insertError } = await supabase
        .from('billing_state')
        .insert({
          user_id: user.id,
          current_plan_id: 'starter',
          cadence: null,
          status: 'active',
          requests_remaining: amount,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (insertError) {
        console.error('❌ Erreur lors de la création du billing utilisateur:', insertError.message);
        return false;
      }

      console.log(`✅ Billing utilisateur créé avec ${amount} requêtes`);
    }

    return true;
  } catch (error) {
    console.error('❌ Erreur générale:', error.message);
    return false;
  }
}

/**
 * Affiche l'état actuel du billing
 */
async function showBillingState() {
  try {
    console.log('\n📊 État actuel du billing:');
    
    const { data: billingStates, error } = await supabase
      .from('billing_state')
      .select(`
        *,
        users!billing_state_user_id_fkey(email, name, prenom)
      `)
      .order('user_id', { ascending: true });

    if (error) {
      console.error('❌ Erreur lors de la récupération du billing:', error.message);
      return;
    }

    if (!billingStates || billingStates.length === 0) {
      console.log('   Aucun état de billing trouvé.');
      return;
    }

    billingStates.forEach(state => {
      const userInfo = state.users ? `${state.users.email} (${state.users.name} ${state.users.prenom})` : 'POOL GLOBAL';
      console.log(`   - ${userInfo}: ${state.requests_remaining} requêtes restantes`);
    });

  } catch (error) {
    console.error('❌ Erreur lors de l\'affichage du billing:', error.message);
  }
}

/**
 * Fonction principale
 */
async function main() {
  const args = process.argv.slice(2);
  const amount = parseInt(args[0]) || 200;
  const userEmail = args[1];

  console.log('🚀 Script d\'ajout de requêtes de chat\n');

  try {
    if (userEmail) {
      // Ajouter des requêtes à un utilisateur spécifique
      const success = await addUserRequests(userEmail, amount);
      if (success) {
        console.log(`\n✅ ${amount} requêtes ajoutées pour ${userEmail}`);
      }
    } else {
      // Ajouter des requêtes au pool global
      const success = await addGlobalRequests(amount);
      if (success) {
        console.log(`\n✅ ${amount} requêtes ajoutées au pool global`);
      }
    }

    // Afficher l'état final
    await showBillingState();

  } catch (error) {
    console.error('💥 Erreur fatale:', error.message);
    process.exit(1);
  }
}

// Exécuter le script
if (require.main === module) {
  main().then(() => {
    console.log('\n🎉 Script terminé !');
    process.exit(0);
  }).catch(error => {
    console.error('💥 Erreur fatale:', error);
    process.exit(1);
  });
}

module.exports = { addGlobalRequests, addUserRequests, showBillingState };




