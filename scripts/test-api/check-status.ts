/**
 * Script simple pour vérifier un statut spécifique
 */

import dotenv from 'dotenv';
import { supabase } from '../../src/lib/supabase-client';

dotenv.config({ path: '.env.local' });

async function checkStatus(code: string) {
  const { data, error } = await supabase
    .from('intervention_statuses')
    .select('*')
    .eq('code', code)
    .single();

  if (error) {
    console.log(`❌ Statut "${code}" NOT FOUND`);
    console.log(`   Error: ${error.message}`);
  } else {
    console.log(`✅ Statut "${code}" FOUND:`);
    console.log(`   ID: ${data.id}`);
    console.log(`   Label: ${data.label}`);
    console.log(`   Color: ${data.color}`);
  }
}

async function listAll() {
  const { data, error } = await supabase
    .from('intervention_statuses')
    .select('code, label')
    .order('sort_order');

  if (error) {
    console.log('Error:', error);
    return;
  }

  console.log('\n📋 All statuses in DB:');
  data?.forEach(s => {
    console.log(`   - ${s.code.padEnd(25)} → "${s.label}"`);
  });
}

async function main() {
  console.log('\n=== STATUS CHECK ===\n');
  
  await checkStatus('INTER_TERMINEE');
  console.log('');
  await checkStatus('INTER_EN_COURS');
  console.log('');
  await checkStatus('TERMINE');
  console.log('');
  await checkStatus('EN_COURS');
  
  await listAll();
  
  process.exit(0);
}

main();

