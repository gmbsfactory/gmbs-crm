#!/usr/bin/env node
/**
 * Audit complet des mappings SANS LIMITE de résultats
 * Récupère TOUTES les interventions (pas juste 1000)
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'http://127.0.0.1:54321';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  console.log('\n🔍 AUDIT COMPLET DES MAPPINGS (SANS LIMITE)\n');
  console.log('═'.repeat(80));

  // ============================================================================
  // PARTIE 1 : COMPTAGE TOTAL
  // ============================================================================
  console.log('\n📊 COMPTAGE TOTAL DES INTERVENTIONS\n');

  const { count: totalCount, error: totalError } = await supabase
    .from('interventions')
    .select('*', { count: 'exact', head: true });

  if (totalError) throw totalError;

  console.log(`   ✅ Total interventions en BDD : ${totalCount}\n`);

  // ============================================================================
  // PARTIE 2 : AUDIT DES STATUTS (AVEC AGGREGATION SQL)
  // ============================================================================
  console.log('═'.repeat(80));
  console.log('\n📋 PARTIE 1 : AUDIT DES STATUTS\n');

  // 1.1 Récupérer TOUS les statuts
  console.log('1️⃣ Statuts définis dans la table intervention_statuses :');
  const { data: allStatuses, error: statusError } = await supabase
    .from('intervention_statuses')
    .select('id, code, label')
    .order('label');

  if (statusError) throw statusError;

  console.log(`   ✅ ${allStatuses.length} statuts trouvés\n`);

  // 1.2 Compter les interventions PAR STATUT (requête SQL agrégée)
  console.log('2️⃣ Distribution des interventions par statut (TOUTES) :\n');

  // Créer un mapping statusId -> count
  const statusCounts = {};
  
  // Pour chaque statut, faire un count exact
  for (const status of allStatuses) {
    const { count, error } = await supabase
      .from('interventions')
      .select('id', { count: 'exact', head: true })
      .eq('statut_id', status.id);
    
    if (error) {
      console.error(`   ❌ Erreur pour ${status.label}: ${error.message}`);
      continue;
    }
    
    if (count > 0) {
      statusCounts[status.id] = count;
    }
  }

  // Trier par nombre d'interventions
  const sortedStatuses = Object.entries(statusCounts)
    .sort((a, b) => b[1] - a[1]);

  console.log('   Distribution :');
  sortedStatuses.forEach(([statusId, count]) => {
    const status = allStatuses.find(s => s.id === statusId);
    const percent = ((count / totalCount) * 100).toFixed(1);
    console.log(`   - ${status.label.padEnd(25)} [${status.code.padEnd(20)}] : ${count.toString().padStart(5)} (${percent.padStart(5)}%)`);
  });

  const totalCounted = sortedStatuses.reduce((sum, [_, count]) => sum + count, 0);
  console.log(`\n   Total comptabilisé : ${totalCounted} / ${totalCount}`);

  // 1.3 Vérifier les codes frontend
  console.log('\n3️⃣ Mapping Codes Frontend vs BDD :\n');
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

  console.log('   Codes Frontend → Statut BDD :');
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
      const percent = totalCount > 0 ? ((usedCount / totalCount) * 100).toFixed(1) : 0;
      const status = usedCount > 0 ? '✅' : '⚠️ ';
      console.log(`   ${status} ${code.padEnd(20)} → ${found.label.padEnd(25)} : ${usedCount.toString().padStart(5)} (${percent}%)`);
    } else {
      console.log(`   ❌ ${code.padEnd(20)} → NON TROUVÉ EN BDD`);
    }
  });

  // ============================================================================
  // PARTIE 3 : AUDIT DES UTILISATEURS
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

  console.log(`   ✅ ${allUsers.length} utilisateurs trouvés\n`);

  // 2.2 Compter les interventions PAR UTILISATEUR
  console.log('2️⃣ Distribution des interventions par utilisateur (TOUS) :\n');

  const userCounts = {};
  
  // Pour chaque utilisateur, faire un count exact
  for (const user of allUsers) {
    const { count, error } = await supabase
      .from('interventions')
      .select('id', { count: 'exact', head: true })
      .eq('assigned_user_id', user.id);
    
    if (error) {
      console.error(`   ❌ Erreur pour ${user.username}: ${error.message}`);
      continue;
    }
    
    if (count > 0) {
      userCounts[user.id] = count;
    }
  }

  // Trier par nombre d'interventions
  const sortedUsers = Object.entries(userCounts)
    .sort((a, b) => b[1] - a[1]);

  console.log('   Utilisateurs avec interventions :');
  sortedUsers.forEach(([userId, count]) => {
    const user = allUsers.find(u => u.id === userId);
    const percent = ((count / totalCount) * 100).toFixed(1);
    console.log(`   - ${user.username.padEnd(25)} [${user.email?.substring(0, 20).padEnd(20) || 'no email'.padEnd(20)}] : ${count.toString().padStart(5)} (${percent.padStart(5)}%)`);
  });

  const totalAssigned = sortedUsers.reduce((sum, [_, count]) => sum + count, 0);
  console.log(`\n   Total assigné : ${totalAssigned} / ${totalCount}`);

  const unassignedCount = totalCount - totalAssigned;
  if (unassignedCount > 0) {
    console.log(`   ⚠️  ${unassignedCount} interventions NON assignées`);
  }

  // 2.3 Utilisateurs sans interventions
  const unusedUsers = allUsers.filter(u => !userCounts[u.id]);
  if (unusedUsers.length > 0) {
    console.log(`\n   ℹ️  ${unusedUsers.length} utilisateurs sans interventions : ${unusedUsers.map(u => u.username).join(', ')}`);
  }

  // ============================================================================
  // PARTIE 4 : TEST DÉTAILLÉ POUR ANDREA
  // ============================================================================
  console.log('\n\n═'.repeat(80));
  console.log('\n🎯 PARTIE 3 : ANALYSE DÉTAILLÉE POUR ANDREA\n');

  const andrea = allUsers.find(u => u.username.toLowerCase() === 'andrea');
  if (andrea) {
    console.log(`✅ Utilisateur trouvé : ${andrea.username} (${andrea.id})\n`);
    
    console.log('Distribution par statut pour Andrea :');
    for (const status of allStatuses) {
      const { count } = await supabase
        .from('interventions')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_user_id', andrea.id)
        .eq('statut_id', status.id);
      
      if (count > 0) {
        const percent = userCounts[andrea.id] > 0 ? ((count / userCounts[andrea.id]) * 100).toFixed(1) : 0;
        console.log(`   - ${status.label.padEnd(25)} [${status.code.padEnd(20)}] : ${count.toString().padStart(4)} (${percent.padStart(5)}%)`);
      }
    }
    
    console.log(`\n   Total pour Andrea : ${userCounts[andrea.id] || 0} interventions`);
  } else {
    console.log('❌ Utilisateur Andrea non trouvé');
  }

  // ============================================================================
  // PARTIE 5 : RÉSUMÉ
  // ============================================================================
  console.log('\n\n═'.repeat(80));
  console.log('\n📊 RÉSUMÉ FINAL\n');

  console.log(`📈 INTERVENTIONS :`);
  console.log(`   - Total en BDD : ${totalCount}`);
  console.log(`   - Statuts utilisés : ${sortedStatuses.length} / ${allStatuses.length}`);
  console.log(`   - Utilisateurs assignés : ${sortedUsers.length} / ${allUsers.length}`);
  
  // Vérifier les codes frontend manquants
  const missingCodes = [];
  frontendCodes.forEach(code => {
    let found = allStatuses.find(s => s.code === code);
    if (!found && code === 'EN_COURS') {
      found = allStatuses.find(s => s.code === 'INTER_EN_COURS');
    }
    if (!found && code === 'TERMINE') {
      found = allStatuses.find(s => s.code === 'INTER_TERMINEE');
    }
    if (!found) {
      missingCodes.push(code);
    }
  });

  if (missingCodes.length > 0) {
    console.log(`\n⚠️  ${missingCodes.length} codes frontend sans mapping : ${missingCodes.join(', ')}`);
  } else {
    console.log(`\n✅ Tous les codes frontend ont un mapping`);
  }

  console.log('\n═'.repeat(80));
  console.log('\n✅ Audit terminé\n');
}

main().catch(console.error);




