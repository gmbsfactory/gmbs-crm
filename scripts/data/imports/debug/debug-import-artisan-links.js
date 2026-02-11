#!/usr/bin/env node

/**
 * Script de diagnostic pour vérifier pourquoi intervention_artisans est vide
 * 
 * Usage: node scripts/debug-import-artisan-links.js
 */

require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');
const { google } = require('googleapis');
const { googleSheetsConfig } = require('../config/google-sheets-config');

// Créer le client Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Variables d\'environnement Supabase manquantes !');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function diagnoseImport() {
  console.log('🔍 DIAGNOSTIC DE L\'IMPORT DES LIENS INTERVENTION ↔ ARTISAN\n');
  
  // 1. Vérifier la table intervention_artisans
  console.log('📊 1. État de la table intervention_artisans:');
  const { data: links, error: linksError, count } = await supabase
    .from('intervention_artisans')
    .select('*', { count: 'exact', head: false })
    .limit(10);
    
  if (linksError) {
    console.error('❌ Erreur:', linksError.message);
  } else {
    console.log(`   Total de liens: ${count}`);
    if (count === 0) {
      console.log('   ⚠️  TABLE VIDE !');
    } else {
      console.log(`   Aperçu des ${Math.min(count, 10)} premiers liens:`);
      links.forEach(link => {
        console.log(`   - Intervention ${link.intervention_id} → Artisan ${link.artisan_id} (${link.role}, primary: ${link.is_primary})`);
      });
    }
  }
  
  // 2. Vérifier les artisans
  console.log('\n👷 2. Artisans dans la BDD:');
  const { data: artisans, error: artisansError, count: artisansCount } = await supabase
    .from('artisans')
    .select('id, prenom, nom, plain_nom', { count: 'exact' })
    .limit(5);
    
  if (artisansError) {
    console.error('❌ Erreur:', artisansError.message);
  } else {
    console.log(`   Total artisans: ${artisansCount}`);
    if (artisansCount === 0) {
      console.log('   ⚠️  AUCUN ARTISAN EN BDD ! Importez d\'abord les artisans.');
    } else {
      console.log(`   Exemples:`);
      artisans.forEach(a => {
        console.log(`   - ${a.prenom} ${a.nom} (plain_nom: "${a.plain_nom}")`);
      });
    }
  }
  
  // 3. Vérifier les interventions
  console.log('\n🔧 3. Interventions dans la BDD:');
  const { data: interventions, error: interventionsError, count: interventionsCount } = await supabase
    .from('interventions')
    .select('id, id_inter', { count: 'exact' })
    .limit(5);
    
  if (interventionsError) {
    console.error('❌ Erreur:', interventionsError.message);
  } else {
    console.log(`   Total interventions: ${interventionsCount}`);
    if (interventionsCount === 0) {
      console.log('   ⚠️  AUCUNE INTERVENTION EN BDD !');
    }
  }
  
  // 4. Lire le CSV pour voir les noms d'artisans SST
  console.log('\n📄 4. Échantillon du Google Sheets (colonne SST):');
  try {
    const credentials = googleSheetsConfig.getCredentials();
    const auth = new google.auth.JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
    });
    
    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = googleSheetsConfig.getSpreadsheetId();
    const range = process.env.GOOGLE_SHEETS_INTERVENTIONS_RANGE || 'Interventions!A:Z';
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range
    });
    
    const rows = response.data.values;
    if (rows && rows.length > 1) {
      const headers = rows[0];
      const sstIndex = headers.findIndex(h => h.toLowerCase().includes('sst'));
      
      if (sstIndex === -1) {
        console.log('   ⚠️  Colonne SST non trouvée dans le CSV !');
        console.log('   📋 Headers disponibles:', headers.join(', '));
      } else {
        console.log(`   ✅ Colonne SST trouvée à l'index ${sstIndex}: "${headers[sstIndex]}"`);
        console.log('   Échantillon des 10 premières valeurs SST:');
        
        for (let i = 1; i <= Math.min(10, rows.length - 1); i++) {
          const sstValue = rows[i][sstIndex] || '[VIDE]';
          console.log(`   Ligne ${i + 1}: "${sstValue}"`);
        }
      }
    }
  } catch (error) {
    console.error('❌ Erreur lecture Google Sheets:', error.message);
  }
  
  // 5. Recommandations
  console.log('\n💡 RECOMMANDATIONS:');
  if (artisansCount === 0) {
    console.log('   1. ⚠️  Importez d\'abord les artisans : npm run import:artisans');
  }
  if (count === 0 && artisansCount > 0 && interventionsCount > 0) {
    console.log('   2. ⚠️  Les liens ne sont pas créés. Vérifiez :');
    console.log('      - Que la colonne SST dans le CSV contient des noms d\'artisans');
    console.log('      - Que ces noms matchent avec les artisans en BDD (plain_nom)');
    console.log('      - Relancez l\'import : npm run import:interventions');
  }
  if (count === 0 && interventionsCount === 0) {
    console.log('   3. ⚠️  Aucune intervention. Lancez : npm run import:all');
  }
  
  console.log('\n✅ Diagnostic terminé');
}

diagnoseImport().catch(error => {
  console.error('❌ Erreur fatale:', error);
  process.exit(1);
});

