#!/usr/bin/env node

/**
 * Script post-import: Populate agency_config
 * 
 * Ce script doit être exécuté APRÈS npm run import:all
 * pour peupler la table agency_config avec les 3 agences
 * qui requièrent une référence (ImoDirect, AFEDIM, Oqoro)
 * 
 * Usage:
 *   node scripts/post-import/populate-agency-config.js
 */

const { createClient } = require('@supabase/supabase-js');

require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY manquant dans .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function populateAgencyConfig() {
  console.log('🔧 Peuplement de agency_config...\n');

  try {
    // Récupérer les 3 agences
    const { data: agencies, error: fetchError } = await supabase
      .from('agencies')
      .select('id, label, code')
      .or('label.ilike.%ImoDirect%,label.ilike.%AFEDIM%,label.ilike.%Oqoro%,code.ilike.%ImoDirect%,code.ilike.%AFEDIM%,code.ilike.%Oqoro%');

    if (fetchError) {
      throw new Error(`Erreur lors de la récupération des agences: ${fetchError.message}`);
    }

    if (!agencies || agencies.length === 0) {
      console.warn('⚠️  Aucune agence trouvée (ImoDirect, AFEDIM, Oqoro)');
      console.log('💡 Assurez-vous d\'avoir exécuté "npm run import:all" d\'abord.\n');
      return;
    }

    console.log(`✅ ${agencies.length} agence(s) trouvée(s):`);
    agencies.forEach(a => console.log(`   - ${a.label} (${a.code || 'pas de code'})`));
    console.log('');

    // Insérer dans agency_config
    const { data: inserted, error: insertError } = await supabase
      .from('agency_config')
      .upsert(
        agencies.map(agency => ({
          agency_id: agency.id,
          requires_reference: true,
        })),
        { onConflict: 'agency_id' }
      );

    if (insertError) {
      throw new Error(`Erreur lors de l'insertion: ${insertError.message}`);
    }

    console.log('✅ agency_config peuplé avec succès!\n');

    // Vérification
    const { data: config, error: verifyError } = await supabase
      .from('agency_config')
      .select(`
        agency_id,
        requires_reference,
        agencies (label, code)
      `)
      .eq('requires_reference', true);

    if (verifyError) {
      console.warn('⚠️  Erreur lors de la vérification:', verifyError.message);
    } else {
      console.log('📊 Configuration actuelle:');
      config.forEach(c => {
        const agency = c.agencies;
        console.log(`   ✅ ${agency.label} → requires_reference: ${c.requires_reference}`);
      });
    }

    console.log('\n🎉 Terminé!\n');

  } catch (error) {
    console.error('\n❌ Erreur:', error.message);
    process.exit(1);
  }
}

populateAgencyConfig();

