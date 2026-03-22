'use strict';

/**
 * Système de mapping robuste entre données Google Sheets et base de données
 *
 * Ce module gère la transformation des données CSV vers le schéma de base de données
 * défini dans supabase/migrations/20251005_clean_schema.sql
 *
 * NOTE: Thin orchestrator — délègue à des modules spécialisés.
 */

const { ErrorLogger } = require('./error-logger');
const { EnumResolver } = require('./resolvers/enum-resolver');
const { EntityFinder } = require('./resolvers/entity-finder');
const { mapArtisanFromCSV } = require('./mappers/artisan-mapper');
const { mapInterventionFromCSV } = require('./mappers/intervention-mapper');
const { mapClientFromInterventionCSV } = require('./mappers/client-mapper');

// Re-export parsers for wrapper methods
const { cleanString, truncateString, cleanPhone, cleanEmail, cleanSiret, stripDigitsFromName, capitalizeFirstLetter } = require('./parsers/string-cleaner');
const { parseNumber, parseDate } = require('./parsers/date-number-parser');
const { normalizeColumnName, cleanCSVKeys, getCSVValue, getStatutValue, isValidRow, isDateLike } = require('./parsers/csv-parser');
const { extractAddress, extractInterventionAddress, extractDepartement, extractDepartementFromNamePrenom, extractInterventionId, extractDepartementWithPriority } = require('./parsers/address-parser');
const { extractNomPrenomStrict, shouldInvertNames, extractPrenom, extractNom, extractSecondPhone, extractPrenomProprietaire, extractNomProprietaire, extractNomClient, extractPrenomClient, parsePersonName } = require('./parsers/name-parser');
const { extractEmail, extractPhones, parseTenantInfo, parseOwnerInfo } = require('./parsers/person-parser');
const { extractCostsData, _validateCostsLimits, _calculateAndValidateMargin, _formatCostsForInsertion } = require('./extractors/cost-extractor');
const { validateArtisan } = require('./validators/artisan-validator');
const { validateIntervention } = require('./validators/intervention-validator');
const { mapMetiersFromCSV, mapZonesFromCSV, mapDocumentsFromCSV, extractDocumentNameFromUrl } = require('./mappers/artisan-mapper');

class DataMapper {
  constructor(options = {}) {
    this.errorLogger = new ErrorLogger(options);
    this.enumResolver = new EnumResolver();
    this.entityFinder = new EntityFinder({
      sstSearchDelay: 50,
      sstSearchTimeout: 5000,
      sstMaxVariants: 5,
      logParsingErrorFn: this.errorLogger.logParsingError.bind(this.errorLogger),
    });
    this.authenticatedClient = options.authenticatedClient || null;

    this.stats = {
      processed: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
      artisansProcessed: 0,
      artisansCreated: 0,
      artisansUpdated: 0,
      clientsProcessed: 0,
      clientsCreated: 0,
      clientsUpdated: 0,
      // Legacy stats used by google-sheets-import
      newArtisans: [],
      metiersCreated: 0,
      newMetiers: [],
      zonesCreated: 0,
      newZones: [],
      artisanStatusesCreated: 0,
      newArtisanStatuses: [],
      interventionStatusesCreated: 0,
      newInterventionStatuses: [],
      documentsCreated: 0,
      newDocuments: [],
    };

    this.verbose = options.verbose || false;
    this.importType = options.importType || 'unknown';

    // Expose cache for backward compat (read-only from callers)
    this.cache = this.enumResolver.cache;
  }

  // ===== ErrorLogger delegation =====
  initErrorLog() { return this.errorLogger.initErrorLog(); }
  logParsingError(idInter, reason, rawData, lineNumber) { return this.errorLogger.logParsingError(idInter, reason, rawData, lineNumber); }
  getErrorLogPath() { return this.errorLogger.getErrorLogPath(); }

  // ===== EnumResolver delegation (authenticatedClient passed automatically) =====
  async getAgencyId(name) { return this.enumResolver.getAgencyId(name, this.authenticatedClient); }
  async getUserId(name) { return this.enumResolver.getUserId(name, this.authenticatedClient); }
  async getUserIdNormalized(code, warningsAccumulator) { return this.enumResolver.getUserIdNormalized(code, this.authenticatedClient, warningsAccumulator); }
  async getMetierId(name) { return this.enumResolver.getMetierId(name, this.authenticatedClient); }
  async getZoneId(name) { return this.enumResolver.getZoneId(name, this.authenticatedClient); }
  async getArtisanStatusId(name) { return this.enumResolver.getArtisanStatusId(name, this.authenticatedClient); }
  async getArtisanStatusIdNormalized(label) { return this.enumResolver.getArtisanStatusIdNormalized(label, this.authenticatedClient); }
  async getInterventionStatusId(name) { return this.enumResolver.getInterventionStatusId(name, this.authenticatedClient); }
  async getInterventionStatusIdNormalized(label) { return this.enumResolver.getInterventionStatusIdNormalized(label, this.authenticatedClient); }
  normalizeMetierName(name) { return this.enumResolver.normalizeMetierName(name); }
  normalizeZoneName(name) { return this.enumResolver.normalizeZoneName(name); }

  // ===== EntityFinder delegation =====
  async findOrCreateTenant(tenantInfo) { return this.entityFinder.findOrCreateTenant(tenantInfo); }
  async findOrCreateOwner(ownerInfo) { return this.entityFinder.findOrCreateOwner(ownerInfo); }
  async findArtisanSST(sstName, idInter, csvRow, lineNumber) {
    return this.entityFinder.findArtisanSST(sstName, idInter, csvRow, lineNumber, null);
  }

  // ===== Mapper delegation =====
  async mapArtisanFromCSV(csvRow, lineNumber) {
    return mapArtisanFromCSV(csvRow, lineNumber, this.enumResolver, this.errorLogger, this.authenticatedClient);
  }

  async mapInterventionFromCSV(csvRow, verbose, lineNumber) {
    return mapInterventionFromCSV(csvRow, verbose, lineNumber, this.enumResolver, this.entityFinder, this.errorLogger, this.authenticatedClient);
  }

  mapClientFromInterventionCSV(csvRow) {
    return mapClientFromInterventionCSV(csvRow);
  }

  // ===== Mapper helpers delegation =====
  async mapMetiersFromCSV(csvRow) {
    return mapMetiersFromCSV(csvRow, this.enumResolver, this.authenticatedClient);
  }

  async mapZonesFromCSV(csvRow) {
    return mapZonesFromCSV(csvRow, this.enumResolver, this.authenticatedClient);
  }

  mapDocumentsFromCSV(artisan, csvRow) {
    return mapDocumentsFromCSV(artisan, csvRow, getCSVValue);
  }

  extractDocumentNameFromUrl(url) {
    return extractDocumentNameFromUrl(url);
  }

  // ===== Validators delegation =====
  validateArtisan(mappedArtisan) { return validateArtisan(mappedArtisan); }
  validateIntervention(mappedIntervention) { return validateIntervention(mappedIntervention); }

  // ===== Cost extractor delegation =====
  extractCostsData(csvRow) { return extractCostsData(csvRow); }
  _validateCostsLimits(coutIntervention, coutSST, maxCost) { return _validateCostsLimits(coutIntervention, coutSST, maxCost); }
  _calculateAndValidateMargin(coutIntervention, coutSST, coutMateriel, idInter, minMarginPercent, maxMarginPercent) {
    return _calculateAndValidateMargin(coutIntervention, coutSST, coutMateriel, idInter, minMarginPercent, maxMarginPercent);
  }
  _formatCostsForInsertion(extractedCosts, idInter, verbose) { return _formatCostsForInsertion(extractedCosts, idInter, verbose); }

  // ===== Parser wrappers =====
  cleanString(value) { return cleanString(value); }
  truncateString(value, maxLength) { return truncateString(value, maxLength); }
  cleanPhone(phoneValue) { return cleanPhone(phoneValue); }
  cleanEmail(emailValue) { return cleanEmail(emailValue); }
  cleanSiret(siretValue) { return cleanSiret(siretValue); }
  stripDigitsFromName(value) { return stripDigitsFromName(value); }
  capitalizeFirstLetter(text) { return capitalizeFirstLetter(text); }
  parseNumber(value) { return parseNumber(value); }
  parseDate(dateValue) { return parseDate(dateValue); }
  normalizeColumnName(columnName) { return normalizeColumnName(columnName); }
  cleanCSVKeys(csvRow) { return cleanCSVKeys(csvRow); }
  getCSVValue(csvRow, columnName) { return getCSVValue(csvRow, columnName); }
  getStatutValue(csvRow) { return getStatutValue(csvRow); }
  isValidRow(csvRow) { return isValidRow(csvRow); }
  isDateLike(str) { return isDateLike(str); }
  extractAddress(adresseComplete) { return extractAddress(adresseComplete); }
  extractInterventionAddress(adresseComplete) { return extractInterventionAddress(adresseComplete); }
  extractDepartement(adresseComplete) { return extractDepartement(adresseComplete); }
  extractDepartementFromNamePrenom(nomPrenom) { return extractDepartementFromNamePrenom(nomPrenom); }
  extractInterventionId(idValue) { return extractInterventionId(idValue); }
  extractDepartementWithPriority(csvRow) { return extractDepartementWithPriority(csvRow); }
  extractNomPrenomStrict(nomPrenom) { return extractNomPrenomStrict(nomPrenom); }
  shouldInvertNames(prenom, nom) { return shouldInvertNames(prenom, nom); }
  extractPrenom(nomPrenom) { return extractPrenom(nomPrenom); }
  extractNom(nomPrenom) { return extractNom(nomPrenom); }
  extractSecondPhone(phoneValue) { return extractSecondPhone(phoneValue); }
  extractPrenomProprietaire(proprioValue) { return extractPrenomProprietaire(proprioValue); }
  extractNomProprietaire(proprioValue) { return extractNomProprietaire(proprioValue); }
  extractNomClient(locataireValue) { return extractNomClient(locataireValue); }
  extractPrenomClient(locataireValue) { return extractPrenomClient(locataireValue); }
  parsePersonName(fullName) { return parsePersonName(fullName); }
  extractEmail(text) { return extractEmail(text); }
  extractPhones(text) { return extractPhones(text); }
  parseTenantInfo(csvRow, verbose) { return parseTenantInfo(csvRow, verbose); }
  parseOwnerInfo(csvRow, verbose) { return parseOwnerInfo(csvRow, verbose); }

  // ===== Legacy utility methods =====
  validateMappedData(mappedData, type) {
    const errors = [];
    const warnings = [];

    if (type === 'artisan') {
      if (!mappedData.prenom && !mappedData.nom) errors.push('Prénom ou nom requis');
      if (!mappedData.email && !mappedData.telephone) warnings.push('Email ou téléphone recommandé');
      if (mappedData.email && !mappedData.email.includes('@')) errors.push('Email invalide');
      if (mappedData.siret && mappedData.siret.length !== 14) warnings.push('SIRET invalide');
    } else if (type === 'intervention') {
      if (!mappedData.date) errors.push('Date requise');
      if (!mappedData.adresse && !mappedData.ville) warnings.push('Adresse ou ville recommandée');
      if (!mappedData.id_inter) warnings.push('ID intervention recommandé');
    } else if (type === 'client') {
      if (!mappedData.firstname && !mappedData.lastname) warnings.push('Prénom ou nom client recommandé');
      if (!mappedData.email && !mappedData.telephone) warnings.push('Email ou téléphone client recommandé');
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  cleanMappedData(mappedData) {
    const cleaned = { ...mappedData };
    Object.keys(cleaned).forEach((key) => {
      if (cleaned[key] === null || cleaned[key] === undefined || cleaned[key] === '') {
        delete cleaned[key];
      }
    });
    return cleaned;
  }

  async createArtisanMetierRelation(artisanId, metierName) {
    const metierId = await this.getMetierId(metierName);
    if (!metierId) return null;
    return { artisan_id: artisanId, metier_id: metierId, is_primary: true };
  }

  getStats() {
    return {
      artisansCreated: this.stats.artisansCreated || 0,
      newArtisans: [...(this.stats.newArtisans || [])],
      metiersCreated: this.stats.metiersCreated || 0,
      newMetiers: [...(this.stats.newMetiers || [])],
      zonesCreated: this.stats.zonesCreated || 0,
      newZones: [...(this.stats.newZones || [])],
      artisanStatusesCreated: this.stats.artisanStatusesCreated || 0,
      newArtisanStatuses: [...(this.stats.newArtisanStatuses || [])],
      interventionStatusesCreated: this.stats.interventionStatusesCreated || 0,
      newInterventionStatuses: [...(this.stats.newInterventionStatuses || [])],
      documentsCreated: this.stats.documentsCreated || 0,
      newDocuments: [...(this.stats.newDocuments || [])],
    };
  }

  logMappedIntervention(mapped) {
    console.log('\n📋 ===== INTERVENTION MAPPÉE =====');
    console.log(`ID: ${mapped.id_inter}`);
    console.log(`Date: ${mapped.date}`);
    console.log(`Date prévue: ${mapped.date_prevue || 'NULL'}`);
    console.log(`Agence ID: ${mapped.agence_id || 'NULL'}`);
    console.log(`Statut ID: ${mapped.statut_id || 'NULL'}`);
    console.log(`Métier ID: ${mapped.metier_id || 'NULL'}`);
    console.log(`Gestionnaire ID: ${mapped.assigned_user_id || 'NULL'}`);
    const adresseDisplay = mapped.adresse || '[Manquante]';
    const cpDisplay = mapped.code_postal || '[Manquant]';
    const villeDisplay = mapped.ville || '[Manquante]';
    console.log(`Adresse: ${adresseDisplay}, ${cpDisplay} ${villeDisplay}`);
    console.log(`Artisan SST: ${mapped.artisanSST || 'NULL'}`);
    if (mapped.costs && Array.isArray(mapped.costs)) {
      const costsDisplay = mapped.costs.map(cost => `${cost.label}: ${cost.amount}€`);
      console.log(`Coûts: ${costsDisplay.length > 0 ? costsDisplay.join(' | ') : 'Aucun'}`);
    }
    if (mapped.tenant) {
      const name = [mapped.tenant.firstname, mapped.tenant.lastname].filter(Boolean).join(' ') || 'N/A';
      console.log(`Tenant: ${name} (Email: ${mapped.tenant.email || 'N/A'}, Tel: ${mapped.tenant.telephone || 'N/A'})`);
    } else {
      console.log('Tenant: NULL');
    }
    if (mapped.owner) {
      const name = [mapped.owner.firstname, mapped.owner.lastname].filter(Boolean).join(' ') || 'N/A';
      console.log(`Owner: ${name} (Tel: ${mapped.owner.telephone || 'N/A'})`);
    } else {
      console.log('Owner: NULL');
    }
    console.log('📋 ================================\n');
  }
}

module.exports = { DataMapper };
