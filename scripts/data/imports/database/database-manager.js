/**
 * Gestionnaire de base de données pour l'import
 * 
 * Ce module utilise l'API Supabase existante (supabase-api-v2.ts) pour
 * insérer les données mappées dans la base de données.
 */

// Import de l'API existante
const { artisansApiV2, interventionsApiV2, clientsApi, documentsApi } = require('../../../src/lib/supabase-api-v2');

class DatabaseManager {
  constructor(options = {}) {
    this.options = {
      batchSize: options.batchSize || 50,
      dryRun: options.dryRun || false,
      verbose: options.verbose || false,
      ...options
    };
    
    this.stats = {
      artisans: { inserted: 0, errors: 0, skipped: 0 },
      interventions: { inserted: 0, errors: 0, skipped: 0 },
      clients: { inserted: 0, errors: 0, skipped: 0 },
      costs: { inserted: 0, errors: 0, skipped: 0 },
      artisanMetiers: { inserted: 0, errors: 0, skipped: 0 }
    };
  }

  // ===== INSERTION ARTISANS =====

  /**
   * Insère les artisans en lot
   * @param {Array} artisans - Tableau d'artisans mappés
   * @returns {Object} - Résultats d'insertion
   */
  async insertArtisans(artisans) {
    if (this.options.dryRun) {
      this.log(`[DRY-RUN] ${artisans.length} artisans seraient insérés`, 'info');
      return { success: artisans.length, errors: 0, skipped: 0 };
    }

    const results = {
      success: 0,
      errors: 0,
      skipped: 0,
      details: []
    };

    // Traitement par lots avec index global
    for (let batchStart = 0; batchStart < artisans.length; batchStart += this.options.batchSize) {
      const batch = artisans.slice(batchStart, batchStart + this.options.batchSize);
      const batchResults = await this.insertArtisanBatch(batch, batchStart);
      
      results.success += batchResults.success;
      results.errors += batchResults.errors;
      results.skipped += batchResults.skipped;
      results.details.push(...batchResults.details);
    }

    this.stats.artisans = results;
    return results;
  }

  async insertArtisanBatch(artisans, globalStartIndex = 0) {
    const results = {
      success: 0,
      errors: 0,
      skipped: 0,
      details: []
    };

    // Traitement individuel pour utiliser l'API existante
    for (let i = 0; i < artisans.length; i++) {
      const artisan = artisans[i];
      const globalIndex = globalStartIndex + i;
      
      try {
        if (this.options.dryRun) {
          results.success++;
          results.details.push({
            index: globalIndex,
            artisan: artisan,
            success: true,
            dryRun: true
          });
          this.log(`[DRY-RUN] Artisan ${globalIndex + 1}: ${artisan.prenom} ${artisan.nom}`, 'verbose');
        } else {
          // Utiliser la méthode upsert si activée
          if (this.options.upsert) {
            this.log(`🔄 Artisan ${globalIndex + 1}: Mode upsert pour ${artisan.prenom} ${artisan.nom}`, 'verbose');
            const apiResponse = await artisansApiV2.upsert(artisan);
            
            // Considérer comme succès si :
            // 1. apiResponse.success === true (format standard)
            // 2. apiResponse.id existe (format direct de l'Edge Function)
            // 3. Pas d'erreur explicite
            const isSuccess = apiResponse.success === true || 
                             (apiResponse.id && !apiResponse.error);
            
            if (isSuccess) {
              results.success++;
              // Récupérer les données selon le format de réponse
              const artisanData = apiResponse.data || apiResponse;
              results.details.push({
                index: globalIndex,
                artisan: artisanData,
                success: true,
                warnings: apiResponse.validation?.warnings || []
              });
              this.log(`✅ Artisan ${globalIndex + 1}: ${artisan.prenom} ${artisan.nom} (created - no email for upsert)`, 'verbose');
            } else {
              results.errors++;
              results.details.push({
                index: globalIndex,
                artisan: artisan,
                error: apiResponse.error || 'Erreur API',
                validation: apiResponse.validation
              });
              
              // Debug : afficher le contenu de l'artisan et la réponse API en cas d'erreur
              const artisanDebug = {
                prenom: artisan.prenom,
                nom: artisan.nom,
                email: artisan.email,
                telephone: artisan.telephone,
                telephone2: artisan.telephone2,
                raison_sociale: artisan.raison_sociale,
                siret: artisan.siret,
                statut_id: artisan.statut_id,
                gestionnaire_id: artisan.gestionnaire_id,
                metiers: artisan.metiers,
                zones: artisan.zones,
                // Ajouter tous les autres champs pour debug complet
                ...artisan
              };
              
              this.log(`❌ Erreur artisan ${globalIndex + 1}: ${apiResponse.error || 'Erreur API'}`, 'error');
              this.log(`🔍 [DEBUG] Artisan ${globalIndex + 1} contenu: ${JSON.stringify(artisanDebug, null, 2)}`, 'error');
              this.log(`🔍 [DEBUG] API Response: ${JSON.stringify(apiResponse, null, 2)}`, 'error');
            }
          } else {
            // Utiliser upsert si l'option est activée et email présent, sinon créer normalement
            const apiResponse = this.options.upsert 
              ? await artisansApiV2.upsert(artisan)
              : await artisansApiV2.create(artisan);
            
            // Considérer comme succès si :
            // 1. apiResponse.success === true (format standard)
            // 2. apiResponse.id existe (format direct de l'Edge Function)
            // 3. Pas d'erreur explicite
            const isSuccess = apiResponse.success === true || 
                             (apiResponse.id && !apiResponse.error);
            
            if (isSuccess) {
              results.success++;
              // Récupérer les données selon le format de réponse
              const artisanData = apiResponse.data || apiResponse;
              results.details.push({
                index: globalIndex,
                artisan: artisanData,
                success: true,
                warnings: apiResponse.validation?.warnings || []
              });
              const operation = this.options.upsert ? 'upserted' : 'created';
              this.log(`✅ Artisan ${globalIndex + 1}: ${artisan.prenom} ${artisan.nom} (${operation})`, 'verbose');
            } else {
              results.errors++;
              results.details.push({
                index: globalIndex,
                artisan: artisan,
                error: apiResponse.error || 'Erreur API',
                validation: apiResponse.validation
              });
              
              // Debug : afficher le contenu de l'artisan et la réponse API en cas d'erreur
              const artisanDebug = {
                prenom: artisan.prenom,
                nom: artisan.nom,
                email: artisan.email,
                telephone: artisan.telephone,
                telephone2: artisan.telephone2,
                raison_sociale: artisan.raison_sociale,
                siret: artisan.siret,
                statut_id: artisan.statut_id,
                gestionnaire_id: artisan.gestionnaire_id,
                metiers: artisan.metiers,
                zones: artisan.zones,
                // Ajouter tous les autres champs pour debug complet
                ...artisan
              };
              
              this.log(`❌ Erreur artisan ${globalIndex + 1}: ${apiResponse.error || 'Erreur API'}`, 'error');
              this.log(`🔍 [DEBUG] Artisan ${globalIndex + 1} contenu: ${JSON.stringify(artisanDebug, null, 2)}`, 'error');
              this.log(`🔍 [DEBUG] API Response: ${JSON.stringify(apiResponse, null, 2)}`, 'error');
            }
          }
        }
      } catch (error) {
        results.errors++;
        results.details.push({
          index: globalIndex,
          artisan: artisan,
          error: error.message
        });
        
        // Debug : afficher le contenu de l'artisan en cas d'erreur
        const artisanDebug = {
          prenom: artisan.prenom,
          nom: artisan.nom,
          email: artisan.email,
          telephone: artisan.telephone,
          telephone2: artisan.telephone2,
          raison_sociale: artisan.raison_sociale,
          siret: artisan.siret,
          statut_id: artisan.statut_id,
          gestionnaire_id: artisan.gestionnaire_id,
          metiers: artisan.metiers,
          zones: artisan.zones,
          // Ajouter tous les autres champs pour debug complet
          ...artisan
        };
        
        this.log(`❌ Erreur artisan ${globalIndex + 1}: ${error.message}`, 'error');
        this.log(`🔍 [DEBUG] Artisan ${globalIndex + 1} contenu: ${JSON.stringify(artisanDebug, null, 2)}`, 'error');
      }
    }

    if (results.success > 0) {
      this.log(`✅ ${results.success} artisans insérés`, 'success');
    }
    if (results.errors > 0) {
      this.log(`❌ ${results.errors} erreurs d'insertion`, 'error');
    }

    return results;
  }

  // ===== INSERTION INTERVENTIONS =====

  /**
   * Insère les interventions en lot
   * @param {Array} interventions - Tableau d'interventions mappées
   * @returns {Object} - Résultats d'insertion
   */
  async insertInterventions(interventions) {
    if (this.options.dryRun) {
      this.log(`[DRY-RUN] ${interventions.length} interventions seraient insérées`, 'info');
      return { success: interventions.length, errors: 0, skipped: 0 };
    }

    const results = {
      success: 0,
      errors: 0,
      skipped: 0,
      details: []
    };

    // Traitement par lots avec index global
    for (let i = 0; i < interventions.length; i += this.options.batchSize) {
      const batch = interventions.slice(i, i + this.options.batchSize);
      const batchResults = await this.insertInterventionBatch(batch, i);
      
      results.success += batchResults.success;
      results.errors += batchResults.errors;
      results.skipped += batchResults.skipped;
      results.details.push(...batchResults.details);
    }

    this.stats.interventions = results;
    return results;
  }

  async insertInterventionBatch(interventions, globalIndex = 0) {
    const results = {
      success: 0,
      errors: 0,
      skipped: 0,
      details: []
    };

    // Traitement individuel via l'API v2 avec index global
    for (let i = 0; i < interventions.length; i++) {
      const intervention = interventions[i];
      const currentGlobalIndex = globalIndex + i;
      
      try {
        let result;
        
        // Si mode upsert et id_inter présent, utiliser la méthode upsert
        if (this.options.upsert && intervention.id_inter) {
          this.log(`🔄 Intervention ${currentGlobalIndex + 1}: Mode upsert pour ${intervention.id_inter}`, 'verbose');
          result = await interventionsApiV2.upsert(intervention);
        } else {
          // Mode normal (id_inter absent ou upsert désactivé)
          result = await interventionsApiV2.create(intervention);
        }
        
        results.success++;
        results.details.push({
          index: currentGlobalIndex,
          intervention: result,
          success: true
        });
        this.log(`✅ Intervention ${currentGlobalIndex + 1} insérée: ${result.id_inter || result.id}`, 'verbose');
      } catch (error) {
        results.errors++;
        results.details.push({
          index: currentGlobalIndex,
          intervention: intervention,
          error: error.message
        });
        this.log(`❌ Erreur intervention ${currentGlobalIndex + 1}: ${error.message}`, 'error');
      }
    }

    this.log(`✅ ${results.success} interventions insérées, ${results.errors} erreurs, ${results.skipped} ignorées`, 'success');
    return results;
  }

  // ===== INSERTION CLIENTS =====

  /**
   * Insère les clients en lot
   * @param {Array} clients - Tableau de clients mappés
   * @returns {Object} - Résultats d'insertion
   */
  async insertClients(clients) {
    if (this.options.dryRun) {
      this.log(`[DRY-RUN] ${clients.length} clients seraient insérés`, 'info');
      return { success: clients.length, errors: 0, skipped: 0 };
    }

    const results = {
      success: 0,
      errors: 0,
      skipped: 0,
      details: []
    };

    // Traitement par lots
    for (let i = 0; i < clients.length; i += this.options.batchSize) {
      const batch = clients.slice(i, i + this.options.batchSize);
      const batchResults = await this.insertClientBatch(batch);
      
      results.success += batchResults.success;
      results.errors += batchResults.errors;
      results.skipped += batchResults.skipped;
      results.details.push(...batchResults.details);
    }

    this.stats.clients = results;
    return results;
  }

  async insertClientBatch(clients) {
    const results = {
      success: 0,
      errors: 0,
      skipped: 0,
      details: []
    };

    // Utiliser l'API v2 pour insérer les clients
    try {
      const apiResult = await clientsApi.insertClients(clients);
      results.success = apiResult.success;
      results.errors = apiResult.errors;
      results.details = apiResult.details;
      
      this.log(`✅ ${results.success} clients insérés, ${results.errors} erreurs`, 'success');
    } catch (error) {
      this.log(`Erreur fatale insertion clients: ${error.message}`, 'error');
      results.errors = clients.length;
      clients.forEach((client, index) => {
        results.details.push({
          index: index,
          client: client,
          error: error.message
        });
      });
    }

    return results;
  }

  // ===== INSERTION COÛTS D'INTERVENTION =====

  /**
   * Insère les coûts d'intervention en lot
   * @param {Array} costs - Tableau de coûts mappés
   * @returns {Object} - Résultats d'insertion
   */
  async insertInterventionCosts(costs) {
    if (this.options.dryRun) {
      this.log(`[DRY-RUN] ${costs.length} coûts seraient insérés`, 'info');
      return { success: costs.length, errors: 0, skipped: 0 };
    }

    const results = {
      success: 0,
      errors: 0,
      skipped: 0,
      details: []
    };

    // Traitement par lots
    for (let i = 0; i < costs.length; i += this.options.batchSize) {
      const batch = costs.slice(i, i + this.options.batchSize);
      const batchResults = await this.insertCostBatch(batch);
      
      results.success += batchResults.success;
      results.errors += batchResults.errors;
      results.skipped += batchResults.skipped;
      results.details.push(...batchResults.details);
    }

    this.stats.costs = results;
    return results;
  }

  async insertCostBatch(costs) {
    const results = {
      success: 0,
      errors: 0,
      skipped: 0,
      details: []
    };

    // Utiliser l'API v2 pour insérer les coûts
    try {
      const apiResult = await interventionsApiV2.insertInterventionCosts(costs);
      results.success = apiResult.success;
      results.errors = apiResult.errors;
      results.details = apiResult.details;
      
      this.log(`✅ ${results.success} coûts insérés, ${results.errors} erreurs`, 'success');
    } catch (error) {
      this.log(`Erreur fatale insertion coûts: ${error.message}`, 'error');
      results.errors = costs.length;
      costs.forEach((cost, index) => {
        results.details.push({
          index: index,
          cost: cost,
          error: error.message
        });
      });
    }

    return results;
  }

  // ===== INSERTION RELATIONS ARTISAN-MÉTIER =====

  /**
   * Insère les relations artisan-métier en lot
   * @param {Array} relations - Tableau de relations mappées
   * @returns {Object} - Résultats d'insertion
   */
  async insertArtisanMetiers(relations) {
    if (this.options.dryRun) {
      this.log(`[DRY-RUN] ${relations.length} relations artisan-métier seraient insérées`, 'info');
      return { success: relations.length, errors: 0, skipped: 0 };
    }

    const results = {
      success: 0,
      errors: 0,
      skipped: 0,
      details: []
    };

    // Traitement par lots
    for (let i = 0; i < relations.length; i += this.options.batchSize) {
      const batch = relations.slice(i, i + this.options.batchSize);
      const batchResults = await this.insertArtisanMetierBatch(batch);
      
      results.success += batchResults.success;
      results.errors += batchResults.errors;
      results.skipped += batchResults.skipped;
      results.details.push(...batchResults.details);
    }

    this.stats.artisanMetiers = results;
    return results;
  }

  async insertArtisanMetierBatch(relations) {
    const results = {
      success: 0,
      errors: 0,
      skipped: 0,
      details: []
    };

    // Utiliser l'API v2 pour insérer les relations artisan-métier
    try {
      const apiResult = await artisansApiV2.insertArtisanMetiers(relations);
      results.success = apiResult.success;
      results.errors = apiResult.errors;
      results.details = apiResult.details;
      
      this.log(`✅ ${results.success} relations artisan-métier insérées, ${results.errors} erreurs`, 'success');
    } catch (error) {
      this.log(`Erreur fatale insertion relations artisan-métier: ${error.message}`, 'error');
      results.errors = relations.length;
      relations.forEach((relation, index) => {
        results.details.push({
          index: index,
          relation: relation,
          error: error.message
        });
      });
    }

    return results;
  }

  // ===== MÉTHODES UTILITAIRES =====

  /**
   * Génère un rapport complet des statistiques
   * @returns {Object} - Rapport des statistiques
   */
  getStats() {
    const totalInserted = Object.values(this.stats).reduce((sum, stat) => sum + stat.inserted, 0);
    const totalErrors = Object.values(this.stats).reduce((sum, stat) => sum + stat.errors, 0);
    const totalSkipped = Object.values(this.stats).reduce((sum, stat) => sum + stat.skipped, 0);

    return {
      summary: {
        totalInserted,
        totalErrors,
        totalSkipped,
        successRate: totalInserted + totalErrors > 0 ? (totalInserted / (totalInserted + totalErrors)) * 100 : 0
      },
      details: this.stats
    };
  }

  /**
   * Génère un rapport formaté
   * @returns {string} - Rapport formaté
   */
  generateReport() {
    const stats = this.getStats();
    let report = `\n📊 RAPPORT D'INSERTION\n`;
    report += `========================\n`;
    report += `✅ Total inséré: ${stats.summary.totalInserted}\n`;
    report += `❌ Total erreurs: ${stats.summary.totalErrors}\n`;
    report += `⏭️  Total ignoré: ${stats.summary.totalSkipped}\n`;
    report += `📈 Taux de succès: ${stats.summary.successRate.toFixed(2)}%\n\n`;
    
    Object.keys(stats.details).forEach(type => {
      const stat = stats.details[type];
      report += `${type.toUpperCase()}:\n`;
      report += `  ✅ Insérés: ${stat.inserted}\n`;
      report += `  ❌ Erreurs: ${stat.errors}\n`;
      report += `  ⏭️  Ignorés: ${stat.skipped}\n\n`;
    });
    
    return report;
  }

  /**
   * Réinitialise les statistiques
   */
  resetStats() {
    this.stats = {
      artisans: { inserted: 0, errors: 0, skipped: 0 },
      interventions: { inserted: 0, errors: 0, skipped: 0 },
      clients: { inserted: 0, errors: 0, skipped: 0 },
      costs: { inserted: 0, errors: 0, skipped: 0 },
      artisanMetiers: { inserted: 0, errors: 0, skipped: 0 }
    };
  }

  /**
   * Insère les documents Drive pour un artisan
   * @param {Array} documents - Liste des documents à insérer
   * @returns {Promise<Object>} - Résultat de l'insertion
   */
  async insertDocuments(documents) {
    if (!documents || documents.length === 0) {
      return { success: 0, errors: 0, details: [] };
    }

    const results = {
      success: 0,
      errors: 0,
      details: []
    };

    for (const document of documents) {
      try {
        if (this.options.dryRun) {
          this.log(`🔍 [DRY-RUN] Document: ${document.filename} (${document.url})`, 'verbose');
          results.success++;
          results.details.push({
            document: document,
            success: true,
            dryRun: true
          });
        } else {
          // Appeler l'API pour créer le document
          const apiResponse = await artisansApiV2.createDocument(document);
          
          if (apiResponse.success === true || apiResponse.id) {
            results.success++;
            results.details.push({
              document: apiResponse.data || apiResponse,
              success: true
            });
            this.log(`✅ Document créé: ${document.filename}`, 'verbose');
          } else {
            results.errors++;
            results.details.push({
              document: document,
              error: apiResponse.error || 'Erreur API'
            });
            this.log(`❌ Erreur document: ${apiResponse.error || 'Erreur API'}`, 'error');
          }
        }
      } catch (error) {
        results.errors++;
        results.details.push({
          document: document,
          error: error.message
        });
        this.log(`❌ Erreur document: ${error.message}`, 'error');
      }
    }

    return results;
  }

  /**
   * Insère les métiers pour un artisan
   * @param {Array} metiers - Liste des métiers à insérer
   * @returns {Promise<Object>} - Résultat de l'insertion
   */
  async insertArtisanMetiers(metiers) {
    if (!metiers || metiers.length === 0) {
      return { success: 0, errors: 0, details: [] };
    }

    // Dédupliquer les métiers par artisan_id + metier_id
    const uniqueMetiers = [];
    const seenKeys = new Set();
    
    for (const metier of metiers) {
      const key = `${metier.artisan_id}-${metier.metier_id}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        uniqueMetiers.push(metier);
      } else {
        this.log(`⚠️ Métier dupliqué ignoré: ${metier.metier_id} pour artisan ${metier.artisan_id}`, 'verbose');
      }
    }

    if (uniqueMetiers.length === 0) {
      this.log('ℹ️ Aucun métier unique à insérer après déduplication', 'info');
      return { success: 0, errors: 0, details: [] };
    }

    const results = {
      success: 0,
      errors: 0,
      details: []
    };

    for (const metier of uniqueMetiers) {
      try {
        if (this.options.dryRun) {
          this.log(`🔍 [DRY-RUN] Métier: ${metier.metier_id} pour artisan ${metier.artisan_id}`, 'verbose');
          results.success++;
          results.details.push({
            metier: metier,
            success: true,
            dryRun: true
          });
        } else {
          // Appeler l'API pour créer l'association métier-artisan
          const apiResponse = await artisansApiV2.createArtisanMetier(metier);
          
          if (apiResponse.success === true || apiResponse.id) {
            results.success++;
            results.details.push({
              metier: apiResponse.data || apiResponse,
              success: true
            });
            this.log(`✅ Métier associé: ${metier.metier_id}`, 'verbose');
          } else {
            // Vérifier si c'est une erreur de contrainte de clé unique
            const errorMessage = apiResponse.error || 'Erreur API';
            if (errorMessage.includes('duplicate key value violates unique constraint')) {
              // En mode upsert, considérer comme succès car l'association existe déjà
              results.success++;
              results.details.push({
                metier: metier,
                success: true,
                skipped: true,
                reason: 'Association déjà existante'
              });
              this.log(`ℹ️ Métier déjà associé (ignoré): ${metier.metier_id}`, 'verbose');
            } else {
              results.errors++;
              results.details.push({
                metier: metier,
                error: errorMessage
              });
              this.log(`❌ Erreur métier: ${errorMessage}`, 'error');
            }
          }
        }
      } catch (error) {
        // Vérifier si c'est une erreur de contrainte de clé unique
        if (error.message.includes('duplicate key value violates unique constraint')) {
          // En mode upsert, considérer comme succès car l'association existe déjà
          results.success++;
          results.details.push({
            metier: metier,
            success: true,
            skipped: true,
            reason: 'Association déjà existante'
          });
          this.log(`ℹ️ Métier déjà associé (ignoré): ${metier.metier_id}`, 'verbose');
        } else {
          results.errors++;
          results.details.push({
            metier: metier,
            error: error.message
          });
          this.log(`❌ Erreur métier: ${error.message}`, 'error');
        }
      }
    }

    return results;
  }

  /**
   * Insère les zones pour un artisan
   * @param {Array} zones - Liste des zones à insérer
   * @returns {Promise<Object>} - Résultat de l'insertion
   */
  async insertArtisanZones(zones) {
    if (!zones || zones.length === 0) {
      return { success: 0, errors: 0, details: [] };
    }

    // Dédupliquer les zones par artisan_id + zone_id
    const uniqueZones = [];
    const seenKeys = new Set();
    
    for (const zone of zones) {
      const key = `${zone.artisan_id}-${zone.zone_id}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        uniqueZones.push(zone);
      } else {
        this.log(`⚠️ Zone dupliquée ignorée: ${zone.zone_id} pour artisan ${zone.artisan_id}`, 'verbose');
      }
    }

    if (uniqueZones.length === 0) {
      this.log('ℹ️ Aucune zone unique à insérer après déduplication', 'info');
      return { success: 0, errors: 0, details: [] };
    }

    const results = {
      success: 0,
      errors: 0,
      details: []
    };

    for (const zone of uniqueZones) {
      try {
        if (this.options.dryRun) {
          this.log(`🔍 [DRY-RUN] Zone: ${zone.zone_id} pour artisan ${zone.artisan_id}`, 'verbose');
          results.success++;
          results.details.push({
            zone: zone,
            success: true,
            dryRun: true
          });
        } else {
          // Appeler l'API pour créer l'association zone-artisan
          const apiResponse = await artisansApiV2.createArtisanZone(zone);
          
          if (apiResponse.success === true || apiResponse.id) {
            results.success++;
            results.details.push({
              zone: apiResponse.data || apiResponse,
              success: true
            });
            this.log(`✅ Zone associée: ${zone.zone_id}`, 'verbose');
          } else {
            // Vérifier si c'est une erreur de contrainte de clé unique
            const errorMessage = apiResponse.error || 'Erreur API';
            if (errorMessage.includes('duplicate key value violates unique constraint')) {
              // En mode upsert, considérer comme succès car l'association existe déjà
              results.success++;
              results.details.push({
                zone: zone,
                success: true,
                skipped: true,
                reason: 'Association déjà existante'
              });
              this.log(`ℹ️ Zone déjà associée (ignorée): ${zone.zone_id}`, 'verbose');
            } else {
              results.errors++;
              results.details.push({
                zone: zone,
                error: errorMessage
              });
              this.log(`❌ Erreur zone: ${errorMessage}`, 'error');
            }
          }
        }
      } catch (error) {
        // Vérifier si c'est une erreur de contrainte de clé unique
        if (error.message.includes('duplicate key value violates unique constraint')) {
          // En mode upsert, considérer comme succès car l'association existe déjà
          results.success++;
          results.details.push({
            zone: zone,
            success: true,
            skipped: true,
            reason: 'Association déjà existante'
          });
          this.log(`ℹ️ Zone déjà associée (ignorée): ${zone.zone_id}`, 'verbose');
        } else {
          results.errors++;
          results.details.push({
            zone: zone,
            error: error.message
          });
          this.log(`❌ Erreur zone: ${error.message}`, 'error');
        }
      }
    }

    return results;
  }

  /**
   * Méthode de logging
   * @param {string} message - Message à logger
   * @param {string} level - Niveau de log
   */
  log(message, level = 'info') {
    if (!this.options.verbose && level === 'verbose') return;
    
    const timestamp = new Date().toISOString();
    const prefix = `[DB-MANAGER]`;
    
    switch (level) {
      case 'error':
        console.error(`❌ ${prefix} ${message}`);
        break;
      case 'warn':
        console.warn(`⚠️  ${prefix} ${message}`);
        break;
      case 'success':
        console.log(`✅ ${prefix} ${message}`);
        break;
      case 'verbose':
        console.log(`🔍 ${prefix} ${message}`);
        break;
      default:
        console.log(`ℹ️  ${prefix} ${message}`);
    }
  }
}

module.exports = { DatabaseManager };
