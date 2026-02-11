#!/usr/bin/env node
/**
 * Vérification complète des compteurs par gestionnaire vs tableau de référence
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'http://127.0.0.1:54321';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Tableau de référence fourni par l'utilisateur
const REFERENCE_DATA = {
  'A': { // Andrea
    'Accepté': 22,
    'Annulé': 45,
    'Att Acompte': 1,
    'Demandé': 108,
    'Devis Envoyé': 334,
    'Inter en cours': 32,
    'Inter terminée': 190,
    'Refusé': 13,
    'SAV': 10,
    'STAND BY': 120,
    'Visite Technique': 25,
  },
  'B': { // Badr
    'Accepté': 18,
    'Annulé': 22,
    'Att Acompte': 6,
    'Demandé': 21,
    'Devis Envoyé': 423,
    'Inter en cours': 46,
    'Inter terminée': 149,
    'Refusé': 23,
    'SAV': 6,
    'STAND BY': 56,
    'Visite Technique': 13,
  },
  'D': { // Dimitri
    'Accepté': 43,
    'Annulé': 63,
    'Att Acompte': 0,
    'Demandé': 202,
    'Devis Envoyé': 388,
    'Inter en cours': 43,
    'Inter terminée': 244,
    'Refusé': 19,
    'SAV': 1,
    'STAND BY': 54,
    'Visite Technique': 43,
  },
  'J': { // Inconnu
    'Accepté': 4,
    'Annulé': 7,
    'Att Acompte': 0,
    'Demandé': 2,
    'Devis Envoyé': 45,
    'Inter en cours': 5,
    'Inter terminée': 29,
    'Refusé': 0,
    'SAV': 0,
    'STAND BY': 2,
    'Visite Technique': 1,
  },
  'K': { // Killian
    'Accepté': 0,
    'Annulé': 1,
    'Att Acompte': 0,
    'Demandé': 0,
    'Devis Envoyé': 1,
    'Inter en cours': 0,
    'Inter terminée': 20,
    'Refusé': 0,
    'SAV': 0,
    'STAND BY': 0,
    'Visite Technique': 0,
  },
  'L': { // Lucien
    'Accepté': 22,
    'Annulé': 208,
    'Att Acompte': 6,
    'Demandé': 25,
    'Devis Envoyé': 308,
    'Inter en cours': 71,
    'Inter terminée': 321,
    'Refusé': 25,
    'SAV': 2,
    'STAND BY': 39,
    'Visite Technique': 38,
  },
  'O': { // Olivier
    'Accepté': 33,
    'Annulé': 10,
    'Att Acompte': 0,
    'Demandé': 40,
    'Devis Envoyé': 180,
    'Inter en cours': 51,
    'Inter terminée': 86,
    'Refusé': 4,
    'SAV': 0,
    'STAND BY': 3,
    'Visite Technique': 2,
  },
  'P': { // Paul
    'Accepté': 0,
    'Annulé': 15,
    'Att Acompte': 0,
    'Demandé': 7,
    'Devis Envoyé': 217,
    'Inter en cours': 7,
    'Inter terminée': 87,
    'Refusé': 3,
    'SAV': 1,
    'STAND BY': 16,
    'Visite Technique': 5,
  },
  'S': { // Samuel
    'Accepté': 7,
    'Annulé': 42,
    'Att Acompte': 0,
    'Demandé': 16,
    'Devis Envoyé': 608,
    'Inter en cours': 14,
    'Inter terminée': 172,
    'Refusé': 14,
    'SAV': 1,
    'STAND BY': 34,
    'Visite Technique': 5,
  },
  'T': { // Tom
    'Accepté': 0,
    'Annulé': 79,
    'Att Acompte': 0,
    'Demandé': 10,
    'Devis Envoyé': 341,
    'Inter en cours': 0,
    'Inter terminée': 172,
    'Refusé': 14,
    'SAV': 1,
    'STAND BY': 57,
    'Visite Technique': 1,
  },
};

// Mapping lettre → username
const LETTER_TO_USERNAME = {
  'A': 'andrea',
  'B': 'badr',
  'D': 'dimitri',
  'J': null, // À déterminer
  'K': 'killian',
  'L': 'lucien',
  'O': 'olivier',
  'P': 'paul',
  'S': 'samuel',
  'T': 'tom',
};

async function main() {
  console.log('\n🔍 VÉRIFICATION COMPLÈTE DES COMPTEURS PAR GESTIONNAIRE\n');
  console.log('═'.repeat(100));

  // Récupérer tous les utilisateurs
  const { data: users } = await supabase
    .from('users')
    .select('id, username, email')
    .order('username');

  // Récupérer tous les statuts
  const { data: statuses } = await supabase
    .from('intervention_statuses')
    .select('id, code, label')
    .order('label');

  // Créer un mapping label → id
  const labelToId = {};
  statuses.forEach(s => {
    labelToId[s.label] = s.id;
  });

  // Créer un mapping username → lettre
  const usernameToLetter = {};
  Object.entries(LETTER_TO_USERNAME).forEach(([letter, username]) => {
    if (username) {
      usernameToLetter[username] = letter;
    }
  });

  console.log('\n📊 COMPARAISON PAR GESTIONNAIRE\n');

  const allResults = [];
  let totalDifferences = 0;

  for (const user of users) {
    const letter = usernameToLetter[user.username];
    
    // Ignorer les utilisateurs non mappés dans le tableau de référence
    if (!letter) continue;

    const expected = REFERENCE_DATA[letter];
    if (!expected) continue;

    console.log(`\n${'═'.repeat(100)}`);
    console.log(`📌 ${letter} - ${user.username.toUpperCase()} (${user.email || 'no email'})`);
    console.log(`${'═'.repeat(100)}\n`);

    const results = {
      user: user.username,
      letter,
      differences: [],
      totalExpected: 0,
      totalActual: 0,
    };

    // Pour chaque statut dans le tableau de référence
    for (const [statusLabel, expectedCount] of Object.entries(expected)) {
      // Normaliser le label pour matcher avec la BDD
      let dbStatusId = null;
      
      // Chercher le statut correspondant
      const matchingStatus = statuses.find(s => 
        s.label.toLowerCase() === statusLabel.toLowerCase() ||
        s.label.toLowerCase().includes(statusLabel.toLowerCase().replace('stand by', 'stand')) ||
        statusLabel.toLowerCase().includes(s.label.toLowerCase().replace('stand by', 'stand'))
      );

      if (matchingStatus) {
        dbStatusId = matchingStatus.id;
      } else {
        console.log(`   ⚠️  Statut non trouvé en BDD : "${statusLabel}"`);
        continue;
      }

      // Compter les interventions réelles
      const { count: actualCount } = await supabase
        .from('interventions')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_user_id', user.id)
        .eq('statut_id', dbStatusId);

      results.totalExpected += expectedCount;
      results.totalActual += (actualCount || 0);

      const diff = (actualCount || 0) - expectedCount;
      const status = diff === 0 ? '✅' : '❌';
      
      if (diff !== 0) {
        results.differences.push({
          status: statusLabel,
          expected: expectedCount,
          actual: actualCount || 0,
          diff,
        });
        totalDifferences++;
      }

      console.log(`   ${status} ${statusLabel.padEnd(25)} | Attendu: ${String(expectedCount).padStart(4)} | Réel: ${String(actualCount || 0).padStart(4)} | Diff: ${diff >= 0 ? '+' : ''}${diff}`);
    }

    console.log(`\n   📊 TOTAL : Attendu = ${results.totalExpected}, Réel = ${results.totalActual}, Diff = ${results.totalActual - results.totalExpected}`);

    allResults.push(results);
  }

  // Résumé final
  console.log('\n\n' + '═'.repeat(100));
  console.log('📊 RÉSUMÉ GLOBAL\n');

  const usersWithDiff = allResults.filter(r => r.differences.length > 0);

  if (usersWithDiff.length === 0) {
    console.log('✅ PARFAIT ! Toutes les valeurs correspondent au tableau de référence.\n');
  } else {
    console.log(`⚠️  ${usersWithDiff.length} gestionnaire(s) avec des différences (${totalDifferences} différences au total)\n`);

    usersWithDiff.forEach(result => {
      console.log(`\n❌ ${result.letter} - ${result.user.toUpperCase()} :`);
      result.differences.forEach(d => {
        console.log(`   - ${d.status.padEnd(25)} : ${d.expected} attendu, ${d.actual} réel (${d.diff >= 0 ? '+' : ''}${d.diff})`);
      });
    });

    console.log('\n💡 CAUSES POSSIBLES :');
    console.log('   1. Les données du tableau de référence sont obsolètes');
    console.log('   2. Des interventions ont été ajoutées/modifiées depuis');
    console.log('   3. Le mapping des statuts est incorrect');
    console.log('   4. Problème avec le gestionnaire "J" (non mappé)');
  }

  // Vérifier le gestionnaire "J" non mappé
  console.log('\n\n' + '═'.repeat(100));
  console.log('🔍 RECHERCHE DU GESTIONNAIRE "J"\n');

  const totalExpectedJ = Object.values(REFERENCE_DATA['J']).reduce((sum, val) => sum + val, 0);
  console.log(`   Total attendu pour J : ${totalExpectedJ} interventions`);

  // Chercher un utilisateur avec ~95 interventions qui n'est pas déjà mappé
  const mappedUserIds = users
    .filter(u => usernameToLetter[u.username])
    .map(u => u.id);

  for (const user of users) {
    if (mappedUserIds.includes(user.id)) continue;

    const { count } = await supabase
      .from('interventions')
      .select('id', { count: 'exact', head: true })
      .eq('assigned_user_id', user.id);

    if (count >= 90 && count <= 100) {
      console.log(`   💡 Candidat potentiel : ${user.username} (${user.email || 'no email'}) - ${count} interventions`);
    }
  }

  console.log('\n' + '═'.repeat(100) + '\n');
}

main().catch(console.error);




