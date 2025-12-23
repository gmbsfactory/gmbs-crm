const {
  artisansApi,
  interventionsApi,
  documentsApi,
  tenantsApi,
  ownersApi,
} = require("../../../src/lib/api/v2");
const { dataValidator } = require("../../data-processing/data-validator");

// Créer un client Supabase pour les insertions directes (évite les Edge Functions)
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabaseClient = null;
if (supabaseUrl && supabaseServiceKey) {
  supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
}

class DatabaseManager {
  constructor(options = {}) {
    this.options = {
      dryRun: false,
      upsert: false,
      batchSize: 50,
      verbose: false,
      ...options,
    };

    // Référence au DataMapper pour les opérations de mapping
    this.dataMapper = options.dataMapper || null;

    // Cache des artisans pour la recherche par email
    this.artisansCache = null;
    
    // Client Supabase authentifié (sera initialisé lors de l'authentification)
    this.authenticatedClient = null;
  }

  log(message, level = "info") {
    if (level === "verbose" && !this.options.verbose) return;
    const timestamp = new Date().toISOString();
    const prefix = level === "error" ? "❌" : level === "warning" ? "⚠️" : "✅";
    console.log(`${prefix} [DB-MANAGER] ${message}`);
  }

  /**
   * Authentifie un utilisateur pour les opérations d'import
   * @param {string} email - Email de l'utilisateur
   * @param {string} password - Mot de passe de l'utilisateur
   */
  async authenticateUser(email, password) {
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
      
      if (!supabaseUrl || !anonKey) {
        throw new Error('SUPABASE_URL et SUPABASE_ANON_KEY sont requis pour l\'authentification');
      }
      
      // Créer un client avec la clé anon pour l'authentification
      const authClient = createClient(supabaseUrl, anonKey, {
        auth: { persistSession: false }
      });
      
      // Authentifier l'utilisateur
      const { data: authData, error: authError } = await authClient.auth.signInWithPassword({
        email,
        password
      });
      
      if (authError) {
        throw new Error(`Erreur d'authentification: ${authError.message}`);
      }
      
      if (!authData.session) {
        throw new Error('Aucune session créée après authentification');
      }
      
      // Créer un nouveau client avec le token de session
      this.authenticatedClient = createClient(supabaseUrl, anonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        },
        global: {
          headers: {
            Authorization: `Bearer ${authData.session.access_token}`
          }
        }
      });
      
      // Définir la session manuellement
      await this.authenticatedClient.auth.setSession({
        access_token: authData.session.access_token,
        refresh_token: authData.session.refresh_token
      });
      
      this.log(`✅ Utilisateur authentifié: ${email}`, 'info');
      return true;
    } catch (error) {
      this.log(`❌ Erreur lors de l'authentification: ${error.message}`, 'error');
      throw error;
    }
  }

  // ===== MÉTHODES DE RÉSOLUTION DES RELATIONS =====

  /**
   * Trouve ou crée un tenant (locataire)
   * @param {Object} tenantData - {firstname, lastname, email, telephone}
   * @returns {string} - ID du tenant
   */
  async findOrCreateTenant(tenantData) {
    if (!tenantData || (!tenantData.email && !tenantData.telephone)) {
      throw new Error("Tenant requires email or telephone");
    }

    try {
      // Chercher d'abord par email
      if (tenantData.email) {
        const results = await tenantsApi.searchByEmail(tenantData.email);
        if (results && results.data && results.data.length > 0) {
          return results.data[0].id;
        }
      }

      // Chercher par téléphone
      if (tenantData.telephone) {
        const results = await tenantsApi.searchByPhone(tenantData.telephone);
        if (results && results.data && results.data.length > 0) {
          return results.data[0].id;
        }
      }

      // Créer si non trouvé
      const created = await tenantsApi.create({
        firstname: tenantData.firstname,
        lastname: tenantData.lastname,
        email: tenantData.email,
        telephone: tenantData.telephone,
        telephone2: tenantData.telephone2,
      });

      return created.id;
    } catch (error) {
      throw new Error(`Failed to find or create tenant: ${error.message}`);
    }
  }

  /**
   * Trouve ou crée un owner (propriétaire)
   * @param {Object} ownerData - {firstname, lastname, telephone, email}
   * @returns {string} - ID du owner
   */
  async findOrCreateOwner(ownerData) {
    if (!ownerData || !ownerData.telephone) {
      throw new Error("Owner requires telephone");
    }

    try {
      // Chercher par téléphone
      const results = await ownersApi.searchByPhone(ownerData.telephone);
      if (results && results.data && results.data.length > 0) {
        return results.data[0].id;
      }

      // Créer si non trouvé
      const created = await ownersApi.create({
        owner_firstname: ownerData.firstname,
        owner_lastname: ownerData.lastname,
        telephone: ownerData.telephone,
        email: ownerData.email,
      });

      return created.id;
    } catch (error) {
      throw new Error(`Failed to find or create owner: ${error.message}`);
    }
  }

  /**
   * Insère les coûts d'une intervention
   * @param {string} interventionId - ID de l'intervention
   * @param {Object} costsData - {sst, materiel, materielUrl, intervention, total, numeroSST}
   * @returns {Object} - {success, errors}
   */
  async insertCosts(interventionId, costsData) {
    const results = { success: 0, errors: 0, details: [] };

    if (!costsData || !interventionId) {
      this.log(
        `⚠️ insertCosts appelé sans données (interventionId: ${interventionId}, costsData: ${!!costsData})`,
        "verbose"
      );
      return results;
    }

    // Coût SST
    if (costsData.sst !== null && costsData.sst !== undefined) {
      try {
        await interventionsApi.addCost(interventionId, {
          cost_type: "sst",
          label: "Coût SST",
          amount: costsData.sst,
          currency: "EUR",
        });
        results.success++;
        this.log(`  ✓ Coût SST inséré: ${costsData.sst}€`, "verbose");
      } catch (error) {
        results.errors++;
        results.details.push({ type: "sst", error: error.message });
        this.log(`  ✗ Erreur coût SST: ${error.message}`, "warning");
      }
    }

    // Coût matériel (avec URL et numéro SST en metadata)
    if (costsData.materiel !== null && costsData.materiel !== undefined) {
      try {
        const metadata = {};
        if (costsData.materielUrl) metadata.url = costsData.materielUrl;
        if (costsData.numeroSST) metadata.numero_sst = costsData.numeroSST;

        await interventionsApi.addCost(interventionId, {
          cost_type: "materiel",
          label: "Coût Matériel",
          amount: costsData.materiel,
          currency: "EUR",
          metadata:
            Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : null,
        });
        results.success++;
        this.log(`  ✓ Coût matériel inséré: ${costsData.materiel}€`, "verbose");
      } catch (error) {
        results.errors++;
        results.details.push({ type: "materiel", error: error.message });
        this.log(`  ✗ Erreur coût matériel: ${error.message}`, "warning");
      }
    }

    // Coût intervention
    if (
      costsData.intervention !== null &&
      costsData.intervention !== undefined
    ) {
      try {
        await interventionsApi.addCost(interventionId, {
          cost_type: "intervention",
          label: "Coût Intervention",
          amount: costsData.intervention,
          currency: "EUR",
        });
        results.success++;
        this.log(
          `  ✓ Coût intervention inséré: ${costsData.intervention}€`,
          "verbose"
        );
      } catch (error) {
        results.errors++;
        results.details.push({ type: "intervention", error: error.message });
        this.log(`  ✗ Erreur coût intervention: ${error.message}`, "warning");
      }
    }

    // Marge (calculée)
    if (costsData.total !== null && costsData.total !== undefined) {
      try {
        await interventionsApi.addCost(interventionId, {
          cost_type: "marge",
          label: "Marge",
          amount: costsData.total,
          currency: "EUR",
        });
        results.success++;
        this.log(`  ✓ Marge insérée: ${costsData.total}€`, "verbose");
      } catch (error) {
        results.errors++;
        results.details.push({ type: "marge", error: error.message });
        this.log(`  ✗ Erreur marge: ${error.message}`, "warning");
      }
    }

    return results;
  }

  // ===== MÉTHODES D'INSERTION PAR LOTS =====

  async insertArtisanBatch(artisans, globalIndex = 0) {
    const results = {
      success: 0,
      errors: 0,
      details: [],
      withoutName: [], // Liste des artisans sans nom
    };

    for (let i = 0; i < artisans.length; i++) {
      const artisan = artisans[i];
      const currentGlobalIndex = globalIndex + i;

      // Vérifier si l'artisan a un nom - rejeter si absent
      const hasNoName = !artisan.nom || artisan.nom.trim() === '';
      if (hasNoName) {
        results.withoutName.push({
          index: currentGlobalIndex,
          artisan: artisan,
          prenom: artisan.prenom || '',
          telephone: artisan.telephone || '',
          email: artisan.email || '',
          raison_sociale: artisan.raison_sociale || '',
        });
        results.errors++;
        results.details.push({
          index: currentGlobalIndex,
          artisan: artisan,
          error: 'Artisan rejeté: nom manquant',
          skipped: true,
          withoutName: true,
        });
        this.log(
          `❌ Artisan ${currentGlobalIndex + 1} rejeté (sans nom): ${artisan.prenom || 'N/A'} (tél: ${artisan.telephone || 'N/A'})`,
          "warning"
        );
        continue; // Ne pas insérer cet artisan
      }

      if (this.options.dryRun) {
        results.success++;
        results.details.push({
          index: currentGlobalIndex,
          artisan: artisan,
          success: true,
          dryRun: true,
        });
        this.log(
          `[DRY-RUN] Artisan ${currentGlobalIndex + 1}: ${artisan.prenom} ${artisan.nom}`,
          "verbose"
        );
        
        // Afficher les métiers en mode dry-run
        if (artisan.metiers && artisan.metiers.length > 0) {
          this.log(
            `  → Métiers: ${artisan.metiers.map(m => m.metier_id).join(', ')}`,
            "verbose"
          );
        }
      } else {
        try {
          // Extraire les métiers avant l'upsert
          const metiersData = artisan.metiers || [];
          
          // Nettoyer les données temporaires avant l'upsert
          delete artisan.metiers;

          // Utiliser l'API V2 avec upsertDirect en passant le client authentifié
          const upsertedArtisan = await artisansApi.upsertDirect(
            artisan,
            this.authenticatedClient || supabaseClient
          );

          // Assigner les métiers après l'upsert
          if (metiersData.length > 0 && upsertedArtisan.id) {
            try {
              // Insérer directement dans la table artisan_metiers (évite les Edge Functions)
              // Utiliser le client authentifié si disponible
              const clientToUse = this.authenticatedClient || supabaseClient;
              
              if (clientToUse) {
                const metierInserts = metiersData.map(metier => ({
                  artisan_id: upsertedArtisan.id,
                  metier_id: metier.metier_id,
                  is_primary: metier.is_primary || false
                }));

                // Insérer chaque métier individuellement pour gérer les doublons
                let successCount = 0;
                let duplicateCount = 0;
                
                for (const metierInsert of metierInserts) {
                  const { error: metierError } = await clientToUse
                    .from('artisan_metiers')
                    .insert(metierInsert);

                  if (metierError) {
                    // Si erreur de duplicate key, c'est OK (déjà assigné)
                    if (metierError.message && (
                      metierError.message.includes('duplicate key') ||
                      metierError.message.includes('unique constraint') ||
                      metierError.code === '23505' // PostgreSQL unique violation
                    )) {
                      duplicateCount++;
                    } else {
                      this.log(
                        `  ⚠️ Erreur assignation métier ${metierInsert.metier_id}: ${metierError.message}`,
                        "warning"
                      );
                    }
                  } else {
                    successCount++;
                  }
                }
                
                if (successCount > 0) {
                  this.log(
                    `  → ${successCount} métier(s) assigné(s)${duplicateCount > 0 ? `, ${duplicateCount} déjà assigné(s)` : ''}`,
                    "verbose"
                  );
                } else if (duplicateCount > 0) {
                  this.log(`  ℹ️ Tous les métiers étaient déjà assignés`, "verbose");
                }
              } else {
                // Fallback: utiliser l'API (peut échouer si Edge Function n'existe pas)
                for (let j = 0; j < metiersData.length; j++) {
                  const metier = metiersData[j];
                  try {
                    await artisansApi.assignMetier(
                      upsertedArtisan.id,
                      metier.metier_id,
                      metier.is_primary || false
                    );
                    this.log(
                      `  → Métier assigné: ${metier.metier_id}${metier.is_primary ? ' (principal)' : ''}`,
                      "verbose"
                    );
                  } catch (error) {
                    // Ignorer les doublons (contrainte unique)
                    if (
                      error.message &&
                      (error.message.includes("duplicate key value violates unique constraint") ||
                       error.message.includes("NOT_FOUND"))
                    ) {
                      this.log(`  ℹ️ Métier déjà assigné ou Edge Function non disponible: ${metier.metier_id}`, "verbose");
                    } else {
                      this.log(
                        `  ⚠️ Erreur assignation métier ${metier.metier_id}: ${error.message}`,
                        "warning"
                      );
                    }
                  }
                }
              }
            } catch (error) {
              this.log(
                `  ⚠️ Erreur lors de l'assignation des métiers: ${error.message}`,
                "warning"
              );
            }
          }

          results.success++;
          results.details.push({
            index: currentGlobalIndex,
            artisan: upsertedArtisan,
            success: true,
          });
          this.log(
            `✅ Artisan ${currentGlobalIndex + 1}: ${artisan.prenom} ${artisan.nom}`,
            "verbose"
          );
        } catch (error) {
          results.errors++;

          // Améliorer le message d'erreur
          let errorMessage = error.message || "Erreur lors de l'insertion";

          results.details.push({
            index: currentGlobalIndex,
            artisan: artisan,
            error: errorMessage,
          });
          this.log(
            `❌ Erreur artisan ${currentGlobalIndex + 1}: ${errorMessage}`,
            "error"
          );
        }
      }
    }

    return results;
  }

  async insertInterventionBatch(interventions, globalIndex = 0) {
    const results = {
      success: 0,
      errors: 0,
      details: [],
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
          dryRun: true,
        });
        this.log(
          `[DRY-RUN] Intervention ${currentGlobalIndex + 1}: ${
            intervention.id_inter
          }`,
          "verbose"
        );
      } else {
        // Validation avec InterventionValidator
        const validation = dataValidator.validate(intervention, "intervention");

        if (!validation.isValid) {
          this.log(
            `⚠️ Intervention ${
              currentGlobalIndex + 1
            } ignorée: ${validation.errors.join(", ")}`,
            "warning"
          );

          results.errors++;
          results.details.push({
            index: currentGlobalIndex,
            intervention: intervention,
            error: `Validation échouée: ${validation.errors.join(", ")}`,
            skipped: true,
          });

          continue; // Passer à l'intervention suivante
        }

        // Afficher les warnings (non bloquants)
        if (validation.warnings && validation.warnings.length > 0) {
          this.log(
            `  ℹ️ Warnings: ${validation.warnings.join(", ")}`,
            "verbose"
          );
        }

        try {
          // Extraire les données complémentaires
          const tenantData = intervention.tenant;
          const ownerData = intervention.owner;
          const artisanSSTId = intervention.artisanSST;
          
          // Sauvegarder les coûts formatés avant leur suppression (déjà formatés par mapInterventionFromCSV)
          const formattedCosts = intervention.costs || [];

          // Résoudre les relations (find or create)
          if (tenantData && (tenantData.email || tenantData.telephone)) {
            try {
              intervention.tenant_id = await this.findOrCreateTenant(tenantData);
              this.log(`  → Tenant lié: ${intervention.tenant_id}`, "verbose");
            } catch (error) {
              this.log(`  ⚠️ Erreur tenant: ${error.message}`, "warning");
            }
          }

          if (ownerData && ownerData.telephone) {
            try {
              intervention.owner_id = await this.findOrCreateOwner(ownerData);
              this.log(`  → Owner lié: ${intervention.owner_id}`, "verbose");
            } catch (error) {
              this.log(`  ⚠️ Erreur owner: ${error.message}`, "warning");
            }
          }

          // Nettoyer les données temporaires avant l'upsert
          delete intervention.tenant;
          delete intervention.owner;
          delete intervention.costs; // Coûts déjà sauvegardés dans formattedCosts
          delete intervention.artisanSST;
          delete intervention._originalCSVRow;

          // Valider la date : si invalide, loguer mais NE PAS modifier/interrompre le process
          const DEFAULT_INVALID_DATE = "2000-01-01T00:00:00Z";
          const isDateValid = intervention.date && 
            intervention.date !== DEFAULT_INVALID_DATE &&
            new Date(intervention.date).getFullYear() > 2000;

          if (!isDateValid) {
            // N'interrompt pas le process, utilise simplement ce qui est fourni
            const logMsg = `INVALID DATE database-manager-v2: intervention id: ${intervention.id_inter || intervention.id || "N/A"} raw date: ${intervention.date}`;
            console.log(logMsg);
            // On log dans un fichier 'log-database-manager-intervention'
            try {
              const fs = require("fs");
              fs.appendFileSync(
                "log-database-manager-intervention.txt",
                logMsg + "\n"
              );
            } catch (e) {
              // Ignore erreur d'écriture (pour les environnements qui n'ont pas accès au disque)
            }
          }

          if (!isDateValid) {
            // Utiliser la date du jour si la date du CSV n'est pas valide
            intervention.date = new Date().toISOString();
            this.log(`  ⚠️ Date invalide, utilisation de la date du jour`, "verbose");
          }

          // Créer l'intervention
          const upsertedIntervention = await interventionsApi.upsertDirect(
            intervention
          );

          // Assigner l'artisan SST (si trouvé)
          if (artisanSSTId && upsertedIntervention.id) {
            try {
              await interventionsApi.assignArtisan(
                upsertedIntervention.id,
                artisanSSTId,
                "primary"
              );
              this.log(`  → Artisan SST assigné`, "verbose");
            } catch (error) {
              // Ignorer les doublons
              if (
                error.message &&
                error.message.includes(
                  "duplicate key value violates unique constraint"
                )
              ) {
                this.log(`  ℹ️ Artisan SST déjà assigné`, "verbose");
              } else {
                this.log(
                  `  ⚠️ Erreur assignation artisan SST: ${error.message}`,
                  "warning"
                );
              }
            }
          }

          // Insérer les coûts formatés (déjà formatés par mapInterventionFromCSV)
          if (upsertedIntervention.id && formattedCosts && formattedCosts.length > 0) {
            try {
              // Ajouter intervention_id à chaque coût
              const costs = formattedCosts.map(cost => ({
                ...cost,
                intervention_id: upsertedIntervention.id
              }));
              
              // Utiliser insertInterventionCosts de l'API pour insérer tous les coûts en une fois
              const costsResult = await interventionsApi.insertInterventionCosts(costs);
              
              if (costsResult.success > 0) {
                this.log(`  ✓ ${costsResult.success} coût(s) inséré(s)`, "verbose");
              }
              if (costsResult.errors > 0) {
                this.log(`  ⚠️ ${costsResult.errors} erreur(s) lors de l'insertion des coûts`, "warning");
              }
            } catch (error) {
              this.log(`  ⚠️ Erreur coûts: ${error.message}`, "warning");
            }
          }

          results.success++;
          results.details.push({
            index: currentGlobalIndex,
            intervention: upsertedIntervention,
            success: true,
          });
          this.log(
            `✅ Intervention ${currentGlobalIndex + 1}: ${
              intervention.id_inter
            }`,
            "verbose"
          );
        } catch (error) {
          results.errors++;

          let errorMessage = error.message || "Erreur lors de l'insertion";

          results.details.push({
            index: currentGlobalIndex,
            intervention: intervention,
            error: errorMessage,
          });
          this.log(
            `❌ Erreur intervention ${currentGlobalIndex + 1}: ${errorMessage}`,
            "error"
          );
        }
      }
    }

    return results;
  }

  // ===== MÉTHODES PRINCIPALES D'INSERTION =====

  async insertArtisans(artisans) {
    this.log(`📥 Insertion de ${artisans.length} artisans...`, "info");

    const results = {
      success: 0,
      errors: 0,
      details: [],
      withoutName: [], // Liste consolidée des artisans sans nom
    };

    // Traitement par lots
    for (let i = 0; i < artisans.length; i += this.options.batchSize) {
      const batch = artisans.slice(i, i + this.options.batchSize);
      const batchResults = await this.insertArtisanBatch(batch, i);

      results.success += batchResults.success;
      results.errors += batchResults.errors;
      results.details.push(...batchResults.details);
      results.withoutName.push(...(batchResults.withoutName || []));

      this.log(
        `📊 Lot ${Math.floor(i / this.options.batchSize) + 1}: ${
          batchResults.success
        } succès, ${batchResults.errors} erreurs`,
        "info"
      );
    }

    // Afficher le rapport des artisans sans nom
    if (results.withoutName.length > 0) {
      this.log(
        `⚠️ ${results.withoutName.length} artisan(s) rejeté(s) car sans nom`,
        "warning"
      );
    }

    this.log(
      `✅ Insertion artisans terminée: ${results.success} succès, ${results.errors} erreurs`,
      "success"
    );
    return results;
  }

  async insertInterventions(interventions) {
    this.log(
      `📥 Insertion de ${interventions.length} interventions...`,
      "info"
    );

    const results = {
      success: 0,
      errors: 0,
      details: [],
    };

    // Traitement par lots
    for (let i = 0; i < interventions.length; i += this.options.batchSize) {
      const batch = interventions.slice(i, i + this.options.batchSize);
      const batchResults = await this.insertInterventionBatch(batch, i);

      results.success += batchResults.success;
      results.errors += batchResults.errors;
      results.details.push(...batchResults.details);

      this.log(
        `📊 Lot ${Math.floor(i / this.options.batchSize) + 1}: ${
          batchResults.success
        } succès, ${batchResults.errors} erreurs`,
        "info"
      );
    }

    this.log(
      `✅ Insertion interventions terminée: ${results.success} succès, ${results.errors} erreurs`,
      "success"
    );
    return results;
  }
}

module.exports = { DatabaseManager };
