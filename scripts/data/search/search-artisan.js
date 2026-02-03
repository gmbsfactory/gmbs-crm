#!/usr/bin/env node
/**
 * search-artisan.js — Search for an artisan in the database
 * Usage: node scripts/search-artisan.js "andre bertera"
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');

// Load environment variables
const envLocalPath = path.join(__dirname, '..', '.env.local');
const envPath = path.join(__dirname, '..', '.env');

if (fs.existsSync(envLocalPath)) {
  require('dotenv').config({ path: envLocalPath });
} else if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
}

// Get search query from command line
const searchQuery = process.argv[2] || 'andre bertera';

// Supabase configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not found in environment variables');
  console.error('Please make sure you have a .env.local or .env file with the required credentials');
  process.exit(1);
}

// Create Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function searchArtisan(query) {
  console.log('\n🔍 Recherche dans la base de données...');
  console.log(`   Requête: "${query}"\n`);
  
  try {
    // Split query into parts (e.g., "andre bertera" -> ["andre", "bertera"])
    const parts = query.toLowerCase().trim().split(/\s+/);
    
    // Search in multiple fields
    const { data, error } = await supabase
      .from('artisans')
      .select('*')
      .or(
        parts.map((part, i) => {
          // Search in prenom, nom, plain_nom, email, and raison_sociale
          return `prenom.ilike.%${part}%,nom.ilike.%${part}%,plain_nom.ilike.%${part}%,email.ilike.%${part}%,raison_sociale.ilike.%${part}%`;
        }).join(',')
      );
    
    if (error) {
      console.error('❌ Erreur lors de la recherche:', error.message);
      return;
    }
    
    if (!data || data.length === 0) {
      console.log('❌ Aucun artisan trouvé avec cette recherche\n');
      return;
    }
    
    // Filter results to ensure all parts match somewhere
    const filteredResults = data.filter(artisan => {
      const searchableText = [
        artisan.prenom,
        artisan.nom,
        artisan.plain_nom,
        artisan.email,
        artisan.raison_sociale
      ].join(' ').toLowerCase();
      
      return parts.every(part => searchableText.includes(part));
    });
    
    if (filteredResults.length === 0) {
      console.log('❌ Aucun artisan trouvé avec cette recherche\n');
      return;
    }
    
    console.log(`✅ ${filteredResults.length} artisan(s) trouvé(s):\n`);
    
    filteredResults.forEach((artisan, index) => {
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`Artisan #${index + 1}`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`ID: ${artisan.id}`);
      console.log(`Prénom: ${artisan.prenom || 'N/A'}`);
      console.log(`Nom: ${artisan.nom || 'N/A'}`);
      console.log(`Plain nom: ${artisan.plain_nom || 'N/A'}`);
      console.log(`Email: ${artisan.email || 'N/A'}`);
      console.log(`Téléphone: ${artisan.telephone || 'N/A'}`);
      console.log(`Téléphone 2: ${artisan.telephone2 || 'N/A'}`);
      console.log(`Raison sociale: ${artisan.raison_sociale || 'N/A'}`);
      console.log(`SIRET: ${artisan.siret || 'N/A'}`);
      console.log(`Département: ${artisan.departement || 'N/A'}`);
      console.log(`Adresse siège: ${artisan.adresse_siege_social || 'N/A'}`);
      console.log(`Ville siège: ${artisan.ville_siege_social || 'N/A'}`);
      console.log(`Code postal siège: ${artisan.code_postal_siege_social || 'N/A'}`);
      console.log(`Adresse intervention: ${artisan.adresse_intervention || 'N/A'}`);
      console.log(`Ville intervention: ${artisan.ville_intervention || 'N/A'}`);
      console.log(`Code postal intervention: ${artisan.code_postal_intervention || 'N/A'}`);
      console.log(`Numéro associé: ${artisan.numero_associe || 'N/A'}`);
      console.log(`Date ajout: ${artisan.date_ajout || 'N/A'}`);
      console.log(`Actif: ${artisan.is_active ? 'Oui' : 'Non'}`);
      console.log(`Créé le: ${artisan.created_at || 'N/A'}`);
      console.log(`Mis à jour le: ${artisan.updated_at || 'N/A'}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Erreur inattendue:', error.message);
  }
}

// Run the search
searchArtisan(searchQuery)
  .then(() => {
    console.log('✅ Recherche terminée\n');
  })
  .catch((error) => {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  });




