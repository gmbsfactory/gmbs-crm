#!/usr/bin/env node
/**
 * Audit complet des mappings : Statuts + Utilisateurs
 * Vérifie que tous les statuts/users présents dans les interventions sont bien accessibles
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'http://127.0.0.1:54321';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  console.log('\n🔍 AUDIT COMPLET DES MAPPINGS\n');
  console.log('═'.repeat(80));

  // ============================================================================
  // PARTIE 1 : AUDIT DES STATUTS
  // ============================================================================
  console.log('\n📋 PARTIE 1 : AUDIT DES STATUTS\n');

  // 1.1 Récupérer TOUS les statuts de la table intervention_statuses
  console.log('1️⃣ Statuts définis dans la table intervention_statuses :');
  const { data: allStatuses, error: statusError } = await supabase
    .from('intervention_statuses')
    .select('id, code, label')
    .order('label');

  if (statusError) throw statusError;

  console.log(`   ✅ ${allStatuses.length} statuts trouvés :\n`);
  allStatuses.forEach((s, i) => {
    console.log(`   ${(i + 1).toString().padStart(2)}. ${s.label.padEnd(25)} [${s.code.padEnd(20)}] ${s.id}`);
  });

  // 1.2 Récupérer tous les statut_id UNIQUES utilisés dans les interventions
  console.log('\n2️⃣ Statuts réellement utilisés dans les interventions :');
  const { data: usedStatusIds, error: usedError } = await supabase
    .from('interventions')
    .select('statut_id')
    .not('statut_id', 'is', null);

  if (usedError) throw usedError;

  // Compter les occurrences
  const statusCounts = {};
  usedStatusIds.forEach(row => {
    const id = row.statut_id;
    statusCounts[id] = (statusCounts[id] || 0) + 1;
  });

  console.log(`   ✅ ${Object.keys(statusCounts).length} statuts uniques utilisés :\n`);
  
  // Trier par nombre d'occurrences
  const sortedStatuses = Object.entries(statusCounts)
    .sort((a, b) => b[1] - a[1]);

  sortedStatuses.forEach(([statusId, count]) => {
    const status = allStatuses.find(s => s.id === statusId);
    if (status) {
      console.log(`   - ${status.label.padEnd(25)} [${status.code.padEnd(20)}] : ${count.toString().padStart(4)} interventions`);
    } else {
      console.log(`   ⚠️  STATUT INCONNU (${statusId}) : ${count} interventions`);
    }
  });

  // 1.3 Vérifier les statuts orphelins (définis mais jamais utilisés)
  console.log('\n3️⃣ Statuts définis mais jamais utilisés :');
  const unusedStatuses = allStatuses.filter(s => !statusCounts[s.id]);
  if (unusedStatuses.length > 0) {
    console.log(`   ⚠️  ${unusedStatuses.length} statuts orphelins :\n`);
    unusedStatuses.forEach(s => {
      console.log(`   - ${s.label.padEnd(25)} [${s.code.padEnd(20)}] ${s.id}`);
    });
  } else {
    console.log('   ✅ Tous les statuts sont utilisés');
  }

  // 1.4 Codes frontend vs codes BDD
  console.log('\n4️⃣ Mapping Codes Frontend vs BDD :');
  const frontendCodes = [
    "DEMANDE",
    "DEVIS_ENVOYE", 
    "VISITE_TECHNIQUE",
    "ACCEPTE",
    "EN_COURS",        // Code legacy
    "TERMINE",          // Code legacy
    "SAV",
    "STAND_BY",
    "REFUSE",
    "ANNULE",
  ];

  console.log('\n   Codes Frontend → Statut BDD :');
  frontendCodes.forEach(code => {
    // Essayer de trouver avec le code direct
    let found = allStatuses.find(s => s.code === code);
    
    // Si pas trouvé, essayer avec les alias connus
    if (!found) {
      if (code === 'EN_COURS') {
        found = allStatuses.find(s => s.code === 'INTER_EN_COURS');
      } else if (code === 'TERMINE') {
        found = allStatuses.find(s => s.code === 'INTER_TERMINEE');
      }
    }

    if (found) {
      const usedCount = statusCounts[found.id] || 0;
      const status = usedCount > 0 ? '✅' : '⚠️ ';
      console.log(`   ${status} ${code.padEnd(20)} → ${found.label.padEnd(25)} (${usedCount} interventions)`);
    } else {
      console.log(`   ❌ ${code.padEnd(20)} → NON TROUVÉ EN BDD`);
    }
  });

  // ============================================================================
  // PARTIE 2 : AUDIT DES UTILISATEURS
  // ============================================================================
  console.log('\n\n═'.repeat(80));
  console.log('\n👤 PARTIE 2 : AUDIT DES UTILISATEURS (Assigné à)\n');

  // 2.1 Récupérer TOUS les utilisateurs
  console.log('1️⃣ Utilisateurs dans la table users :');
  const { data: allUsers, error: usersError } = await supabase
    .from('users')
    .select('id, username, email')
    .order('username');

  if (usersError) throw usersError;

  console.log(`   ✅ ${allUsers.length} utilisateurs trouvés :\n`);
  allUsers.forEach((u, i) => {
    const name = u.username;
    console.log(`   ${(i + 1).toString().padStart(2)}. ${name.padEnd(30)} [${u.email?.substring(0, 25).padEnd(25) || 'no email'}] ${u.id}`);
  });

  // 2.2 Récupérer tous les assigned_user_id UNIQUES utilisés
  console.log('\n2️⃣ Utilisateurs réellement assignés aux interventions :');
  const { data: assignedUserIds, error: assignedError } = await supabase
    .from('interventions')
    .select('assigned_user_id')
    .not('assigned_user_id', 'is', null);

  if (assignedError) throw assignedError;

  // Compter les occurrences
  const userCounts = {};
  assignedUserIds.forEach(row => {
    const id = row.assigned_user_id;
    userCounts[id] = (userCounts[id] || 0) + 1;
  });

  console.log(`   ✅ ${Object.keys(userCounts).length} utilisateurs assignés :\n`);
  
  // Trier par nombre d'interventions
  const sortedUsers = Object.entries(userCounts)
    .sort((a, b) => b[1] - a[1]);

  sortedUsers.forEach(([userId, count]) => {
    const user = allUsers.find(u => u.id === userId);
    if (user) {
      const name = user.username;
      console.log(`   - ${name.padEnd(30)} [${user.email?.substring(0, 15).padEnd(15) || 'no email'}] : ${count.toString().padStart(4)} interventions`);
    } else {
      console.log(`   ⚠️  UTILISATEUR INCONNU (${userId}) : ${count} interventions`);
    }
  });

  // 2.3 Utilisateurs orphelins (jamais assignés)
  console.log('\n3️⃣ Utilisateurs jamais assignés :');
  const unusedUsers = allUsers.filter(u => !userCounts[u.id]);
  if (unusedUsers.length > 0) {
    console.log(`   ⚠️  ${unusedUsers.length} utilisateurs sans interventions :\n`);
    unusedUsers.forEach(u => {
      const name = u.username;
      console.log(`   - ${name.padEnd(30)} [${u.email?.substring(0, 15).padEnd(15) || 'no email'}] ${u.id}`);
    });
  } else {
    console.log('   ✅ Tous les utilisateurs ont des interventions assignées');
  }

  // 2.4 Vérifier le mapping username → UUID (comme le fait useUserMap)
  console.log('\n4️⃣ Test du mapping Username → UUID :');
  const userMap = {};
  allUsers.forEach(user => {
    const normalized = user.username.toLowerCase();
    userMap[normalized] = user.id;
  });

  console.log('\n   Utilisateurs avec interventions (mapping) :');
  sortedUsers.slice(0, 10).forEach(([userId, count]) => {
    const user = allUsers.find(u => u.id === userId);
    if (user) {
      const normalized = user.username.toLowerCase();
      const mappedId = userMap[normalized];
      const status = mappedId === userId ? '✅' : '❌';
      console.log(`   ${status} "${normalized.padEnd(20)}" → ${mappedId === userId ? 'OK' : 'ERREUR'} (${count} interventions)`);
    }
  });

  // ============================================================================
  // PARTIE 3 : RÉSUMÉ ET RECOMMANDATIONS
  // ============================================================================
  console.log('\n\n═'.repeat(80));
  console.log('\n📊 RÉSUMÉ DE L\'AUDIT\n');

  // Problèmes détectés
  const problems = [];

  // Vérifier les statuts manquants
  const missingStatuses = frontendCodes.filter(code => {
    const found = allStatuses.find(s => s.code === code);
    if (!found && code !== 'EN_COURS' && code !== 'TERMINE') {
      return true;
    }
    return false;
  });

  if (missingStatuses.length > 0) {
    problems.push(`❌ ${missingStatuses.length} codes frontend sans correspondance BDD : ${missingStatuses.join(', ')}`);
  }

  // Vérifier les statuts utilisés mais non mappés
  const unmappedStatuses = allStatuses.filter(s => {
    const isUsed = statusCounts[s.id] > 0;
    const isMapped = frontendCodes.includes(s.code) || 
                     (s.code === 'INTER_EN_COURS' && frontendCodes.includes('EN_COURS')) ||
                     (s.code === 'INTER_TERMINEE' && frontendCodes.includes('TERMINE'));
    return isUsed && !isMapped;
  });

  if (unmappedStatuses.length > 0) {
    problems.push(`⚠️  ${unmappedStatuses.length} statuts utilisés mais pas dans les codes frontend :`);
    unmappedStatuses.forEach(s => {
      const count = statusCounts[s.id];
      problems.push(`    - ${s.label} [${s.code}] : ${count} interventions`);
    });
  }

  // Afficher les problèmes ou succès
  if (problems.length > 0) {
    console.log('⚠️  PROBLÈMES DÉTECTÉS :\n');
    problems.forEach(p => console.log(`   ${p}`));
  } else {
    console.log('✅ AUCUN PROBLÈME DÉTECTÉ\n');
    console.log('   - Tous les statuts sont correctement mappés');
    console.log('   - Tous les utilisateurs sont accessibles');
  }

  console.log('\n💡 RECOMMANDATIONS :\n');
  
  if (unmappedStatuses.length > 0) {
    console.log('   1. Ajouter les codes manquants dans InterventionStatusValues (src/types/interventions.ts) :');
    unmappedStatuses.forEach(s => {
      console.log(`      - "${s.code}"`);
    });
  }

  if (unusedStatuses.length > 0) {
    console.log(`   2. Considérer la suppression ou archivage de ${unusedStatuses.length} statuts inutilisés`);
  }

  if (unusedUsers.length > 0) {
    console.log(`   3. ${unusedUsers.length} utilisateurs sans interventions (peut-être normaux)`);
  }

  console.log('\n═'.repeat(80));
  console.log('\n✅ Audit terminé\n');
}

main().catch(console.error);

