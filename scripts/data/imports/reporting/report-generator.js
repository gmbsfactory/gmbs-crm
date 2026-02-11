/**
 * Générateur de rapports d'import amélioré
 * 
 * Ce module gère la génération de rapports détaillés pour l'import Google Sheets
 * avec logging des adresses difficiles à parser et statistiques complètes.
 */

const fs = require('fs');
const path = require('path');

class ReportGenerator {
  constructor(options = {}) {
    this.options = {
      outputDir: options.outputDir || './data/imports/processed',
      verbose: options.verbose || false,
      ...options
    };
    
    this.timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.reportData = {
      timestamp: new Date().toISOString(),
      summary: {},
      details: {
        artisans: { processed: 0, valid: 0, invalid: 0, inserted: 0, errors: 0, warnings: 0 },
        interventions: { processed: 0, valid: 0, invalid: 0, inserted: 0, errors: 0, warnings: 0 },
        clients: { processed: 0, valid: 0, invalid: 0, inserted: 0, errors: 0, warnings: 0 },
        costs: { processed: 0, valid: 0, invalid: 0, inserted: 0, errors: 0, warnings: 0 }
      },
      errors: {
        artisans: [],
        interventions: [],
        clients: [],
        costs: [],
        addressParsing: []
      },
      warnings: {
        artisans: [],
        interventions: [],
        clients: [],
        costs: []
      }
    };
  }

  // ===== LOGGING DES ADRESSES DIFFICILES =====

  /**
   * Log une adresse difficile à parser
   */
  logDifficultAddress(originalAddress, extractedData, interventionIndex) {
    const addressIssue = {
      index: interventionIndex,
      original: originalAddress,
      extracted: extractedData,
      issues: []
    };

    // Identifier les problèmes
    if (!extractedData.adresse) addressIssue.issues.push('Adresse manquante');
    if (!extractedData.ville) addressIssue.issues.push('Ville manquante');
    if (!extractedData.codePostal) addressIssue.issues.push('Code postal manquant');

    this.reportData.errors.addressParsing.push(addressIssue);
  }

  // ===== COLLECTE DES DONNÉES =====

  /**
   * Collecte les résultats de traitement des artisans
   */
  collectArtisanResults(results) {
    this.reportData.details.artisans = {
      processed: results.processed || 0,
      valid: results.valid || 0,
      invalid: results.invalid || 0,
      inserted: 0, // Sera mis à jour lors de l'insertion
      errors: results.errors?.length || 0,
      warnings: results.warnings?.length || 0
    };

    if (results.errors) {
      this.reportData.errors.artisans = results.errors;
    }

    if (results.warnings) {
      this.reportData.warnings.artisans = results.warnings;
    }
  }

  /**
   * Collecte les résultats de traitement des interventions
   */
  collectInterventionResults(results) {
    this.reportData.details.interventions = {
      processed: results.processed || 0,
      valid: results.valid || 0,
      invalid: results.invalid || 0,
      inserted: 0, // Sera mis à jour lors de l'insertion
      errors: results.errors?.length || 0,
      warnings: results.warnings?.length || 0
    };

    if (results.errors) {
      this.reportData.errors.interventions = results.errors;
    }

    if (results.warnings) {
      this.reportData.warnings.interventions = results.warnings;
    }
  }

  /**
   * Collecte les résultats d'insertion
   */
  collectInsertionResults(insertResults) {
    // Mettre à jour les statistiques d'insertion
    if (insertResults.artisans) {
      this.reportData.details.artisans.inserted = insertResults.artisans.success || 0;
      this.reportData.details.artisans.errors = insertResults.artisans.errors || 0;
    }

    if (insertResults.interventions) {
      this.reportData.details.interventions.inserted = insertResults.interventions.success || 0;
      this.reportData.details.interventions.errors = insertResults.interventions.errors || 0;
    }

    if (insertResults.clients) {
      this.reportData.details.clients.inserted = insertResults.clients.success || 0;
      this.reportData.details.clients.errors = insertResults.clients.errors || 0;
    }

    if (insertResults.costs) {
      this.reportData.details.costs.inserted = insertResults.costs.success || 0;
      this.reportData.details.costs.errors = insertResults.costs.errors || 0;
    }

    // Collecter les erreurs d'insertion détaillées
    this.collectInsertionErrors(insertResults);
  }

  /**
   * Collecte les erreurs d'insertion détaillées
   */
  collectInsertionErrors(insertResults) {
    // Erreurs d'insertion des artisans
    if (insertResults.artisans?.details) {
      const insertionErrors = insertResults.artisans.details.filter(detail => !detail.success);
      this.reportData.errors.artisans.push(...insertionErrors.map(error => ({
        type: 'insertion',
        index: error.index,
        error: error.error,
        data: error.artisan
      })));
    }

    // Erreurs d'insertion des interventions
    if (insertResults.interventions?.details) {
      const insertionErrors = insertResults.interventions.details.filter(detail => !detail.success);
      this.reportData.errors.interventions.push(...insertionErrors.map(error => ({
        type: 'insertion',
        index: error.index,
        error: error.error,
        data: error.intervention
      })));
    }

    // Erreurs d'insertion des clients
    if (insertResults.clients?.details) {
      const insertionErrors = insertResults.clients.details.filter(detail => !detail.success);
      this.reportData.errors.clients.push(...insertionErrors.map(error => ({
        type: 'insertion',
        index: error.index,
        error: error.error,
        data: error.client
      })));
    }

    // Erreurs d'insertion des coûts
    if (insertResults.costs?.details) {
      const insertionErrors = insertResults.costs.details.filter(detail => !detail.success);
      this.reportData.errors.costs.push(...insertionErrors.map(error => ({
        type: 'insertion',
        index: error.index,
        error: error.error,
        data: error.cost
      })));
    }
  }

  // ===== GÉNÉRATION DU RAPPORT =====

  /**
   * Génère le résumé exécutif
   */
  generateExecutiveSummary() {
    const details = this.reportData.details;
    
    const totalProcessed = details.artisans.processed + details.interventions.processed;
    const totalValid = details.artisans.valid + details.interventions.valid;
    const totalInserted = details.artisans.inserted + details.interventions.inserted;
    const totalErrors = details.artisans.errors + details.interventions.errors;
    const totalWarnings = details.artisans.warnings + details.interventions.warnings;

    this.reportData.summary = {
      totalProcessed,
      totalValid,
      totalInserted,
      totalErrors,
      totalWarnings,
      validationRate: totalProcessed > 0 ? ((totalValid / totalProcessed) * 100).toFixed(2) : 0,
      insertionRate: totalValid > 0 ? ((totalInserted / totalValid) * 100).toFixed(2) : 0,
      successRate: totalProcessed > 0 ? ((totalInserted / totalProcessed) * 100).toFixed(2) : 0
    };
  }

  /**
   * Génère le rapport textuel complet
   */
  generateTextReport() {
    this.generateExecutiveSummary();
    
    let report = `\n📊 RAPPORT D'IMPORT GOOGLE SHEETS - VERSION AMÉLIORÉE\n`;
    report += `========================================================\n`;
    report += `📅 Date: ${new Date(this.reportData.timestamp).toLocaleString('fr-FR')}\n`;
    report += `🔍 Mode: ${this.options.dryRun ? 'DRY-RUN' : 'PRODUCTION'}\n\n`;
    
    // Résumé exécutif
    report += this.generateExecutiveSummarySection();
    
    // Détails par type
    report += this.generateDetailsSection();
    
    // Erreurs et warnings
    report += this.generateErrorsSection();
    
    // Adresses difficiles à parser
    report += this.generateAddressIssuesSection();
    
    // Recommandations
    report += this.generateRecommendationsSection();
    
    return report;
  }

  /**
   * Génère la section résumé exécutif
   */
  generateExecutiveSummarySection() {
    const s = this.reportData.summary;
    
    let section = `🎯 RÉSUMÉ EXÉCUTIF\n`;
    section += `==================\n`;
    section += `📋 Total traité: ${s.totalProcessed}\n`;
    section += `✅ Données valides: ${s.totalValid} (${s.validationRate}%)\n`;
    section += `💾 Données insérées: ${s.totalInserted} (${s.insertionRate}%)\n`;
    section += `❌ Erreurs: ${s.totalErrors}\n`;
    section += `⚠️  Warnings: ${s.totalWarnings}\n`;
    section += `📊 Taux de succès global: ${s.successRate}%\n\n`;
    
    // Statut global
    if (s.successRate >= 95) {
      section += `🟢 STATUT: EXCELLENT - Import très réussi\n\n`;
    } else if (s.successRate >= 85) {
      section += `🟡 STATUT: BON - Import réussi avec quelques problèmes mineurs\n\n`;
    } else if (s.successRate >= 70) {
      section += `🟠 STATUT: MOYEN - Import partiellement réussi, attention requise\n\n`;
    } else {
      section += `🔴 STATUT: PROBLÉMATIQUE - Import avec de nombreux problèmes\n\n`;
    }
    
    return section;
  }

  /**
   * Génère la section détails par type
   */
  generateDetailsSection() {
    let section = `📋 DÉTAILS PAR TYPE\n`;
    section += `===================\n`;
    
    // Artisans
    const artisans = this.reportData.details.artisans;
    section += `\n👷 ARTISANS:\n`;
    section += `  📊 Traités: ${artisans.processed}\n`;
    section += `  ✅ Valides: ${artisans.valid} (${artisans.processed > 0 ? ((artisans.valid / artisans.processed) * 100).toFixed(1) : 0}%)\n`;
    section += `  💾 Insérés: ${artisans.inserted} (${artisans.valid > 0 ? ((artisans.inserted / artisans.valid) * 100).toFixed(1) : 0}%)\n`;
    section += `  ❌ Erreurs: ${artisans.errors}\n`;
    section += `  ⚠️  Warnings: ${artisans.warnings}\n`;
    
    // Interventions
    const interventions = this.reportData.details.interventions;
    section += `\n🔧 INTERVENTIONS:\n`;
    section += `  📊 Traitées: ${interventions.processed}\n`;
    section += `  ✅ Valides: ${interventions.valid} (${interventions.processed > 0 ? ((interventions.valid / interventions.processed) * 100).toFixed(1) : 0}%)\n`;
    section += `  💾 Insérées: ${interventions.inserted} (${interventions.valid > 0 ? ((interventions.inserted / interventions.valid) * 100).toFixed(1) : 0}%)\n`;
    section += `  ❌ Erreurs: ${interventions.errors}\n`;
    section += `  ⚠️  Warnings: ${interventions.warnings}\n`;
    
    // Clients
    const clients = this.reportData.details.clients;
    if (clients.inserted > 0) {
      section += `\n👥 CLIENTS:\n`;
      section += `  💾 Insérés: ${clients.inserted}\n`;
      section += `  ❌ Erreurs: ${clients.errors}\n`;
    }
    
    // Coûts
    const costs = this.reportData.details.costs;
    if (costs.inserted > 0) {
      section += `\n💰 COÛTS:\n`;
      section += `  💾 Insérés: ${costs.inserted}\n`;
      section += `  ❌ Erreurs: ${costs.errors}\n`;
    }
    
    section += `\n`;
    return section;
  }

  /**
   * Génère la section erreurs et warnings
   */
  generateErrorsSection() {
    let section = `❌ ERREURS ET WARNINGS\n`;
    section += `======================\n`;
    
    // Erreurs d'insertion
    const insertionErrors = this.reportData.errors.artisans.filter(e => e.type === 'insertion').length +
                           this.reportData.errors.interventions.filter(e => e.type === 'insertion').length +
                           this.reportData.errors.clients.filter(e => e.type === 'insertion').length +
                           this.reportData.errors.costs.filter(e => e.type === 'insertion').length;
    
    if (insertionErrors > 0) {
      section += `\n💾 ERREURS D'INSERTION EN BASE: ${insertionErrors}\n`;
      
      // Erreurs d'insertion des artisans
      const artisanInsertionErrors = this.reportData.errors.artisans.filter(e => e.type === 'insertion');
      if (artisanInsertionErrors.length > 0) {
        section += `  👷 Artisans (${artisanInsertionErrors.length}):\n`;
        artisanInsertionErrors.slice(0, 5).forEach((error, index) => {
          section += `    ${index + 1}. Ligne ${error.index + 1}: ${error.error}\n`;
        });
        if (artisanInsertionErrors.length > 5) {
          section += `    ... et ${artisanInsertionErrors.length - 5} autres erreurs\n`;
        }
      }
      
      // Erreurs d'insertion des interventions
      const interventionInsertionErrors = this.reportData.errors.interventions.filter(e => e.type === 'insertion');
      if (interventionInsertionErrors.length > 0) {
        section += `  🔧 Interventions (${interventionInsertionErrors.length}):\n`;
        interventionInsertionErrors.slice(0, 5).forEach((error, index) => {
          section += `    ${index + 1}. Ligne ${error.index + 1}: ${error.error}\n`;
        });
        if (interventionInsertionErrors.length > 5) {
          section += `    ... et ${interventionInsertionErrors.length - 5} autres erreurs\n`;
        }
      }
    }
    
    // Warnings
    const totalWarnings = this.reportData.warnings.artisans.length + this.reportData.warnings.interventions.length;
    if (totalWarnings > 0) {
      section += `\n⚠️  WARNINGS: ${totalWarnings}\n`;
      section += `  👷 Artisans: ${this.reportData.warnings.artisans.length}\n`;
      section += `  🔧 Interventions: ${this.reportData.warnings.interventions.length}\n`;
    }
    
    section += `\n`;
    return section;
  }

  /**
   * Génère la section problèmes d'adresses
   */
  generateAddressIssuesSection() {
    if (this.reportData.errors.addressParsing.length === 0) {
      return '';
    }
    
    let section = `🏠 PROBLÈMES D'EXTRACTION D'ADRESSES\n`;
    section += `====================================\n`;
    section += `📊 Total: ${this.reportData.errors.addressParsing.length} adresses difficiles\n\n`;
    
    // Statistiques des problèmes
    const issues = {
      missingAddress: 0,
      missingCity: 0,
      missingPostalCode: 0
    };
    
    this.reportData.errors.addressParsing.forEach(addr => {
      if (addr.issues.includes('Adresse manquante')) issues.missingAddress++;
      if (addr.issues.includes('Ville manquante')) issues.missingCity++;
      if (addr.issues.includes('Code postal manquant')) issues.missingPostalCode++;
    });
    
    section += `📈 RÉPARTITION DES PROBLÈMES:\n`;
    section += `  📍 Adresse manquante: ${issues.missingAddress}\n`;
    section += `  🏙️  Ville manquante: ${issues.missingCity}\n`;
    section += `  📮 Code postal manquant: ${issues.missingPostalCode}\n\n`;
    
    // Exemples
    section += `🔍 EXEMPLES (5 premiers):\n`;
    this.reportData.errors.addressParsing.slice(0, 5).forEach((addr, index) => {
      section += `  ${index + 1}. Ligne ${addr.index + 1}: ${addr.issues.join(', ')}\n`;
      section += `     Original: "${addr.original}"\n`;
      section += `     Extraite: Adresse="${addr.extracted.adresse || 'NULL'}", Ville="${addr.extracted.ville || 'NULL'}", CP="${addr.extracted.codePostal || 'NULL'}"\n\n`;
    });
    
    if (this.reportData.errors.addressParsing.length > 5) {
      section += `  ... et ${this.reportData.errors.addressParsing.length - 5} autres adresses difficiles\n`;
    }
    
    section += `\n`;
    return section;
  }

  /**
   * Génère la section recommandations
   */
  generateRecommendationsSection() {
    let section = `💡 RECOMMANDATIONS\n`;
    section += `==================\n`;
    
    const s = this.reportData.summary;
    
    if (s.successRate < 95) {
      section += `🔧 ACTIONS RECOMMANDÉES:\n`;
      
      if (s.validationRate < 90) {
        section += `  • Améliorer la qualité des données source (${s.validationRate}% de validation)\n`;
      }
      
      if (s.insertionRate < 95) {
        section += `  • Vérifier les erreurs d'insertion en base (${s.insertionRate}% d'insertion)\n`;
      }
      
      if (this.reportData.errors.addressParsing.length > 0) {
        section += `  • Revoir le format des adresses (${this.reportData.errors.addressParsing.length} problèmes détectés)\n`;
      }
      
      if (s.totalWarnings > 100) {
        section += `  • Corriger les warnings récurrents (${s.totalWarnings} warnings)\n`;
      }
    } else {
      section += `✅ Import très réussi ! Aucune action particulière requise.\n`;
    }
    
    section += `\n`;
    return section;
  }

  // ===== SAUVEGARDE DES FICHIERS =====

  /**
   * Sauvegarde le rapport principal
   */
  async saveMainReport(report) {
    try {
      // Créer le dossier s'il n'existe pas
      if (!fs.existsSync(this.options.outputDir)) {
        fs.mkdirSync(this.options.outputDir, { recursive: true });
      }
      
      const filename = `import-report-${this.timestamp}.txt`;
      const filepath = path.join(this.options.outputDir, filename);
      
      fs.writeFileSync(filepath, report, 'utf8');
      console.log(`📄 Rapport principal sauvegardé: ${filepath}`);
      
      return filepath;
    } catch (error) {
      console.error(`❌ Erreur sauvegarde rapport: ${error.message}`);
      throw error;
    }
  }

  /**
   * Sauvegarde le fichier des adresses difficiles
   */
  async saveAddressIssuesFile() {
    if (this.reportData.errors.addressParsing.length === 0) {
      return;
    }
    
    try {
      const filename = `address-parsing-issues-${this.timestamp}.json`;
      const filepath = path.join(this.options.outputDir, filename);
      
      const addressData = {
        timestamp: this.reportData.timestamp,
        total: this.reportData.errors.addressParsing.length,
        issues: this.reportData.errors.addressParsing
      };
      
      fs.writeFileSync(filepath, JSON.stringify(addressData, null, 2), 'utf8');
      console.log(`🏠 Fichier des adresses difficiles sauvegardé: ${filepath}`);
      
      return filepath;
    } catch (error) {
      console.error(`❌ Erreur sauvegarde adresses: ${error.message}`);
      throw error;
    }
  }

  /**
   * Sauvegarde le rapport JSON complet
   */
  async saveJsonReport() {
    try {
      const filename = `import-report-${this.timestamp}.json`;
      const filepath = path.join(this.options.outputDir, filename);
      
      fs.writeFileSync(filepath, JSON.stringify(this.reportData, null, 2), 'utf8');
      console.log(`📊 Rapport JSON complet sauvegardé: ${filepath}`);
      
      return filepath;
    } catch (error) {
      console.error(`❌ Erreur sauvegarde JSON: ${error.message}`);
      throw error;
    }
  }

  // ===== MÉTHODE PRINCIPALE =====

  /**
   * Génère et sauvegarde tous les rapports
   */
  async generateAndSaveReports() {
    console.log('📊 Génération des rapports...');
    
    try {
      // Générer le rapport textuel
      const textReport = this.generateTextReport();
      
      // Sauvegarder tous les fichiers
      const mainReportPath = await this.saveMainReport(textReport);
      const addressIssuesPath = await this.saveAddressIssuesFile();
      const jsonReportPath = await this.saveJsonReport();
      
      console.log('✅ Rapports générés avec succès !');
      
      return {
        mainReport: mainReportPath,
        addressIssues: addressIssuesPath,
        jsonReport: jsonReportPath,
        reportData: this.reportData
      };
      
    } catch (error) {
      console.error(`❌ Erreur génération rapports: ${error.message}`);
      throw error;
    }
  }
}

module.exports = { ReportGenerator };
