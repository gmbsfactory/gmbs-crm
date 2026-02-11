/**
 * Script pour compter les différentes entités dans la base de données
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Charger les variables d'environnement
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variables d\'environnement manquantes');
  console.error('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓' : '✗');
  console.error('SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? '✓' : '✗');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function countEntities() {
  console.log('\n📊 COMPTAGE DES ENTITÉS DANS LA BASE DE DONNÉES\n');
  console.log('='.repeat(60));
  
  // Utilisateurs
  const { count: usersCount, error: usersError } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true });
  
  const { data: activeUsers, error: activeUsersError } = await supabase
    .from('users')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true);
  
  console.log('\n👥 UTILISATEURS:');
  console.log(`   Total: ${usersCount || 0}`);
  console.log(`   Actifs: ${activeUsers?.length || 0}`);
  
  // Agences
  const { count: agenciesCount, error: agenciesError } = await supabase
    .from('agencies')
    .select('*', { count: 'exact', head: true });
  
  const { data: activeAgencies, error: activeAgenciesError } = await supabase
    .from('agencies')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true);
  
  console.log('\n🏢 AGENCES:');
  console.log(`   Total: ${agenciesCount || 0}`);
  console.log(`   Actives: ${activeAgencies?.length || 0}`);
  
  // Statuts d'intervention
  const { count: interventionStatusesCount, error: interventionStatusesError } = await supabase
    .from('intervention_statuses')
    .select('*', { count: 'exact', head: true });
  
  const { data: activeInterventionStatuses, error: activeInterventionStatusesError } = await supabase
    .from('intervention_statuses')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true);
  
  console.log('\n📋 STATUTS INTERVENTION:');
  console.log(`   Total: ${interventionStatusesCount || 0}`);
  console.log(`   Actifs: ${activeInterventionStatuses?.length || 0}`);
  
  // Statuts d'artisan
  const { count: artisanStatusesCount, error: artisanStatusesError } = await supabase
    .from('artisan_statuses')
    .select('*', { count: 'exact', head: true });
  
  const { data: activeArtisanStatuses, error: activeArtisanStatusesError } = await supabase
    .from('artisan_statuses')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true);
  
  console.log('\n👷 STATUTS ARTISAN:');
  console.log(`   Total: ${artisanStatusesCount || 0}`);
  console.log(`   Actifs: ${activeArtisanStatuses?.length || 0}`);
  
  // Métiers
  const { count: metiersCount, error: metiersError } = await supabase
    .from('metiers')
    .select('*', { count: 'exact', head: true });
  
  console.log('\n🔧 MÉTIERS:');
  console.log(`   Total: ${metiersCount || 0}`);
  
  // Zones
  const { count: zonesCount, error: zonesError } = await supabase
    .from('zones')
    .select('*', { count: 'exact', head: true });
  
  console.log('\n🗺️  ZONES:');
  console.log(`   Total: ${zonesCount || 0}`);
  
  console.log('\n' + '='.repeat(60));
  
  // Détails des utilisateurs
  console.log('\n📋 DÉTAILS DES UTILISATEURS:');
  console.log('-'.repeat(60));
  const { data: users } = await supabase
    .from('users')
    .select('id, firstname, lastname, email, role, is_active')
    .order('lastname');
  
  if (users) {
    users.forEach(user => {
      const status = user.is_active ? '✅' : '❌';
      console.log(`${status} ${user.firstname} ${user.lastname} (${user.email}) - ${user.role || 'N/A'}`);
    });
  }
  
  // Détails des agences
  console.log('\n📋 DÉTAILS DES AGENCES:');
  console.log('-'.repeat(60));
  const { data: agencies } = await supabase
    .from('agencies')
    .select('id, label, code, is_active')
    .order('label');
  
  if (agencies) {
    agencies.forEach(agency => {
      const status = agency.is_active ? '✅' : '❌';
      console.log(`${status} ${agency.label} (${agency.code || 'N/A'})`);
    });
  }
  
  // Détails des statuts d'intervention
  console.log('\n📋 DÉTAILS DES STATUTS INTERVENTION:');
  console.log('-'.repeat(60));
  const { data: interventionStatuses } = await supabase
    .from('intervention_statuses')
    .select('id, code, label, color, sort_order, is_active')
    .order('sort_order');
  
  if (interventionStatuses) {
    interventionStatuses.forEach(status => {
      const active = status.is_active ? '✅' : '❌';
      console.log(`${active} [${status.sort_order}] ${status.code} - ${status.label} (${status.color || 'N/A'})`);
    });
  }
  
  // Détails des statuts d'artisan
  console.log('\n📋 DÉTAILS DES STATUTS ARTISAN:');
  console.log('-'.repeat(60));
  const { data: artisanStatuses } = await supabase
    .from('artisan_statuses')
    .select('id, code, label, color, sort_order, is_active')
    .order('sort_order');
  
  if (artisanStatuses) {
    artisanStatuses.forEach(status => {
      const active = status.is_active ? '✅' : '❌';
      console.log(`${active} [${status.sort_order}] ${status.code} - ${status.label} (${status.color || 'N/A'})`);
    });
  }
  
  // Statistiques d'usage
  console.log('\n📊 STATISTIQUES D\'USAGE:');
  console.log('-'.repeat(60));
  
  // Interventions par utilisateur
  const { data: interventionsByUser } = await supabase
    .from('interventions')
    .select('assigned_user_id, users(firstname, lastname, email)');
  
  if (interventionsByUser) {
    const userStats = interventionsByUser.reduce((acc, int) => {
      const userId = int.assigned_user_id;
      if (userId) {
        if (!acc[userId]) {
          acc[userId] = {
            user: int.users,
            count: 0
          };
        }
        acc[userId].count++;
      }
      return acc;
    }, {});
    
    console.log('\nInterventions par utilisateur:');
    Object.values(userStats)
      .sort((a, b) => b.count - a.count)
      .forEach(stat => {
        if (stat.user) {
          console.log(`   ${stat.user.firstname} ${stat.user.lastname}: ${stat.count} interventions`);
        }
      });
  }
  
  // Interventions par agence
  const { data: interventionsByAgency } = await supabase
    .from('interventions')
    .select('agence_id, agencies(label)');
  
  if (interventionsByAgency) {
    const agencyStats = interventionsByAgency.reduce((acc, int) => {
      const agencyId = int.agence_id;
      if (agencyId) {
        if (!acc[agencyId]) {
          acc[agencyId] = {
            agency: int.agencies,
            count: 0
          };
        }
        acc[agencyId].count++;
      }
      return acc;
    }, {});
    
    console.log('\nInterventions par agence:');
    Object.values(agencyStats)
      .sort((a, b) => b.count - a.count)
      .forEach(stat => {
        if (stat.agency) {
          console.log(`   ${stat.agency.label}: ${stat.count} interventions`);
        }
      });
  }
  
  // Interventions par statut
  const { data: interventionsByStatus } = await supabase
    .from('interventions')
    .select('statut_id, intervention_statuses(code, label, sort_order)');
  
  if (interventionsByStatus) {
    const statusStats = interventionsByStatus.reduce((acc, int) => {
      const statusId = int.statut_id;
      if (statusId && int.intervention_statuses) {
        if (!acc[statusId]) {
          acc[statusId] = {
            status: int.intervention_statuses,
            count: 0
          };
        }
        acc[statusId].count++;
      }
      return acc;
    }, {});
    
    console.log('\nInterventions par statut:');
    Object.values(statusStats)
      .sort((a, b) => (a.status.sort_order || 999) - (b.status.sort_order || 999))
      .forEach(stat => {
        if (stat.status) {
          console.log(`   ${stat.status.code} - ${stat.status.label}: ${stat.count} interventions`);
        }
      });
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ Comptage terminé\n');
}

countEntities().catch(console.error);

