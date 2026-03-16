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
   * Génère le rapport textuel — uniquement les échecs
   */
  generateTextReport() {
    this.generateExecutiveSummary();

    const s = this.reportData.summary;
    let report = `RAPPORT D'IMPORT GOOGLE SHEETS\n`;
    report += `==============================\n`;
    report += `Date : ${new Date(this.reportData.timestamp).toLocaleString('fr-FR')}\n`;
    report += `Mode : ${this.options.dryRun ? 'DRY-RUN' : 'PRODUCTION'}\n\n`;

    report += `RÉSUMÉ\n`;
    report += `------\n`;
    report += `Traités   : ${s.totalProcessed}\n`;
    report += `Erreurs   : ${s.totalErrors}\n`;
    report += `Warnings  : ${s.totalWarnings}\n\n`;

    report += this.generateErrorsSection();
    report += this.generateAddressIssuesSection();

    return report;
  }

  /**
   * Génère la section erreurs et warnings — toutes les lignes en échec
   */
  generateErrorsSection() {
    const artisanErrors = this.reportData.errors.artisans;
    const interventionErrors = this.reportData.errors.interventions;
    const warnings = [
      ...this.reportData.warnings.artisans,
      ...this.reportData.warnings.interventions
    ];

    const hasErrors = artisanErrors.length > 0 || interventionErrors.length > 0;
    const hasWarnings = warnings.length > 0;

    if (!hasErrors && !hasWarnings) {
      return `ERREURS\n-------\nAucune erreur.\n\n`;
    }

    let section = '';

    if (artisanErrors.length > 0) {
      section += `ERREURS ARTISANS (${artisanErrors.length})\n`;
      section += `-`.repeat(30) + `\n`;
      artisanErrors.forEach((error, i) => {
        const lineRef = error.row ? `ligne ${error.row}` : `ligne ${(error.index ?? i) + 1}`;
        const label = error.data
          ? `${error.data.prenom || ''} ${error.data.nom || error.data.raison_sociale || ''}`.trim() || lineRef
          : lineRef;
        section += `${i + 1}. [${label}] ${error.error || error.reason || JSON.stringify(error)}\n`;
      });
      section += `\n`;
    }

    if (interventionErrors.length > 0) {
      section += `ERREURS INTERVENTIONS (${interventionErrors.length})\n`;
      section += `-`.repeat(30) + `\n`;
      interventionErrors.forEach((error, i) => {
        const lineRef = error.row ? `ligne ${error.row}` : `ligne ${(error.index ?? i) + 1}`;
        const label = error.identifier
          ? error.identifier
          : error.data?.id_inter
            ? `id_inter=${error.data.id_inter}`
            : lineRef;
        section += `${i + 1}. [${label}] ${error.error || error.reason || JSON.stringify(error)}\n`;
        // Inclure un extrait CSV pour les erreurs de validation
        if (error.csvSample) {
          const sample = this._formatCsvSample(error.csvSample);
          section += `     CSV: ${sample}\n`;
        }
      });
      section += `\n`;
    }

    if (hasWarnings) {
      section += `WARNINGS (${warnings.length})\n`;
      section += `-`.repeat(30) + `\n`;
      warnings.forEach((w, i) => {
        const context = w.idInter ? `[${w.idInter}]` : w.row ? `[ligne ${w.row}]` : '';
        const typeTag = w.type ? `(${w.type}) ` : '';
        section += `${i + 1}. ${context} ${typeTag}${w.error || w.reason || JSON.stringify(w)}\n`;
      });
      section += `\n`;
    }

    return section;
  }

  /**
   * Formate un extrait CSV lisible pour le rapport (champs clés uniquement)
   */
  _formatCsvSample(csvRow) {
    const keyFields = ['ID', 'Date', 'Agence', 'Adresse', 'Statut', 'Contexte d\'intervention', 'Métier', 'Gest.', 'Artisan', 'Locataire'];
    const parts = [];
    for (const key of keyFields) {
      const val = csvRow[key];
      if (val && String(val).trim()) {
        parts.push(`${key}="${String(val).trim().substring(0, 50)}"`);
      }
    }
    return parts.length > 0 ? `{ ${parts.join(', ')} }` : '(données CSV vides)';
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
   * Sauvegarde le rapport JSON — uniquement les échecs
   */
  async saveJsonReport() {
    try {
      const filename = `import-report-${this.timestamp}.json`;
      const filepath = path.join(this.options.outputDir, filename);

      const failuresOnly = {
        timestamp: this.reportData.timestamp,
        summary: {
          totalProcessed: this.reportData.summary.totalProcessed,
          totalErrors: this.reportData.summary.totalErrors,
          totalWarnings: this.reportData.summary.totalWarnings,
        },
        errors: this.reportData.errors,
        warnings: this.reportData.warnings,
      };

      fs.writeFileSync(filepath, JSON.stringify(failuresOnly, null, 2), 'utf8');
      console.log(`📊 Rapport JSON sauvegardé: ${filepath}`);

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
