#!/usr/bin/env node

/**
 * Script de test : Compte les statut_id différents dans la table interventions
 * 
 * Usage: node scripts/tests/test-statut-id-count.js
 */

const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Charger les variables d'environnement
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variables d\'environnement manquantes:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓' : '✗');
  console.error('   NEXT_PUBLIC_SUPABASE_ANON_KEY:', supabaseKey ? '✓' : '✗');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testStatutIdCount() {
  console.log('\n🔍 Test: Comptage des statut_id dans la table interventions\n');
  console.log('='.repeat(60));

  try {
    // 1. Récupérer toutes les interventions
    console.log('\n📊 Récupération des interventions...');
    const { data: interventions, error, count } = await supabase
      .from('interventions')
      .select('statut_id', { count: 'exact' });

    if (error) {
      throw error;
    }

    console.log(`✓ ${count} interventions récupérées`);

    // 2. Compter les statut_id uniques
    const statutIds = interventions
      .map(i => i.statut_id)
      .filter(id => id !== null && id !== undefined);

    const uniqueStatutIds = [...new Set(statutIds)];
    
    console.log('\n📈 Résultats:');
    console.log('─'.repeat(60));
    console.log(`   Total interventions:           ${count}`);
    console.log(`   Interventions avec statut_id:  ${statutIds.length}`);
    console.log(`   Interventions sans statut_id:  ${count - statutIds.length}`);
    console.log(`   Nombre de statut_id différents: ${uniqueStatutIds.length}`);

    // 3. Compter les occurrences de chaque statut_id
    const statutIdCounts = {};
    statutIds.forEach(id => {
      statutIdCounts[id] = (statutIdCounts[id] || 0) + 1;
    });

    console.log('\n📋 Détail par statut_id:');
    console.log('─'.repeat(60));

    // 4. Récupérer les informations des statuts pour affichage
    const { data: statuses } = await supabase
      .from('intervention_statuses')
      .select('id, label, color')
      .in('id', uniqueStatutIds);

    const statusMap = {};
    if (statuses) {
      statuses.forEach(s => {
        statusMap[s.id] = s;
      });
    }

    // Trier par nombre d'occurrences (décroissant)
    const sortedStatutIds = Object.entries(statutIdCounts)
      .sort(([, a], [, b]) => b - a);

    sortedStatutIds.forEach(([statutId, count]) => {
      const status = statusMap[statutId];
      const label = status ? status.label : 'Statut inconnu';
      const percentage = ((count / statutIds.length) * 100).toFixed(1);
      console.log(`   ${label.padEnd(30)} : ${count.toString().padStart(4)} (${percentage}%)`);
    });

    console.log('\n' + '='.repeat(60));
    console.log('✅ Test terminé avec succès\n');

  } catch (error) {
    console.error('\n❌ Erreur lors du test:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Exécuter le test
testStatutIdCount();

