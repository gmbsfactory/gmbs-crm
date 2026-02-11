/**
 * Requêtes SQL de vérification des données
 * 
 * Ce module contient des requêtes SQL pour vérifier l'intégrité
 * et la cohérence des données après import.
 */

class DataIntegrityChecker {
  constructor(supabaseClient) {
    this.supabase = supabaseClient;
  }

  // ===== VÉRIFICATIONS GÉNÉRALES =====

  /**
   * Vérifie les données manquantes critiques
   * @returns {Promise<Object>} - Résultats des vérifications
   */
  async checkMissingCriticalData() {
    const results = {
      artisans: {},
      interventions: {},
      clients: {},
      summary: {
        totalIssues: 0,
        criticalIssues: 0,
        warnings: 0
      }
    };

    // Artisans sans contact
    const { data: artisansNoContact } = await this.supabase
      .from('artisans')
      .select('id, prenom, nom, email, telephone')
      .is('email', null)
      .is('telephone', null);

    results.artisans.noContact = {
      count: artisansNoContact?.length || 0,
      data: artisansNoContact || [],
      severity: 'critical'
    };

    // Interventions sans adresse
    const { data: interventionsNoAddress } = await this.supabase
      .from('interventions')
      .select('id, id_inter, adresse, ville')
      .is('adresse', null)
      .is('ville', null);

    results.interventions.noAddress = {
      count: interventionsNoAddress?.length || 0,
      data: interventionsNoAddress || [],
      severity: 'warning'
    };

    // Interventions sans date
    const { data: interventionsNoDate } = await this.supabase
      .from('interventions')
      .select('id, id_inter, date')
      .is('date', null);

    results.interventions.noDate = {
      count: interventionsNoDate?.length || 0,
      data: interventionsNoDate || [],
      severity: 'critical'
    };

    // Calcul du résumé
    results.summary.criticalIssues = 
      results.artisans.noContact.count + 
      results.interventions.noDate.count;
    
    results.summary.warnings = 
      results.interventions.noAddress.count;
    
    results.summary.totalIssues = 
      results.summary.criticalIssues + results.summary.warnings;

    return results;
  }

  /**
   * Vérifie les références cassées (foreign keys)
   * @returns {Promise<Object>} - Résultats des vérifications
   */
  async checkBrokenReferences() {
    const results = {
      artisans: {},
      interventions: {},
      summary: {
        totalIssues: 0,
        criticalIssues: 0
      }
    };

    // Artisans avec gestionnaire inexistant
    const { data: artisansBadGestionnaire } = await this.supabase
      .from('artisans')
      .select(`
        id, prenom, nom, gestionnaire_id,
        users!gestionnaire_id(id, username)
      `)
      .not('gestionnaire_id', 'is', null)
      .is('users.id', null);

    results.artisans.badGestionnaire = {
      count: artisansBadGestionnaire?.length || 0,
      data: artisansBadGestionnaire || [],
      severity: 'critical'
    };

    // Artisans avec statut inexistant
    const { data: artisansBadStatut } = await this.supabase
      .from('artisans')
      .select(`
        id, prenom, nom, statut_id,
        artisan_statuses!statut_id(id, code)
      `)
      .not('statut_id', 'is', null)
      .is('artisan_statuses.id', null);

    results.artisans.badStatut = {
      count: artisansBadStatut?.length || 0,
      data: artisansBadStatut || [],
      severity: 'critical'
    };

    // Interventions avec agence inexistante
    const { data: interventionsBadAgence } = await this.supabase
      .from('interventions')
      .select(`
        id, id_inter, agence_id,
        agencies!agence_id(id, name)
      `)
      .not('agence_id', 'is', null)
      .is('agencies.id', null);

    results.interventions.badAgence = {
      count: interventionsBadAgence?.length || 0,
      data: interventionsBadAgence || [],
      severity: 'critical'
    };

    // Interventions avec statut inexistant
    const { data: interventionsBadStatut } = await this.supabase
      .from('interventions')
      .select(`
        id, id_inter, statut_id,
        intervention_statuses!statut_id(id, code)
      `)
      .not('statut_id', 'is', null)
      .is('intervention_statuses.id', null);

    results.interventions.badStatut = {
      count: interventionsBadStatut?.length || 0,
      data: interventionsBadStatut || [],
      severity: 'critical'
    };

    // Calcul du résumé
    results.summary.criticalIssues = 
      results.artisans.badGestionnaire.count +
      results.artisans.badStatut.count +
      results.interventions.badAgence.count +
      results.interventions.badStatut.count;
    
    results.summary.totalIssues = results.summary.criticalIssues;

    return results;
  }

  /**
   * Vérifie les doublons potentiels
   * @returns {Promise<Object>} - Résultats des vérifications
   */
  async checkDuplicates() {
    const results = {
      artisans: {},
      interventions: {},
      summary: {
        totalDuplicates: 0
      }
    };

    // Artisans avec même email
    const { data: artisansDuplicateEmail } = await this.supabase
      .rpc('find_duplicate_artisans_by_email');

    results.artisans.duplicateEmail = {
      count: artisansDuplicateEmail?.length || 0,
      data: artisansDuplicateEmail || [],
      severity: 'warning'
    };

    // Artisans avec même SIRET
    const { data: artisansDuplicateSiret } = await this.supabase
      .rpc('find_duplicate_artisans_by_siret');

    results.artisans.duplicateSiret = {
      count: artisansDuplicateSiret?.length || 0,
      data: artisansDuplicateSiret || [],
      severity: 'critical'
    };

    // Interventions avec même ID
    const { data: interventionsDuplicateId } = await this.supabase
      .rpc('find_duplicate_interventions_by_id');

    results.interventions.duplicateId = {
      count: interventionsDuplicateId?.length || 0,
      data: interventionsDuplicateId || [],
      severity: 'critical'
    };

    // Calcul du résumé
    results.summary.totalDuplicates = 
      results.artisans.duplicateEmail.count +
      results.artisans.duplicateSiret.count +
      results.interventions.duplicateId.count;

    return results;
  }

  /**
   * Vérifie la cohérence des données
   * @returns {Promise<Object>} - Résultats des vérifications
   */
  async checkDataConsistency() {
    const results = {
      interventions: {},
      summary: {
        totalIssues: 0,
        warnings: 0
      }
    };

    // Interventions avec date de fin avant date de début
    const { data: interventionsBadDates } = await this.supabase
      .from('interventions')
      .select('id, id_inter, date, date_termine')
      .not('date_termine', 'is', null)
      .lt('date_termine', 'date');

    results.interventions.badDates = {
      count: interventionsBadDates?.length || 0,
      data: interventionsBadDates || [],
      severity: 'warning'
    };

    // Interventions avec pourcentage SST incohérent
    const { data: interventionsBadSST } = await this.supabase
      .from('interventions')
      .select('id, id_inter, pourcentage_sst')
      .not('pourcentage_sst', 'is', null)
      .or('pourcentage_sst.lt.0,pourcentage_sst.gt.100');

    results.interventions.badSST = {
      count: interventionsBadSST?.length || 0,
      data: interventionsBadSST || [],
      severity: 'warning'
    };

    // Calcul du résumé
    results.summary.warnings = 
      results.interventions.badDates.count +
      results.interventions.badSST.count;
    
    results.summary.totalIssues = results.summary.warnings;

    return results;
  }

  // ===== VÉRIFICATIONS COMPLÈTES =====

  /**
   * Exécute toutes les vérifications
   * @returns {Promise<Object>} - Rapport complet
   */
  async runAllChecks() {
    console.log('🔍 Démarrage des vérifications d\'intégrité...');
    
    const startTime = Date.now();
    
    const [
      missingData,
      brokenRefs,
      duplicates,
      consistency
    ] = await Promise.all([
      this.checkMissingCriticalData(),
      this.checkBrokenReferences(),
      this.checkDuplicates(),
      this.checkDataConsistency()
    ]);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    const report = {
      timestamp: new Date().toISOString(),
      duration: `${duration}s`,
      checks: {
        missingData,
        brokenRefs,
        duplicates,
        consistency
      },
      summary: {
        totalIssues: 
          missingData.summary.totalIssues +
          brokenRefs.summary.totalIssues +
          duplicates.summary.totalDuplicates +
          consistency.summary.totalIssues,
        criticalIssues:
          missingData.summary.criticalIssues +
          brokenRefs.summary.criticalIssues +
          duplicates.artisans.duplicateSiret.count +
          duplicates.interventions.duplicateId.count,
        warnings:
          missingData.summary.warnings +
          consistency.summary.warnings +
          duplicates.artisans.duplicateEmail.count
      }
    };

    console.log(`✅ Vérifications terminées en ${duration}s`);
    console.log(`📊 Total: ${report.summary.totalIssues} problèmes (${report.summary.criticalIssues} critiques, ${report.summary.warnings} avertissements)`);

    return report;
  }

  /**
   * Génère un rapport formaté
   * @param {Object} report - Rapport de vérification
   * @returns {string} - Rapport formaté
   */
  generateReport(report) {
    let output = `\n🔍 RAPPORT DE VÉRIFICATION DES DONNÉES\n`;
    output += `========================================\n`;
    output += `📅 Date: ${new Date(report.timestamp).toLocaleString()}\n`;
    output += `⏱️  Durée: ${report.duration}\n\n`;
    
    output += `📊 RÉSUMÉ GLOBAL:\n`;
    output += `  Total problèmes: ${report.summary.totalIssues}\n`;
    output += `  🚨 Critiques: ${report.summary.criticalIssues}\n`;
    output += `  ⚠️  Avertissements: ${report.summary.warnings}\n\n`;

    // Données manquantes
    if (report.checks.missingData.summary.totalIssues > 0) {
      output += `🚨 DONNÉES MANQUANTES:\n`;
      if (report.checks.missingData.artisans.noContact.count > 0) {
        output += `  - ${report.checks.missingData.artisans.noContact.count} artisans sans contact\n`;
      }
      if (report.checks.missingData.interventions.noDate.count > 0) {
        output += `  - ${report.checks.missingData.interventions.noDate.count} interventions sans date\n`;
      }
      if (report.checks.missingData.interventions.noAddress.count > 0) {
        output += `  - ${report.checks.missingData.interventions.noAddress.count} interventions sans adresse\n`;
      }
      output += `\n`;
    }

    // Références cassées
    if (report.checks.brokenRefs.summary.totalIssues > 0) {
      output += `🔗 RÉFÉRENCES CASSÉES:\n`;
      if (report.checks.brokenRefs.artisans.badGestionnaire.count > 0) {
        output += `  - ${report.checks.brokenRefs.artisans.badGestionnaire.count} artisans avec gestionnaire inexistant\n`;
      }
      if (report.checks.brokenRefs.artisans.badStatut.count > 0) {
        output += `  - ${report.checks.brokenRefs.artisans.badStatut.count} artisans avec statut inexistant\n`;
      }
      if (report.checks.brokenRefs.interventions.badAgence.count > 0) {
        output += `  - ${report.checks.brokenRefs.interventions.badAgence.count} interventions avec agence inexistante\n`;
      }
      if (report.checks.brokenRefs.interventions.badStatut.count > 0) {
        output += `  - ${report.checks.brokenRefs.interventions.badStatut.count} interventions avec statut inexistant\n`;
      }
      output += `\n`;
    }

    // Doublons
    if (report.checks.duplicates.summary.totalDuplicates > 0) {
      output += `🔄 DOUBLONS DÉTECTÉS:\n`;
      if (report.checks.duplicates.artisans.duplicateEmail.count > 0) {
        output += `  - ${report.checks.duplicates.artisans.duplicateEmail.count} artisans avec même email\n`;
      }
      if (report.checks.duplicates.artisans.duplicateSiret.count > 0) {
        output += `  - ${report.checks.duplicates.artisans.duplicateSiret.count} artisans avec même SIRET\n`;
      }
      if (report.checks.duplicates.interventions.duplicateId.count > 0) {
        output += `  - ${report.checks.duplicates.interventions.duplicateId.count} interventions avec même ID\n`;
      }
      output += `\n`;
    }

    // Incohérences
    if (report.checks.consistency.summary.totalIssues > 0) {
      output += `⚠️  INCOHÉRENCES:\n`;
      if (report.checks.consistency.interventions.badDates.count > 0) {
        output += `  - ${report.checks.consistency.interventions.badDates.count} interventions avec dates incohérentes\n`;
      }
      if (report.checks.consistency.interventions.badSST.count > 0) {
        output += `  - ${report.checks.consistency.interventions.badSST.count} interventions avec pourcentage SST incohérent\n`;
      }
      output += `\n`;
    }

    if (report.summary.totalIssues === 0) {
      output += `🎉 Aucun problème détecté ! Les données sont cohérentes.\n`;
    } else {
      output += `💡 RECOMMANDATIONS:\n`;
      if (report.summary.criticalIssues > 0) {
        output += `  - Corriger les problèmes critiques avant de continuer\n`;
      }
      if (report.summary.warnings > 0) {
        output += `  - Examiner les avertissements pour améliorer la qualité des données\n`;
      }
    }

    return output;
  }
}

module.exports = { DataIntegrityChecker };
