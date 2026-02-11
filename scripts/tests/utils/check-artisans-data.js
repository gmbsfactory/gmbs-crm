#!/usr/bin/env node
/**
 * check-artisans-data.js — Check if artisans have any actual data
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');

// Load environment variables
const envLocalPath = path.join(__dirname, '..', '.env.local');
const envPath = path.join(__dirname, '..', '.env');

if (fs.existsSync(envLocalPath)) {
  require('dotenv').config({ path: envLocalPath });
} else if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
}

// Supabase configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not found');
  process.exit(1);
}

// Create Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkData() {
  console.log('\n🔍 Vérification des données artisans...\n');
  
  try {
    // Use RPC to execute SQL directly
    const { data: stats, error: statsError } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT 
          COUNT(*) as total,
          COUNT(prenom) as with_prenom,
          COUNT(nom) as with_nom,
          COUNT(email) as with_email,
          COUNT(plain_nom) as with_plain_nom,
          COUNT(raison_sociale) as with_raison_sociale,
          COUNT(siret) as with_siret
        FROM artisans
      `
    });
    
    if (statsError) {
      console.log('⚠️  La fonction RPC n\'est pas disponible, utilisation d\'une méthode alternative...\n');
      
      // Alternative: Count using queries
      const { count: total } = await supabase
        .from('artisans')
        .select('*', { count: 'exact', head: true });
      
      console.log(`📊 Statistiques des artisans:`);
      console.log(`   Total d'artisans: ${total || 0}`);
      
      // Get first 5 with ANY data
      const { data: sample } = await supabase
        .from('artisans')
        .select('prenom, nom, plain_nom, email, raison_sociale, siret')
        .limit(5);
      
      console.log('\n📋 Échantillon des 5 premiers artisans:');
      sample.forEach((artisan, i) => {
        console.log(`\n${i + 1}.`);
        Object.entries(artisan).forEach(([key, value]) => {
          console.log(`   ${key}: ${value !== null ? value : 'NULL'}`);
        });
      });
      
      // Check if ALL artisans have NULL values
      const allFieldsNull = sample.every(artisan => 
        Object.values(artisan).every(val => val === null)
      );
      
      if (allFieldsNull) {
        console.log('\n⚠️  PROBLÈME DÉTECTÉ: Tous les champs sont NULL pour tous les artisans!');
        console.log('   Cela indique un problème lors de l\'importation des données.\n');
        console.log('💡 Suggestions:');
        console.log('   1. Vérifiez le script d\'import des données');
        console.log('   2. Vérifiez que la source de données (Google Sheets) contient des données');
        console.log('   3. Réimportez les données avec le script d\'import correct\n');
      } else {
        console.log('\n✅ Certains artisans ont des données non NULL');
        
        // Try to find "andre" or "bertera"
        console.log('\n🔍 Recherche spécifique pour "andre" ou "bertera"...');
        const { data: search } = await supabase
          .from('artisans')
          .select('*')
          .limit(1000);
        
        const found = search.filter(a => {
          const searchText = [
            a.prenom,
            a.nom,
            a.plain_nom,
            a.email,
            a.raison_sociale
          ].filter(Boolean).join(' ').toLowerCase();
          
          return searchText.includes('andre') || searchText.includes('bertera');
        });
        
        if (found.length > 0) {
          console.log(`✅ Trouvé ${found.length} correspondance(s):`);
          found.forEach(a => {
            console.log(`   - ${a.prenom} ${a.nom} (${a.email})`);
          });
        } else {
          console.log('❌ Aucun artisan trouvé avec "andre" ou "bertera"');
        }
      }
      
    } else {
      console.log('✅ Statistiques obtenues via RPC');
      console.log(stats);
    }
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

checkData()
  .then(() => {
    console.log('\n✅ Vérification terminée\n');
  })
  .catch((error) => {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  });




