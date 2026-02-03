/**
 * Architecture modulaire pour l'import CRM Google Sheets
 * 
 * Workflow:
 * 1. Fetch data from Google Sheets
 * 2. Extract unique agences and populate agence table
 * 3. Process and clean CSV data
 * 4. Map CSV data to database schema
 * 5. Populate database tables
 */

const { createClient } = require('@supabase/supabase-js');
const { google } = require('googleapis');
require('dotenv').config({ path: '.env.local' });

// Configuration
const config = {
  credentialsPath: process.env.GOOGLE_CREDENTIALS_PATH || './user-credentials-2025-09-17T23-26-42-341Z.json',
  artisansSheetId: process.env.GOOGLE_SHEETS_ARTISANS_ID || '1B8iXJKI2oOiTC8XWd3lg66iD7dvCUauFvBlCjpiwCkA',
  artisansRange: process.env.GOOGLE_SHEETS_ARTISANS_RANGE || 'BASE de DONNÉE SST ARTISANS!A1:Z',
  interventionsSheetId: process.env.GOOGLE_SHEETS_INTERVENTIONS_ID || '1B8iXJKI2oOiTC8XWd3lg66iD7dvCUauFvBlCjpiwCkA',
  interventionsRange: process.env.GOOGLE_SHEETS_INTERVENTIONS_RANGE || 'SUIVI INTER GMBS 2025!A1:Z',
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321',
  supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0',
  verbose: false,
  dryRun: false
};

// Classe principale pour l'import CRM
class CRMImporter {
  constructor(options = {}) {
    this.config = { ...config, ...options };
    this.supabase = createClient(this.config.supabaseUrl, this.config.supabaseKey);
    this.agenceManager = new AgenceManager(this.supabase);
    this.dataProcessor = new DataProcessor();
    this.interventionMapper = new InterventionMapper(this.supabase);
    this.databasePopulator = new DatabasePopulator(this.supabase);
  }

  async initialize() {
    log('🚀 Initialisation du CRM Importer', 'info');
    
    // Initialiser la connexion Google Sheets
    await this.initializeGoogleSheets();
    
    log('✅ CRM Importer initialisé', 'success');
  }

  async initializeGoogleSheets() {
    const path = require('path');
    const credentialsPath = path.resolve(this.config.credentialsPath);
    const credentials = require(credentialsPath);
    
    // Initialiser l'authentification Google Sheets API
    const auth = new google.auth.GoogleAuth({
      credentials: credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
    });

    this.sheets = google.sheets({ version: 'v4', auth });
    
    log('✅ Connexion Google Sheets initialisée', 'success');
  }

  async importAll() {
    try {
      await this.initialize();
      
      log('📊 Début de l\'import complet', 'info');
      
      // 1. Fetch data from Google Sheets
      const interventionsData = await this.fetchInterventionsData();
      const artisansData = await this.fetchArtisansData();
      
      // 2. Extract and populate agences
      await this.agenceManager.extractAndPopulateAgences(interventionsData);
      
      // 3. Process interventions
      const processedInterventions = await this.processInterventions(interventionsData);
      
      // 4. Process artisans
      const processedArtisans = await this.processArtisans(artisansData);
      
      // 5. Populate database
      const results = await this.populateDatabase(processedInterventions, processedArtisans);
      
      log('🎉 Import complet terminé', 'success');
      return results;
      
    } catch (error) {
      log(`❌ Erreur lors de l'import: ${error.message}`, 'error');
      throw error;
    }
  }

  async fetchInterventionsData() {
    log('📥 Récupération des données interventions...', 'info');
    
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.config.interventionsSheetId,
        range: this.config.interventionsRange,
      });

      const rows = response.data.values;
      if (!rows || rows.length === 0) {
        log('⚠️ Aucune donnée trouvée dans les interventions', 'warn');
        return [];
      }

      // Convertir en objets avec les headers comme clés
      const headers = rows[0];
      const data = rows.slice(1).map(row => {
        const rowData = {};
        headers.forEach((header, index) => {
          rowData[header] = row[index] || '';
        });
        return rowData;
      });
      
      log(`✅ ${data.length} interventions récupérées`, 'success');
      return data;
    } catch (error) {
      log(`❌ Erreur récupération interventions: ${error.message}`, 'error');
      throw error;
    }
  }

  async fetchArtisansData() {
    log('📥 Récupération des données artisans...', 'info');
    
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.config.artisansSheetId,
        range: this.config.artisansRange,
      });

      const rows = response.data.values;
      if (!rows || rows.length === 0) {
        log('⚠️ Aucune donnée trouvée dans les artisans', 'warn');
        return [];
      }

      // Convertir en objets avec les headers comme clés
      const headers = rows[0];
      const data = rows.slice(1).map(row => {
        const rowData = {};
        headers.forEach((header, index) => {
          rowData[header] = row[index] || '';
        });
        return rowData;
      });
      
      log(`✅ ${data.length} artisans récupérés`, 'success');
      return data;
    } catch (error) {
      log(`❌ Erreur récupération artisans: ${error.message}`, 'error');
      throw error;
    }
  }

  async processInterventions(rawData) {
    log('🔄 Traitement des interventions...', 'info');
    
    const processed = [];
    for (const row of rawData) {
      try {
        const cleaned = this.dataProcessor.cleanInterventionData(row);
        const mapped = await this.interventionMapper.mapIntervention(cleaned);
        processed.push(mapped);
      } catch (error) {
        log(`❌ Erreur traitement intervention: ${error.message}`, 'error');
      }
    }
    
    log(`✅ ${processed.length} interventions traitées`, 'success');
    return processed;
  }

  async processArtisans(rawData) {
    log('🔄 Traitement des artisans...', 'info');
    
    const processed = [];
    for (const row of rawData) {
      try {
        const cleaned = this.dataProcessor.cleanArtisanData(row);
        const mapped = await this.interventionMapper.mapArtisan(cleaned);
        processed.push(mapped);
      } catch (error) {
        log(`❌ Erreur traitement artisan: ${error.message}`, 'error');
      }
    }
    
    log(`✅ ${processed.length} artisans traités`, 'success');
    return processed;
  }

  async populateDatabase(interventions, artisans) {
    log('💾 Population de la base de données...', 'info');
    
    const results = {
      interventions: await this.databasePopulator.populateInterventions(interventions),
      artisans: await this.databasePopulator.populateArtisans(artisans)
    };
    
    log('✅ Base de données peuplée', 'success');
    return results;
  }
}

// Classe pour gérer les agences
class AgenceManager {
  constructor(supabase) {
    this.supabase = supabase;
    this.agenceCache = new Map();
  }

  async extractAndPopulateAgences(interventionsData) {
    log('🏢 Extraction des agences uniques...', 'info');
    
    const uniqueAgences = new Set();
    interventionsData.forEach(row => {
      if (row['Agence'] && row['Agence'].trim() !== '') {
        uniqueAgences.add(row['Agence'].trim());
      }
    });
    
    log(`📋 ${uniqueAgences.size} agences uniques trouvées`, 'info');
    
    // Populate agences table
    for (const agenceName of uniqueAgences) {
      await this.createOrGetAgence(agenceName);
    }
    
    log('✅ Agences peuplées', 'success');
  }

  async createOrGetAgence(agenceName) {
    if (this.agenceCache.has(agenceName)) {
      return this.agenceCache.get(agenceName);
    }

    try {
      // Vérifier si l'agence existe déjà
      const { data: existing, error: checkError } = await this.supabase
        .from('agences')
        .select('id')
        .eq('nom', agenceName)
        .single();

      if (existing) {
        this.agenceCache.set(agenceName, existing.id);
        return existing.id;
      }

      // Créer l'agence
      const { data: newAgence, error: insertError } = await this.supabase
        .from('agences')
        .insert([{ nom: agenceName }])
        .select()
        .single();

      if (insertError) {
        log(`❌ Erreur création agence ${agenceName}: ${insertError.message}`, 'error');
        return null;
      }

      this.agenceCache.set(agenceName, newAgence.id);
      log(`✅ Agence créée: ${agenceName}`, 'verbose', config.verbose);
      return newAgence.id;

    } catch (error) {
      log(`❌ Erreur agence ${agenceName}: ${error.message}`, 'error');
      return null;
    }
  }
}

// Classe pour le traitement des données
class DataProcessor {
  cleanInterventionData(rawData) {
    const cleaned = {};
    
    // Nettoyer chaque champ
    Object.keys(rawData).forEach(key => {
      const value = rawData[key];
      if (value !== null && value !== undefined) {
        cleaned[key] = String(value).trim();
      } else {
        cleaned[key] = '';
      }
    });
    
    return cleaned;
  }

  cleanArtisanData(rawData) {
    const cleaned = {};
    
    // Nettoyer chaque champ
    Object.keys(rawData).forEach(key => {
      const value = rawData[key];
      if (value !== null && value !== undefined) {
        cleaned[key] = String(value).trim();
      } else {
        cleaned[key] = '';
      }
    });
    
    return cleaned;
  }
}

// Classe pour le mapping des données
class InterventionMapper {
  constructor(supabase) {
    this.supabase = supabase;
    this.userCache = new Map();
    this.metierCache = new Map();
  }

  async mapIntervention(cleanedData) {
    const mapped = {
      id_facture: this.parseIdFacture(cleanedData['ID']),
      agence_id: await this.getAgenceId(cleanedData['Agence']),
      contexte_intervention: cleanedData['Contexte d\'intervention'] || null,
      adresse: cleanedData['Adresse d\'intervention'] || null,
      statut: this.mapStatut(cleanedData[' Statut']),
      metier_id: await this.getMetierId(cleanedData['Métier']),
      attribue_a: await this.getUserId(cleanedData[' Gest.']),
      cout_sst: this.parseNumber(cleanedData['COUT SST']),
      cout_materiel: this.parseNumber(cleanedData['COÛT MATERIEL ']),
      prenom_proprietaire: this.extractPrenomProprietaire(cleanedData['PROPRIO']),
      nom_proprietaire: this.extractNomProprietaire(cleanedData['PROPRIO']),
      telephone_client: this.cleanPhone(cleanedData['TEL LOC']),
      nom_client: this.extractNomClient(cleanedData['Locataire']),
      prenom_client: this.extractPrenomClient(cleanedData['Locataire']),
      email_client: cleanedData['Em@il Locataire'] || null,
      commentaire_agent: cleanedData['COMMENTAIRE'] || null,
      trustpilot_statut: cleanedData['Truspilot '] || null,
      demande_intervention: cleanedData['Demande d\'intervention ✅'] || null,
      demande_devis: cleanedData['Demande Devis  ✅'] || null,
      demande_trust_pilot: cleanedData['Demande TrustPilot  ✅'] || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    return mapped;
  }

  async mapArtisan(cleanedData) {
    const mapped = {
      prenom: this.extractPrenom(cleanedData['                  Nom Prénom ']),
      nom: this.extractNom(cleanedData['                  Nom Prénom ']),
      email: cleanedData['Adresse Mail'] || null,
      telephone: this.cleanPhone(cleanedData['Numéro Téléphone ']),
      telephone2: null, // Pas de deuxième téléphone dans les données
      raison_sociale: cleanedData['Raison Social'] || null,
      siret: this.cleanSiret(cleanedData['Siret ']),
      statut_juridique: cleanedData['STATUT JURIDIQUE'] || null,
      statut_dossier: this.mapStatutDossier(cleanedData['DOSSIER ARTISAN']),
      statut_artisan: cleanedData['STATUT'] || null,
      statut_inactif: false,
      adresse_siege_social: cleanedData['Adresse Postale'] || null,
      ville_siege_social: this.extractVille(cleanedData['Adresse Postale']),
      code_postal_siege_social: this.extractCodePostal(cleanedData['Adresse Postale']),
      adresse_intervention: null,
      ville_intervention: null,
      code_postal_intervention: null,
      intervention_latitude: null,
      intervention_longitude: null,
      nom_prenom: cleanedData['                  Nom Prénom '] || null,
      numero_associe: null,
      gestionnaire_id: await this.getUserId(cleanedData['Gestionnaire']),
      date_ajout: cleanedData['DATE D\'AJOUT '] || null,
      suivi_relances_docs: cleanedData['SUIVI DES RELANCES DOCS'] || null,
      nombre_interventions: this.parseNumber(cleanedData['NOMBRE D\'INTERVENTION(S)']) || 0,
      cout_sst: this.parseNumber(cleanedData['COUT SST']) || null,
      cout_inter: this.parseNumber(cleanedData['COUT INTER']) || null,
      cout_materiel: this.parseNumber(cleanedData['COUT MATÉRIEL\n(cleaner colonne)']) || null,
      gain_brut: this.parseNumber(cleanedData['GAIN BRUT €']) || null,
      pourcentage_sst: this.parseNumber(cleanedData['% SST']) || null,
      metier_id: await this.getMetierId(cleanedData['MÉTIER']),
      departement: cleanedData['DPT'] || null,
      document_drive: cleanedData['Document Drive '] || null,
      commentaire: cleanedData['Commentaire'] || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    return mapped;
  }

  parseIdFacture(value) {
    if (!value || value.trim() === '') return null;
    const parsed = parseInt(value.trim());
    return isNaN(parsed) ? null : parsed;
  }

  async getAgenceId(agenceName) {
    if (!agenceName || agenceName.trim() === '') return null;
    
    const { data, error } = await this.supabase
      .from('agences')
      .select('id')
      .eq('nom', agenceName.trim())
      .single();

    if (error) {
      log(`❌ Agence non trouvée: ${agenceName}`, 'warn');
      return null;
    }

    return data.id;
  }

  mapStatut(statutValue) {
    if (!statutValue || statutValue.trim() === '') return 'Demandé';
    
    const statut = statutValue.trim();
    const statutMap = {
      'Accepté': 'Accepté',
      'Demandé': 'Demandé',
      'Devis Envoyé': 'Devis Envoyé',
      'Inter en cours': 'Inter en cours',
      'Annulé': 'Annulé',
      'Inter terminée': 'Inter terminée',
      'Visite Technique': 'Visite Technique',
      'Refusé': 'Refusé',
      'Stand by': 'Stand by',
      'Att Acompte': 'Att Acompte'
    };

    return statutMap[statut] || 'Demandé';
  }

  async getMetierId(metierName) {
    if (!metierName || metierName.trim() === '') return null;
    
    if (this.metierCache.has(metierName)) {
      return this.metierCache.get(metierName);
    }

    const { data, error } = await this.supabase
      .from('metiers')
      .select('id')
      .eq('label', metierName.trim())
      .single();

    if (error) {
      log(`❌ Métier non trouvé: ${metierName}`, 'warn');
      return null;
    }

    this.metierCache.set(metierName, data.id);
    return data.id;
  }

  async getUserId(gestionnaireCode) {
    if (!gestionnaireCode || gestionnaireCode.trim() === '') return null;
    
    if (this.userCache.has(gestionnaireCode)) {
      return this.userCache.get(gestionnaireCode);
    }

    // Chercher par nom ou prénom au lieu de code_gestionnaire
    const { data, error } = await this.supabase
      .from('users')
      .select('id')
      .or(`name.ilike.%${gestionnaireCode.trim()}%,prenom.ilike.%${gestionnaireCode.trim()}%`)
      .single();

    if (error) {
      log(`❌ Gestionnaire non trouvé: ${gestionnaireCode}`, 'warn');
      return null;
    }

    this.userCache.set(gestionnaireCode, data.id);
    return data.id;
  }

  parseNumber(value) {
    if (!value || value.trim() === '') return null;
    
    // Nettoyer le nombre (supprimer espaces, remplacer virgules par points)
    const cleaned = value.replace(/\s/g, '').replace(',', '.');
    const parsed = parseFloat(cleaned);
    
    return isNaN(parsed) ? null : parsed;
  }

  extractPrenomProprietaire(proprioValue) {
    if (!proprioValue || proprioValue.trim() === '') return null;
    
    // Logique d'extraction du prénom propriétaire
    // Ex: "M. Jean Dupont" -> "Jean"
    const match = proprioValue.match(/M\.?\s+([A-Za-z]+)/);
    return match ? match[1] : null;
  }

  extractNomProprietaire(proprioValue) {
    if (!proprioValue || proprioValue.trim() === '') return null;
    
    // Logique d'extraction du nom propriétaire
    // Ex: "M. Jean Dupont" -> "Dupont"
    const parts = proprioValue.split(/\s+/);
    if (parts.length >= 3) {
      return parts.slice(2).join(' ');
    }
    return null;
  }

  cleanPhone(phoneValue) {
    if (!phoneValue || phoneValue.trim() === '') return null;
    
    // Nettoyer le téléphone (garder seulement les chiffres)
    const cleaned = phoneValue.replace(/[^\d]/g, '');
    return cleaned.length >= 10 ? cleaned : null;
  }

  extractNomClient(locataireValue) {
    if (!locataireValue || locataireValue.trim() === '') return null;
    
    // Logique d'extraction du nom client
    // Ex: "MME FATIMA HERNANDEZ" -> "HERNANDEZ"
    const parts = locataireValue.split(/\s+/);
    if (parts.length >= 3) {
      return parts.slice(2).join(' ');
    }
    return locataireValue;
  }

  extractPrenomClient(locataireValue) {
    if (!locataireValue || locataireValue.trim() === '') return null;
    
    // Logique d'extraction du prénom client
    // Ex: "MME FATIMA HERNANDEZ" -> "FATIMA"
    const parts = locataireValue.split(/\s+/);
    if (parts.length >= 2) {
      return parts[1];
    }
    return null;
  }

  // Méthodes pour les artisans
  extractPrenom(nomPrenomValue) {
    if (!nomPrenomValue || nomPrenomValue.trim() === '') return null;
    
    const parts = nomPrenomValue.trim().split(/\s+/);
    if (parts.length >= 2) {
      return parts[0];
    }
    return nomPrenomValue;
  }

  extractNom(nomPrenomValue) {
    if (!nomPrenomValue || nomPrenomValue.trim() === '') return null;
    
    const parts = nomPrenomValue.trim().split(/\s+/);
    if (parts.length >= 2) {
      return parts.slice(1).join(' ');
    }
    return null;
  }

  cleanSiret(siretValue) {
    if (!siretValue || siretValue.trim() === '') return null;
    
    const cleaned = siretValue.replace(/[^\d]/g, '');
    return cleaned.length === 14 ? cleaned : null;
  }

  mapStatutDossier(statutValue) {
    if (!statutValue || statutValue.trim() === '') return 'INCOMPLET';
    
    const statut = statutValue.trim();
    const statutMap = {
      'COMPLET': 'COMPLET',
      'INCOMPLET': 'INCOMPLET',
      'DOSSIER COMPLET': 'COMPLET',
      'DOSSIER INCOMPLET': 'INCOMPLET',
      'DOSSIER À FINALISER': 'INCOMPLET'
    };

    return statutMap[statut] || 'INCOMPLET';
  }

  extractVille(adresseValue) {
    if (!adresseValue || adresseValue.trim() === '') return null;
    
    // Extraire la ville de l'adresse (après le code postal)
    const villeMatch = adresseValue.match(/\b(\d{5})\s+([A-Z\s-]+)$/);
    return villeMatch ? villeMatch[2].trim() : null;
  }

  extractCodePostal(adresseValue) {
    if (!adresseValue || adresseValue.trim() === '') return null;
    
    // Extraire le code postal de l'adresse
    const codePostalMatch = adresseValue.match(/\b(\d{5})\b/);
    return codePostalMatch ? codePostalMatch[1] : null;
  }
}

// Classe pour la population de la base de données
class DatabasePopulator {
  constructor(supabase) {
    this.supabase = supabase;
  }

  async populateInterventions(interventions) {
    log('💾 Insertion des interventions...', 'info');
    
    if (config.dryRun) {
      log(`[DRY-RUN] ${interventions.length} interventions seraient insérées`, 'info');
      return { success: interventions.length, errors: 0 };
    }

    const { data, error } = await this.supabase
      .from('interventions')
      .insert(interventions);

    if (error) {
      log(`❌ Erreur insertion interventions: ${error.message}`, 'error');
      return { success: 0, errors: interventions.length };
    }

    log(`✅ ${interventions.length} interventions insérées`, 'success');
    return { success: interventions.length, errors: 0 };
  }

  async populateArtisans(artisans) {
    log('💾 Insertion des artisans...', 'info');
    
    if (config.dryRun) {
      log(`[DRY-RUN] ${artisans.length} artisans seraient insérés`, 'info');
      return { success: artisans.length, errors: 0 };
    }

    const { data, error } = await this.supabase
      .from('artisans')
      .insert(artisans);

    if (error) {
      log(`❌ Erreur insertion artisans: ${error.message}`, 'error');
      return { success: 0, errors: artisans.length };
    }

    log(`✅ ${artisans.length} artisans insérés`, 'success');
    return { success: artisans.length, errors: 0 };
  }
}

// Fonction utilitaire pour le logging
function log(message, level = 'info', verbose = false) {
  const timestamp = new Date().toISOString();
  
  if (level === 'verbose' && !verbose) return;
  
  switch (level) {
    case 'error':
      console.error(`❌ [CRM-IMPORT] ${message}`);
      break;
    case 'warn':
      console.warn(`⚠️  [CRM-IMPORT] ${message}`);
      break;
    case 'success':
      console.log(`✅ [CRM-IMPORT] ${message}`);
      break;
    case 'verbose':
      console.log(`🔍 [CRM-IMPORT] ${message}`);
      break;
    default:
      console.log(`ℹ️  [CRM-IMPORT] ${message}`);
  }
}

module.exports = {
  CRMImporter,
  AgenceManager,
  DataProcessor,
  InterventionMapper,
  DatabasePopulator
};
