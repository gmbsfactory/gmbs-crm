/**
 * Script pour valider les transitions des interventions existantes
 * 
 * Ce script analyse toutes les interventions avec le statut INTER_TERMINEE
 * et vérifie si elles ont la chaîne complète de transitions.
 * 
 * Usage:
 *   npm run test:validate-existing
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ ERREUR: Variables d\'environnement manquantes');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✅' : '❌');
  console.error('   NEXT_PUBLIC_SUPABASE_ANON_KEY:', supabaseAnonKey ? '✅' : '❌');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const EXPECTED_CHAIN = ['DEMANDE', 'DEVIS_ENVOYE', 'VISITE_TECHNIQUE', 'ACCEPTE', 'INTER_EN_COURS', 'INTER_TERMINEE'];

async function analyzeInterventions() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  Analyse des interventions INTER_TERMINEE                ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  // Récupérer toutes les interventions avec statut INTER_TERMINEE
  const { data: interventions, error } = await supabase
    .from('interventions')
    .select(`
      id,
      id_inter,
      contexte_intervention,
      statut_id,
      status:intervention_statuses(code)
    `)
    .eq('status.code', 'INTER_TERMINEE')
    .eq('is_active', true)
    .limit(1000);
  
  if (error) {
    console.error('❌ Erreur:', error.message);
    if (error.details) console.error('   Détails:', error.details);
    if (error.hint) console.error('   Indice:', error.hint);
    process.exit(1);
  }
  
  if (!interventions || interventions.length === 0) {
    console.log('ℹ️  Aucune intervention avec le statut INTER_TERMINEE trouvée');
    process.exit(0);
  }
  
  console.log(`📊 Analyse de ${interventions.length} interventions...\n`);
  
  const stats = {
    total: interventions.length,
    withFullChain: 0,
    withDirectTransition: 0,
    withPartialChain: 0,
    errors: 0
  };
  
  const issues = [];
  let processed = 0;
  
  // Analyser chaque intervention
  for (const intervention of interventions) {
    processed++;
    if (processed % 50 === 0) {
      process.stdout.write(`\r   Progression: ${processed}/${interventions.length}...`);
    }
    
    const { data: transitions, error: transError } = await supabase
      .from('intervention_status_transitions')
      .select('from_status_code, to_status_code, transition_date, source')
      .eq('intervention_id', intervention.id)
      .order('transition_date', { ascending: true });
    
    if (transError) {
      stats.errors++;
      issues.push({
        id_inter: intervention.id_inter,
        issue: 'Erreur lors de la récupération des transitions',
        error: transError.message
      });
      continue;
    }
    
    if (!transitions || transitions.length === 0) {
      stats.errors++;
      issues.push({
        id_inter: intervention.id_inter,
        issue: 'Aucune transition trouvée'
      });
      continue;
    }
    
    const transitionCodes = transitions.map(t => t.to_status_code);
    const hasDirectTransition = transitions.length === 1 && 
      transitions[0].from_status_code === null && 
      transitions[0].to_status_code === 'INTER_TERMINEE';
    
    const hasFullChain = EXPECTED_CHAIN.every(code => transitionCodes.includes(code));
    const hasPartialChain = transitions.length > 1 && transitions.length < EXPECTED_CHAIN.length;
    
    if (hasDirectTransition) {
      stats.withDirectTransition++;
      issues.push({
        id_inter: intervention.id_inter,
        issue: 'Transition directe vers INTER_TERMINEE (pas de chaîne)',
        transitions: transitions.length,
        source: transitions[0].source
      });
    } else if (hasFullChain) {
      stats.withFullChain++;
    } else if (hasPartialChain) {
      stats.withPartialChain++;
      issues.push({
        id_inter: intervention.id_inter,
        issue: 'Chaîne partielle',
        transitions: transitions.length,
        chain: transitionCodes.join(' → ')
      });
    } else {
      // Autre cas (régression, statuts hors chaîne, etc.)
      stats.withPartialChain++;
      issues.push({
        id_inter: intervention.id_inter,
        issue: 'Chaîne anormale',
        transitions: transitions.length,
        chain: transitionCodes.join(' → ')
      });
    }
  }
  
  process.stdout.write(`\r   Progression: ${processed}/${interventions.length}... Terminé!\n\n`);
  
  // Afficher les résultats
  console.log('📈 RÉSULTATS:\n');
  console.log(`   Total analysé: ${stats.total}`);
  console.log(`   ✅ Avec chaîne complète: ${stats.withFullChain} (${((stats.withFullChain / stats.total) * 100).toFixed(1)}%)`);
  console.log(`   ❌ Transition directe: ${stats.withDirectTransition} (${((stats.withDirectTransition / stats.total) * 100).toFixed(1)}%)`);
  console.log(`   ⚠️  Chaîne partielle/anormale: ${stats.withPartialChain} (${((stats.withPartialChain / stats.total) * 100).toFixed(1)}%)`);
  console.log(`   🔴 Erreurs: ${stats.errors}\n`);
  
  if (issues.length > 0) {
    console.log(`\n⚠️  ${issues.length} intervention(s) avec problème:\n`);
    issues.slice(0, 20).forEach((issue, index) => {
      console.log(`   ${index + 1}. ${issue.id_inter}: ${issue.issue}`);
      if (issue.transitions !== undefined) {
        console.log(`      Transitions: ${issue.transitions}`);
      }
      if (issue.chain) {
        console.log(`      Chaîne: ${issue.chain}`);
      }
      if (issue.source) {
        console.log(`      Source: ${issue.source}`);
      }
      if (issue.error) {
        console.log(`      Erreur: ${issue.error}`);
      }
      console.log('');
    });
    
    if (issues.length > 20) {
      console.log(`   ... et ${issues.length - 20} autre(s)\n`);
    }
  }
  
  // Conclusion
  console.log('╔════════════════════════════════════════════════════════════╗');
  if (stats.withDirectTransition === 0 && stats.withPartialChain === 0 && stats.errors === 0) {
    console.log('║  ✅ TOUTES LES INTERVENTIONS ONT LA CHAÎNE COMPLÈTE      ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    process.exit(0);
  } else {
    console.log('║  ❌ PROBLÈME DÉTECTÉ: Import ne crée pas la chaîne       ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log('\n💡 SOLUTION:');
    console.log('   1. Modifier l\'import pour utiliser update_intervention_status_with_chain()');
    console.log('   2. Ou utiliser interventionsApi.update() au lieu de upsertDirect()');
    console.log('   3. Après correction, exécuter un script de migration pour reconstruire');
    console.log('      les chaînes manquantes pour les interventions existantes\n');
    process.exit(1);
  }
}

analyzeInterventions();

