#!/usr/bin/env node

/**
 * Initialisation complète de la base de données pour la production
 * Réplique tout ce que font seed_essential.sql et seed_admin_auth.sql
 * - Crée les credentials dans auth.users
 * - Crée les utilisateurs dans public.users
 * - Crée toutes les données de référence (métiers, zones, statuts, etc.)
 * - Crée les rôles et permissions
 * - Assigne les rôles aux utilisateurs
 * 
 * À exécuter APRÈS le reset mais AVANT l'import
 * 
 * Usage: 
 *   NODE_ENV=production node scripts/create-auth-credentials.js
 * 
 * Options:
 *   CLEAN_AUTH=true  - Supprime d'abord tous les utilisateurs de auth.users avant de les recréer
 * 
 * Exemple complet (reset total) :
 *   CLEAN_AUTH=true NODE_ENV=production npm run auth:create-credentials
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');

// Charger les variables d'environnement
const envFile = process.env.NODE_ENV === 'production' 
  ? '.env.production' 
  : '.env.local';

const envFilePath = path.resolve(process.cwd(), envFile);

if (fs.existsSync(envFilePath)) {
  require('dotenv').config({ path: envFilePath });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis');
  console.error(`   Fichier cherché: ${envFilePath}`);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});

// Configuration des utilisateurs (même que seed_essential.sql et seed_admin_auth.sql)
const USERS_CONFIG = [
  { id: '00000000-0000-0000-0000-000000000001', email: 'admin@gmbs.fr', password: 'admin', username: 'admin', firstname: 'Development', lastname: 'Admin', name: 'Admin', prenom: 'Development', color: '#FF0000', code_gestionnaire: 'ADMIN' },
  { id: '00000000-0000-0000-0000-000000000013', email: 'badr@gmbs.fr', password: 'badr123', username: 'badr', firstname: 'Boujimal', lastname: 'Badr', name: 'Boss', prenom: 'Badr', color: '#FF6B6B', code_gestionnaire: 'B' },
  { id: '00000000-0000-0000-0000-000000000002', email: 'andrea@gmbs.fr', password: 'andrea123', username: 'andrea', firstname: 'GAUTRET', lastname: 'Andrea', name: 'GAUTRET', prenom: 'Andrea', color: '#C5E0F4', code_gestionnaire: 'A' },
  { id: '00000000-0000-0000-0000-000000000003', email: 'olivier@gmbs.fr', password: 'olivier123', username: 'olivier', firstname: 'Gestionnaire', lastname: 'Olivier', name: 'Olivier', prenom: 'Gestionnaire', color: '#A22116', code_gestionnaire: 'O' },
  { id: '00000000-0000-0000-0000-000000000004', email: 'tom@gmbs.fr', password: 'tom123', username: 'tom', firstname: 'Birckel', lastname: 'Tom', name: 'Birckel', prenom: 'Tom', color: '#A22116', code_gestionnaire: 'T' },
  { id: '00000000-0000-0000-0000-000000000005', email: 'paul@gmbs.fr', password: 'paul123', username: 'paul', firstname: 'Aguenana', lastname: 'Paul', name: 'Aguenana', prenom: 'Paul', color: '#EBF551', code_gestionnaire: 'P' },
  { id: '00000000-0000-0000-0000-000000000006', email: 'louis@gmbs.fr', password: 'louis123', username: 'louis', firstname: 'Saune', lastname: 'Louis', name: 'Saune', prenom: 'Louis', color: '#69D9E5', code_gestionnaire: 'J' },
  { id: '00000000-0000-0000-0000-000000000007', email: 'samuel@gmbs.fr', password: 'samuel123', username: 'samuel', firstname: 's', lastname: 'Samuel', name: 's', prenom: 'Samuel', color: '#543481', code_gestionnaire: 'S' },
  { id: '00000000-0000-0000-0000-000000000008', email: 'lucien@gmbs.fr', password: 'lucien123', username: 'lucien', firstname: 'L', lastname: 'Lucien', name: 'L', prenom: 'Lucien', color: '#35714E', code_gestionnaire: 'L' },
  { id: '00000000-0000-0000-0000-000000000009', email: 'killian@gmbs.fr', password: 'killian123', username: 'killian', firstname: 'K', lastname: 'Killian', name: 'K', prenom: 'Killian', color: '#1227A1', code_gestionnaire: 'K' },
  { id: '00000000-0000-0000-0000-000000000010', email: 'dimitri@gmbs.fr', password: 'dimitri123', username: 'dimitri', firstname: 'Montanari', lastname: 'Dimitri', name: 'Montanari', prenom: 'Dimitri', color: '#FBE6A8', code_gestionnaire: 'D' },
  { id: '00000000-0000-0000-0000-000000000011', email: 'soulaimane@gmbs.fr', password: 'soulaimane123', username: 'soulaimane', firstname: 'Soulaimane', lastname: 'Soulaimane', name: 'Soulaimane', prenom: 'Soulaimane', color: '#FF6B6B', code_gestionnaire: 'SO' },
  { id: '00000000-0000-0000-0000-000000000012', email: 'clement@gmbs.fr', password: 'clement123', username: 'clement', firstname: 'Clément', lastname: 'Clément', name: 'Clément', prenom: 'Clément', color: '#4ECDC4', code_gestionnaire: 'C' },
];

// Option pour supprimer les utilisateurs auth existants
const CLEAN_AUTH = process.env.CLEAN_AUTH === 'true';

/**
 * Supprime tous les utilisateurs de auth.users
 */
async function deleteAllAuthUsers() {
  console.log('\n🗑️  Suppression des utilisateurs auth existants...');
  
  try {
    const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.error('   ❌ Erreur lors de la récupération des utilisateurs:', listError.message);
      return;
    }
    
    if (!existingUsers?.users?.length) {
      console.log('   ℹ️  Aucun utilisateur auth à supprimer');
      return;
    }

    let deletedCount = 0;
    for (const user of existingUsers.users) {
      const { error } = await supabase.auth.admin.deleteUser(user.id);
      if (error) {
        console.error(`   ⚠️  Erreur suppression ${user.email}:`, error.message);
      } else {
        console.log(`   🗑️  Supprimé: ${user.email}`);
        deletedCount++;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`   ✅ ${deletedCount}/${existingUsers.users.length} utilisateurs supprimés`);
  } catch (error) {
    console.error('   ❌ Erreur:', error.message);
  }
}

/**
 * Crée un utilisateur dans public.users
 */
async function createPublicUser(userConfig, authUserId) {
  const { id: expectedId, email, username, firstname, lastname, color, code_gestionnaire } = userConfig;
  const userId = authUserId || expectedId;

  try {
    // Vérifier si l'utilisateur existe déjà
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (existingUser) {
      // Mettre à jour l'utilisateur existant
      const { error: updateError } = await supabase
        .from('users')
        .update({
          username,
          firstname,
          lastname,
          color,
          code_gestionnaire,
          status: 'offline',
          token_version: 0,
          updated_at: new Date().toISOString()
        })
        .eq('email', email);

      if (updateError) {
        console.error(`   ⚠️  Erreur mise à jour public.users pour ${email}:`, updateError.message);
        return { success: false, error: updateError.message };
      }
      return { success: true, skipped: true };
    }

    // Créer l'utilisateur
    const { error: insertError } = await supabase
      .from('users')
      .insert({
        id: userId,
        username,
        email,
        firstname,
        lastname,
        color,
        code_gestionnaire,
        status: 'offline',
        token_version: 0,
        last_seen_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    if (insertError) {
      console.error(`   ❌ Erreur création public.users pour ${email}:`, insertError.message);
      return { success: false, error: insertError.message };
    }

    return { success: true };
  } catch (error) {
    console.error(`   ❌ Erreur générale public.users pour ${email}:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Crée un utilisateur d'authentification
 */
async function createAuthUser(userConfig) {
  const { id, email, password, username, name, prenom } = userConfig;

  try {
    // Vérifier si l'utilisateur existe déjà par email
    let existingUser = null;
    try {
      // Essayer de trouver l'utilisateur par email
      const { data: usersList } = await supabase.auth.admin.listUsers();
      existingUser = usersList?.users?.find(u => u.email === email);
    } catch (listError) {
      // Si la liste échoue, continuer quand même
      console.log(`   ⚠️  Impossible de vérifier les utilisateurs existants, continuation...`);
    }

    if (existingUser) {
      console.log(`⏭️  Utilisateur ${email} existe déjà (ID: ${existingUser.id})`);
      
      // Essayer de mettre à jour public.users pour utiliser cet ID
      const { data: publicUser } = await supabase
        .from('users')
        .select('id, email')
        .eq('email', email)
        .maybeSingle();

      if (publicUser && publicUser.id !== existingUser.id) {
        const { error: updateError } = await supabase
          .from('users')
          .update({ id: existingUser.id })
          .eq('email', email);
        
        if (!updateError) {
          console.log(`   ✅ ID mis à jour dans public.users pour correspondre à auth.users`);
        }
      }
      
      return { success: true, skipped: true, email, id: existingUser.id };
    }

    // Créer l'utilisateur
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
      user_metadata: {
        username: username,
        name: name,
        prenom: prenom
      }
    });

    if (authError) {
      // Si l'erreur est que l'utilisateur existe déjà, continuer
      if (authError.message.includes('already registered') || 
          authError.message.includes('already exists') ||
          authError.message.includes('User already registered')) {
        console.log(`⏭️  Utilisateur ${email} existe déjà`);
        return { success: true, skipped: true, email, id };
      }
      console.error(`❌ Erreur pour ${email}:`, authError.message);
      return { success: false, error: authError.message, email };
    }

    if (!authUser?.user) {
      console.error(`❌ Pas de données utilisateur retournées pour ${email}`);
      return { success: false, error: 'No user data returned', email };
    }

    const createdUserId = authUser.user.id;

    // Vérifier si l'ID correspond à celui attendu
    if (createdUserId !== id) {
      console.log(`⚠️  ID généré (${createdUserId}) différent de l'ID attendu (${id}) pour ${email}`);
      console.log(`   → L'ID généré sera utilisé: ${createdUserId}`);
    }

    // Mettre à jour public.users pour utiliser l'ID créé (si l'utilisateur existe)
    const { data: publicUser } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', email)
      .single();

    if (publicUser && publicUser.id !== createdUserId) {
      const { error: updateError } = await supabase
        .from('users')
        .update({ id: createdUserId })
        .eq('email', email);

      if (updateError) {
        console.log(`   ⚠️  Note: Impossible de mettre à jour l'ID dans public.users (l'utilisateur sera lié automatiquement)`);
      } else {
        console.log(`   ✅ ID mis à jour dans public.users`);
      }
    }

    console.log(`✅ Créé: ${email} (ID: ${createdUserId})`);
    
    // Créer aussi l'utilisateur dans public.users
    const publicUserResult = await createPublicUser(userConfig, createdUserId);
    if (!publicUserResult.success && !publicUserResult.skipped) {
      console.error(`   ⚠️  Erreur création public.users, mais auth.users créé`);
    }

    return { success: true, email, id: createdUserId };

  } catch (error) {
    console.error(`❌ Erreur générale pour ${email}:`, error.message);
    return { success: false, error: error.message, email };
  }
}

/**
 * Crée les données de référence (métiers, zones, statuts, etc.)
 */
async function createReferenceData() {
  console.log('\n📦 Création des données de référence...');

  // Métiers
  const metiers = [
    ['AUTRES', 'AUTRES', 'Autres métiers'],
    ['BRICOLAGE', 'Bricolage', 'Bricolage et petits travaux'],
    ['CAMION', 'CAMION', 'Services de camion'],
    ['CHAUFFAGE', 'Chauffage', 'Installation et réparation chauffage'],
    ['CLIMATISATION', 'Climatisation', 'Climatisation et ventilation'],
    ['ELECTRICITE', 'Electricite', 'Électricité générale'],
    ['ELECTROMENAGER', 'Electroménager', 'Électroménager'],
    ['ENTRETIEN_GENERAL', 'Entretien général', 'Entretien général'],
    ['JARDINAGE', 'Jardinage', 'Jardinage et espaces verts'],
    ['MENUISIER', 'Menuiserie', 'Menuiserie et ébénisterie'],
    ['MULTI-SERVICE', 'Multi-Service', 'Services multiples'],
    ['MENAGE', 'Menage', 'Services de ménage'],
    ['NETTOYAGE', 'Nettoyage', 'Services de nettoyage'],
    ['NUISIBLE', 'Nuisible', 'Lutte contre les nuisibles'],
    ['PEINTURE', 'Peinture', 'Peinture et décoration'],
    ['PLOMBERIE', 'Plomberie', 'Plomberie générale'],
    ['RDF', 'RDF', 'Réparation de défauts'],
    ['RENOVATION', 'Renovation', 'Rénovation générale'],
    ['SERRURERIE', 'Serrurerie', 'Serrurerie et sécurité'],
    ['VITRERIE', 'Vitrerie', 'Vitrerie et miroiterie'],
    ['VOLET-STORE', 'Volet/Store', 'Volets et stores']
  ];

  for (const [code, label, description] of metiers) {
    // Essayer d'insérer, ignorer si existe déjà
    const { error } = await supabase
      .from('metiers')
      .upsert({ code, label, description }, { onConflict: 'code', ignoreDuplicates: false });
    if (error && !error.message.includes('duplicate') && !error.message.includes('already exists')) {
      console.error(`   ⚠️  Erreur métier ${code}:`, error.message);
    }
  }
  console.log(`   ✅ ${metiers.length} métiers`);

  // Zones
  const zones = [
    ['PARIS', 'Paris', 'Île-de-France'],
    ['LYON', 'Lyon', 'Auvergne-Rhône-Alpes'],
    ['MARSEILLE', 'Marseille', 'Provence-Alpes-Côte d\'Azur'],
    ['TOULOUSE', 'Toulouse', 'Occitanie'],
    ['NICE', 'Nice', 'Provence-Alpes-Côte d\'Azur'],
    ['NANTES', 'Nantes', 'Pays de la Loire'],
    ['STRASBOURG', 'Strasbourg', 'Grand Est'],
    ['MONTPELLIER', 'Montpellier', 'Occitanie'],
    ['BORDEAUX', 'Bordeaux', 'Nouvelle-Aquitaine'],
    ['LILLE', 'Lille', 'Hauts-de-France']
  ];

  for (const [code, label, region] of zones) {
    const { error } = await supabase
      .from('zones')
      .upsert({ code, label, region }, { onConflict: 'code', ignoreDuplicates: false });
    if (error && !error.message.includes('duplicate') && !error.message.includes('already exists')) {
      console.error(`   ⚠️  Erreur zone ${code}:`, error.message);
    }
  }
  console.log(`   ✅ ${zones.length} zones`);

  // Statuts artisans
  const artisanStatuses = [
    ['CANDIDAT', 'Candidat', '#A855F7', 1],
    ['ONE_SHOT', 'One Shot', '#F97316', 2],
    ['POTENTIEL', 'Potentiel', '#FACC15', 3],
    ['NOVICE', 'Novice', '#60A5FA', 4],
    ['FORMATION', 'Formation', '#38BDF8', 5],
    ['CONFIRME', 'Confirmé', '#22C55E', 6],
    ['EXPERT', 'Expert', '#6366F1', 7],
    ['INACTIF', 'Inactif', '#EF4444', 8],
    ['ARCHIVE', 'Archivé', '#6B7280', 9]
  ];

  for (const [code, label, color, sort_order] of artisanStatuses) {
    const { error } = await supabase
      .from('artisan_statuses')
      .upsert({ code, label, color, sort_order }, { onConflict: 'code', ignoreDuplicates: false });
    if (error && !error.message.includes('duplicate') && !error.message.includes('already exists')) {
      console.error(`   ⚠️  Erreur statut artisan ${code}:`, error.message);
    }
  }
  console.log(`   ✅ ${artisanStatuses.length} statuts artisans`);

  // Statuts interventions
  const interventionStatuses = [
    ['DEMANDE', 'Demandé', '#3B82F6', 1],
    ['ACCEPTE', 'Accepté', '#10B981', 2],
    ['DEVIS_ENVOYE', 'Devis Envoyé', '#8B5CF6', 3],
    ['INTER_EN_COURS', 'Inter en cours', '#F59E0B', 4],
    ['INTER_TERMINEE', 'Inter terminée', '#10B981', 5],
    ['VISITE_TECHNIQUE', 'Visite Technique', '#06B6D4', 6],
    ['ATT_ACOMPTE', 'Att Acompte', '#F97316', 7],
    ['ANNULE', 'Annulé', '#EF4444', 8],
    ['REFUSE', 'Refusé', '#EF4444', 9],
    ['STAND_BY', 'Stand by', '#6B7280', 10],
    ['SAV', 'SAV', '#EC4899', 11]
  ];

  for (const [code, label, color, sort_order] of interventionStatuses) {
    const { error } = await supabase
      .from('intervention_statuses')
      .upsert({ code, label, color, sort_order }, { onConflict: 'code', ignoreDuplicates: false });
    if (error && !error.message.includes('duplicate') && !error.message.includes('already exists')) {
      console.error(`   ⚠️  Erreur statut intervention ${code}:`, error.message);
    }
  }
  console.log(`   ✅ ${interventionStatuses.length} statuts interventions`);

  // Statuts tâches
  const taskStatuses = [
    ['TODO', 'À faire', '#3B82F6', 1],
    ['DOING', 'En cours', '#F59E0B', 2],
    ['DONE', 'Terminé', '#10B981', 3],
    ['CANCELLED', 'Annulé', '#EF4444', 4]
  ];

  for (const [code, label, color, sort_order] of taskStatuses) {
    const { error } = await supabase
      .from('task_statuses')
      .upsert({ code, label, color, sort_order }, { onConflict: 'code', ignoreDuplicates: false });
    if (error && !error.message.includes('duplicate') && !error.message.includes('already exists')) {
      console.error(`   ⚠️  Erreur statut tâche ${code}:`, error.message);
    }
  }
  console.log(`   ✅ ${taskStatuses.length} statuts tâches`);
}

/**
 * Crée les rôles et permissions
 */
async function createRolesAndPermissions() {
  console.log('\n🔐 Création des rôles et permissions...');

  // Créer les rôles
  const roles = [
    { name: 'ADMIN', description: 'Accès complet au système' },
    { name: 'MANAGER', description: 'Gestion d\'équipe' },
    { name: 'GESTIONNAIRE', description: 'Opérations quotidiennes' },
    { name: 'VIEWER', description: 'Lecture seule' }
  ];

  const roleIds = {};
  for (const role of roles) {
    const { data, error } = await supabase
      .from('roles')
      .upsert({ name: role.name, description: role.description }, { onConflict: 'name' })
      .select('id, name')
      .single();

    if (error) {
      console.error(`   ⚠️  Erreur rôle ${role.name}:`, error.message);
    } else {
      roleIds[role.name] = data.id;
    }
  }
  console.log(`   ✅ ${roles.length} rôles`);

  // Créer les permissions
  const permissions = [
    ['interventions.view', 'Peut voir les interventions'],
    ['interventions.create', 'Peut créer les interventions'],
    ['interventions.edit', 'Peut modifier les interventions'],
    ['interventions.delete', 'Peut supprimer les interventions'],
    ['artisans.view', 'Peut voir les artisans'],
    ['artisans.create', 'Peut créer les artisans'],
    ['artisans.edit', 'Peut modifier les artisans'],
    ['artisans.delete', 'Peut supprimer les artisans'],
    ['users.view', 'Peut voir les utilisateurs'],
    ['users.manage', 'Peut gérer les utilisateurs'],
    ['settings.view', 'Peut voir les paramètres'],
    ['settings.edit', 'Peut modifier les paramètres']
  ];

  const permissionIds = {};
  for (const [key, description] of permissions) {
    const { data, error } = await supabase
      .from('permissions')
      .upsert({ key, description }, { onConflict: 'key' })
      .select('id, key')
      .single();

    if (error) {
      console.error(`   ⚠️  Erreur permission ${key}:`, error.message);
    } else {
      permissionIds[key] = data.id;
    }
  }
  console.log(`   ✅ ${permissions.length} permissions`);

  // Associer permissions aux rôles
  // Pour les clés composites, on utilise insert et on ignore les erreurs de duplicate
  const insertRolePermission = async (roleId, permissionId) => {
    const { error } = await supabase
      .from('role_permissions')
      .insert({ role_id: roleId, permission_id: permissionId });
    // Ignorer les erreurs de duplicate (la permission est déjà assignée)
    if (error && !error.message.includes('duplicate') && !error.message.includes('already exists')) {
      console.error(`   ⚠️  Erreur role_permission:`, error.message);
    }
  };

  // Admin : toutes les permissions
  if (roleIds['ADMIN']) {
    for (const permId of Object.values(permissionIds)) {
      await insertRolePermission(roleIds['ADMIN'], permId);
    }
  }

  // Manager : toutes sauf users.manage et settings.edit
  if (roleIds['MANAGER']) {
    for (const [key, permId] of Object.entries(permissionIds)) {
      if (!['users.manage', 'settings.edit'].includes(key)) {
        await insertRolePermission(roleIds['MANAGER'], permId);
      }
    }
  }

  // Gestionnaire : opérations quotidiennes
  if (roleIds['GESTIONNAIRE']) {
    const gestionnairePerms = ['interventions.view', 'interventions.create', 'interventions.edit', 'artisans.view', 'artisans.create', 'artisans.edit'];
    for (const key of gestionnairePerms) {
      if (permissionIds[key]) {
        await insertRolePermission(roleIds['GESTIONNAIRE'], permissionIds[key]);
      }
    }
  }

  // Viewer : lecture seule
  if (roleIds['VIEWER']) {
    const viewerPerms = ['interventions.view', 'artisans.view'];
    for (const key of viewerPerms) {
      if (permissionIds[key]) {
        await insertRolePermission(roleIds['VIEWER'], permissionIds[key]);
      }
    }
  }

  console.log(`   ✅ Permissions associées aux rôles`);

  return roleIds;
}

/**
 * Assigne les rôles aux utilisateurs
 */
async function assignRolesToUsers(roleIds) {
  console.log('\n👥 Assignation des rôles aux utilisateurs...');

  // Helper pour insérer user_roles en ignorant les duplicates
  const insertUserRole = async (userId, roleId) => {
    const { error } = await supabase
      .from('user_roles')
      .insert({ user_id: userId, role_id: roleId });
    // Ignorer les erreurs de duplicate (le rôle est déjà assigné)
    if (error && !error.message.includes('duplicate') && !error.message.includes('already exists')) {
      console.error(`   ⚠️  Erreur user_role:`, error.message);
    }
  };

  // Admin role pour admin et badr
  if (roleIds['ADMIN']) {
    for (const username of ['admin', 'badr']) {
      const user = USERS_CONFIG.find(u => u.username === username);
      if (user) {
        await insertUserRole(user.id, roleIds['ADMIN']);
      }
    }
  }

  // Manager role pour andrea
  if (roleIds['MANAGER']) {
    const user = USERS_CONFIG.find(u => u.username === 'andrea');
    if (user) {
      await insertUserRole(user.id, roleIds['MANAGER']);
    }
  }

  // Gestionnaire role pour les autres
  if (roleIds['GESTIONNAIRE']) {
    const gestionnaires = ['olivier', 'tom', 'paul', 'louis', 'samuel', 'lucien', 'killian', 'dimitri', 'soulaimane', 'clement'];
    for (const username of gestionnaires) {
      const user = USERS_CONFIG.find(u => u.username === username);
      if (user) {
        await insertUserRole(user.id, roleIds['GESTIONNAIRE']);
      }
    }
  }

  console.log(`   ✅ Rôles assignés`);
}

/**
 * Fonction principale
 */
async function main() {
  console.log('🚀 Initialisation complète de la base de données...\n');
  console.log(`📍 URL Supabase: ${supabaseUrl}`);
  console.log(`📁 Environnement: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🧹 Clean auth: ${CLEAN_AUTH ? 'OUI (suppression préalable)' : 'NON'}\n`);

  // Étape 0 (optionnelle) : Supprimer tous les utilisateurs auth existants
  if (CLEAN_AUTH) {
    await deleteAllAuthUsers();
  }

  // 1. Créer les credentials d'authentification
  console.log('\n👤 Étape 1/5 : Création des credentials d\'authentification...');
  let successCount = 0;
  let errorCount = 0;
  let skippedCount = 0;
  const results = [];

  for (const userConfig of USERS_CONFIG) {
    const result = await createAuthUser(userConfig);
    results.push({ ...userConfig, ...result });

    if (result.success) {
      if (result.skipped) {
        skippedCount++;
      } else {
        successCount++;
      }
    } else {
      errorCount++;
    }

    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.log(`   ✅ Créés: ${successCount}, ⏭️  Existants: ${skippedCount}, ❌ Erreurs: ${errorCount}`);

  // 2. S'assurer que tous les utilisateurs existent dans public.users
  console.log('\n👥 Étape 2/5 : Vérification des utilisateurs dans public.users...');
  for (const userConfig of USERS_CONFIG) {
    const authUser = results.find(r => r.email === userConfig.email);
    if (authUser?.id) {
      await createPublicUser(userConfig, authUser.id);
    }
  }
  console.log(`   ✅ ${USERS_CONFIG.length} utilisateurs vérifiés`);

  // 3. Créer les données de référence
  await createReferenceData();

  // 4. Créer les rôles et permissions
  const roleIds = await createRolesAndPermissions();

  // 5. Assigner les rôles aux utilisateurs
  await assignRolesToUsers(roleIds);

  console.log('\n📊 Résumé final:');
  console.log(`   ✅ Credentials créés: ${successCount}`);
  console.log(`   ⏭️  Credentials existants: ${skippedCount}`);
  console.log(`   ❌ Erreurs: ${errorCount}`);
  console.log(`   👤 Utilisateurs: ${USERS_CONFIG.length}`);
  console.log(`   📦 Données de référence créées`);

  if (errorCount === 0) {
    console.log('\n✅ Base de données initialisée avec succès ! Prête pour l\'import.');
  } else {
    console.log('\n⚠️  Certaines erreurs sont survenues. Vérifiez les messages ci-dessus.');
    process.exit(1);
  }
}

// Exécuter le script
if (require.main === module) {
  main()
    .then(() => {
      console.log('\n🎉 Script terminé !');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n💥 Erreur fatale:', error);
      process.exit(1);
    });
}

module.exports = { createAuthUser, USERS_CONFIG };

