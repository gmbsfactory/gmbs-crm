const { artisansApiV2, interventionsApiV2, clientsApi, documentsApi } = require('../../../src/lib/supabase-api-v2');

class DatabaseManager {
  constructor(options = {}) {
    this.options = {
      dryRun: false,
      upsert: false,
      batchSize: 50,
      verbose: false,
      ...options
    };
  }

  log(message, level = 'info') {
    if (level === 'verbose' && !this.options.verbose) return;
    const timestamp = new Date().toISOString();
    const prefix = level === 'error' ? '❌' : level === 'warning' ? '⚠️' : '✅';
    console.log(`${prefix} [DB-MANAGER] ${message}`);
  }

  async insertArtisanBatch(artisans, globalIndex = 0) {
    const results = {
      success: 0,
      errors: 0,
      details: []
    };

    for (let i = 0; i < artisans.length; i++) {
      const artisan = artisans[i];
      const currentGlobalIndex = globalIndex + i;

      if (this.options.dryRun) {
        results.success++;
        results.details.push({
          index: currentGlobalIndex,
          artisan: artisan,
          success: true,
          dryRun: true
        });
        this.log(`[DRY-RUN] Artisan ${currentGlobalIndex + 1}: ${artisan.prenom} ${artisan.nom}`, 'verbose');
      } else {
        // L'API gère intelligemment l'upsert selon le contexte (email, SIRET, etc.)
        const apiResponse = await artisansApiV2.create(artisan);
        
        if (apiResponse.success) {
          results.success++;
          results.details.push({
            index: currentGlobalIndex,
            artisan: apiResponse.data,
            success: true,
            warnings: apiResponse.validation?.warnings || []
          });
          this.log(`✅ Artisan ${currentGlobalIndex + 1}: ${artisan.prenom} ${artisan.nom}`, 'verbose');
        } else {
          results.errors++;
          
          // Améliorer le message d'erreur pour les duplicate key
          let errorMessage = apiResponse.error || 'Erreur API';
          if (errorMessage.includes('duplicate key value violates unique constraint')) {
            if (errorMessage.includes('artisans_email_key')) {
              errorMessage = `Email '${artisan.email}' déjà existant (duplicate key)`;
            } else if (errorMessage.includes('artisans_siret_key')) {
              errorMessage = `SIRET '${artisan.siret}' déjà existant (duplicate key)`;
            } else {
              errorMessage = `Clé unique violée: ${errorMessage.split('"')[1] || 'contrainte inconnue'}`;
            }
          }
          
          results.details.push({
            index: currentGlobalIndex,
            artisan: artisan,
            error: errorMessage,
            validation: apiResponse.validation
          });
          this.log(`❌ Erreur artisan ${currentGlobalIndex + 1}: ${errorMessage}`, 'error');
        }
      }
    }

    return results;
  }

  async insertInterventionBatch(interventions, globalIndex = 0) {
    const results = {
      success: 0,
      errors: 0,
      details: []
    };

    for (let i = 0; i < interventions.length; i++) {
      const intervention = interventions[i];
      const currentGlobalIndex = globalIndex + i;

      if (this.options.dryRun) {
        results.success++;
        results.details.push({
          index: currentGlobalIndex,
          intervention: intervention,
          success: true,
          dryRun: true
        });
        this.log(`[DRY-RUN] Intervention ${currentGlobalIndex + 1}: ${intervention.id_inter || '(no id_inter)'}`, 'verbose');
      } else {
        try {
          // Utiliser upsert pour gérer création et mise à jour
          const result = await interventionsApiV2.upsert(intervention);
          
          results.success++;
          results.details.push({
            index: currentGlobalIndex,
            intervention: result,
            success: true
          });
          
          // Déterminer si c'est une création ou une mise à jour
          const operation = result.created_at === result.updated_at ? 'créée' : 'mise à jour';
          this.log(`✅ Intervention ${currentGlobalIndex + 1} ${operation}: ${result.id_inter || result.id}`, 'verbose');
        } catch (error) {
          // Améliorer le message d'erreur pour les duplicate key
          let errorMessage = error.message;
          let isDuplicateKey = false;
          
          if (error.message.includes('duplicate key value violates unique constraint')) {
            if (error.message.includes('interventions_id_inter_key')) {
              errorMessage = `ID intervention '${intervention.id_inter}' déjà existant - pas de mise à jour nécessaire`;
              isDuplicateKey = true;
            } else {
              errorMessage = `Clé unique violée: ${error.message.split('"')[1] || 'contrainte inconnue'}`;
            }
          }
          
          if (isDuplicateKey) {
            // Compter comme succès pour les interventions déjà présentes
            results.success++;
            results.details.push({
              index: currentGlobalIndex,
              intervention: intervention,
              success: true,
              message: errorMessage
            });
            this.log(`ℹ️ Intervention ${currentGlobalIndex + 1} déjà présente: ${intervention.id_inter}`, 'info');
          } else {
            // Vraie erreur
            results.errors++;
            results.details.push({
              index: currentGlobalIndex,
              intervention: intervention,
              error: errorMessage
            });
            this.log(`❌ Erreur intervention ${currentGlobalIndex + 1}: ${errorMessage}`, 'error');
          }
        }
      }
    }

    return results;
  }

  async insertArtisans(artisans) {
    const results = {
      inserted: 0,
      errors: 0,
      details: []
    };

    // Traiter par lots pour éviter les timeouts
    const batchSize = this.options.batchSize || 50;
    
    for (let i = 0; i < artisans.length; i += batchSize) {
      const batch = artisans.slice(i, i + batchSize);
      const batchResult = await this.insertArtisanBatch(batch, i);
      
      results.inserted += batchResult.success;
      results.errors += batchResult.errors;
      results.details.push(...batchResult.details);
      
      const logLevel = batchResult.errors > 0 ? 'error' : 'info';
      this.log(`📦 Lot ${Math.floor(i / batchSize) + 1}: ${batchResult.success} succès, ${batchResult.errors} erreurs`, logLevel);
    }

    return results;
  }

  async insertInterventions(interventions) {
    const results = {
      inserted: 0,
      errors: 0,
      details: []
    };

    // Traiter par lots pour éviter les timeouts
    const batchSize = this.options.batchSize || 50;
    
    for (let i = 0; i < interventions.length; i += batchSize) {
      const batch = interventions.slice(i, i + batchSize);
      const batchResult = await this.insertInterventionBatch(batch, i);
      
      results.inserted += batchResult.success;
      results.errors += batchResult.errors;
      results.details.push(...batchResult.details);
      
      const logLevel = batchResult.errors > 0 ? 'error' : 'info';
      this.log(`📦 Lot ${Math.floor(i / batchSize) + 1}: ${batchResult.success} succès, ${batchResult.errors} erreurs`, logLevel);
    }

    return results;
  }

  async insertClients(clients) {
    const results = {
      inserted: 0,
      errors: 0,
      details: []
    };

    // Traiter par lots pour éviter les timeouts
    const batchSize = this.options.batchSize || 50;
    
    for (let i = 0; i < clients.length; i += batchSize) {
      const batch = clients.slice(i, i + batchSize);
      const batchResult = await this.insertClientBatch(batch);
      
      results.inserted += batchResult.success;
      results.errors += batchResult.errors;
      results.details.push(...batchResult.details);
      
      const logLevel = batchResult.errors > 0 ? 'error' : 'info';
      this.log(`📦 Lot clients ${Math.floor(i / batchSize) + 1}: ${batchResult.success} succès, ${batchResult.errors} erreurs`, logLevel);
    }

    return results;
  }

  async insertClientBatch(clients) {
    if (this.options.dryRun) {
      return {
        success: clients.length,
        errors: 0,
        details: clients.map((client, index) => ({
          index,
          client,
          success: true,
          dryRun: true
        }))
      };
    }

    try {
      const result = await clientsApi.insertClients(clients);
      return {
        success: result.success,
        errors: result.errors,
        details: result.details.map((detail, index) => ({
          index,
          client: detail.client,
          success: detail.success,
          error: detail.error,
          data: detail.data
        }))
      };
    } catch (error) {
      return {
        success: 0,
        errors: clients.length,
        details: clients.map((client, index) => ({
          index,
          client,
          success: false,
          error: error.message
        }))
      };
    }
  }

  async insertInterventionCosts(costs) {
    if (this.options.dryRun) {
      return {
        success: costs.length,
        errors: 0,
        details: costs.map((cost, index) => ({
          index,
          cost,
          success: true,
          dryRun: true
        }))
      };
    }

    try {
      const result = await interventionsApiV2.insertInterventionCosts(costs);
      return {
        success: result.success ? costs.length : 0,
        errors: result.success ? 0 : costs.length,
        details: costs.map((cost, index) => ({
          index,
          cost,
          success: result.success,
          error: result.error
        }))
      };
    } catch (error) {
      return {
        success: 0,
        errors: costs.length,
        details: costs.map((cost, index) => ({
          index,
          cost,
          success: false,
          error: error.message
        }))
      };
    }
  }

  async insertArtisanMetiers(metiers) {
    if (this.options.dryRun) {
      return {
        success: metiers.length,
        errors: 0,
        details: metiers.map((metier, index) => ({
          index,
          metier,
          success: true,
          dryRun: true
        }))
      };
    }

    try {
      const result = await artisansApiV2.insertArtisanMetiers(metiers);
      return {
        success: result.success ? metiers.length : 0,
        errors: result.success ? 0 : metiers.length,
        details: metiers.map((metier, index) => ({
          index,
          metier,
          success: result.success,
          error: result.error
        }))
      };
    } catch (error) {
      return {
        success: 0,
        errors: metiers.length,
        details: metiers.map((metier, index) => ({
          index,
          metier,
          success: false,
          error: error.message
        }))
      };
    }
  }

  async insertArtisanZones(zones) {
    if (this.options.dryRun) {
      return {
        success: zones.length,
        errors: 0,
        details: zones.map((zone, index) => ({
          index,
          zone,
          success: true,
          dryRun: true
        }))
      };
    }

    try {
      const result = await artisansApiV2.insertArtisanZones(zones);
      return {
        success: result.success ? zones.length : 0,
        errors: result.success ? 0 : zones.length,
        details: zones.map((zone, index) => ({
          index,
          zone,
          success: result.success,
          error: result.error
        }))
      };
    } catch (error) {
      return {
        success: 0,
        errors: zones.length,
        details: zones.map((zone, index) => ({
          index,
          zone,
          success: false,
          error: error.message
        }))
      };
    }
  }

  async insertDocuments(documents) {
    if (this.options.dryRun) {
      return {
        success: documents.length,
        errors: 0,
        details: documents.map((doc, index) => ({
          index,
          document: doc,
          success: true,
          dryRun: true
        }))
      };
    }

    try {
      const result = await documentsApi.insertDocuments(documents);
      return {
        success: result.success ? documents.length : 0,
        errors: result.success ? 0 : documents.length,
        details: documents.map((doc, index) => ({
          index,
          document: doc,
          success: result.success,
          error: result.error
        }))
      };
    } catch (error) {
      return {
        success: 0,
        errors: documents.length,
        details: documents.map((doc, index) => ({
          index,
          document: doc,
          success: false,
          error: error.message
        }))
      };
    }
  }
}

module.exports = { DatabaseManager };
