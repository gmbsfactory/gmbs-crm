#!/usr/bin/env node

/**
 * Script de test : Debug de l'API interventions
 * 
 * Usage: node scripts/tests/test-interventions-api-debug.js
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

async function testInterventionsAPI() {
  console.log('\n🔍 Test de l\'API Interventions V2\n');
  console.log('='.repeat(70));

  try {
    // Test 1 : Query simple sans JOIN
    console.log('\n📊 Test 1 : SELECT simple (sans JOIN)');
    console.log('─'.repeat(70));
    
    const { data: simpleData, error: simpleError, count: simpleCount } = await supabase
      .from('interventions')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(5);

    if (simpleError) {
      console.error('❌ Erreur:', simpleError.message);
    } else {
      console.log(`✅ ${simpleCount} interventions total`);
      console.log(`✅ ${simpleData.length} interventions récupérées`);
      if (simpleData.length > 0) {
        console.log('\nPremière intervention:');
        console.log('  ID:', simpleData[0].id);
        console.log('  statut_id:', simpleData[0].statut_id || 'NULL');
        console.log('  date:', simpleData[0].date);
        console.log('  adresse:', simpleData[0].adresse);
      }
    }

    // Test 2 : Query avec JOIN (syntaxe 1)
    console.log('\n\n📊 Test 2 : SELECT avec JOIN (syntaxe simple)');
    console.log('─'.repeat(70));
    
    const { data: joinData1, error: joinError1 } = await supabase
      .from('interventions')
      .select(`
        *,
        status:intervention_statuses(id,code,label,color,sort_order)
      `)
      .order('created_at', { ascending: false })
      .limit(5);

    if (joinError1) {
      console.error('❌ Erreur:', joinError1.message);
      console.error('Détails:', joinError1);
    } else {
      console.log(`✅ ${joinData1.length} interventions récupérées avec JOIN`);
      if (joinData1.length > 0) {
        console.log('\nPremière intervention avec JOIN:');
        console.log('  ID:', joinData1[0].id);
        console.log('  statut_id:', joinData1[0].statut_id || 'NULL');
        console.log('  status:', joinData1[0].status || 'NULL');
        if (joinData1[0].status) {
          console.log('    → label:', joinData1[0].status.label);
          console.log('    → color:', joinData1[0].status.color);
        } else {
          console.log('  ⚠️ PAS DE STATUS JOINT !');
        }
      }
    }

    // Test 3 : Vérifier la FK
    console.log('\n\n📊 Test 3 : Vérifier les foreign keys');
    console.log('─'.repeat(70));
    
    const { data: fkData, error: fkError } = await supabase.rpc('get_foreign_keys', {
      table_name: 'interventions'
    }).catch(() => {
      // Si la fonction n'existe pas, faire une requête manuelle
      return { data: null, error: { message: 'Fonction RPC non disponible' } };
    });

    if (fkError) {
      console.log('⚠️ Impossible de vérifier les FK automatiquement');
      console.log('Vérifiez manuellement dans Supabase Dashboard → Table → Relationships');
    } else if (fkData) {
      console.log('Foreign Keys trouvées:', fkData);
    }

    // Test 4 : Compter les interventions avec/sans statut
    console.log('\n\n📊 Test 4 : Statistiques statut_id');
    console.log('─'.repeat(70));
    
    const { count: totalCount } = await supabase
      .from('interventions')
      .select('*', { count: 'exact', head: true });
    
    const { count: withStatusCount } = await supabase
      .from('interventions')
      .select('*', { count: 'exact', head: true })
      .not('statut_id', 'is', null);
    
    const { count: withoutStatusCount } = await supabase
      .from('interventions')
      .select('*', { count: 'exact', head: true })
      .is('statut_id', null);

    console.log(`Total interventions:        ${totalCount}`);
    console.log(`Avec statut_id:            ${withStatusCount} (${((withStatusCount/totalCount)*100).toFixed(1)}%)`);
    console.log(`Sans statut_id:            ${withoutStatusCount} (${((withoutStatusCount/totalCount)*100).toFixed(1)}%)`);

    // Test 5 : Tester le JOIN avec une intervention qui a un statut
    console.log('\n\n📊 Test 5 : JOIN sur une intervention avec statut');
    console.log('─'.repeat(70));
    
    const { data: withStatus, error: withStatusError } = await supabase
      .from('interventions')
      .select(`
        *,
        status:intervention_statuses(id,code,label,color,sort_order)
      `)
      .not('statut_id', 'is', null)
      .limit(1)
      .single();

    if (withStatusError) {
      console.error('❌ Erreur:', withStatusError.message);
    } else if (withStatus) {
      console.log('✅ Intervention avec statut trouvée:');
      console.log('  ID:', withStatus.id);
      console.log('  statut_id:', withStatus.statut_id);
      console.log('  status:', withStatus.status);
      
      if (!withStatus.status) {
        console.log('\n⚠️⚠️⚠️ PROBLÈME DÉTECTÉ ⚠️⚠️⚠️');
        console.log('L\'intervention a un statut_id mais le JOIN ne retourne pas de données !');
        console.log('\nCauses possibles:');
        console.log('1. La foreign key n\'existe pas ou a un mauvais nom');
        console.log('2. La syntaxe du JOIN est incorrecte pour votre version de Supabase');
        console.log('3. Les données dans intervention_statuses ne correspondent pas');
        
        // Vérifier si le statut existe
        const { data: statusCheck } = await supabase
          .from('intervention_statuses')
          .select('*')
          .eq('id', withStatus.statut_id)
          .single();
        
        if (statusCheck) {
          console.log('\n✅ Le statut existe dans intervention_statuses:');
          console.log('  ', statusCheck);
          console.log('\n→ Le problème vient de la syntaxe du JOIN ou du nom de la FK');
        } else {
          console.log('\n❌ Le statut n\'existe PAS dans intervention_statuses !');
          console.log('→ Données orphelines, il faut nettoyer la base');
        }
      } else {
        console.log('✅ JOIN fonctionne correctement !');
      }
    }

    console.log('\n\n' + '='.repeat(70));
    console.log('✅ Tests terminés\n');

  } catch (error) {
    console.error('\n❌ Erreur lors des tests:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Exécuter les tests
testInterventionsAPI();




