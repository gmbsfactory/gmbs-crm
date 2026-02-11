#!/usr/bin/env node

/**
 * Script pour créer des utilisateurs d'authentification à partir des utilisateurs publics
 * Ce script lit les utilisateurs de public.users et les crée dans auth.users
 */

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

// Configuration Supabase
const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});

/**
 * Génère un mot de passe aléatoire sécurisé
 */
function generatePassword(length = 12) {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
}

/**
 * Crée un utilisateur d'authentification
 */
async function createAuthUser(userData) {
  const { email, firstname, lastname, username } = userData;
  
  // Générer un mot de passe aléatoire
  const password = generatePassword();
  
  try {
    // Créer l'utilisateur dans auth.users via l'API Admin
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true, // Confirmer automatiquement l'email
      user_metadata: {
        firstname: firstname || 'Utilisateur',
        lastname: lastname || 'Utilisateur',
        username: username || email
      }
    });

    if (authError) {
      console.error(`❌ Erreur création auth user pour ${email}:`, authError.message);
      return null;
    }

    console.log(`✅ Utilisateur auth créé: ${email} (ID: ${authUser.user.id})`);

    return {
      email,
      password,
      auth_user_id: authUser.user.id,
      firstname,
      lastname,
      username
    };

  } catch (error) {
    console.error(`❌ Erreur générale pour ${email}:`, error.message);
    return null;
  }
}

/**
 * Fonction principale
 */
async function main() {
  console.log('🚀 Début de la création des utilisateurs d\'authentification...\n');

  try {
    // Récupérer tous les utilisateurs de public.users
    const { data: users, error: fetchError } = await supabase
      .from('users')
      .select('id, email, firstname, lastname, username')
      .not('email', 'is', null); // Seulement les users avec un email

    if (fetchError) {
      console.error('❌ Erreur lors de la récupération des utilisateurs:', fetchError.message);
      return;
    }

    if (!users || users.length === 0) {
      console.log('ℹ️  Aucun utilisateur à migrer trouvé.');
      return;
    }

    console.log(`📋 ${users.length} utilisateur(s) à migrer trouvé(s):`);
    users.forEach(user => {
      console.log(`   - ${user.email} (${user.firstname} ${user.lastname})`);
    });
    console.log('');

    const credentials = [];
    let successCount = 0;
    let errorCount = 0;

    // Créer chaque utilisateur d'authentification
    for (const user of users) {
      const result = await createAuthUser(user);
      if (result) {
        credentials.push(result);
        successCount++;
      } else {
        errorCount++;
      }
      
      // Petite pause pour éviter de surcharger l'API
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log('\n📊 Résumé:');
    console.log(`   ✅ Succès: ${successCount}`);
    console.log(`   ❌ Erreurs: ${errorCount}`);

    if (credentials.length > 0) {
      // Sauvegarder les credentials dans un fichier
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `user-credentials-${timestamp}.json`;
      
      const fs = require('fs');
      fs.writeFileSync(filename, JSON.stringify(credentials, null, 2));
      
      console.log(`\n💾 Credentials sauvegardés dans: ${filename}`);
      console.log('\n🔑 Credentials créés:');
      credentials.forEach(cred => {
        console.log(`   Email: ${cred.email}`);
        console.log(`   Mot de passe: ${cred.password}`);
        console.log(`   Auth ID: ${cred.auth_user_id}`);
        console.log('   ---');
      });
    }

  } catch (error) {
    console.error('❌ Erreur fatale:', error.message);
  }
}

// Exécuter le script
if (require.main === module) {
  main().then(() => {
    console.log('\n🎉 Script terminé !');
    process.exit(0);
  }).catch(error => {
    console.error('💥 Erreur fatale:', error);
    process.exit(1);
  });
}

module.exports = { createAuthUser, generatePassword };




