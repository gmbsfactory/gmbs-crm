#!/usr/bin/env node

/**
 * Script de Géocodage en Masse pour les Artisans
 *
 * Récupère tous les artisans qui ont une adresse mais pas de coordonnées,
 * utilise le service de géocodage pour obtenir les latitudes/longitudes,
 * et met à jour la base de données.
 *
 * Usage:
 *   node scripts/data/artisans/bulk-geocode-artisans.js [options]
 *
 * Options:
 *   --dry-run          Affiche ce qui serait fait sans modifier la base
 *   --verbose          Affichage détaillé
 *   --limit=N          Géocoder seulement N artisans (pour test)
 *   --batch-size=N     Nombre de requêtes parallèles (défaut: 5)
 *   --skip-cache       Ignore le cache de géocodage
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env.local') });

const { createClient } = require('@supabase/supabase-js');

class ArtisanBulkGeocoder {
  constructor(options = {}) {
    this.options = {
      dryRun: options.dryRun || false,
      verbose: options.verbose || false,
      limit: options.limit || null,
      batchSize: options.batchSize || 5,
      skipCache: options.skipCache || false,
      ...options
    };

    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    this.results = {
      total: 0,
      skipped: 0,
      geocoded: 0,
      failed: 0,
      errors: []
    };

    // Cache local des résultats de géocodage
    this.geocodeCache = new Map();
  }

  /**
   * Construit l'adresse complète pour le géocodage
   */
  buildFullAddress(artisan) {
    // Priorité : adresse d'intervention, sinon adresse du siège social
    const adresse = artisan.adresse_intervention || artisan.adresse_siege_social;
    const codePostal = artisan.code_postal_intervention || artisan.code_postal_siege_social;
    const ville = artisan.ville_intervention || artisan.ville_siege_social;

    const parts = [adresse, codePostal, ville];
    return parts.filter(p => p && p.trim()).join(' ');
  }

  /**
   * Utilise l'API Adresse France pour géocoder
   */
  async geocodeAddress(address) {
    if (!address || !address.trim()) {
      return null;
    }

    // Vérifier le cache local
    const cacheKey = address.toLowerCase();
    if (this.geocodeCache.has(cacheKey)) {
      return this.geocodeCache.get(cacheKey);
    }

    try {
      const response = await fetch(
        `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(address)}&limit=1`
      );

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      const data = await response.json();

      if (data.features && data.features.length > 0) {
        const feature = data.features[0];
        const [lng, lat] = feature.geometry.coordinates;
        const result = {
          latitude: parseFloat(lat.toFixed(6)),
          longitude: parseFloat(lng.toFixed(6)),
          score: feature.properties.score
        };

        this.geocodeCache.set(cacheKey, result);
        return result;
      }

      this.geocodeCache.set(cacheKey, null);
      return null;
    } catch (error) {
      if (this.options.verbose) {
        console.warn(`  ⚠️  Erreur géocodage pour "${address}":`, error.message);
      }
      return null;
    }
  }

  /**
   * Récupère les artisans sans coordonnées
   */
  async fetchArtisansWithoutCoordinates() {
    let query = this.supabase
      .from('artisans')
      .select('id, prenom, nom, adresse_intervention, code_postal_intervention, ville_intervention, adresse_siege_social, code_postal_siege_social, ville_siege_social, intervention_latitude, intervention_longitude')
      .is('intervention_latitude', null);

    if (this.options.limit) {
      query = query.limit(this.options.limit);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Erreur lors de la récupération des artisans: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Traite un lot d'artisans en parallèle
   */
  async processBatch(artisans) {
    const promises = artisans.map(async (artisan) => {
      const address = this.buildFullAddress(artisan);

      if (!address) {
        if (this.options.verbose) {
          console.log(`  ⊘ [${artisan.nom}] Pas d'adresse complète`);
        }
        this.results.skipped++;
        return null;
      }

      const coords = await this.geocodeAddress(address);

      if (!coords) {
        if (this.options.verbose) {
          console.log(`  ✗ [${artisan.nom}] Géocodage échoué: ${address}`);
        }
        this.results.failed++;
        this.results.errors.push({
          artisanId: artisan.id,
          nom: artisan.nom,
          address,
          reason: 'Adresse non trouvée'
        });
        return null;
      }

      if (this.options.verbose) {
        console.log(`  ✓ [${artisan.nom}] ${coords.latitude}, ${coords.longitude} (score: ${coords.score.toFixed(2)})`);
      }

      return {
        id: artisan.id,
        nom: artisan.nom,
        latitude: coords.latitude,
        longitude: coords.longitude
      };
    });

    return Promise.all(promises);
  }

  /**
   * Met à jour les artisans en base de données
   */
  async updateArtisans(geocodedArtisans) {
    const validResults = geocodedArtisans.filter(r => r !== null);

    if (validResults.length === 0) {
      return;
    }

    if (this.options.dryRun) {
      console.log(`  📋 [DRY RUN] Aurait mis à jour ${validResults.length} artisans`);
      return;
    }

    // Faire les updates un par un pour meilleur contrôle d'erreur
    for (const artisan of validResults) {
      const { error } = await this.supabase
        .from('artisans')
        .update({
          intervention_latitude: artisan.latitude,
          intervention_longitude: artisan.longitude
        })
        .eq('id', artisan.id);

      if (error) {
        this.results.failed++;
        this.results.errors.push({
          artisanId: artisan.id,
          nom: artisan.nom,
          reason: `Erreur update: ${error.message}`
        });
        console.error(`  ✗ Erreur update ${artisan.nom}: ${error.message}`);
      } else {
        this.results.geocoded++;
      }
    }
  }

  /**
   * Lance le géocodage en masse
   */
  async run() {
    console.log('\n🗺️  Géocodage en Masse des Artisans\n');
    console.log('⚙️  Configuration:');
    console.log(`   Dry Run: ${this.options.dryRun ? '✓' : '✗'}`);
    console.log(`   Verbose: ${this.options.verbose ? '✓' : '✗'}`);
    console.log(`   Limite: ${this.options.limit || 'Aucune'}`);
    console.log(`   Taille lot: ${this.options.batchSize}\n`);

    try {
      // Récupérer les artisans
      console.log('📋 Récupération des artisans sans coordonnées...');
      const artisans = await this.fetchArtisansWithoutCoordinates();
      this.results.total = artisans.length;

      if (artisans.length === 0) {
        console.log('✓ Tous les artisans ont des coordonnées!\n');
        return;
      }

      console.log(`   Trouvé ${artisans.length} artisans\n`);

      // Traiter par lots
      console.log(`🔄 Géocodage par lots (taille: ${this.options.batchSize})...\n`);

      for (let i = 0; i < artisans.length; i += this.options.batchSize) {
        const batch = artisans.slice(i, i + this.options.batchSize);
        const batchNum = Math.floor(i / this.options.batchSize) + 1;
        const totalBatches = Math.ceil(artisans.length / this.options.batchSize);

        console.log(`📦 Lot ${batchNum}/${totalBatches} (${batch.length} artisans):`);

        const geocodedBatch = await this.processBatch(batch);
        await this.updateArtisans(geocodedBatch);

        // Petit délai entre les lots pour respecter les rate limits
        if (i + this.options.batchSize < artisans.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      // Afficher les résultats
      this.printResults();

    } catch (error) {
      console.error('❌ Erreur:', error.message);
      process.exit(1);
    }
  }

  /**
   * Affiche les résultats finaux
   */
  printResults() {
    console.log('\n📊 Résultats:\n');
    console.log(`  Total artisans traités:     ${this.results.total}`);
    console.log(`  Géocodés avec succès:       ${this.results.geocoded} ✓`);
    console.log(`  Échoués:                    ${this.results.failed} ✗`);
    console.log(`  Ignorés (pas d'adresse):    ${this.results.skipped} ⊘`);

    if (this.results.errors.length > 0) {
      console.log('\n⚠️  Erreurs:\n');
      this.results.errors.forEach(err => {
        console.log(`  [${err.nom}]`);
        console.log(`    Raison: ${err.reason}`);
      });
    }

    console.log('\n✨ Géocodage terminé!\n');
  }
}

// Parse arguments
const args = process.argv.slice(2);
const options = {
  dryRun: args.includes('--dry-run'),
  verbose: args.includes('--verbose'),
  skipCache: args.includes('--skip-cache')
};

const limitArg = args.find(a => a.startsWith('--limit='));
if (limitArg) {
  options.limit = parseInt(limitArg.split('=')[1]);
}

const batchSizeArg = args.find(a => a.startsWith('--batch-size='));
if (batchSizeArg) {
  options.batchSize = parseInt(batchSizeArg.split('=')[1]);
}

// Lance le script
const geocoder = new ArtisanBulkGeocoder(options);
geocoder.run().catch(console.error);
