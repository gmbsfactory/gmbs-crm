#!/usr/bin/env node

/**
 * Script pour restaurer les utilisateurs d'authentification à partir d'un fichier de credentials
 * Ce script lit les credentials JSON et recrée les utilisateurs dans auth.users
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Configuration Supabase
const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});

/**
 * Crée un utilisateur d'authentification avec des credentials spécifiques
 */
async function createAuthUserWithCredentials(userData) {
  const { email, password, name, prenom, username } = userData;
  
  try {
    // Créer l'utilisateur dans auth.users via l'API Admin
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true, // Confirmer automatiquement l'email
      user_metadata: {
        name: name || 'Utilisateur',
        prenom: prenom || 'Utilisateur',
        username: username || email
      }
    });

    if (authError) {
      console.error(`❌ Erreur création auth user pour ${email}:`, authError.message);
      return null;
    }

    console.log(`✅ Utilisateur auth créé: ${email} (ID: ${authUser.user.id})`);

    // Mettre à jour public.users avec le nouvel auth_user_id
    const { error: updateError } = await supabase
      .from('users')
      .update({ auth_user_id: authUser.user.id })
      .eq('email', email);

    if (updateError) {
      console.error(`❌ Erreur mise à jour public.users pour ${email}:`, updateError.message);
    } else {
      console.log(`✅ Lien auth_user_id mis à jour pour ${email}`);
    }

    return {
      email,
      password,
      auth_user_id: authUser.user.id,
      name,
      prenom,
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
  console.log('🚀 Début de la restauration des utilisateurs d\'authentification...\n');

  // Chemin vers le fichier de credentials
  const credentialsFile = 'user-credentials-2025-09-17T23-26-42-341Z.json';
  const credentialsPath = path.join(process.cwd(), credentialsFile);

  try {
    // Vérifier que le fichier existe
    if (!fs.existsSync(credentialsPath)) {
      console.error(`❌ Fichier de credentials non trouvé: ${credentialsPath}`);
      return;
    }

    // Lire le fichier de credentials
    const credentialsData = fs.readFileSync(credentialsPath, 'utf8');
    const credentials = JSON.parse(credentialsData);

    if (!Array.isArray(credentials) || credentials.length === 0) {
      console.error('❌ Aucun credential valide trouvé dans le fichier');
      return;
    }

    console.log(`📋 ${credentials.length} utilisateur(s) à restaurer trouvé(s):`);
    credentials.forEach(user => {
      console.log(`   - ${user.email} (${user.name} ${user.prenom})`);
    });
    console.log('');

    const newCredentials = [];
    let successCount = 0;
    let errorCount = 0;

    // Créer chaque utilisateur d'authentification
    for (const user of credentials) {
      const result = await createAuthUserWithCredentials(user);
      if (result) {
        newCredentials.push(result);
        successCount++;
      } else {
        errorCount++;
      }
      
      // Petite pause pour éviter de surcharger l'API
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    console.log('\n📊 Résumé:');
    console.log(`   ✅ Succès: ${successCount}`);
    console.log(`   ❌ Erreurs: ${errorCount}`);

    if (newCredentials.length > 0) {
      // Sauvegarder les nouveaux credentials dans un fichier
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `user-credentials-restored-${timestamp}.json`;
      
      fs.writeFileSync(filename, JSON.stringify(newCredentials, null, 2));
      
      console.log(`\n💾 Nouveaux credentials sauvegardés dans: ${filename}`);
      console.log('\n🔑 Credentials restaurés:');
      newCredentials.forEach(cred => {
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
    console.log('\n🎉 Script de restauration terminé !');
    process.exit(0);
  }).catch(error => {
    console.error('💥 Erreur fatale:', error);
    process.exit(1);
  });
}

module.exports = { createAuthUserWithCredentials };
