#!/usr/bin/env node

/**
 * Script de diagnostic pour vérifier si la fonction RPC get_admin_dashboard_stats existe
 * Usage: node scripts/check-rpc-function.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!SUPABASE_ANON_KEY) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_ANON_KEY n\'est pas défini dans .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkRPCFunction() {
  console.log('\n🔍 Vérification de la fonction RPC get_admin_dashboard_stats...\n');
  console.log(`📍 Supabase URL: ${SUPABASE_URL}\n`);

  try {
    // Essayer d'appeler la fonction avec des paramètres de test
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();

    console.log('📅 Période de test:');
    console.log(`   Début: ${startOfMonth}`);
    console.log(`   Fin: ${endOfMonth}\n`);

    const { data, error } = await supabase.rpc('get_admin_dashboard_stats', {
      p_period_start: startOfMonth,
      p_period_end: endOfMonth,
      p_demande_status_code: 'DEMANDE',
      p_devis_status_code: 'DEVIS_ENVOYE',
      p_accepte_status_code: 'ACCEPTE',
      p_en_cours_status_code: 'EN_COURS',
      p_terminee_status_code: 'TERMINE',
      p_att_acompte_status_code: 'ATT_ACOMPTE',
      p_valid_status_codes: ['TERMINE', 'EN_COURS', 'ACCEPTE'],
      p_agence_id: null,
      p_gestionnaire_id: null,
      p_metier_id: null,
    });

    if (error) {
      console.error('❌ ERREUR lors de l\'appel de la fonction RPC:\n');
      console.error(`   Message: ${error.message}`);
      if (error.details) console.error(`   Détails: ${error.details}`);
      if (error.hint) console.error(`   Hint: ${error.hint}`);
      if (error.code) console.error(`   Code: ${error.code}`);
      
      if (error.message.includes('Could not find the function') || error.message.includes('schema cache')) {
        console.error('\n⚠️  DIAGNOSTIC: La fonction n\'existe pas dans le schéma Supabase.\n');
        console.log('📋 SOLUTIONS:\n');
        console.log('1. Si vous êtes en LOCAL:');
        console.log('   - Vérifiez que Supabase est démarré: supabase status');
        console.log('   - Appliquez les migrations: supabase db reset');
        console.log('   - Ou redémarrez Supabase: supabase stop && supabase start\n');
        console.log('2. Si vous êtes en PRODUCTION:');
        console.log('   - Vérifiez que la migration a été appliquée:');
        console.log('     supabase/migrations/20251116000000_create_admin_dashboard_stats_function.sql');
        console.log('   - Appliquez la migration via le dashboard Supabase ou CLI\n');
        console.log('3. Vérifiez les permissions:');
        console.log('   - La fonction doit avoir: GRANT EXECUTE ON FUNCTION ... TO authenticated;\n');
      }
      process.exit(1);
    }

    if (data) {
      console.log('✅ La fonction RPC existe et fonctionne correctement!\n');
      console.log('📊 Résultat de test:');
      console.log(`   - mainStats: ${JSON.stringify(data.mainStats || {}, null, 2)}`);
      console.log(`   - statusBreakdown: ${(data.statusBreakdown || []).length} statuts`);
      console.log(`   - metierBreakdown: ${(data.metierBreakdown || []).length} métiers`);
      console.log(`   - agencyBreakdown: ${(data.agencyBreakdown || []).length} agences\n`);
      process.exit(0);
    } else {
      console.log('⚠️  La fonction a répondu mais sans données\n');
      process.exit(0);
    }

  } catch (err) {
    console.error('❌ Erreur inattendue:', err.message);
    console.error(err);
    process.exit(1);
  }
}

checkRPCFunction();


