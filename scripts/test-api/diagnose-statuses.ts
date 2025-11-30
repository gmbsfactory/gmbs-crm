/**
 * Script de diagnostic pour vérifier les statuts disponibles dans la DB
 * 
 * Usage:
 *   npx tsx scripts/test-api/diagnose-statuses.ts
 */

import dotenv from 'dotenv';
import { supabase } from '../../src/lib/supabase-client';

// Charger les variables d'environnement
dotenv.config({ path: '.env.local' });

async function diagnoseStatuses() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  Diagnostic des Statuts d\'Intervention                    ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  try {
    // Récupérer tous les statuts
    const { data: statuses, error } = await supabase
      .from('intervention_statuses')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('❌ Erreur lors de la récupération des statuts:', error);
      return;
    }

    if (!statuses || statuses.length === 0) {
      console.log('⚠️  Aucun statut trouvé dans la base de données');
      return;
    }

    console.log(`✅ ${statuses.length} statuts trouvés:\n`);
    
    console.table(statuses.map(s => ({
      Code: s.code,
      Label: s.label,
      Couleur: s.color,
      Ordre: s.sort_order,
      Actif: s.is_active ? '✓' : '✗'
    })));

    // Vérifier les statuts attendus pour le test
    const expectedCodes = [
      'DEMANDE',
      'DEVIS_ENVOYE',
      'VISITE_TECHNIQUE',
      'ACCEPTE',
      'INTER_EN_COURS',
      'INTER_TERMINEE'
    ];

    console.log('\n📋 Vérification des statuts requis pour les tests:\n');
    
    for (const code of expectedCodes) {
      const found = statuses.find(s => s.code === code);
      if (found) {
        console.log(`   ✅ ${code.padEnd(20)} → ${found.label}`);
      } else {
        console.log(`   ❌ ${code.padEnd(20)} → MANQUANT`);
      }
    }

    // Vérifier les variantes possibles
    console.log('\n🔍 Variantes possibles dans la DB:\n');
    const variants = statuses.filter(s => 
      s.code.includes('COURS') || 
      s.code.includes('TERMIN') ||
      s.code.toLowerCase().includes('cours') ||
      s.code.toLowerCase().includes('termin')
    );

    if (variants.length > 0) {
      variants.forEach(s => {
        console.log(`   • ${s.code} → "${s.label}"`);
      });
    } else {
      console.log('   Aucune variante trouvée');
    }

  } catch (error) {
    console.error('❌ Erreur inattendue:', error);
  }
}

diagnoseStatuses().then(() => {
  console.log('\n✅ Diagnostic terminé\n');
  process.exit(0);
}).catch(error => {
  console.error('\n❌ Erreur fatale:', error);
  process.exit(1);
});

