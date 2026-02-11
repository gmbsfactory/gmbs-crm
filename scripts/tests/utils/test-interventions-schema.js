#!/usr/bin/env node

/**
 * Script de diagnostic : Vérifie la structure de la table interventions
 * 
 * Usage: node scripts/tests/test-interventions-schema.js
 */

const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Charger les variables d'environnement
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variables d\'environnement manquantes');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testInterventionsSchema() {
  console.log('\n🔍 Structure de la table interventions\n');
  console.log('='.repeat(70));

  try {
    // Récupérer une intervention pour voir les colonnes disponibles
    const { data: sample, error } = await supabase
      .from('interventions')
      .select('*')
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    if (!sample) {
      console.log('❌ Aucune intervention trouvée dans la base');
      return;
    }

    console.log('\n📋 Colonnes disponibles dans la table interventions:\n');
    
    const columns = Object.keys(sample).sort();
    const statusRelated = columns.filter(col => 
      col.toLowerCase().includes('statut') || 
      col.toLowerCase().includes('status')
    );
    const otherColumns = columns.filter(col => 
      !statusRelated.includes(col)
    );

    console.log('🎯 Colonnes liées aux statuts:');
    console.log('─'.repeat(70));
    statusRelated.forEach(col => {
      const value = sample[col];
      const type = typeof value;
      console.log(`  ${col.padEnd(30)} | Type: ${type.padEnd(10)} | Valeur: ${value !== null ? String(value).substring(0, 40) : 'NULL'}`);
    });

    console.log('\n\n📦 Autres colonnes importantes:');
    console.log('─'.repeat(70));
    const importantCols = [
      'id', 'id_inter', 'date', 'adresse', 
      'agence_id', 'metier_id', 'assigned_user_id',
      'tenant_id', 'owner_id', 'artisan_sst_id',
      'created_at', 'updated_at', 'is_active'
    ];
    
    importantCols.forEach(col => {
      if (columns.includes(col)) {
        const value = sample[col];
        const type = typeof value;
        const displayValue = value !== null ? 
          (type === 'string' && value.length > 40 ? value.substring(0, 40) + '...' : String(value)) : 
          'NULL';
        console.log(`  ${col.padEnd(30)} | Type: ${type.padEnd(10)} | Valeur: ${displayValue}`);
      }
    });

    console.log('\n\n📊 Statistiques de la colonne statut_id:\n');
    console.log('─'.repeat(70));
    
    // Compter les interventions par statut_id
    const { data: allInterventions } = await supabase
      .from('interventions')
      .select('statut_id');

    const statusCounts = {};
    let nullCount = 0;
    
    allInterventions.forEach(inter => {
      if (inter.statut_id === null) {
        nullCount++;
      } else {
        statusCounts[inter.statut_id] = (statusCounts[inter.statut_id] || 0) + 1;
      }
    });

    console.log(`  NULL (sans statut): ${nullCount} interventions`);
    console.log(`  Avec statut_id:     ${Object.keys(statusCounts).length} statuts différents`);
    console.log(`  Total:              ${allInterventions.length} interventions`);

    // Récupérer les labels des statuts
    const statusIds = Object.keys(statusCounts);
    if (statusIds.length > 0) {
      const { data: statuses } = await supabase
        .from('intervention_statuses')
        .select('id, label, code')
        .in('id', statusIds);

      const statusMap = {};
      if (statuses) {
        statuses.forEach(s => {
          statusMap[s.id] = s;
        });
      }

      console.log('\n  Distribution par statut:');
      const sorted = Object.entries(statusCounts).sort((a, b) => b[1] - a[1]);
      sorted.forEach(([id, count]) => {
        const status = statusMap[id];
        if (status) {
          console.log(`    ${status.label.padEnd(25)} : ${count.toString().padStart(5)} interventions (${((count / allInterventions.length) * 100).toFixed(1)}%)`);
        } else {
          console.log(`    [ORPHELIN] ${id.substring(0, 8)}...    : ${count.toString().padStart(5)} interventions (${((count / allInterventions.length) * 100).toFixed(1)}%)`);
        }
      });
    }

    console.log('\n\n💡 ANALYSE:');
    console.log('─'.repeat(70));
    
    if (nullCount > 0) {
      const percentage = ((nullCount / allInterventions.length) * 100).toFixed(1);
      console.log(`\n  ⚠️  ${percentage}% des interventions (${nullCount}) n'ont pas de statut_id`);
      console.log('      Ces interventions doivent se voir attribuer un statut par défaut');
    }

    if (!statusRelated.includes('statut')) {
      console.log('\n  ℹ️  La colonne "statut" (texte) n\'existe pas');
      console.log('      Le système utilise uniquement statut_id (UUID)');
      console.log('      Le frontend doit mapper statut_id vers les labels affichés');
    }

    console.log('\n\n' + '='.repeat(70));
    console.log('✅ Analyse terminée\n');

  } catch (error) {
    console.error('\n❌ Erreur lors de l\'analyse:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Exécuter l'analyse
testInterventionsSchema();

