/**
 * Système de mapping robuste entre données Google Sheets et base de données
 *
 * Ce module gère la transformation des données CSV vers le schéma de base de données
 * défini dans supabase/migrations/20251005_clean_schema.sql
 *
 * NOTE: Utilise l'API v2 complète avec les méthodes de création d'énumérations.
 * Toutes les énumérations (métiers, statuts, agences, utilisateurs) sont maintenant
 * créées automatiquement via l'API v2 si elles n'existent pas.
 */

const { log } = require("console");
const fs = require("fs");
const path = require("path");
const {
  artisansApi,
  interventionsApi,
  enumsApi,
} = require("../../src/lib/api/v2");
const {
  STATUS_LABEL_TO_CODE,
  GESTIONNAIRE_CODE_MAP,
  AGENCE_NORMALIZATION_MAP,
  METIER_NORMALIZATION_MAP,
} = require("./mapping-constants");

// Normalise une valeur issue des sheets (trim, suppression des accents,
// remplacement des caractères spéciaux) pour permettre une recherche
// clé-insensible dans les dictionnaires.
const normalizeSheetKey = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toUpperCase();

const STATUS_LOOKUP = Object.entries(STATUS_LABEL_TO_CODE).reduce(
  (acc, [key, code]) => {
    const normalizedKey = normalizeSheetKey(key);
    if (!acc[normalizedKey]) {
      acc[normalizedKey] = code;
    }
    return acc;
  },
  {}
);

const GESTIONNAIRE_LOOKUP = Object.entries(GESTIONNAIRE_CODE_MAP).reduce(
  (acc, [key, username]) => {
    const normalizedKey = normalizeSheetKey(key);
    if (!acc[normalizedKey]) {
      acc[normalizedKey] = username;
    }
    return acc;
  },
  {}
);

class DataMapper {
  constructor(options = {}) {
    this.cache = {
      agencies: new Map(),
      users: new Map(),
      metiers: new Map(),
      zones: new Map(),
      artisanStatuses: new Map(),
      interventionStatuses: new Map(),
    };

    // Compteurs pour le rapport
    this.stats = {
      artisansCreated: 0,
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
    
    // Rate limiting simple pour les recherches SST
    this.lastSSTSearchTime = 0;
    this.sstSearchDelay = 50; // 50ms entre chaque recherche SST

    // Déterminer le type d'import pour le nom du fichier de log
    const importType = options.importType || 'parsing'; // 'artisans', 'interventions', ou 'parsing' (par défaut)
    const logFileName = importType === 'artisans' 
      ? `erreurs-artisans-${new Date().toISOString().split("T")[0]}.log`
      : importType === 'interventions'
      ? `erreurs-interventions-${new Date().toISOString().split("T")[0]}.log`
      : `erreurs-parsing-${new Date().toISOString().split("T")[0]}.log`;

    // Initialiser le fichier de log des erreurs
    this.errorLogPath = path.join(
      process.cwd(),
      "logs",
      logFileName
    );
    this.initErrorLog();
  }

  /**
   * Initialise le fichier de log des erreurs de parsing
   */
  initErrorLog() {
    try {
      const logDir = path.dirname(this.errorLogPath);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
      // Créer ou vider le fichier au début
      fs.writeFileSync(
        this.errorLogPath,
        `=== LOG DES ERREURS DE PARSING - ${new Date().toISOString()} ===\n\n`,
        "utf8"
      );
    } catch (error) {
      console.error("Erreur lors de l'initialisation du fichier de log:", error);
    }
  }

  /**
   * Log une erreur de parsing dans le fichier avec le format standardisé
   * @param {string} idInter - ID de l'intervention
   * @param {string} reason - Raison du rejet
   * @param {Object} rawData - Données brutes du CSV (optionnel, pour debug)
   * @param {number} lineNumber - Numéro de ligne dans le fichier source (optionnel)
   */
  logParsingError(idInter, reason, rawData = null, lineNumber = null) {
    try {
      // Ne logger que les IDs qui sont des nombres simples sans espace
      // Si on a un ID normal qui est un nombre simple, l'utiliser
      // Sinon, utiliser "N/A"
      let logId = "N/A";
      
      if (idInter && /^\d+$/.test(idInter)) {
        // ID normal est un nombre simple, l'utiliser
        logId = idInter;
      }
      
      // Formater le rawData avec JSON.stringify pour un affichage correct
      let rawDataStr = "null";
      if (rawData !== null && rawData !== undefined) {
        try {
          rawDataStr = JSON.stringify(rawData, null, 2);
        } catch (e) {
          rawDataStr = String(rawData);
        }
      }
      
      // Ajouter le numéro de ligne si disponible
      const lineInfo = lineNumber !== null ? `Ligne ${lineNumber}: ` : "";
      
      const logEntry = `${lineInfo}${logId}, \tNot inserted reason \t{${reason}} \n rawData: \t${rawDataStr} \n  \n`;
      fs.appendFileSync(this.errorLogPath, logEntry, "utf8");
    } catch (error) {
      console.error("Erreur lors de l'écriture dans le fichier de log:", error);
    }
  }

  /**
   * Retourne le chemin du fichier de log des erreurs
   * @returns {string} - Chemin du fichier de log
   */
  getErrorLogPath() {
    return this.errorLogPath;
  }

  /**
   * Valide un artisan mappé selon le schéma de base de données
   * @param {Object} mappedArtisan - Artisan mappé à valider
   * @returns {Object} - { isValid: boolean, errors: Array<{field, reason}>, identifier: string }
   */
  validateArtisan(mappedArtisan) {
    const errors = [];
    // Identifier pour le log : nom, prénom, raison sociale ou plain_nom
    const identifier = mappedArtisan.plain_nom || 
                      `${mappedArtisan.prenom || ''} ${mappedArtisan.nom || ''}`.trim() ||
                      mappedArtisan.raison_sociale ||
                      "N/A";

    // Validation : le nom est obligatoire (comme dans database-manager-v2.js)
    // Le database manager rejette les artisans sans nom, donc on doit les rejeter ici aussi
    if (!mappedArtisan.nom || mappedArtisan.nom.trim() === '') {
      errors.push({
        field: 'nom',
        reason: 'Le champ nom invalide'
      });
    }

    // Validation de l'email si présent
    if (mappedArtisan.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(mappedArtisan.email)) {
        errors.push({
          field: 'email',
          reason: 'Format d\'email invalide'
        });
      }
    }

    // Validation du SIRET si présent (doit être 14 chiffres)
    if (mappedArtisan.siret && mappedArtisan.siret.length !== 14) {
      if (mappedArtisan.siret.length !== 14) {
        errors.push({
          field: 'siret',
            reason: 'SIRET invalide (doit contenir 14 chiffres)'
          });
      }
      else {
        errors.push({
          field: 'siret',
          reason: 'SIRET invalide'
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      identifier
    };
  }

  /**
   * Valide une intervention mappée selon le schéma de base de données
   * @param {Object} mappedIntervention - Intervention mappée à valider
   * @returns {Object} - { isValid: boolean, errors: Array<{field, reason}>, idInter: string }
   */
  validateIntervention(mappedIntervention) {
    const errors = [];
    const idInter = mappedIntervention.id_inter || "N/A";

    // Champs obligatoires 
    // Note: id_inter est obligatoire pour éviter les doublons (peut être réel ou synthétique SYNTH-xxx)
    const requiredFields = {
      id_inter: 'Champ id_inter invalide (requis pour éviter les doublons, généré automatiquement si absent)',
      date: 'Champ date invalide ',
      adresse: 'Champ adresse invalide',
      contexte_intervention: 'Champ contexte_intervention invalide',
      metier_id: 'Champ metier_id invalide ',
      statut_id: 'Champ statut_id invalide ',
      agence_id: 'Champ agence_id invalide '
    };

    // Vérifier chaque champ obligatoire
    Object.entries(requiredFields).forEach(([field, reason]) => {
      const value = mappedIntervention[field];
      if (value === null || value === undefined || value === '') {
        errors.push({
          field,
          reason
        });
      }
    });

    // Validation de la date si présente
    if (mappedIntervention.date) {
      const dateValue = new Date(mappedIntervention.date);
      if (isNaN(dateValue.getTime())) {
        errors.push({
          field: 'date',
          reason: 'Format de date invalide'
        });
      }
    }

    // Validation des coûts si présents
    if (mappedIntervention.costs) {
      const { sst: coutSST, materiel: coutMateriel, intervention: coutIntervention, total: margeCalculee } = mappedIntervention.costs;

      // Note: Les coûts manquants (null) ne sont plus bloquants
      // L'intervention sera insérée même sans coûts
      
      // Vérification des limites de coûts (uniquement si les coûts sont présents)
      const MAX_COST = 100000;
      const costLimitErrors = this._validateCostsLimits(coutIntervention, coutSST, MAX_COST, idInter);
      errors.push(...costLimitErrors);

      let marginErrors = [];
      if (margeCalculee !== null && coutIntervention !== null && coutIntervention > 0) {
        // La marge a déjà été calculée dans extractCostsData, on valide juste les limites
        const margePourcentage = (margeCalculee / coutIntervention) * 100;
        
        // Vérifier les limites de marge (-200% à 200%)
        if (margePourcentage < -200 || margePourcentage > 200) {
          marginErrors.push({
            field: 'costs',
            reason: `Marge hors limites: ${margePourcentage.toFixed(2)}% (limites: -200% à 200%), Marge: ${margeCalculee} EUR, Coût Intervention: ${coutIntervention} EUR, Coût SST: ${coutSST || 0} EUR, Coût Matériel: ${coutMateriel || 0} EUR`
          });
        } else if (margeCalculee < 0) {
          // Warning pour marge négative (dans les limites)
          marginErrors.push({
            field: 'costs',
            reason: `Marge négative: ${margePourcentage.toFixed(2)}%, Marge: ${margeCalculee} EUR, Coût Intervention: ${coutIntervention} EUR, Coût SST: ${coutSST || 0} EUR, Coût Matériel: ${coutMateriel || 0} EUR`
          });
        }
      } else if (coutIntervention !== null && coutIntervention > 0) {
        // Si la marge n'a pas été calculée (cas rare), la calculer maintenant
        const { errors: calculatedMarginErrors } = this._calculateAndValidateMargin(
          coutIntervention,
          coutSST,
          coutMateriel,
          idInter,
          -200,
          200
        );
        marginErrors = calculatedMarginErrors;
      }
      
      // Séparer les erreurs critiques (hors limites) des warnings (marge négative)
      const criticalMarginErrors = marginErrors.filter(e => e.reason.includes('hors limites'));
      
      // Ajouter les erreurs critiques (bloquent l'insertion)
      errors.push(...criticalMarginErrors);

      // Si les coûts sont invalides (hors limites), marquer costs comme null
      if (costLimitErrors.length > 0 || criticalMarginErrors.length > 0) {
        // Les coûts seront traités comme invalides par DatabaseManager
        mappedIntervention.costs = {
          sst: null,
          materiel: null,
          intervention: null,
          total: null
        };
      }
    }

    // Calculer isValid en excluant les warnings (marge négative dans les limites)
    // Les warnings sont loggés mais ne bloquent pas l'insertion
    const criticalErrors = errors.filter(e => !e.reason.includes('Marge négative'));
    
    return {
      isValid: criticalErrors.length === 0,
      errors,
      idInter
    };
  }

  // ===== MAPPING ARTISANS =====

  /**
   * Mappe une ligne d'artisan depuis le CSV vers le schéma de la table artisans
   * @param {Object} csvRow - Ligne du CSV artisans
   * @param {number} lineNumber - Numéro de ligne dans le fichier source (optionnel)
   * @returns {Object} - Objet mappé pour l'insertion en base
   */
  async mapArtisanFromCSV(csvRow, lineNumber = null) {
    // Nettoyer les clés CSV (trim les espaces)
    csvRow = this.cleanCSVKeys(csvRow);

    // Vérifier si la ligne est complètement vide
    const hasAnyData = Object.values(csvRow).some(
      (val) => val && String(val).trim() !== ""
    );
    if (!hasAnyData) {
      return null; // Ignorer uniquement les lignes 100% vides
    }

    // Vérifier si la ligne contient des informations valides
    const originalNomPrenom = this.getCSVValue(csvRow, "Nom Prénom") || '';
    const nomPrenom = originalNomPrenom;
    // Extraction stricte selon les règles définies
    const { prenom, nom } = this.extractNomPrenomStrict(nomPrenom);

    const mapped = {
      // Informations personnelles (selon le schéma artisans)
      prenom: prenom,
      nom: nom,
      plain_nom: nomPrenom ? nomPrenom.trim() : null, // Sauvegarder la colonne originale "Nom Prénom"

      // Contact
      email: this.cleanEmail(this.getCSVValue(csvRow, "Adresse Mail")),
      telephone: this.cleanPhone(this.getCSVValue(csvRow, "Numéro Téléphone")),
      telephone2: this.extractSecondPhone(
        this.getCSVValue(csvRow, "Numéro Téléphone")
      ),

      // Informations entreprise
      raison_sociale: this.cleanString(
        this.getCSVValue(csvRow, "Raison Social")
      ),
      siret: this.cleanSiret(this.getCSVValue(csvRow, "Siret")),
      statut_juridique: this.cleanString(
        this.getCSVValue(csvRow, "STATUT JURIDIQUE")
      ),

      // Adresse siège social
      adresse_siege_social: this.extractAddress(
        this.getCSVValue(csvRow, "Adresse Postale")
      ).adresse,
      ville_siege_social: this.extractAddress(
        this.getCSVValue(csvRow, "Adresse Postale")
      ).ville,
      code_postal_siege_social: this.extractAddress(
        this.getCSVValue(csvRow, "Adresse Postale")
      ).codePostal,
      departement: this.extractDepartementWithPriority(csvRow),

      // Adresse intervention (pas dans le CSV, donc null)
      adresse_intervention: null,
      ville_intervention: null,
      code_postal_intervention: null,
      intervention_latitude: null,
      intervention_longitude: null,

      // Références (IDs vers autres tables)
      gestionnaire_id: await this.getUserId(
        this.getCSVValue(csvRow, "Gestionnaire")
      ),
      statut_id: await this.getArtisanStatusId(
        this.getCSVValue(csvRow, "STATUT")
      ),

      // Informations supplémentaires
      numero_associe: null, // Pas dans le CSV
      suivi_relances_docs: this.cleanString(
        this.getCSVValue(csvRow, "SUIVI DES RELANCES DOCS")
      ),
      date_ajout: this.parseDate(this.getCSVValue(csvRow, "DATE D'AJOUT")),

      // Champs par défaut
      is_active: true,

      // ===== DONNÉES BRUTES pour DatabaseManager =====
      // Ces champs seront traités par DatabaseManager et supprimés avant l'insertion
      metiers: await this.mapMetiersFromCSV(csvRow),
    };

    // Validation de l'artisan mappé
    const validation = this.validateArtisan(mapped);
    
    if (!validation.isValid) {
      // Logger chaque erreur individuellement avec le format standardisé
      validation.errors.forEach(({ field, reason }) => {
        this.logParsingError(
          validation.identifier,
          `${field}: ${reason}`,
          csvRow,
          lineNumber
        );
      });
      
      return null;
    }

    return mapped;
  }

  /**
   * Vérifie si une chaîne ressemble à une date
   * @param {string} str - Chaîne à vérifier
   * @returns {boolean} - True si ça ressemble à une date
   */
  isDateLike(str) {
    if (!str) return false;

    // Patterns de dates courants
    const datePatterns = [
      /^\d{1,2}\/\d{1,2}\/\d{4}$/, // DD/MM/YYYY
      /^\d{1,2}-\d{1,2}-\d{4}$/, // DD-MM-YYYY
      /^\d{4}-\d{1,2}-\d{1,2}$/, // YYYY-MM-DD
      /^\d{1,2}\/\d{1,2}\/\d{2}$/, // DD/MM/YY
      /^\d{1,2}-\d{1,2}-\d{2}$/, // DD-MM-YY
      /^\d{2}\/\d{2}\/\d{4}$/, // DD/MM/YYYY (avec zéros)
      /^\d{2}-\d{2}-\d{4}$/, // DD-MM-YYYY (avec zéros)
    ];

    return datePatterns.some((pattern) => pattern.test(str));
  }

  /**
   * Normalise un nom de métier pour éviter les doublons
   * @param {string} metierName - Nom du métier à normaliser
   * @returns {string} - Nom normalisé
   */
  normalizeMetierName(metierName) {
    if (!metierName || typeof metierName !== "string") return "";

    return metierName
      .trim()
      .toLowerCase() // Convertir en minuscules
      .normalize("NFD") // Décomposer les accents
      .replace(/[\u0300-\u036f]/g, "") // Supprimer les accents
      .replace(/[\/\-]/g, " ") // Remplacer slash et tiret par espace
      .replace(/[^a-z0-9\s]/g, "") // Garder seulement lettres, chiffres et espaces
      .replace(/\s+/g, " ") // Remplacer les espaces multiples par un seul
      .trim();
  }

  /**
   * Mappe les métiers depuis les données CSV
   * @param {Object} csvRow - Ligne CSV originale
   * @returns {Array} - Liste des métiers à associer
   */
  async mapMetiersFromCSV(csvRow) {
    const metiers = [];

    // Chercher le champ métier dans la ligne CSV
    const metierValue =
      this.getCSVValue(csvRow, "MÉTIER") ||
      this.getCSVValue(csvRow, "Métier") ||
      this.getCSVValue(csvRow, "metier") ||
      this.getCSVValue(csvRow, "METIER");

    if (metierValue && metierValue.trim() !== "") {
      // Séparer les métiers par virgule, point-virgule ou slash
      const metierNames = metierValue
        .split(/[,;\/]/)
        .map((name) => name.trim())
        .filter((name) => name);

      // Normaliser et dédupliquer les métiers
      const normalizedMetiers = new Map();

      for (const metierName of metierNames) {
        // Ignorer les métiers vides ou qui ressemblent à des dates AVANT normalisation
        if (metierName && !this.isDateLike(metierName.trim())) {
          const normalized = this.normalizeMetierName(metierName);

          // Ignorer les métiers vides après normalisation
          if (normalized) {
            // Garder le nom original le plus "propre" (moins de caractères spéciaux)
            if (
              !normalizedMetiers.has(normalized) ||
              metierName.length < normalizedMetiers.get(normalized).length
            ) {
              normalizedMetiers.set(normalized, metierName);
            }
          }
        }
      }

      // Traiter les métiers normalisés
      for (const [normalized, originalName] of normalizedMetiers) {
        const metierId = await this.getMetierId(originalName);
        if (metierId) {
          metiers.push({
            metier_id: metierId,
            is_primary: metiers.length === 0, // Premier métier = principal
          });
        }
      }
    }

    return metiers;
  }

  /**
   * Normalise un nom de zone pour éviter les doublons
   * @param {string} zoneName - Nom de la zone à normaliser
   * @returns {string} - Nom normalisé
   */
  normalizeZoneName(zoneName) {
    if (!zoneName || typeof zoneName !== "string") return "";

    return zoneName
      .trim()
      .toLowerCase() // Convertir en minuscules
      .normalize("NFD") // Décomposer les accents
      .replace(/[\u0300-\u036f]/g, "") // Supprimer les accents
      .replace(/[\/\-]/g, " ") // Remplacer slash et tiret par espace
      .replace(/[^a-z0-9\s]/g, "") // Garder seulement lettres, chiffres et espaces
      .replace(/\s+/g, " ") // Remplacer les espaces multiples par un seul
      .trim();
  }

  /**
   * Mappe les zones depuis les données CSV
   * @param {Object} csvRow - Ligne CSV originale
   * @returns {Array} - Liste des zones à associer
   */
  async mapZonesFromCSV(csvRow) {
    const zones = [];

    // Chercher le champ zone dans la ligne CSV
    const zoneValue =
      this.getCSVValue(csvRow, "ZONE") ||
      this.getCSVValue(csvRow, "Zone") ||
      this.getCSVValue(csvRow, "zone") ||
      this.getCSVValue(csvRow, "ZONES");

    if (zoneValue && zoneValue.trim() !== "") {
      // Séparer les zones par virgule, point-virgule ou slash
      const zoneNames = zoneValue
        .split(/[,;\/]/)
        .map((name) => name.trim())
        .filter((name) => name);

      // Normaliser et dédupliquer les zones
      const normalizedZones = new Map();

      for (const zoneName of zoneNames) {
        const normalized = this.normalizeZoneName(zoneName);

        // Ignorer les zones vides
        if (normalized) {
          // Garder le nom original le plus "propre" (moins de caractères spéciaux)
          if (
            !normalizedZones.has(normalized) ||
            zoneName.length < normalizedZones.get(normalized).length
          ) {
            normalizedZones.set(normalized, zoneName);
          }
        }
      }

      // Traiter les zones normalisées
      for (const [normalized, originalName] of normalizedZones) {
        const zoneId = await this.getZoneId(originalName);
        if (zoneId) {
          zones.push({
            zone_id: zoneId,
          });
        }
      }
    }

    return zones;
  }

  // ===== MAPPING INTERVENTIONS =====

  /**
   * Nettoie les clés d'un objet CSV (trim les espaces)
   */
  cleanCSVKeys(csvRow) {
    const cleaned = {};
    for (const key in csvRow) {
      // Nettoyer la clé : trim + suppression des sauts de ligne
      const cleanKey = key.replace(/\n/g, ' ').trim();
      cleaned[cleanKey] = csvRow[key];
      
      // Garder aussi la clé originale pour compatibilité
      if (cleanKey !== key) {
        cleaned[key] = csvRow[key];
      }
    }
    return cleaned;
  }

  /**
   * Trouve la valeur de la colonne Statut en essayant plusieurs variantes
   * Gère les espaces avant/après et les variations de casse
   * @param {Object} csvRow - Ligne CSV nettoyée
   * @returns {string|null} - Valeur du statut ou null
   */
  getStatutValue(csvRow) {
    // DEBUG: Afficher toutes les clés disponibles pour debug
    if (process.env.VERBOSE || process.argv.includes('--verbose')) {
      const allKeys = Object.keys(csvRow);
      const statutRelatedKeys = allKeys.filter(k => 
        k.toLowerCase().includes('statut')
      );
      console.log(`🔍 [STATUT DEBUG] Toutes les clés: ${allKeys.slice(0, 10).join(", ")}...`);
      console.log(`🔍 [STATUT DEBUG] Clés contenant "statut": ${statutRelatedKeys.join(", ")}`);
      if (statutRelatedKeys.length > 0) {
        statutRelatedKeys.forEach(key => {
          console.log(`   "${key}": "${csvRow[key]}"`);
        });
      }
    }
    
    // Essayer plusieurs variantes possibles (avec et sans espaces)
    const possibleKeys = [
      "Statut",
      " Statut",
      "Statut ",
      " STATUT",
      "STATUT",
      "STATUT "
    ];
    
    for (const key of possibleKeys) {
      if (csvRow[key] && String(csvRow[key]).trim() !== "") {
        if (process.env.VERBOSE || process.argv.includes('--verbose')) {
          console.log(`✅ [STATUT] Trouvé avec clé "${key}": "${csvRow[key]}"`);
        }
        return String(csvRow[key]).trim();
      }
    }
    
    // Si aucune variante ne fonctionne, chercher toutes les clés qui contiennent "statut"
    const statutKeys = Object.keys(csvRow).filter(k => 
      k.toLowerCase().trim() === 'statut' || 
      k.toLowerCase().trim().includes('statut')
    );
    
    for (const key of statutKeys) {
      if (csvRow[key] && String(csvRow[key]).trim() !== "") {
        if (process.env.VERBOSE || process.argv.includes('--verbose')) {
          console.log(`✅ [STATUT] Trouvé avec clé "${key}": "${csvRow[key]}"`);
        }
        return String(csvRow[key]).trim();
      }
    }
    
    if (process.env.VERBOSE || process.argv.includes('--verbose')) {
      console.log(`❌ [STATUT] Aucune colonne statut trouvée dans csvRow`);
    }
    return null;
  }
  
  /**
   * Filtre les valeurs aberrantes (dates dans mauvaises colonnes)
   * Retourne null si la ligne contient des valeurs aberrantes critiques
   */
  isValidRow(csvRow) {
    // Colonnes qui NE doivent PAS contenir de dates
    const criticalColumns = [
      ' Statut',
      'Agence',
      ' Gest.',
      'Métier'
    ];
    
    for (const col of criticalColumns) {
      const value = csvRow[col];
      if (value && typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}/)) {
        // C'est une date dans une colonne qui ne devrait pas en contenir
        return false;
      }
    }
    
    return true;
  }

  /**
   * Mappe une ligne d'intervention depuis le CSV vers le schéma de la table interventions
   * @param {Object} csvRow - Ligne du CSV interventions
   * @param {boolean} verbose - Mode verbose pour logging
   * @returns {Object} - Objet mappé avec données brutes pour l'insertion
   */
  async mapInterventionFromCSV(csvRow, verbose = false, lineNumber = null) {
    // Nettoyer les clés CSV (trim les espaces)
    csvRow = this.cleanCSVKeys(csvRow);

    // Vérifier si la ligne est vide (toutes les valeurs sont vides ou null)
    const hasData = Object.values(csvRow).some(
      (val) => val && String(val).trim() !== ""
    );
    if (!hasData) {
      if (verbose) console.log("⚠️ Ligne vide ignorée");
      return null;
    }
    
    let idInter = this.extractInterventionId(csvRow["ID"]);
    // Filtrer les lignes avec valeurs aberrantes (dates dans mauvaises colonnes)
    if (!this.isValidRow(csvRow)) {      
      this.logParsingError(
        idInter || "N/A",
        "Ligne avec mauvais formatage",
        csvRow,
        lineNumber
      );
      if (verbose) console.log("⚠️ Ligne avec mauvais formatag)");
      return null;
    }

    // Mapper les métiers avec la même logique que pour les artisans
    // (gestion des métiers multiples, filtrage des dates aberrantes, normalisation)
    const metiers = await this.mapMetiersFromCSV(csvRow);
    // Prendre le premier métier (principal) pour metier_id
    const metierId = metiers.length > 0 ? metiers[0].metier_id : null;

    // ===== RÉCUPÉRER LES DONNÉES NÉCESSAIRES POUR ID SYNTHÉTIQUE =====
    const agenceId = await this.getAgencyId(csvRow["Agence"]);
    // Chercher la date dans plusieurs colonnes possibles (FErn est un nom alternatif utilisé dans certains sheets)
    const rawDate = csvRow["Date "] || csvRow["Date"] || csvRow["FErn"] || csvRow["Date d'intervention"];
    const dateValue = this.parseDate(rawDate);
    const adresseValue = this.extractInterventionAddress(csvRow["Adresse d'intervention"]).adresse;
    const contexteValue = this.cleanString(csvRow["Contexte d'intervention "]);

    // ===== GÉNÉRATION ID_INTER DÉTERMINISTE SI ABSENT =====
    // Si pas d'id_inter dans le CSV, générer un ID synthétique basé sur:
    // agence + date + adresse + contexte (pour identifier de manière unique)
    if (!idInter) {
      const syntheticId = this.generateDeterministicIdInter(
        agenceId,
        dateValue,
        adresseValue,
        contexteValue
      );
      
      if (syntheticId) {
        idInter = syntheticId;
        if (verbose) {
          console.log(`🔑 ID synthétique généré: ${idInter}`);
          console.log(`   (agence=${agenceId ? agenceId.substring(0, 8) : 'N/A'}, date=${dateValue || 'N/A'}, adresse hash)`);
        }
      } else {
        // Si on ne peut pas générer d'ID synthétique, logger l'erreur
        this.logParsingError(
          "N/A",
          "Impossible de générer un id_inter: données insuffisantes (agence_id et adresse requis)",
          csvRow,
          lineNumber
        );
        if (verbose) {
          console.log(`⚠️ Ligne ${lineNumber || '?'}: Impossible de générer un id_inter synthétique`);
          console.log(`   agence_id=${agenceId || 'NULL'}, adresse=${adresseValue || 'NULL'}`);
        }
        // Ne pas retourner null ici - on laisse la validation décider si l'intervention est valide
      }
    }

    // Extraire l'adresse une seule fois (optimisation)
    const adresseExtracted = this.extractInterventionAddress(csvRow["Adresse d'intervention"]);

    const mapped = {
      // Identifiant externe - peut être réel (du CSV) ou synthétique (généré)
      id_inter: idInter,

      // Références vers autres tables (déjà récupérées ci-dessus)
      agence_id: agenceId,
      assigned_user_id: await this.getUserIdNormalized(csvRow["Gest."]),
      statut_id: await this.getInterventionStatusIdNormalized(
        this.getStatutValue(csvRow)
      ),
      metier_id: metierId,

      // Dates (avec valeur par défaut si manquante) - réutiliser dateValue déjà parsé
      date: dateValue || null,
      date_termine: null, // Pas dans le CSV
      date_prevue: this.parseDate(csvRow["Date d'intervention"]) || null,
      due_date: null, // Pas dans le CSV

      // Contexte et instructions (tronqué à 10000 caractères) - contexteValue déjà extrait
      contexte_intervention: this.truncateString(contexteValue, 10000),
      commentaire_agent: this.cleanString(csvRow["COMMENTAIRE"]),

      // Adresse d'intervention (réutiliser adresseExtracted)
      adresse: adresseExtracted.adresse,
      code_postal: adresseExtracted.codePostal,
      ville: adresseExtracted.ville,
      latitude: null, // Pas dans le CSV
      longitude: null, // Pas dans le CSV

      // Champs par défaut
      is_active: true,

      // ===== DONNÉES BRUTES pour DatabaseManager =====
      // Ces champs seront traités par DatabaseManager et supprimés avant l'insertion
      tenant: this.parseTenantInfo(csvRow, false),
      owner: this.parseOwnerInfo(csvRow, false),
      artisanSST: await this.findArtisanSST(csvRow["Technicien"], idInter, csvRow, lineNumber),
    };

    // Extraire les coûts bruts pour la validation
    const extractedCosts = this.extractCostsData(csvRow);
    
    // Validation de l'intervention mappée (utilise les coûts bruts)
    const mappedForValidation = { ...mapped, costs: extractedCosts };
    const validation = this.validateIntervention(mappedForValidation);
    
    if (!validation.isValid) {
      // Logger chaque erreur individuellement avec le format standardisé
      validation.errors.forEach(({ field, reason }) => {
        this.logParsingError(
          validation.idInter,
          `${field}: ${reason}`,
          csvRow,
          lineNumber
        );
      });
      
      console.log(`❌ Intervention ${validation.idInter} invalide:`);
      validation.errors.forEach(({ field, reason }) => {
        console.log(
          `   - ${field}: ${reason}\n\t\t${JSON.stringify(csvRow, null, 2)}`
        );
      });
            
      return null;
    }

    // Formater les coûts pour insertion (sans intervention_id, sera ajouté après insertion)
    mapped.costs = this._formatCostsForInsertion(extractedCosts, idInter, verbose);

    // Logging verbose - Affiche uniquement l'objet mapped
    if (verbose) {
      this.logMappedIntervention(mapped);
    }

    return mapped;
  }

  // ===== MAPPING COÛTS D'INTERVENTION =====

  /**
   * Affiche de manière formatée les données d'une intervention mappée
   * @param {Object} mapped - Objet intervention mappé depuis le CSV
   */
  logMappedIntervention(mapped) {
    console.log("\n📋 ===== INTERVENTION MAPPÉE =====");
    console.log(`ID: ${mapped.id_inter}`);
    console.log(`Date: ${mapped.date}`);
    console.log(`Date prévue: ${mapped.date_prevue || "NULL"}`);

    // IDs résolus
    console.log(`Agence ID: ${mapped.agence_id || "NULL"}`);
    console.log(`Statut ID: ${mapped.statut_id || "NULL"}`);
    console.log(`Métier ID: ${mapped.metier_id || "NULL"}`);
    console.log(`Gestionnaire ID: ${mapped.assigned_user_id || "NULL"}`);

    // Adresse
    const adresseDisplay = mapped.adresse || "[Manquante]";
    const cpDisplay = mapped.code_postal || "[Manquant]";
    const villeDisplay = mapped.ville || "[Manquante]";
    console.log(`Adresse: ${adresseDisplay}, ${cpDisplay} ${villeDisplay}`);

    // Artisan SST
    console.log(`Artisan SST: ${mapped.artisanSST || "NULL"}`);

    // Coûts (formatés pour insertion)
    if (mapped.costs && Array.isArray(mapped.costs)) {
      const costsDisplay = [];
      mapped.costs.forEach(cost => {
        costsDisplay.push(`${cost.label}: ${cost.amount}€`);
      });
      console.log(
        `Coûts: ${costsDisplay.length > 0 ? costsDisplay.join(" | ") : "Aucun"}`
      );
    }

    // Tenant (données brutes)
    if (mapped.tenant) {
      const name =
        [mapped.tenant.firstname, mapped.tenant.lastname]
          .filter(Boolean)
          .join(" ") || "N/A";
      console.log(
        `Tenant: ${name} (Email: ${mapped.tenant.email || "N/A"}, Tel: ${
          mapped.tenant.telephone || "N/A"
        })`
      );
    } else {
      console.log(`Tenant: NULL`);
    }

    // Owner (données brutes)
    if (mapped.owner) {
      const name =
        [mapped.owner.firstname, mapped.owner.lastname]
          .filter(Boolean)
          .join(" ") || "N/A";
      console.log(`Owner: ${name} (Tel: ${mapped.owner.telephone || "N/A"})`);
    } else {
      console.log(`Owner: NULL`);
    }

    console.log("📋 ================================\n");
  }

  // ===== MAPPING COÛTS D'INTERVENTION =====

  /**
   * Extrait les coûts depuis le CSV
   * @private
   * @param {Object} csvRow - Ligne CSV nettoyée
   * @returns {Object} - { coutSST, coutMaterielData, coutIntervention }
   * Note: Tous les coûts sont des nombres (ou null)
   */
  _extractCosts(csvRow) {
    const COUT_SST_COLUMN = "COUT SST";
    const COUT_MATERIEL_COLUMN = "COÛT MATERIEL";
    const COUT_INTER_COLUMN = "COUT INTER";

    // Coût SST
    let coutSST = 0;
    const coutSSTValue = csvRow[COUT_SST_COLUMN];
    if (coutSSTValue) {
      coutSST = this.parseNumber(coutSSTValue);
    }

    // Coût matériel
    let coutMaterielData = 0;
    const coutMaterielValue = csvRow[COUT_MATERIEL_COLUMN];
    if (coutMaterielValue) {
      coutMaterielData = this.parseNumber(coutMaterielValue);
    }

    // Coût intervention
    let coutIntervention = 0;
    const coutInterValue = csvRow[COUT_INTER_COLUMN];
    if (coutInterValue) {
      coutIntervention = this.parseNumber(coutInterValue);
    }

    return { coutSST, coutMaterielData, coutIntervention };
  }

  /**
   * Valide les coûts contre une limite maximale
   * @private
   * @param {number|null} coutIntervention - Coût intervention
   * @param {number|null} coutSST - Coût SST
   * @param {number} maxCost - Limite maximale
   * @param {string} idInter - ID intervention
   * @returns {Array} - Tableau d'erreurs (vide si valide)
   */
  _validateCostsLimits(coutIntervention, coutSST, maxCost) {
    const errors = [];

    if (coutIntervention !== null && coutIntervention > maxCost) {
      errors.push({
        field: 'costs',
        reason: `Coût intervention hors limites: ${coutIntervention} EUR (max autorisé: ${maxCost} EUR)`
      });
    }

    if (coutSST !== null && coutSST > maxCost) {
      errors.push({
        field: 'costs',
        reason: `Coût SST hors limites: ${coutSST} EUR (max autorisé: ${maxCost} EUR)`
      });
    }

    return errors;
  }

  /**
   * Calcule et valide la marge
   * @private
   * @param {number|null} coutIntervention - Coût intervention
   * @param {number|null} coutSST - Coût SST
   * @param {number|null} coutMateriel - Coût matériel
   * @param {string} idInter - ID intervention
   * @param {number} minMarginPercent - Pourcentage minimum de marge (-200 par défaut)
   * @param {number} maxMarginPercent - Pourcentage maximum de marge (200 par défaut)
   * @returns {Object} - { marge, margePourcentage, errors } où errors est un tableau d'erreurs
   */
  _calculateAndValidateMargin(coutIntervention, coutSST, coutMateriel, idInter, minMarginPercent = -200, maxMarginPercent = 200) {
    let marge = null;
    let margePourcentage = null;
    const errors = [];
    
    if (coutIntervention !== null && coutIntervention > 0) {
      marge = coutIntervention;
      if (coutSST !== null) marge -= coutSST;
      if (coutMateriel !== null) marge -= coutMateriel;

      // Calculer la marge en pourcentage
      margePourcentage = (marge / coutIntervention) * 100;

      // ⭐ RÈGLE DE SÉCURITÉ: Ne garder que les marges dans les limites
      if (margePourcentage < minMarginPercent || margePourcentage > maxMarginPercent) {
        errors.push({
          field: 'costs',
          reason: `Marge hors limites: ${margePourcentage.toFixed(2)}% (limites: ${minMarginPercent}% à ${maxMarginPercent}%), Marge: ${marge} EUR, Coût Intervention: ${coutIntervention} EUR, Coût SST: ${coutSST || 0} EUR, Coût Matériel: ${coutMateriel || 0} EUR`
        });
        marge = null;
      } else if (marge < 0) {
        // Logger les marges négatives (mais dans les limites) pour information
        // Note: On ne retourne pas d'erreur pour les marges négatives dans les limites, juste un warning
        errors.push({
          field: 'costs',
          reason: `Marge négative: ${margePourcentage.toFixed(2)}%, Marge: ${marge} EUR, Coût Intervention: ${coutIntervention} EUR, Coût SST: ${coutSST || 0} EUR, Coût Matériel: ${coutMateriel || 0} EUR`
        });
      }
    }
    
    return { marge, margePourcentage, errors };
  }

  /**
   * Extrait les données de coûts depuis le CSV (sans intervention_id)
   * Utilisé par mapInterventionFromCSV pour retourner des données brutes
   * ⚠️ Cette méthode extrait uniquement les données, sans validation.
   * La validation est effectuée dans validateIntervention.
   * @param {Object} csvRow - Ligne du CSV interventions
   * @returns {Object} - Objet avec les coûts extraits (peut contenir des valeurs null)
   */
  extractCostsData(csvRow) {
    csvRow = this.cleanCSVKeys(csvRow);

    // Extraire les coûts
    const { coutSST, coutMaterielData, coutIntervention } = this._extractCosts(csvRow);

    // Calculer la marge (sans validation)
    let marge = null;
    if (coutIntervention !== null && coutIntervention > 0) {
      marge = coutIntervention;
      if (coutSST !== null) marge -= coutSST;
      if (coutMaterielData !== null) marge -= coutMaterielData;
    }

    return {
      sst: coutSST,
      materiel: coutMaterielData,
      intervention: coutIntervention,
      total: marge
    };
  }

  /**
   * Formate les coûts extraits pour insertion en base de données
   * Applique les validations spécifiques (MAX_VALUE=10000, marge -250% à 250%)
   * @private
   * @param {Object} extractedCosts - Coûts extraits { sst, materiel, intervention, total }
   * @param {string} idInter - ID de l'intervention (pour logging)
   * @param {boolean} verbose - Mode verbose pour logging
   * @returns {Array} - Tableau des coûts formatés SANS intervention_id
   */
  _formatCostsForInsertion(extractedCosts, idInter = null, verbose = false) {
    if (!extractedCosts) return [];

    let coutSST = extractedCosts.sst !== undefined ? extractedCosts.sst : null;
    let coutMaterielData = extractedCosts.materiel !== undefined ? extractedCosts.materiel : null;
    let coutIntervention = extractedCosts.intervention !== undefined ? extractedCosts.intervention : null;

    // Note: Cette méthode utilise une limite différente (10000) et un comportement différent
    // pour les valeurs trop élevées (mise à 0 au lieu de rejet)
    const MAX_VALUE = 10000;
    if (coutSST !== null && Math.abs(coutSST) >= MAX_VALUE) {
      console.log(`\n⚠️ Coût SST dépasse 6 chiffres pour id_inter: ${idInter || "N/A"}`);
      console.log(`  Valeur originale: ${coutSST.toLocaleString("fr-FR")}€`);
      console.log(`  → Valeur mise à 0\n`);
      coutSST = 0;
    }
    if (coutIntervention !== null && Math.abs(coutIntervention) >= MAX_VALUE) {
      console.log(`\n⚠️ Coût intervention dépasse 6 chiffres pour id_inter: ${idInter || "N/A"}`);
      console.log(`  Valeur originale: ${coutIntervention.toLocaleString("fr-FR")}€`);
      console.log(`  → Valeur mise à 0\n`);
      coutIntervention = 0;
    }

    // Calculer et valider la marge (avec limites -250% à 250% pour cette fonction)
    const { marge, margePourcentage, errors } = this._calculateAndValidateMargin(
      coutIntervention,
      coutSST,
      coutMaterielData,
      idInter,
      -250,
      250
    );

    // Si marge hors limites, retourner un tableau vide
    if (errors.length > 0 && errors.some(e => e.reason.includes('hors limites'))) {
      return [];
    }

    // Si on arrive ici, la marge est dans les limites (ou pas de coût intervention)
    // Ajouter tous les coûts au tableau (SANS intervention_id)
    const costs = [];

    // Coût SST
    if (coutSST !== null) {
      costs.push({
        cost_type: "sst",
        label: "Coût SST",
        amount: coutSST,
        currency: "EUR",
      });
    }

    // Coût matériel
    if (coutMaterielData !== null) {
      costs.push({
        cost_type: "materiel",
        label: "Coût Matériel",
        amount: coutMaterielData,
        currency: "EUR",
      });
    }

    // Coût intervention
    if (coutIntervention !== null) {
      costs.push({
        cost_type: "intervention",
        label: "Coût Intervention",
        amount: coutIntervention,
        currency: "EUR",
      });
    }

    // Marge (ajouter seulement si calculée et dans les limites)
    if (marge !== null && !errors.some(e => e.reason.includes('hors limites'))) {
      costs.push({
        cost_type: "marge",
        label: "Marge",
        amount: marge,
        currency: "EUR",
      });
    }

    // Logging verbose
    if (verbose) {
      console.log("\n💰 ===== COÛTS FORMATÉS =====");
      console.log(`ID Intervention: ${idInter || "N/A"}`);
      console.log(`Coût SST: ${coutSST !== null ? coutSST + " EUR" : "N/A"}`);
      console.log(
        `Coût Matériel: ${
          coutMaterielData !== null ? coutMaterielData + " EUR" : "N/A"
        }`
      );
      console.log(
        `Coût Intervention: ${
          coutIntervention !== null ? coutIntervention + " EUR" : "N/A"
        }`
      );
      console.log(
        `Marge (calculée): ${
          marge !== null ? marge + " EUR" : "N/A"
        }`
      );
      console.log(`Nombre de coûts formatés: ${costs.length}`);
      if (costs.length > 0) {
        costs.forEach((cost, i) => {
          console.log(
            `  ${i + 1}. ${cost.label}: ${cost.amount} ${cost.currency}`
          );
        });
      } else {
        console.log("  ⚠️ Aucun coût formaté");
      }
      console.log("💰 ===========================\n");
    }

    return costs;
  }


  // ===== MAPPING CLIENTS =====

  /**
   * Mappe les informations client depuis le CSV d'intervention
   * @param {Object} csvRow - Ligne du CSV interventions
   * @returns {Object} - Objet client mappé
   */
  mapClientFromInterventionCSV(csvRow) {
    const mapped = {
      // Référence externe (peut être l'ID de l'intervention)
      external_ref: this.cleanString(csvRow["ID"]),

      // Informations client (depuis les colonnes Locataire)
      firstname: this.extractPrenomClient(csvRow["Locataire"]),
      lastname: this.extractNomClient(csvRow["Locataire"]),
      email: this.cleanEmail(csvRow["Em@il Locataire"]),
      telephone: this.cleanPhone(csvRow["TEL LOC"]),
      telephone2: null, // Pas dans le CSV

      // Adresse (même que l'intervention)
      adresse: this.extractInterventionAddress(csvRow["Adresse d'intervention"])
        .adresse,
      ville: this.extractInterventionAddress(csvRow["Adresse d'intervention"])
        .ville,
      code_postal: this.extractInterventionAddress(
        csvRow["Adresse d'intervention"]
      ).codePostal,

      // Champs par défaut
      is_active: true,
    };

    return mapped;
  }

  /**
   * Nettoie et normalise les noms de colonnes CSV
   * @param {string} columnName - Nom de colonne à nettoyer
   * @returns {string} - Nom de colonne nettoyé
   */
  normalizeColumnName(columnName) {
    if (!columnName) return "";
    return columnName.trim();
  }

  /**
   * Récupère une valeur CSV en gérant les espaces et les noms de colonnes
   * @param {Object} csvRow - Ligne CSV
   * @param {string} columnName - Nom de colonne (avec ou sans espaces)
   * @returns {string|null} - Valeur nettoyée
   */
  getCSVValue(csvRow, columnName) {
    if (!csvRow) return null;

    // Essayer d'abord avec le nom exact
    if (csvRow[columnName] !== undefined) {
      return csvRow[columnName];
    }

    // Essayer avec le nom normalisé (trim)
    const normalizedName = this.normalizeColumnName(columnName);
    if (csvRow[normalizedName] !== undefined) {
      return csvRow[normalizedName];
    }

    // Chercher par correspondance partielle (pour gérer les variations d'espaces)
    const foundKey = Object.keys(csvRow).find(
      (key) => this.normalizeColumnName(key) === normalizedName
    );

    if (foundKey) {
      return csvRow[foundKey];
    }

    return null;
  }

  /**
   * Extraction stricte du nom et prénom selon les règles définies
   * Format attendu: "NOM PRENOM DPT" ou variations
   * 
   * Règles:
   * - 0 espace (1 mot): PRENOM = undefined, NOM = plain_nom
   * - 1 espace (2 mots): PRENOM = première partie, NOM = plain_nom
   * - 2 espaces (3 mots): NOM = première partie, PRENOM = deuxième partie (DPT ignoré)
   * - 3+ espaces (4+ mots): 
   *   - Si particule (Monsieur, Mr, M, Madame, Mme, Mlle) → enlever et réappliquer
   *   - Sinon: PRENOM = undefined, NOM = plain_nom
   * 
   * @param {string} nomPrenom - Valeur brute de la colonne "Nom Prénom"
   * @returns {Object} - { prenom: string|undefined, nom: string }
   */
  extractNomPrenomStrict(nomPrenom) {
    // plain_nom est toujours la valeur brute de la colonne
    const plain_nom = nomPrenom ? nomPrenom.trim() : '';
    
    if (!plain_nom) {
      return { prenom: undefined, nom: undefined };
    }

    // Nettoyer et séparer en parties
    let parts = plain_nom.split(/\s+/).filter(p => p.trim() !== '');
    const spaceCount = parts.length - 1;

    // Traitement des particules (Monsieur, Mr, M, Madame, Mme, Mlle)
    const particles = ['monsieur', 'mr', 'm', 'madame', 'mme', 'mlle'];
    const firstPartLower = parts[0] ? parts[0].toLowerCase() : '';
    
    // Si particule détectée et 2 espaces ou plus, l'enlever et réappliquer les règles
    if (spaceCount >= 2 && particles.includes(firstPartLower)) {
      parts = parts.slice(1); // Enlever la particule
      const newSpaceCount = parts.length - 1;
      
      // Réappliquer les règles avec les parties restantes
      if (newSpaceCount === 0) {
        // 0 espace après suppression: PRENOM = undefined, NOM = plain_nom
        return { prenom: undefined, nom: plain_nom };
      } else if (newSpaceCount === 1) {
        // 1 espace après suppression: PRENOM = première partie, NOM = plain_nom
        return { prenom: parts[0], nom: plain_nom };
      } else if (newSpaceCount === 2) {
        // 2 espaces après suppression: NOM = première partie, PRENOM = deuxième partie
        return { prenom: parts[1], nom: parts[0] };
      } else {
        // Plus de 2 espaces après suppression: PRENOM = undefined, NOM = plain_nom
        return { prenom: undefined, nom: plain_nom };
      }
    }

    // Application des règles selon le nombre d'espaces
    if (spaceCount === 0) {
      // 0 espace (1 mot): PRENOM = undefined, NOM = plain_nom
      return { prenom: undefined, nom: plain_nom };
    } else if (spaceCount === 1) {
      // 1 espace (2 mots): PRENOM = première partie, NOM = plain_nom
      return { prenom: parts[0], nom: plain_nom };
    } else if (spaceCount === 2) {
      // 2 espaces (3 mots): NOM = première partie, PRENOM = deuxième partie (DPT ignoré)
      return { prenom: parts[1], nom: parts[0] };
    } else {
      // Plus de 2 espaces (4+ mots): PRENOM = undefined, NOM = plain_nom
      return { prenom: undefined, nom: plain_nom };
    }
  }

  /**
   * @deprecated Utiliser extractNomPrenomStrict à la place
   */
  extractPrenom(nomPrenom) {
    const { prenom } = this.extractNomPrenomStrict(nomPrenom);
    return prenom || null;
  }

  /**
   * @deprecated Utiliser extractNomPrenomStrict à la place
   */
  extractNom(nomPrenom) {
    const { nom } = this.extractNomPrenomStrict(nomPrenom);
    return nom || null;
  }

  shouldInvertNames(prenom, nom) {
    // Liste de prénoms courants français
    const commonPrenoms = [
      "jean",
      "pierre",
      "marie",
      "paul",
      "jacques",
      "michel",
      "alain",
      "philippe",
      "bernard",
      "andr",
      "alexandre",
      "nicolas",
      "christophe",
      "françois",
      "laurent",
      "thomas",
      "david",
      "olivier",
      "vincent",
      "sebastien",
      "antoine",
      "guillaume",
      "benjamin",
      "julien",
      "maxime",
      "kevin",
      "romain",
      "alexis",
      "cedric",
      "fabien",
      "jeremy",
      "mathieu",
      "damien",
      "florian",
      "gregory",
      "hugo",
      "jordan",
      "mickael",
      "nathan",
      "quentin",
      "simon",
      "yann",
      "adrien",
      "arthur",
      "axel",
      "baptiste",
      "corentin",
      "daniel",
      "etienne",
      "florent",
      "gaetan",
      "ivan",
      "joffrey",
      "kamel",
      "leo",
      "lucas",
      "marc",
      "noel",
      "pascal",
      "raphael",
      "sylvain",
      "tristan",
      "valentin",
      "william",
      "yves",
      "zacharie",
    ];

    // Liste de noms de famille courants français
    const commonNoms = [
      "martin",
      "bernard",
      "dubois",
      "thomas",
      "robert",
      "petit",
      "durand",
      "leroy",
      "moreau",
      "simon",
      "laurent",
      "lefebvre",
      "michel",
      "garcia",
      "david",
      "bertrand",
      "roux",
      "vincent",
      "fournier",
      "morel",
      "girard",
      "andre",
      "lefevre",
      "mercier",
      "dupont",
      "lambert",
      "bonnet",
      "françois",
      "martinez",
      "legrand",
      "garnier",
      "faure",
      "roussel",
      "blanc",
      "guerin",
      "muller",
      "henry",
      "rouger",
      "nicolas",
      "perrin",
      "morin",
      "mathieu",
      "clement",
      "gauthier",
      "dumont",
      "lopez",
      "fontaine",
      "chevalier",
      "robin",
      "masson",
      "sanchez",
      "gerard",
      "nguyen",
      "boyer",
      "denis",
      "lucas",
      "philippe",
      "brun",
      "rey",
      "noel",
      "giraud",
      "blanchard",
      "barre",
      "guillaume",
      "lemaire",
    ];

    const prenomLower = prenom.toLowerCase();
    const nomLower = nom.toLowerCase();

    // Si le "prénom" est dans la liste des noms de famille et le "nom" est dans la liste des prénoms
    if (commonNoms.includes(prenomLower) && commonPrenoms.includes(nomLower)) {
      return true;
    }

    // Si le "prénom" est plus long que le "nom" (souvent les noms de famille sont plus longs)
    if (prenom.length > nom.length + 2) {
      return true;
    }

    // Si le "prénom" contient des caractères typiques des noms de famille
    if (
      prenomLower.includes("le ") ||
      prenomLower.includes("de ") ||
      prenomLower.includes("du ")
    ) {
      return true;
    }

    // Si le "prénom" commence par une particule (cas déjà traité par extractPrenom/extractNom)
    const particles = ["le", "de", "du", "la", "les", "des"];
    if (particles.includes(prenomLower)) {
      return true;
    }

    return false;
  }

  extractSecondPhone(phoneValue) {
    if (!phoneValue || phoneValue.trim() === "") return null;

    // Détecter les séparateurs de téléphones multiples
    const separators = ["/", "\\", "|", " ou ", " et ", " - ", " -"];

    for (const sep of separators) {
      if (phoneValue.includes(sep)) {
        const parts = phoneValue.split(sep);
        if (parts.length >= 2) {
          return this.cleanPhone(parts[1].trim());
        }
      }
    }

    return null;
  }

  extractAddress(adresseComplete) {
    if (!adresseComplete || adresseComplete.trim() === "") {
      return {
        adresse: null,
        ville: null,
        codePostal: null,
      };
    }

    // Extraire le code postal (5 chiffres)
    const codePostalMatch = adresseComplete.match(/\b(\d{5})\b/);
    const codePostal = codePostalMatch ? codePostalMatch[1] : null;

    // Extraire la ville (après le code postal)
    const villeMatch = adresseComplete.match(/\b(\d{5})\s+([A-Z\s-]+)$/);
    const ville = villeMatch ? villeMatch[2].trim() : null;

    return {
      adresse: adresseComplete.trim(),
      ville: ville,
      codePostal: codePostal,
    };
  }

  /**
   * Extrait le département à partir de l'adresse complète
   * Peut être trouvé via le code postal OU via des lettres en fin d'adresse
   */
  extractDepartement(adresseComplete) {
    if (!adresseComplete || adresseComplete.trim() === "") {
      return null;
    }

    const adresse = adresseComplete.trim();

    // 1. Essayer d'extraire le département via le code postal
    const codePostalMatch = adresse.match(/\b(\d{5})\b/);
    if (codePostalMatch) {
      const codePostal = codePostalMatch[1];

      // Extraire les 2 premiers chiffres du code postal pour le département
      const departement = codePostal.substring(0, 2);

      // Gestion des départements d'outre-mer (97x)
      if (departement.startsWith("97")) {
        return codePostal.substring(0, 3);
      }

      return departement;
    }

    // 2. Essayer d'extraire le département via des lettres en fin d'adresse
    // Recherche de patterns comme "75 PARIS", "13 MARSEILLE", etc.
    const departementLettreMatch = adresse.match(/\b(\d{2,3})\s+([A-Z\s-]+)$/);
    if (departementLettreMatch) {
      const departement = departementLettreMatch[1];

      // Validation du format département
      if (/^(0[1-9]|[1-9][0-9]|9[7-8][0-9])$/.test(departement)) {
        return departement;
      }
    }

    // 3. Recherche de départements écrits en toutes lettres en fin d'adresse
    // Patterns comme "PARIS 75", "MARSEILLE 13", etc.
    const departementInverseMatch = adresse.match(
      /\b([A-Z\s-]+)\s+(\d{2,3})\b$/
    );
    if (departementInverseMatch) {
      const departement = departementInverseMatch[2];

      // Validation du format département
      if (/^(0[1-9]|[1-9][0-9]|9[7-8][0-9])$/.test(departement)) {
        return departement;
      }
    }

    // 4. Recherche de départements isolés (2-3 chiffres) en fin d'adresse
    const departementIsoleMatch = adresse.match(/\b(\d{2,3})\b$/);
    if (departementIsoleMatch) {
      const departement = departementIsoleMatch[1];

      // Validation du format département
      if (/^(0[1-9]|[1-9][0-9]|9[7-8][0-9])$/.test(departement)) {
        return departement;
      }
    }

    return null;
  }

  /**
   * Extrait le département à partir du champ "Nom Prénom"
   * Recherche un numéro de département à la fin du nom/prénom
   * Exemples: "Jean-Francois GAUTIER 44", "Jean Sebastien Papon 87"
   */
  extractDepartementFromNamePrenom(nomPrenom) {
    if (!nomPrenom || nomPrenom.trim() === "") {
      return null;
    }

    const nomPrenomClean = nomPrenom.trim();

    // Recherche d'un numéro de département à la fin (2-3 chiffres)
    // Pattern: nom prénom + espace + numéro département
    const departementMatch = nomPrenomClean.match(/\s+(\d{2,3})$/);

    if (departementMatch) {
      const departement = departementMatch[1];

      // Validation du format département français
      if (/^(0[1-9]|[1-9][0-9]|9[7-8][0-9])$/.test(departement)) {
        return departement;
      }
    }

    return null;
  }

  /**
   * Extrait l'ID intervention en nettoyant le texte et en gardant seulement le numéro
   * Ne retourne que les IDs qui sont des nombres simples sans espace
   * Exemple: "11754 inter meme adresse..." -> "11754"
   * Exemple: "11754" -> "11754"
   * Exemple: "abc123" -> null (pas un nombre simple)
   */
  extractInterventionId(idValue) {
    if (!idValue || idValue.trim() === "") return null;

    const cleaned = idValue.trim();

    // Si c'est déjà un numéro simple (uniquement des chiffres), le retourner
    if (/^\d+$/.test(cleaned)) {
      return cleaned;
    }

    // Extraire le premier numéro trouvé au début du texte
    const numberMatch = cleaned.match(/^(\d+)/);
    if (numberMatch) {
      return numberMatch[1];
    }

    // Si aucun numéro simple trouvé, retourner null (au lieu du texte nettoyé)
    return null;
  }

  /**
   * Génère un hash déterministe simple pour une chaîne de caractères
   * Le même input produit TOUJOURS le même output (contrairement à Math.random())
   * @param {string} str - Chaîne à hasher
   * @returns {string} - Hash hexadécimal de 8 caractères
   */
  generateDeterministicHash(str) {
    if (!str) return '00000000';
    
    // Normaliser la chaîne (minuscules, sans accents, sans espaces multiples)
    const normalized = String(str)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Supprimer les accents
      .replace(/[^a-z0-9]/g, '')       // Garder seulement alphanumérique
      .trim();
    
    // Algorithme de hash simple mais déterministe (djb2)
    let hash = 5381;
    for (let i = 0; i < normalized.length; i++) {
      const char = normalized.charCodeAt(i);
      hash = ((hash << 5) + hash) + char; // hash * 33 + char
      hash = hash & hash; // Convertir en 32bit integer
    }
    
    // Retourner en hexadécimal (8 caractères)
    return Math.abs(hash).toString(16).padStart(8, '0').substring(0, 8);
  }

  /**
   * Génère un id_inter déterministe basé sur les données de l'intervention
   * Utilisé quand id_inter est absent du CSV pour éviter les doublons lors des imports répétés
   * 
   * Format: AUTO-{12 caractères} (compatible avec l'ancien format)
   * Les 12 caractères sont un hash déterministe combinant agence + date + adresse + contexte
   * 
   * @param {string} agenceId - UUID de l'agence
   * @param {string} dateValue - Date ISO de l'intervention
   * @param {string} adresse - Adresse de l'intervention
   * @param {string} contexte - Contexte d'intervention (optionnel, pour différencier les interventions à la même adresse le même jour)
   * @returns {string|null} - ID synthétique ou null si données insuffisantes
   */
  generateDeterministicIdInter(agenceId, dateValue, adresse, contexte = null) {
    // On a besoin d'au moins l'agence et l'adresse pour générer un ID unique
    if (!agenceId || !adresse) {
      return null;
    }
    
    // Créer une chaîne unique combinant toutes les données
    // Format: agence|date|adresse|contexte
    let combinedData = agenceId + '|';
    
    // Ajouter la date si disponible
    if (dateValue) {
      try {
        const date = new Date(dateValue);
        if (!isNaN(date.getTime())) {
          combinedData += date.toISOString().split('T')[0];
        }
      } catch (e) {
        // Ignorer
      }
    }
    combinedData += '|' + adresse;
    
    // Ajouter le contexte si disponible
    if (contexte) {
      combinedData += '|' + contexte;
    }
    
    // Générer un hash unique de 12 caractères
    const fullHash = this.generateDeterministicHash(combinedData);
    // Étendre le hash à 12 caractères en combinant avec un second hash
    const secondHash = this.generateDeterministicHash(combinedData + fullHash);
    const hash12chars = (fullHash + secondHash).substring(0, 12);
    
    // Format: AUTO-{12 caractères}
    return `AUTO-${hash12chars}`;
  }

  /**
   * Extrait le département avec une logique de priorité intelligente
   * Priorité: 1. Colonne DPT 2. Nom Prénom 3. Adresse
   */
  extractDepartementWithPriority(csvRow) {
    // 1. Priorité: Colonne DPT si elle existe et n'est pas vide
    const dptColumn = this.getCSVValue(csvRow, "DPT");
    if (dptColumn && dptColumn.trim() !== "") {
      const dptClean = dptColumn.trim();
      // Validation du format département
      if (/^(0[1-9]|[1-9][0-9]|9[7-8][0-9])$/.test(dptClean)) {
        return dptClean;
      }
    }

    // 2. Deuxième priorité: Nom Prénom
    const nomPrenom = this.getCSVValue(csvRow, "Nom Prénom");
    const departementFromName =
      this.extractDepartementFromNamePrenom(nomPrenom);
    if (departementFromName) {
      return departementFromName;
    }

    // 3. Troisième priorité: Adresse
    const adresse = this.getCSVValue(csvRow, "Adresse Postale");
    const departementFromAddress = this.extractDepartement(adresse);
    if (departementFromAddress) {
      return departementFromAddress;
    }

    return null;
  }

  extractInterventionAddress(adresseComplete) {
    if (!adresseComplete || adresseComplete.trim() === "") {
      return {
        adresse: null,
        ville: null,
        codePostal: null,
      };
    }

    let cleanedAddress = adresseComplete.trim();

    // Nettoyer les commentaires et annotations
    // Supprimer les commentaires après // ou / ou :
    cleanedAddress = cleanedAddress.replace(/\s*\/\/.*$/g, "");
    cleanedAddress = cleanedAddress.replace(/\s*\/\s*[^\/]*$/g, "");
    cleanedAddress = cleanedAddress.replace(/\s*:\s*[^:]*$/g, "");

    // Supprimer les guillemets en début/fin et les caractères parasites
    cleanedAddress = cleanedAddress.replace(/^["':\s]+|["':\s]+$/g, "");

    // Nettoyer les virgules en fin de ligne
    cleanedAddress = cleanedAddress.replace(/,\s*$/, "");

    // Extraire le code postal (5 chiffres) - chercher partout dans la chaîne
    const codePostalMatch = cleanedAddress.match(/\b(\d{5})\b/);
    const codePostal = codePostalMatch ? codePostalMatch[1] : null;

    // Extraire la ville (après le code postal)
    let ville = null;
    if (codePostal) {
      // Chercher la ville après le code postal
      const villeMatch = cleanedAddress.match(
        new RegExp(
          `\\b${codePostal}\\s+([A-ZÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞß\\s-]+)`,
          "i"
        )
      );
      if (villeMatch) {
        ville = villeMatch[1].trim();
      }
    }

    // Si pas de ville trouvée, essayer de l'extraire à la fin
    if (!ville) {
      const villeEndMatch = cleanedAddress.match(
        /\b([A-ZÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞß\s-]+)$/i
      );
      if (villeEndMatch) {
        const potentialVille = villeEndMatch[1].trim();
        // Vérifier que ce n'est pas juste des mots isolés
        if (potentialVille.length > 2 && !potentialVille.match(/^\d+$/)) {
          ville = potentialVille;
        }
      }
    }

    // Si toujours pas de ville, essayer de l'extraire après une virgule
    if (!ville) {
      const villeCommaMatch = cleanedAddress.match(
        /,\s*([A-ZÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞß\s-]+)$/i
      );
      if (villeCommaMatch) {
        const potentialVille = villeCommaMatch[1].trim();
        if (potentialVille.length > 2 && !potentialVille.match(/^\d+$/)) {
          ville = potentialVille;
        }
      }
    }

    // Nettoyer l'adresse en supprimant le code postal et la ville
    let adresse = cleanedAddress;
    if (codePostal) {
      adresse = adresse.replace(new RegExp(`\\b${codePostal}\\b`), "").trim();
    }
    if (ville) {
      adresse = adresse.replace(new RegExp(`\\b${ville}\\b`, "i"), "").trim();
    }

    // Nettoyer les espaces multiples
    adresse = adresse.replace(/\s+/g, " ").trim();
    if (ville) {
      ville = ville.replace(/\s+/g, " ").trim();
    }

    return {
      adresse: adresse || null,
      ville: ville || null,
      codePostal: codePostal,
    };
  }

  extractPrenomProprietaire(proprioValue) {
    if (!proprioValue || proprioValue.trim() === "") return null;

    // Ex: "M. Jean Dupont" -> "Jean"
    const match = proprioValue.match(/M\.?\s+([A-Za-z]+)/);
    return match ? match[1] : null;
  }

  extractNomProprietaire(proprioValue) {
    if (!proprioValue || proprioValue.trim() === "") return null;

    // Ex: "M. Jean Dupont" -> "Dupont"
    const parts = proprioValue.split(/\s+/);
    if (parts.length >= 3) {
      return parts.slice(2).join(" ");
    }
    return null;
  }

  extractNomClient(locataireValue) {
    if (!locataireValue || locataireValue.trim() === "") return null;

    // Ex: "MME FATIMA HERNANDEZ" -> "HERNANDEZ"
    const parts = locataireValue.split(/\s+/);
    if (parts.length >= 3) {
      return parts.slice(2).join(" ");
    }
    return locataireValue;
  }

  extractPrenomClient(locataireValue) {
    if (!locataireValue || locataireValue.trim() === "") return null;

    // Ex: "MME FATIMA HERNANDEZ" -> "FATIMA"
    const parts = locataireValue.split(/\s+/);
    if (parts.length >= 2) {
      return parts[1];
    }
    return null;
  }

  // ===== MÉTHODES DE NETTOYAGE =====

  cleanString(value) {
    if (!value || value === "null" || value === "NULL") return null;
    const cleaned = String(value).trim();
    return cleaned === "" ? null : cleaned;
  }

  truncateString(value, maxLength) {
    if (!value) return null;
    const cleaned = this.cleanString(value);
    if (!cleaned) return null;

    if (cleaned.length <= maxLength) {
      return cleaned;
    }

    return cleaned.substring(0, maxLength);
  }

  cleanSSTNumber(sstValue) {
    if (!sstValue || sstValue.trim() === "") return null;

    const cleaned = this.cleanString(sstValue);
    if (!cleaned) return null;

    // Si c'est une URL, extraire seulement le nom du fichier ou l'ID
    if (cleaned.startsWith("http")) {
      // Extraire le nom du fichier depuis l'URL
      const urlParts = cleaned.split("/");
      const filename = urlParts[urlParts.length - 1];

      // Si c'est un lien Google Drive, essayer d'extraire l'ID
      if (cleaned.includes("drive.google.com")) {
        const driveMatch = cleaned.match(/\/folders\/([a-zA-Z0-9_-]+)/);
        if (driveMatch) {
          return `drive_${driveMatch[1]}`;
        }
      }

      // Sinon, utiliser le nom du fichier
      return filename.length > 50 ? filename.substring(0, 50) : filename;
    }

    // Si ce n'est pas une URL, tronquer si nécessaire
    return cleaned.length > 200 ? cleaned.substring(0, 200) : cleaned;
  }

  cleanPhone(phoneValue) {
    if (!phoneValue || phoneValue.trim() === "") return null;

    // Nettoyer le téléphone (garder seulement les chiffres)
    const cleaned = phoneValue.replace(/[^\d]/g, "");

    // Vérifier la longueur (au moins 8 chiffres, au plus 15)
    if (cleaned.length < 8 || cleaned.length > 15) {
      return null;
    }

    return cleaned;
  }

  cleanEmail(emailValue) {
    if (!emailValue || emailValue.trim() === "") return null;

    const cleaned = emailValue.trim().toLowerCase();

    // Validation basique de l'email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(cleaned)) {
      return null;
    }

    return cleaned;
  }

  cleanSiret(siretValue) {
    if (!siretValue || siretValue.trim() === "") return null;

    // Nettoyer le SIRET (supprimer espaces, points, etc.)
    const cleaned = siretValue.replace(/[^\d]/g, "");

    // Vérifier que c'est un SIRET valide (14 chiffres)
    if (cleaned.length !== 14) {
      return null;
    }

    return cleaned;
  }

  /**
   * Vérifie si une chaîne contient des lettres invalides
   * Exceptions autorisées: "dire", "/", "*", "+", "-" (opérateurs)
   * @param {string} str - Chaîne à vérifier
   * @returns {boolean} - true si lettres invalides détectées, false sinon
   */
  _hasInvalidLetters(str) {
    // Enlever "dire" et tout ce qui suit (ex: "2976,55 dire 2900")
    const withoutDire = str.replace(/\s*dire\s*[\d\s,\.]*/gi, '');
    // Enlever les opérateurs mathématiques autorisés
    const withoutOperators = withoutDire.replace(/[\/\*\+\-]/g, '');
    // Détecter toutes les lettres (ASCII et Unicode/accentuées)
    return /[\p{L}]/u.test(withoutOperators);
  }

  /**
   * Parse un nombre simple (sans opérations mathématiques)
   * Gère les formats français (virgule) et anglais (point), les espaces comme séparateurs de milliers
   * @param {string} str - Chaîne à parser
   * @returns {number|null} - Nombre parsé ou null si invalide
   */
  _parseSimpleNumber(str) {
    // Gérer le cas "dire" (ex: "2976,55 dire 2900" → prendre "2976,55")
    let cleaned = str;
    if (cleaned.toLowerCase().includes("dire")) {
      const match = cleaned.match(/([\d\s,\.]+)\s*dire/i);
      if (match) {
        cleaned = match[1];
      }
    }

    // Normaliser le format (français: virgule, anglais: point)
    const hasComma = cleaned.includes(",");
    const hasDot = cleaned.includes(".");

    if (hasComma) {
      // Format français: "1 300,50" → "1300.50"
      cleaned = cleaned.replace(/\s+/g, "");
      cleaned = cleaned.replace(",", ".");
    } else if (hasDot) {
      // Format anglais: "2 976.55" → "2976.55"
      const parts = cleaned.split(".");
      if (parts.length === 2) {
        // Un seul point = séparateur décimal
        cleaned = parts[0].replace(/\s+/g, "") + "." + parts[1];
      } else {
        // Plusieurs points = format avec points comme milliers
        cleaned = cleaned.replace(/\s+/g, "");
        const dotParts = cleaned.split(".");
        cleaned = dotParts.slice(0, -1).join("") + "." + dotParts[dotParts.length - 1];
      }
    } else {
      // Pas de séparateur décimal, juste supprimer les espaces
      cleaned = cleaned.replace(/\s+/g, "");
    }

    // Supprimer les caractères non numériques sauf le point et le signe moins
    cleaned = cleaned.replace(/[^\d.-]/g, "");

    const parsed = parseFloat(cleaned);
    if (isNaN(parsed)) return null;

    return parsed;
  }

  /**
   * Évalue une expression mathématique avec opérations (*, +, -)
   * Priorité: multiplication d'abord, puis addition/soustraction
   * @param {string} str - Expression à évaluer
   * @returns {number|null} - Résultat de l'expression ou null si invalide
   */
  _evaluateExpression(str) {
    let processedStr = str;

    // Étape 1: Traiter les multiplications en premier (priorité)
    if (processedStr.includes("*")) {
      let hasChanged = true;
      let iterations = 0;
      const maxIterations = 100;

      while (processedStr.includes("*") && hasChanged && iterations < maxIterations) {
        iterations++;
        hasChanged = false;

        const multPattern = /([\d\s,\.]+)\s*\*\s*([\d\s,\.]+)/;
        const match = processedStr.match(multPattern);

        if (match) {
          // Parser récursivement les deux côtés de la multiplication avec parseNumber
          // (pour gérer les cas comme "182*2" où chaque côté peut être un nombre simple)
          const left = this.parseNumber(match[1].trim());
          const right = this.parseNumber(match[2].trim());
          if (left !== null && right !== null) {
            const multResult = left * right;
            processedStr = processedStr.replace(match[0], multResult.toString());
            hasChanged = true;
          } else {
            return null;
          }
        } else {
          hasChanged = false;
        }
      }

      if (iterations >= maxIterations) {
        console.warn(`⚠️ Trop d'itérations lors du parsing de "${str}"`);
        return null;
      }

      if (processedStr.includes("*")) {
        console.warn(`⚠️ Multiplications restantes non résolues dans "${processedStr}"`);
        return null;
      }
    }

    // Étape 2: Traiter les additions
    if (processedStr.includes("+")) {
      const terms = processedStr.split("+").map(s => s.trim());
      let sum = 0;
      for (const term of terms) {
        // Parser chaque terme récursivement
        // (pour gérer les cas comme "50* 30" dans "182*2+ 50* 30")
        const termValue = this.parseNumber(term);
        if (termValue === null) return null;
        sum += termValue;
      }
      return sum;
    }

    // Étape 3: Traiter les soustractions (doit avoir un chiffre AVANT le -)
    // Ex: "100-50" → 100 - 50 = 50
    // Mais pas "-50" qui est un nombre négatif
    const subtractionMatch = processedStr.match(/^([\d\s,\.]+)\s*-\s*([\d\s,\.]+)$/);
    if (subtractionMatch) {
      const left = this.parseNumber(subtractionMatch[1]);
      const right = this.parseNumber(subtractionMatch[2]);
      if (left !== null && right !== null) {
        return left - right;
      }
      return null;
    }

    // Si aucune opération détectée, parser comme nombre simple
    return this._parseSimpleNumber(processedStr);
  }

  parseNumber(value) {
    if (!value) return null;

    // Convertir en string et trim
    let str = String(value).trim();
    if (str === "") return 0;

    // Supprimer les espaces
    str = str.replace(/\s+/g, "");

    // ⭐ RÈGLE: Accepter uniquement les chiffres, point (.), virgule (,) et signe moins (-) au début
    // Rejeter tout autre caractère
    if (!/^-?[\d,\.]+$/.test(str)) {
      return null;
    }

    // Remplacer la virgule par un point pour le format décimal
    str = str.replace(/,/g, ".");

    // Vérifier qu'il n'y a qu'un seul point décimal
    const dotCount = (str.match(/\./g) || []).length;
    if (dotCount > 1) {
      return null; // Plusieurs points décimaux = invalide
    }

    // Parser en nombre décimal
    const result = parseFloat(str);
    if (isNaN(result)) {
      return null;
    }

    return result;
  }

  parseDate(dateValue) {
    if (!dateValue || dateValue.trim() === "") return null;

    // Si c'est un nombre (timestamp Excel), ignorer
    if (!isNaN(dateValue) && typeof dateValue !== "string") {
      return null;
    }

    const strValue = String(dateValue).trim();

    // Formats de date courants
    const dateFormats = [
      /^\d{2}\/\d{2}\/\d{4}/, // DD/MM/YYYY
      /^\d{2}-\d{2}-\d{4}/, // DD-MM-YYYY
      /^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD
    ];

    let parsedDate;

    for (const format of dateFormats) {
      if (format.test(strValue)) {
        if (format.source.includes("\\d{2}\\/\\d{2}\\/\\d{4}")) {
          // Convertir DD/MM/YYYY en YYYY-MM-DD
          const parts = strValue.split("/");
          if (parts.length >= 3) {
            const day = parts[0].padStart(2, "0");
            const month = parts[1].padStart(2, "0");
            const year = parts[2];

            // Vérifier que l'année est raisonnable (entre 1900 et 2100)
            const yearNum = parseInt(year);
            if (yearNum < 1900 || yearNum > 2100) {
              return null;
            }

            parsedDate = new Date(`${year}-${month}-${day}T00:00:00Z`);
          }
        } else {
          parsedDate = new Date(strValue);
        }
        break;
      }
    }

    if (!parsedDate) {
      parsedDate = new Date(strValue);
    }

    // Vérifier si la date est valide
    if (isNaN(parsedDate.getTime())) {
      return null;
    }

    // Vérifier que l'année est raisonnable
    const year = parsedDate.getFullYear();
    if (year < 1900 || year > 2100) {
      return null;
    }

    return parsedDate.toISOString();
  }

  // ===== MAPPING DES STATUTS =====

  // Note: Les statuts sont maintenant gérés via les tables de référence
  // artisan_statuses et intervention_statuses avec des codes

  // ===== MÉTHODES DE RÉFÉRENCE =====

  async getAgencyId(agenceName) {
    if (!agenceName || agenceName.trim() === "") return null;

    let name = agenceName.trim();
    
    // Normaliser le nom de l'agence (gérer les variations de casse)
    if (AGENCE_NORMALIZATION_MAP.hasOwnProperty(name)) {
      const normalizedName = AGENCE_NORMALIZATION_MAP[name];
      
      // Si la valeur normalisée est null, ignorer cette agence
      if (normalizedName === null) {
        console.log(`⚠️ Agence aberrante ignorée: "${name}"`);
        return null;
      }
      
      const originalName = name;
      name = normalizedName;
      console.log(`🔄 Agence normalisée: "${originalName}" → "${name}"`);
    }

    // Vérifier le cache
    if (this.cache.agencies.has(name)) {
      return this.cache.agencies.get(name);
    }

    try {
      // Utiliser l'API v2 pour trouver ou créer l'agence
      // enumsApi est maintenant importé directement
      const result = await enumsApi.findOrCreateAgency(name);

      this.cache.agencies.set(name, result.id);
      const action = result.created ? "🆕 créée" : "✅ trouvée";
      console.log(`${action} Agence: ${name} (ID: ${result.id})`);

      return result.id;
    } catch (error) {
      console.error(
        `Erreur lors de la recherche/création de l'agence ${name}:`,
        error
      );
      return null;
    }
  }

  async getUserId(gestionnaireName) {
    if (!gestionnaireName || gestionnaireName.trim() === "") return null;

    const name = gestionnaireName.trim();

    // Vérifier le cache
    if (this.cache.users.has(name)) {
      return this.cache.users.get(name);
    }

    try {
      // Utiliser l'API v2 pour trouver ou créer l'utilisateur
      // enumsApi est maintenant importé directement
      const result = await enumsApi.findOrCreateUser(name);

      this.cache.users.set(name, result.id);
      const action = result.created ? "🆕 créé" : "✅ trouvé";
      console.log(`${action} Utilisateur: ${name} (ID: ${result.id})`);

      return result.id;
    } catch (error) {
      console.error(
        `Erreur lors de la recherche/création de l'utilisateur ${name}:`,
        error
      );
      return null;
    }
  }

  /**
   * Normalise un code gestionnaire avant de rechercher l'utilisateur associé.
   * Permet d'éviter la création d'utilisateurs doublons lors des imports.
   */
  async getUserIdNormalized(gestionnaireCode) {
    if (!gestionnaireCode || gestionnaireCode.trim() === "") {
      return null;
    }

    const normalizedKey = normalizeSheetKey(gestionnaireCode);
    const username =
      GESTIONNAIRE_LOOKUP[normalizedKey] ||
      GESTIONNAIRE_CODE_MAP[gestionnaireCode.trim()] ||
      GESTIONNAIRE_CODE_MAP[gestionnaireCode.trim().toUpperCase()];

    if (!username) {
      console.warn(
        `⚠️ Gestionnaire non mappé: "${gestionnaireCode}". Utilisation du comportement legacy.`
      );
      return this.getUserId(gestionnaireCode);
    }

    if (this.cache.users.has(username)) {
      return this.cache.users.get(username);
    }

    if (typeof enumsApi.getUserByUsername !== "function") {
      console.warn(
        "⚠️ enumsApi.getUserByUsername indisponible, fallback legacy."
      );
      return this.getUserId(username);
    }

    try {
      const { data, error } = await enumsApi.getUserByUsername(username);

      if (error) {
        throw error;
      }

      if (!data || !data.id) {
        console.error(
          `❌ Username canonique introuvable en base: ${username} (depuis "${gestionnaireCode}")`
        );
        return null;
      }

      this.cache.users.set(username, data.id);
      console.log(
        `✅ Gestionnaire normalisé: "${gestionnaireCode}" → ${username} (ID: ${data.id})`
      );
      return data.id;
    } catch (error) {
      console.error(
        `Erreur lors de la résolution du gestionnaire "${gestionnaireCode}" → ${username}:`,
        error
      );
      return null;
    }
  }

  async getMetierId(metierName) {
    if (!metierName || metierName.trim() === "") return null;

    let name = metierName.trim();
    
    // Normaliser le nom du métier (gérer les variations de casse et accents)
    if (METIER_NORMALIZATION_MAP.hasOwnProperty(name)) {
      const normalizedName = METIER_NORMALIZATION_MAP[name];
      
      // Si la valeur normalisée est null, ignorer ce métier
      if (normalizedName === null) {
        console.log(`⚠️ Métier aberrant ignoré: "${name}"`);
        return null;
      }
      
      const originalName = name;
      name = normalizedName;
      console.log(`🔄 Métier normalisé: "${originalName}" → "${name}"`);
    }
    
    const normalized = this.normalizeMetierName(name);

    // Vérifier le cache avec le nom normalisé
    if (this.cache.metiers.has(normalized)) {
      return this.cache.metiers.get(normalized);
    }

    try {
      // Utiliser l'API v2 pour trouver ou créer le métier
      // enumsApi est maintenant importé directement
      const result = await enumsApi.findOrCreateMetier(name);

      // Stocker dans le cache avec le nom normalisé comme clé
      this.cache.metiers.set(normalized, result.id);
      if (result.created) {
        this.stats.metiersCreated++;
        this.stats.newMetiers.push(name);
      }
      const action = result.created ? "🆕 créé" : "✅ trouvé";
      console.log(
        `${action} Métier: ${name} (normalisé: ${normalized}) (ID: ${result.id})`
      );

      return result.id;
    } catch (error) {
      console.error(
        `Erreur lors de la recherche/création du métier ${name}:`,
        error
      );
      return null;
    }
  }

  async getZoneId(zoneName) {
    if (!zoneName || zoneName.trim() === "") return null;

    const name = zoneName.trim();
    const normalized = this.normalizeZoneName(name);

    // Vérifier le cache avec le nom normalisé
    if (this.cache.zones && this.cache.zones.has(normalized)) {
      return this.cache.zones.get(normalized);
    }

    try {
      // Utiliser l'API v2 pour trouver ou créer la zone
      // enumsApi est maintenant importé directement
      const result = await enumsApi.findOrCreateZone(name);

      if (!this.cache.zones) this.cache.zones = new Map();
      // Stocker dans le cache avec le nom normalisé comme clé
      this.cache.zones.set(normalized, result.id);
      if (result.created) {
        this.stats.zonesCreated++;
      }
      const action = result.created ? "🆕 créée" : "✅ trouvée";
      console.log(
        `${action} Zone: ${name} (normalisé: ${normalized}) (ID: ${result.id})`
      );
      if (result.created) {
        this.stats.newZones.push(name);
      }

      return result.id;
    } catch (error) {
      console.error(
        `Erreur lors de la recherche/création de la zone ${name}:`,
        error
      );
      return null;
    }
  }

  async getArtisanStatusId(statusName) {
    if (!statusName || statusName.trim() === "") return null;

    const name = statusName.trim();

    // Vérifier le cache
    if (this.cache.artisanStatuses.has(name)) {
      return this.cache.artisanStatuses.get(name);
    }

    try {
      // Utiliser l'API v2 pour trouver ou créer le statut artisan
      // enumsApi est maintenant importé directement
      const result = await enumsApi.findOrCreateArtisanStatus(name);

      this.cache.artisanStatuses.set(name, result.id);
      if (result.created) {
        this.stats.artisanStatusesCreated =
          (this.stats.artisanStatusesCreated || 0) + 1;
        this.stats.newArtisanStatuses = this.stats.newArtisanStatuses || [];
        this.stats.newArtisanStatuses.push(name);
      }
      const action = result.created ? "🆕 créé" : "✅ trouvé";
      console.log(`${action} Statut artisan: ${name} (ID: ${result.id})`);

      return result.id;
    } catch (error) {
      console.error(
        `Erreur lors de la recherche/création du statut artisan ${name}:`,
        error
      );
      return null;
    }
  }

  async getInterventionStatusId(statusName) {
    if (!statusName || statusName.trim() === "") {
      console.log("⚠️ Statut intervention vide ou null");
      return null;
    }

    const name = statusName.trim();

    // Vérifier le cache
    if (this.cache.interventionStatuses.has(name)) {
      return this.cache.interventionStatuses.get(name);
    }

    try {
      // Utiliser l'API v2 pour trouver ou créer le statut intervention
      // enumsApi est maintenant importé directement
      const result = await enumsApi.findOrCreateInterventionStatus(name);

      this.cache.interventionStatuses.set(name, result.id);
      if (result.created) {
        this.stats.interventionStatusesCreated =
          (this.stats.interventionStatusesCreated || 0) + 1;
        this.stats.newInterventionStatuses =
          this.stats.newInterventionStatuses || [];
        this.stats.newInterventionStatuses.push(name);
      }
      const action = result.created ? "🆕 créé" : "✅ trouvé";
      console.log(`${action} Statut intervention: ${name} (ID: ${result.id})`);

      return result.id;
    } catch (error) {
      console.error(
        `Erreur lors de la recherche/création du statut intervention ${name}:`,
        error
      );
      return null;
    }
  }

  /**
   * Normalise un libellé de statut avant de rechercher l'ID correspondant.
   * Permet d'éviter la création de doublons lors des imports.
   */
  async getInterventionStatusIdNormalized(statusLabel) {
    if (!statusLabel || statusLabel.trim() === "") {
      console.log("⚠️ Statut intervention vide ou null");
      return null;
    }

    const normalizedKey = normalizeSheetKey(statusLabel);
    const canonicalCode =
      STATUS_LOOKUP[normalizedKey] ||
      STATUS_LABEL_TO_CODE[statusLabel.trim()] ||
      STATUS_LABEL_TO_CODE[statusLabel.trim().toUpperCase()] ||
      STATUS_LABEL_TO_CODE[statusLabel.trim().toLowerCase()];

    if (!canonicalCode) {
      console.warn(
        `⚠️ Statut non mappé: "${statusLabel}". Utilisation du comportement legacy.`
      );
      return this.getInterventionStatusId(statusLabel);
    }

    if (this.cache.interventionStatuses.has(canonicalCode)) {
      return this.cache.interventionStatuses.get(canonicalCode);
    }

    if (typeof enumsApi.getInterventionStatusByCode !== "function") {
      console.warn(
        "⚠️ enumsApi.getInterventionStatusByCode indisponible, fallback legacy."
      );
      return this.getInterventionStatusId(canonicalCode);
    }

    try {
      const { data, error } = await enumsApi.getInterventionStatusByCode(
        canonicalCode
      );

      if (error) {
        throw error;
      }

      if (!data || !data.id) {
        console.error(
          `❌ Statut canonique introuvable en base: ${canonicalCode} (depuis "${statusLabel}")`
        );
        return null;
      }

      this.cache.interventionStatuses.set(canonicalCode, data.id);
      console.log(
        `✅ Statut normalisé: "${statusLabel}" → ${canonicalCode} (ID: ${data.id})`
      );
      return data.id;
    } catch (error) {
      console.error(
        `Erreur lors de la résolution du statut "${statusLabel}" → ${canonicalCode}:`,
        error
      );
      return null;
    }
  }

  // ===== MÉTHODES POUR TENANTS, OWNERS ET ARTISANS =====

  /**
   * Trouve ou crée un tenant (locataire) par email ou téléphone
   * Utilise les méthodes de pre-processing des artisans pour normaliser les données
   * @param {Object} tenantInfo - Informations du tenant
   * @returns {string|null} - ID du tenant créé/trouvé
   */
  async findOrCreateTenant(tenantInfo) {
    const { tenantsApi } = require("../../src/lib/api/v2");

    // Vérifier si on a au moins un identifiant (email ou téléphone)
    if (!tenantInfo.email && !tenantInfo.telephone) {
      console.log("⚠️ Tenant sans email ni téléphone, impossible de créer");
      return null;
    }

    try {
      // Chercher d'abord par email
      if (tenantInfo.email) {
        const existingByEmail = await tenantsApi.searchByEmail(
          tenantInfo.email
        );
        if (existingByEmail && existingByEmail.length > 0) {
          console.log(
            `✅ Tenant trouvé par email: ${tenantInfo.email} (ID: ${existingByEmail[0].id})`
          );
          return existingByEmail[0].id;
        }
      }

      // Chercher ensuite par téléphone
      if (tenantInfo.telephone) {
        const existingByPhone = await tenantsApi.searchByPhone(
          tenantInfo.telephone
        );
        if (existingByPhone && existingByPhone.length > 0) {
          console.log(
            `✅ Tenant trouvé par téléphone: ${tenantInfo.telephone} (ID: ${existingByPhone[0].id})`
          );
          return existingByPhone[0].id;
        }
      }

      // Créer le tenant s'il n'existe pas
      const tenantData = {
        firstname: tenantInfo.firstname,
        lastname: tenantInfo.lastname,
        email: tenantInfo.email,
        telephone: tenantInfo.telephone,
        telephone2: tenantInfo.telephone2,
      };

      const created = await tenantsApi.create(tenantData);
      const name =
        [tenantInfo.firstname, tenantInfo.lastname].filter(Boolean).join(" ") ||
        "Sans nom";
      console.log(`🆕 Tenant créé: ${name} (ID: ${created.id})`);

      return created.id;
    } catch (error) {
      console.error(`Erreur lors de la recherche/création du tenant:`, error);
      return null;
    }
  }

  /**
   * Trouve ou crée un owner (propriétaire) par téléphone
   * Utilise les méthodes de pre-processing des artisans pour normaliser les données
   * @param {Object} ownerInfo - Informations du owner
   * @returns {string|null} - ID du owner créé/trouvé
   */
  async findOrCreateOwner(ownerInfo) {
    const { ownersApi } = require("../../src/lib/api/v2");

    // Vérifier si on a au moins un téléphone
    if (!ownerInfo.telephone) {
      console.log("⚠️ Owner sans téléphone, impossible de créer");
      return null;
    }

    try {
      // Chercher par téléphone
      const existingByPhone = await ownersApi.searchByPhone(
        ownerInfo.telephone
      );
      if (existingByPhone && existingByPhone.length > 0) {
        console.log(
          `✅ Owner trouvé par téléphone: ${ownerInfo.telephone} (ID: ${existingByPhone[0].id})`
        );
        return existingByPhone[0].id;
      }

      // Créer le owner s'il n'existe pas
      const ownerData = {
        owner_firstname: ownerInfo.firstname,
        owner_lastname: ownerInfo.lastname,
        telephone: ownerInfo.telephone,
      };

      const created = await ownersApi.create(ownerData);
      const name =
        [ownerInfo.firstname, ownerInfo.lastname].filter(Boolean).join(" ") ||
        "Sans nom";
      console.log(`🆕 Owner créé: ${name} (ID: ${created.id})`);

      return created.id;
    } catch (error) {
      console.error(`Erreur lors de la recherche/création du owner:`, error);
      return null;
    }
  }

  /**
   * Trouve un artisan par son nom complet
   * Utilise les méthodes de pre-processing pour normaliser le nom
   * @param {string} artisanName - Nom complet de l'artisan
   * @returns {string|null} - ID de l'artisan trouvé
   */
  async findArtisanByName(artisanName) {
    const { artisansApi } = require("../../src/lib/api/v2");

    if (!artisanName || artisanName.trim() === "") {
      return null;
    }

    const name = artisanName.trim();

    try {
      // Chercher l'artisan par son nom (prenom ou nom ou raison_sociale)
      const results = await artisansApi.searchByName(name, { limit: 5 });

      if (results.data && results.data.length > 0) {
        // Prendre le premier résultat (meilleure correspondance)
        const artisan = results.data[0];
        console.log(
          `✅ Artisan SST trouvé: ${name} → ${artisan.prenom} ${artisan.nom} (ID: ${artisan.id})`
        );
        return artisan.id;
      }

      console.log(`⚠️ Artisan SST non trouvé: ${name}`);
      return null;
    } catch (error) {
      console.error(`Erreur lors de la recherche de l'artisan ${name}:`, error);
      return null;
    }
  }

  /**
   * Trouve un artisan SST par son nom avec recherche intelligente
   * Gère les variations : "Prenom Nom 77", "NOM Prenom", "Raison Sociale"
   * @param {string} sstName - Nom de l'artisan SST (ex: "Mehdy Pedron 33")
   * @param {string} idInter - ID de l'intervention (optionnel, pour logging)
   * @param {Object} csvRow - Ligne CSV originale (optionnel, pour logging)
   * @param {number} lineNumber - Numéro de ligne dans le fichier source (optionnel)
   * @returns {string|null} - ID de l'artisan ou null si non trouvé
   */
  async findArtisanSST(sstName, idInter = null, csvRow = null, lineNumber = null) {
    const { artisansApi } = require("../../src/lib/api/v2");

    if (!sstName || !sstName.trim()) {
      return null;
    }

    sstName = sstName.trim();

    // Rate limiting simple : attendre un peu si la dernière recherche était trop récente
    const now = Date.now();
    const timeSinceLastSearch = now - this.lastSSTSearchTime;
    if (timeSinceLastSearch < this.sstSearchDelay) {
      await new Promise(resolve => setTimeout(resolve, this.sstSearchDelay - timeSinceLastSearch));
    }
    this.lastSSTSearchTime = Date.now();

    // Nettoyage complet du nom (espaces, retours à la ligne, tabulations)
    const cleanSstName = sstName.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();

    try {
      // Première tentative avec le nom nettoyé
      let results = await artisansApi.searchByPlainNom(cleanSstName, {
        limit: 1,
      });

      if (results.data && results.data.length > 0) {
        const found = results.data[0];
        //console.log(
        //  `✅ [ARTISAN-SST] Trouvé: ${found.prenom} ${found.nom} (ID: ${found.id})`
        //);
        return found.id;
      }

      // Nettoyage du nom pour deuxième tentative
      let cleanName = cleanSstName
        .replace(/\s+\d{2,3}(?:\s+\d{2,3})?$/, "") // Enlever "77" ou "83 13" à la fin
        .replace(/\s*\([^)]*\)\s*/g, "") // Enlever "(page jaune)"
        .trim();

      if (!cleanName) {
        return null;
      }

      // Petit délai avant la deuxième tentative
      await new Promise(resolve => setTimeout(resolve, this.sstSearchDelay));

      // Deuxième tentative avec le nom nettoyé
      results = await artisansApi.searchByPlainNom(cleanName, { limit: 1 });

      if (results.data && results.data.length > 0) {
        const found = results.data[0];
        console.log(
          `✅ [ARTISAN-SST] Trouvé (après nettoyage): ${found.prenom} ${found.nom} (ID: ${found.id})`
        );
        return found.id;
      }

      // Troisième tentative : gérer les cas composites avec "/"
      if (cleanSstName.includes('/')) {
        // Prendre la première partie avant le "/"
        const firstPart = cleanSstName.split('/')[0].trim();
        
        if (firstPart) {
          // Nettoyer la première partie (enlever départements)
          const cleanFirstPart = firstPart.replace(/\s+\d{2,3}(?:\s+\d{2,3})?$/, "").trim();
          
          // Petit délai avant la troisième tentative
          await new Promise(resolve => setTimeout(resolve, this.sstSearchDelay));
          
          results = await artisansApi.searchByPlainNom(cleanFirstPart, { limit: 1 });
          
          if (results.data && results.data.length > 0) {
            const found = results.data[0];
            console.log(
              `✅ [ARTISAN-SST] Trouvé (composite): ${found.prenom} ${found.nom} (ID: ${found.id})`
            );
            return found.id;
          }
        }
      }

      // Pas trouvé - logger dans le fichier de log avec l'id_inter si disponible
      const logId = idInter || "N/A";
      const reason = `Artisan SST non trouvé: "${sstName}"`;
      this.logParsingError(logId, reason, csvRow, lineNumber);
      console.log(`❌ [ARTISAN-SST] Aucun artisan trouvé pour "${sstName}" (id_inter: ${logId})`);
      return null;
    } catch (error) {
      // Gérer spécifiquement les erreurs réseau avec retry simple
      if (error.message && (error.message.includes('fetch') || error.message.includes('network') || error.message.includes('timeout'))) {
        console.warn(
          `⚠️ [ARTISAN-SST] Erreur réseau pour "${sstName}", retry dans 1s...`
        );
        
        // Retry une seule fois après 1 seconde
        try {
          await new Promise(resolve => setTimeout(resolve, 1000));
          const retryResults = await artisansApi.searchByPlainNom(cleanSstName, { limit: 1 });
          
          if (retryResults.data && retryResults.data.length > 0) {
            const found = retryResults.data[0];
            console.log(
              `✅ [ARTISAN-SST] Trouvé après retry: ${found.prenom} ${found.nom} (ID: ${found.id})`
            );
            return found.id;
          }
        } catch (retryError) {
          console.error(
            `💥 [ARTISAN-SST] Erreur réseau persistante pour "${sstName}": ${retryError.message}`
          );
        }
      } else {
        console.error(
          `💥 [ARTISAN-SST] Erreur recherche "${sstName}": ${error.message}`
        );
      }
      return null;
    }
  }

  // ===== MÉTHODES UTILITAIRES =====

  /**
   * Valide un objet mappé avant insertion
   * @param {Object} mappedData - Données mappées
   * @param {string} type - Type de données ('artisan', 'intervention', 'client')
   * @returns {Object} - Résultat de validation
   */
  validateMappedData(mappedData, type) {
    const errors = [];
    const warnings = [];

    if (type === "artisan") {
      // Validation des artisans selon le schéma
      if (!mappedData.prenom && !mappedData.nom) {
        errors.push("Prénom ou nom requis");
      }

      if (!mappedData.email && !mappedData.telephone) {
        warnings.push("Email ou téléphone recommandé");
      }

      if (mappedData.email && !mappedData.email.includes("@")) {
        errors.push("Email invalide");
      }

      if (mappedData.siret && mappedData.siret.length !== 14) {
        warnings.push("SIRET invalide");
      }
    } else if (type === "intervention") {
      // Validation des interventions selon le schéma
      if (!mappedData.date) {
        errors.push("Date requise");
      }

      if (!mappedData.adresse && !mappedData.ville) {
        warnings.push("Adresse ou ville recommandée");
      }

      if (!mappedData.id_inter) {
        warnings.push("ID intervention recommandé");
      }
    } else if (type === "client") {
      // Validation des clients selon le schéma
      if (!mappedData.firstname && !mappedData.lastname) {
        warnings.push("Prénom ou nom client recommandé");
      }

      if (!mappedData.email && !mappedData.telephone) {
        warnings.push("Email ou téléphone client recommandé");
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Nettoie les données mappées pour l'insertion
   * @param {Object} mappedData - Données mappées
   * @returns {Object} - Données nettoyées
   */
  cleanMappedData(mappedData) {
    const cleaned = { ...mappedData };

    // Supprimer les champs null/undefined/vides
    Object.keys(cleaned).forEach((key) => {
      if (
        cleaned[key] === null ||
        cleaned[key] === undefined ||
        cleaned[key] === ""
      ) {
        delete cleaned[key];
      }
    });

    return cleaned;
  }

  /**
   * Crée les relations artisan-métier
   * @param {string} artisanId - ID de l'artisan
   * @param {string} metierName - Nom du métier depuis le CSV
   * @returns {Object} - Relation artisan-métier
   */
  async createArtisanMetierRelation(artisanId, metierName) {
    const metierId = await this.getMetierId(metierName);
    if (!metierId) return null;

    return {
      artisan_id: artisanId,
      metier_id: metierId,
      is_primary: true, // Premier métier = principal
    };
  }

  /**
   * Mappe les documents Drive depuis les données CSV
   * @param {Object} artisan - Artisan créé
   * @param {Object} csvRow - Ligne CSV originale
   * @returns {Array} - Liste des documents à créer
   */
  mapDocumentsFromCSV(artisan, csvRow) {
    const documents = [];

    // Chercher le champ documentDrive dans la ligne CSV
    const documentDriveUrl = this.getCSVValue(csvRow, "Document Drive");

    if (documentDriveUrl && documentDriveUrl.trim() !== "") {
      // Extraire le nom du document depuis l'URL ou utiliser un nom par défaut
      let documentName = this.extractDocumentNameFromUrl(documentDriveUrl);

      // Si pas de nom extrait, utiliser le nom de l'artisan avec un suffixe descriptif
      if (!documentName) {
        const artisanName = `${artisan.prenom || ""} ${
          artisan.nom || ""
        }`.trim();
        const timestamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
        documentName = artisanName
          ? `Document_${artisanName}_${timestamp}`
          : `Document_Drive_${timestamp}`;
      }

      documents.push({
        artisan_id: artisan.id,
        kind: "drive",
        url: documentDriveUrl.trim(),
        filename: documentName,
        created_at: new Date().toISOString(),
        mime_type: "application/octet-stream",
      });
    }

    return documents;
  }

  /**
   * Extrait le nom du document depuis une URL Drive
   * @param {string} url - URL du document Drive
   * @returns {string|null} - Nom du document ou null
   */
  extractDocumentNameFromUrl(url) {
    // Vérifier d'abord si c'est une URL Google Drive valide
    if (!url || typeof url !== "string") {
      return null;
    }

    // Patterns pour différents types d'URLs Drive
    const patterns = [
      // Fichier Drive : https://drive.google.com/file/d/FILE_ID/view
      /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/,
      // Document Google : https://docs.google.com/document/d/DOC_ID/edit
      /docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)/,
      // Feuille de calcul : https://docs.google.com/spreadsheets/d/SHEET_ID/edit
      /docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/,
      // Dossier Drive : https://drive.google.com/drive/folders/FOLDER_ID
      /drive\.google\.com\/drive\/folders\/([a-zA-Z0-9_-]+)/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        // Générer un nom plus descriptif avec le type et l'ID
        const fileId = match[1];
        const timestamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
        return `Drive_${fileId.slice(0, 8)}_${timestamp}`;
      }
    }

    // Si pas de pattern reconnu, essayer d'extraire depuis les paramètres
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split("/");
      const lastPart = pathParts[pathParts.length - 1];

      // Ne retourner un nom que si c'est un pattern Google Drive reconnu
      if (
        lastPart &&
        lastPart !== "view" &&
        lastPart !== "edit" &&
        (url.includes("drive.google.com") || url.includes("docs.google.com"))
      ) {
        const timestamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
        return `Drive_${lastPart.slice(0, 8)}_${timestamp}`;
      }
    } catch (urlError) {
      // URL invalide, retourner null
      return null;
    }

    // Pour toutes les autres URLs (comme https://example.com/invalid), retourner null
    return null;
  }

  /**
   * Retourne les statistiques de l'import
   * @returns {Object} - Statistiques de l'import
   */
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

  // ===== PARSING DES TENANTS (LOCATAIRES) =====

  /**
   * Parse les informations du locataire depuis les colonnes de l'intervention
   * Gère les cas complexes où les infos sont mélangées entre plusieurs colonnes
   * @param {Object} csvRow - Ligne CSV de l'intervention
   * @param {boolean} verbose - Mode verbose pour afficher le parsing
   * @returns {Object} - Informations du tenant parsées
   */
  parseTenantInfo(csvRow, verbose = false) {
    const locataireCol = this.getCSVValue(csvRow, "Locataire") || "";
    const emailCol = this.getCSVValue(csvRow, "Em@ail Locataire") || "";
    const telCol = this.getCSVValue(csvRow, "TEL LOC") || "";

    // Logging désactivé pour éviter le spam en verbose

    // Résultat final
    const result = {
      firstname: null,
      lastname: null,
      email: null,
      telephone: null,
      telephone2: null,
      raw: {
        locataire: locataireCol,
        email: emailCol,
        tel: telCol,
      },
    };

    // 1. Parser l'email
    result.email =
      this.extractEmail(emailCol) ||
      this.extractEmail(locataireCol) ||
      this.extractEmail(telCol);

    // 2. Parser les téléphones
    // Chercher dans toutes les colonnes
    let phones = this.extractPhones(telCol);
    if (phones.length === 0) {
      phones = this.extractPhones(locataireCol);
    }
    if (phones.length === 0) {
      phones = this.extractPhones(emailCol);
    }

    if (phones.length > 0) {
      result.telephone = phones[0];
      if (phones.length > 1) {
        result.telephone2 = phones[1];
      }
    }

    // 3. Parser le nom et prénom
    // Priorité: colonne Locataire, puis TEL LOC si Locataire est vide
    let nameSource = locataireCol.trim();
    if (!nameSource && telCol.trim()) {
      nameSource = telCol.trim();
    }

    if (nameSource) {
      const parsedName = this.parsePersonName(nameSource);
      result.firstname = parsedName.firstname;
      result.lastname = parsedName.lastname;
    }

    // Logging désactivé - les infos sont affichées dans le log de l'intervention

    return result;
  }

  /**
   * Parse les informations du propriétaire depuis la colonne PROPRIO
   * Gère les cas où téléphone et email sont dans la même colonne
   * @param {Object} csvRow - Ligne CSV de l'intervention
   * @param {boolean} verbose - Mode verbose pour afficher le parsing
   * @returns {Object} - Informations du owner parsées ou null
   */
  parseOwnerInfo(csvRow, verbose = false) {
    const proprioCol = this.getCSVValue(csvRow, "PROPRIO") || "";

    if (!proprioCol || !proprioCol.trim()) {
      return null;
    }

    // Extraire téléphone et email depuis la colonne PROPRIO
    const telephones = this.extractPhones(proprioCol);
    const email = this.extractEmail(proprioCol);

    // Nettoyer le texte pour extraire le nom (enlever téléphones et email)
    let nameText = proprioCol;

    // Enlever les téléphones du texte
    telephones.forEach((tel) => {
      // Enlever différentes représentations du téléphone
      nameText = nameText.replace(tel, "");
      nameText = nameText.replace(tel.replace(/(\d{2})(?=\d)/g, "$1 "), ""); // Format avec espaces
      nameText = nameText.replace(tel.replace(/(\d{2})(?=\d)/g, "$1."), ""); // Format avec points
    });

    // Enlever l'email du texte
    if (email) {
      nameText = nameText.replace(email, "");
    }

    // Parser le nom restant
    const parsedName = this.parsePersonName(nameText);

    return {
      firstname: parsedName.firstname,
      lastname: parsedName.lastname,
      telephone: telephones.length > 0 ? telephones[0] : null,
      email: email,
    };
  }

  /**
   * Extrait un email depuis une chaîne de caractères
   * @param {string} text - Texte contenant potentiellement un email
   * @returns {string|null} - Email extrait ou null
   */
  extractEmail(text) {
    if (!text || typeof text !== "string") return null;

    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
    const match = text.match(emailRegex);
    return match ? match[0].toLowerCase() : null;
  }

  /**
   * Extrait les numéros de téléphone depuis une chaîne de caractères
   * @param {string} text - Texte contenant potentiellement des téléphones
   * @returns {Array<string>} - Liste des téléphones trouvés
   */
  extractPhones(text) {
    if (!text || typeof text !== "string") return [];

    const phones = [];

    // Patterns pour différents formats de téléphone français
    const patterns = [
      /0[1-9](?:[\s.-]?\d{2}){4}/g, // 06 12 34 56 78 ou 0612345678
      /\+33[\s.-]?[1-9](?:[\s.-]?\d{2}){4}/g, // +33 6 12 34 56 78
      /\d{10}/g, // 0612345678
    ];

    for (const pattern of patterns) {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach((match) => {
          // Nettoyer le numéro (enlever espaces, points, tirets)
          const cleaned = match.replace(/[\s.-]/g, "");
          // Convertir +33 en 0
          const normalized = cleaned.startsWith("+33")
            ? "0" + cleaned.slice(3)
            : cleaned;
          // Vérifier que c'est bien 10 chiffres commençant par 0
          if (
            normalized.length === 10 &&
            normalized.startsWith("0") &&
            !phones.includes(normalized)
          ) {
            phones.push(normalized);
          }
        });
      }
    }

    return phones;
  }

  /**
   * Parse un nom complet pour extraire prénom et nom
   * Gère les cas: "M. Jean DUPONT", "Monsieur Jean Dupont", "DUPONT Jean", etc.
   * @param {string} fullName - Nom complet à parser
   * @returns {Object} - {firstname, lastname}
   */
  parsePersonName(fullName) {
    if (!fullName || typeof fullName !== "string") {
      return { firstname: null, lastname: null };
    }

    // Nettoyer le texte
    let cleaned = fullName.trim();

    // Enlever les numéros de téléphone du texte
    cleaned = cleaned.replace(/0[1-9](?:[\s.-]?\d{2}){4}/g, "");
    cleaned = cleaned.replace(/\+33[\s.-]?[1-9](?:[\s.-]?\d{2}){4}/g, "");

    // Enlever les mentions comme "conjointe", "Tél :", etc.
    cleaned = cleaned.replace(
      /\b(conjointe?|conjoint|tél\.?|téléphone|email|mail)\b/gi,
      ""
    );

    // Enlever les civilités
    cleaned = cleaned.replace(
      /\b(M\.|Mme|Mlle|Mr|Monsieur|Madame|Mademoiselle)\b/gi,
      ""
    );

    // Enlever les caractères spéciaux et espaces multiples
    cleaned = cleaned
      .replace(/[,:;\/]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (!cleaned) {
      return { firstname: null, lastname: null };
    }

    // Séparer les mots
    let words = cleaned.split(/\s+/).filter((w) => w.length > 0);

    if (words.length === 0) {
      return { firstname: null, lastname: null };
    }

    // Filtrer les civilités courtes qui auraient pu rester (M, Mme, etc.)
    // en début de liste uniquement
    const civilites = ["m", "mme", "mlle", "mr", "ms", "dr"];
    if (words.length > 1 && civilites.includes(words[0].toLowerCase())) {
      words = words.slice(1);
    }

    if (words.length === 0) {
      return { firstname: null, lastname: null };
    }

    if (words.length === 1) {
      // Un seul mot, on le met comme nom de famille
      return {
        firstname: null,
        lastname: this.capitalizeFirstLetter(words[0]),
      };
    }

    // Détecter si le nom est en majuscules (format "DUPONT Jean")
    const uppercaseWords = [];
    const lowercaseWords = [];

    words.forEach((w) => {
      if (w === w.toUpperCase() && w.length > 1) {
        uppercaseWords.push(w);
      } else {
        lowercaseWords.push(w);
      }
    });

    // Si on a un mélange de mots en majuscules et minuscules
    if (uppercaseWords.length > 0 && lowercaseWords.length > 0) {
      // Format "DUPONT Jean" ou "DUPONT Jean-Pierre"
      return {
        firstname: this.capitalizeFirstLetter(lowercaseWords.join(" ")),
        lastname: this.capitalizeFirstLetter(uppercaseWords.join(" ")),
      };
    }

    // Si tout est en majuscules (ex: "THOMAS GERMANAUD")
    if (uppercaseWords.length === words.length && words.length >= 2) {
      // Premier mot = prénom, reste = nom
      return {
        firstname: this.capitalizeFirstLetter(words[0]),
        lastname: this.capitalizeFirstLetter(words.slice(1).join(" ")),
      };
    }

    // Format normal "Jean Dupont" ou "Jean-Pierre Dupont Martin"
    // Premier mot = prénom, reste = nom
    return {
      firstname: this.capitalizeFirstLetter(words[0]),
      lastname: this.capitalizeFirstLetter(words.slice(1).join(" ")),
    };
  }

  /**
   * Capitalise la première lettre de chaque mot
   * @param {string} text - Texte à capitaliser
   * @returns {string} - Texte capitalisé
   */
  capitalizeFirstLetter(text) {
    if (!text || typeof text !== "string") return text;

    return text
      .toLowerCase()
      .split(/\s+/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }
}

module.exports = { DataMapper };
