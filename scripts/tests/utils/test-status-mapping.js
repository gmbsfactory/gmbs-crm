#!/usr/bin/env node

/**
 * Script de diagnostic : Analyse les incohérences de statuts entre seed et import
 * 
 * Usage: node scripts/tests/test-status-mapping.js
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

async function testStatusMapping() {
  console.log('\n🔍 Diagnostic: Analyse des statuts d\'intervention\n');
  console.log('='.repeat(70));

  try {
    // 1. Récupérer tous les statuts définis dans la BDD
    console.log('\n📋 Statuts définis dans intervention_statuses:');
    console.log('─'.repeat(70));
    
    const { data: allStatuses, error: statusError } = await supabase
      .from('intervention_statuses')
      .select('id, code, label, color, sort_order')
      .order('sort_order', { ascending: true });

    if (statusError) throw statusError;

    console.log(`\nTotal: ${allStatuses.length} statuts définis\n`);
    
    const statusById = {};
    const statusByLabel = {};
    const statusByCode = {};
    
    allStatuses.forEach(status => {
      statusById[status.id] = status;
      statusByLabel[status.label.toLowerCase()] = status;
      statusByCode[status.code] = status;
      
      console.log(`  [${status.sort_order.toString().padStart(3)}] ${status.label.padEnd(25)} | Code: ${status.code.padEnd(20)} | ID: ${status.id.substring(0, 8)}...`);
    });

    // 2. Analyser les interventions
    console.log('\n\n📊 Analyse des interventions:');
    console.log('─'.repeat(70));
    
    const { data: interventions, error: intError, count } = await supabase
      .from('interventions')
      .select('id, statut, statut_id', { count: 'exact' });

    if (intError) throw intError;

    console.log(`Total interventions: ${count}`);
    
    // 3. Catégoriser les interventions
    let withStatutId = 0;
    let withStatutOnly = 0;
    let withNeither = 0;
    let withBoth = 0;
    let mismatches = [];
    
    const statutValues = {};
    const orphanStatutIds = new Set();

    interventions.forEach(inter => {
      const hasStatutId = inter.statut_id !== null;
      const hasStatut = inter.statut !== null && inter.statut !== '';
      
      if (hasStatutId && hasStatut) {
        withBoth++;
        
        // Vérifier si le statut_id correspond à un statut connu
        if (!statusById[inter.statut_id]) {
          orphanStatutIds.add(inter.statut_id);
        } else {
          // Vérifier la cohérence entre statut (label) et statut_id
          const statusFromId = statusById[inter.statut_id];
          if (statusFromId && statusFromId.label.toLowerCase() !== inter.statut.toLowerCase()) {
            mismatches.push({
              id: inter.id,
              statut: inter.statut,
              statut_id: inter.statut_id,
              expected_label: statusFromId.label
            });
          }
        }
      } else if (hasStatutId) {
        withStatutId++;
        if (!statusById[inter.statut_id]) {
          orphanStatutIds.add(inter.statut_id);
        }
      } else if (hasStatut) {
        withStatutOnly++;
        
        // Compter les valeurs de statut (texte)
        const label = inter.statut.trim();
        statutValues[label] = (statutValues[label] || 0) + 1;
      } else {
        withNeither++;
      }
    });

    console.log(`\n  ✅ Avec statut_id ET statut:         ${withBoth}`);
    console.log(`  ⚠️  Avec statut_id SEULEMENT:         ${withStatutId}`);
    console.log(`  ⚠️  Avec statut (texte) SEULEMENT:    ${withStatutOnly}`);
    console.log(`  ❌ Sans statut_id NI statut:         ${withNeither}`);

    // 4. Afficher les statuts orphelins
    if (orphanStatutIds.size > 0) {
      console.log('\n\n⚠️  STATUT_IDS ORPHELINS (n\'existent pas dans intervention_statuses):');
      console.log('─'.repeat(70));
      orphanStatutIds.forEach(id => {
        const count = interventions.filter(i => i.statut_id === id).length;
        console.log(`  ID: ${id} | ${count} intervention(s)`);
      });
    }

    // 5. Afficher les incohérences
    if (mismatches.length > 0) {
      console.log('\n\n⚠️  INCOHÉRENCES (statut texte ≠ label du statut_id):');
      console.log('─'.repeat(70));
      mismatches.slice(0, 10).forEach(m => {
        console.log(`  Intervention: ${m.id.substring(0, 8)}...`);
        console.log(`    statut (texte): "${m.statut}"`);
        console.log(`    statut_id label: "${m.expected_label}"`);
      });
      if (mismatches.length > 10) {
        console.log(`\n  ... et ${mismatches.length - 10} autres incohérences`);
      }
    }

    // 6. Afficher les valeurs de statut (texte) et leur mapping possible
    if (Object.keys(statutValues).length > 0) {
      console.log('\n\n📝 Statuts en mode TEXTE (sans statut_id):');
      console.log('─'.repeat(70));
      console.log('Ces interventions utilisent le champ "statut" mais pas "statut_id"');
      console.log('Elles devraient être migrées vers le système de statut_id\n');
      
      const sorted = Object.entries(statutValues).sort((a, b) => b[1] - a[1]);
      
      sorted.forEach(([label, count]) => {
        const matchingStatus = statusByLabel[label.toLowerCase()];
        if (matchingStatus) {
          console.log(`  ✅ "${label}" (${count}) → PEUT être mappé vers ID: ${matchingStatus.id.substring(0, 8)}... (${matchingStatus.code})`);
        } else {
          console.log(`  ❌ "${label}" (${count}) → AUCUN statut correspondant trouvé`);
        }
      });
    }

    // 7. Recommandations
    console.log('\n\n💡 RECOMMANDATIONS:');
    console.log('─'.repeat(70));
    
    if (withStatutOnly > 0) {
      console.log(`\n1. Migration nécessaire pour ${withStatutOnly} interventions`);
      console.log('   Ces interventions utilisent l\'ancien système (champ "statut" texte)');
      console.log('   et doivent être migrées vers le nouveau système (champ "statut_id")');
    }
    
    if (withNeither > 0) {
      console.log(`\n2. ${withNeither} interventions sans aucun statut`);
      console.log('   Ces interventions doivent se voir attribuer un statut par défaut');
      console.log('   (suggéré: "Demandé" ou "Stand by")');
    }
    
    if (mismatches.length > 0) {
      console.log(`\n3. ${mismatches.length} incohérences détectées`);
      console.log('   Le champ "statut" (texte) ne correspond pas au label du "statut_id"');
      console.log('   Ces interventions doivent être synchronisées');
    }
    
    if (orphanStatutIds.size > 0) {
      console.log(`\n4. ${orphanStatutIds.size} statut_id(s) orphelin(s)`);
      console.log('   Ces IDs pointent vers des statuts qui n\'existent plus');
      console.log('   Ces interventions doivent être réassignées à des statuts valides');
    }

    console.log('\n\n' + '='.repeat(70));
    console.log('✅ Diagnostic terminé\n');

  } catch (error) {
    console.error('\n❌ Erreur lors du diagnostic:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Exécuter le diagnostic
testStatusMapping();

