'use strict';

const {
  enumsApi,
} = require('../../../src/lib/api/v2');
const {
  ARTISAN_STATUS_LABEL_TO_CODE,
  STATUS_LABEL_TO_CODE,
  GESTIONNAIRE_CODE_MAP,
  AGENCE_NORMALIZATION_MAP,
  METIER_NORMALIZATION_MAP,
} = require('../mapping-constants');

const normalizeSheetKey = (value) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toUpperCase();

const ARTISAN_STATUS_LOOKUP = Object.entries(ARTISAN_STATUS_LABEL_TO_CODE).reduce(
  (acc, [key, code]) => {
    const normalizedKey = normalizeSheetKey(key);
    if (!acc[normalizedKey]) acc[normalizedKey] = code;
    return acc;
  },
  {}
);

const STATUS_LOOKUP = Object.entries(STATUS_LABEL_TO_CODE).reduce(
  (acc, [key, code]) => {
    const normalizedKey = normalizeSheetKey(key);
    if (!acc[normalizedKey]) acc[normalizedKey] = code;
    return acc;
  },
  {}
);

function normalizeMetierName(metierName) {
  if (!metierName || typeof metierName !== 'string') return '';
  return metierName
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\/\-]/g, ' ')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeZoneName(zoneName) {
  if (!zoneName || typeof zoneName !== 'string') return '';
  return zoneName
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\/\-]/g, ' ')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

class EnumResolver {
  constructor() {
    this.cache = {
      agencies: new Map(),
      users: new Map(),
      metiers: new Map(),
      zones: new Map(),
      artisanStatuses: new Map(),
      interventionStatuses: new Map(),
    };
  }

  async getAgencyId(agenceName, authenticatedClient) {
    if (!agenceName || agenceName.trim() === '') return null;
    let name = agenceName.trim();

    const normalizedKey = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (AGENCE_NORMALIZATION_MAP.hasOwnProperty(normalizedKey)) {
      const normalizedName = AGENCE_NORMALIZATION_MAP[normalizedKey];
      if (normalizedName === null) {
        console.log(`⚠️ Agence aberrante ignorée: "${name}"`);
        return null;
      }
      const originalName = name;
      name = normalizedName;
      // console.log(`🔄 Agence normalisée: "${originalName}" → "${name}"`);
    }

    if (this.cache.agencies.has(name)) return this.cache.agencies.get(name);

    const { data, error } = await enumsApi.getAgencyByName(name, authenticatedClient);
    if (error || !data || !data.id) {
      throw new Error(`Agence introuvable en base: "${name}". Vérifiez que cette agence existe.`);
    }

    this.cache.agencies.set(name, data.id);
    // console.log(`✅ Agence trouvée: ${name} (ID: ${data.id})`);
    return data.id;
  }

  async getUserId(gestionnaireName, authenticatedClient) {
    if (!gestionnaireName || gestionnaireName.trim() === '') return null;
    const name = gestionnaireName.trim();

    if (this.cache.users.has(name)) return this.cache.users.get(name);

    const { data, error } = await enumsApi.getUserByUsername(name, authenticatedClient);
    if (error || !data || !data.id) {
      throw new Error(
        `Utilisateur introuvable en base: "${name}". Vérifiez que cet utilisateur existe ou ajoutez son code dans GESTIONNAIRE_CODE_MAP.`
      );
    }

    this.cache.users.set(name, data.id);
    // console.log(`✅ Utilisateur trouvé: ${name} (ID: ${data.id})`);
    return data.id;
  }

  async getUserIdNormalized(gestionnaireCode, authenticatedClient, warningsAccumulator = null) {
    if (!gestionnaireCode || gestionnaireCode.trim() === '') return null;

    const trimmedCode = gestionnaireCode.trim().toLowerCase();
    const username = GESTIONNAIRE_CODE_MAP[trimmedCode];

    if (!username) {
      throw new Error(
        `Gestionnaire non mappé: "${gestionnaireCode}". Ajoutez ce code dans GESTIONNAIRE_CODE_MAP (mapping-constants.js).`
      );
    }

    if (this.cache.users.has(username)) return this.cache.users.get(username);

    if (typeof enumsApi.getUserByUsername !== 'function') {
      console.warn('⚠️ enumsApi.getUserByUsername indisponible, fallback legacy.');
      return this.getUserId(username, authenticatedClient);
    }

    try {
      const { data, error } = await enumsApi.getUserByUsername(username, authenticatedClient);

      if (error) {
        if (error.code === 'PGRST116') {
          console.log(`ℹ️ Username "${username}" non trouvé en base (depuis "${gestionnaireCode}")`);
          return null;
        }
        throw error;
      }

      if (!data || !data.id) {
        const warnMsg = `Username canonique introuvable en base: ${username} (depuis "${gestionnaireCode}")`;
        console.error(`❌ ${warnMsg}`);
        if (warningsAccumulator) {
          warningsAccumulator.push({ type: 'gestionnaire', reason: warnMsg });
        }
        return null;
      }

      this.cache.users.set(username, data.id);
      // console.log(`✅ Gestionnaire normalisé: "${gestionnaireCode}" → ${username} (ID: ${data.id})`);
      return data.id;
    } catch (error) {
      console.error(`Erreur lors de la résolution du gestionnaire "${gestionnaireCode}" → ${username}:`, error);
      return null;
    }
  }

  async getMetierId(metierName, authenticatedClient) {
    if (!metierName || metierName.trim() === '') return null;
    let name = metierName.trim();

    const normalizedKey = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (METIER_NORMALIZATION_MAP.hasOwnProperty(normalizedKey)) {
      const normalizedName = METIER_NORMALIZATION_MAP[normalizedKey];
      if (normalizedName === null) {
        console.log(`⚠️ Métier aberrant ignoré: "${name}"`);
        return null;
      }
      const originalName = name;
      name = normalizedName;
      // console.log(`🔄 Métier normalisé: "${originalName}" → "${name}"`);
    }

    const normalized = normalizeMetierName(name);
    if (this.cache.metiers.has(normalized)) return this.cache.metiers.get(normalized);

    const { data, error } = await enumsApi.getMetierByName(name, authenticatedClient);
    if (error || !data || !data.id) {
      throw new Error(`Métier introuvable en base: "${name}". Vérifiez que ce métier existe.`);
    }

    this.cache.metiers.set(normalized, data.id);
    // console.log(`✅ Métier trouvé: ${name} (normalisé: ${normalized}) (ID: ${data.id})`);
    return data.id;
  }

  async getZoneId(zoneName, authenticatedClient) {
    if (!zoneName || zoneName.trim() === '') return null;
    const name = zoneName.trim();
    const normalized = normalizeZoneName(name);

    if (this.cache.zones && this.cache.zones.has(normalized)) return this.cache.zones.get(normalized);

    const { data, error } = await enumsApi.getZoneByName(name, authenticatedClient);
    if (error || !data || !data.id) {
      throw new Error(`Zone introuvable en base: "${name}". Vérifiez que cette zone existe.`);
    }

    if (!this.cache.zones) this.cache.zones = new Map();
    this.cache.zones.set(normalized, data.id);
    // console.log(`✅ Zone trouvée: ${name} (normalisé: ${normalized}) (ID: ${data.id})`);
    return data.id;
  }

  async getArtisanStatusIdNormalized(statusLabel, authenticatedClient) {
    if (!statusLabel || statusLabel.trim() === '') {
      console.log('⚠️ Statut artisan vide ou null');
      return null;
    }

    const normalizedKey = normalizeSheetKey(statusLabel);
    const canonicalCode =
      ARTISAN_STATUS_LOOKUP[normalizedKey] ||
      ARTISAN_STATUS_LABEL_TO_CODE[statusLabel.trim().toUpperCase()];

    if (!canonicalCode) {
      console.warn(`⚠️ Statut artisan non mappé: "${statusLabel}".`);
      throw new Error(
        `Statut artisan non mappé: "${statusLabel}". Ajoutez ce statut dans ARTISAN_STATUS_LOOKUP (mapping-constants.js).`
      );
    }

    if (this.cache.artisanStatuses.has(canonicalCode)) return this.cache.artisanStatuses.get(canonicalCode);

    const { data, error } = await enumsApi.getArtisanStatusByCode(canonicalCode, authenticatedClient);
    if (error || !data || !data.id) {
      throw new Error(
        `Statut artisan introuvable en base: "${statusLabel}" → "${canonicalCode}". Vérifiez que ce statut existe.`
      );
    }

    this.cache.artisanStatuses.set(canonicalCode, data.id);
    // console.log(`✅ Statut artisan: "${statusLabel}" → ${canonicalCode} (ID: ${data.id})`);
    return data.id;
  }

  async getArtisanStatusId(statusName, authenticatedClient) {
    if (!statusName || statusName.trim() === '') return null;
    const name = statusName.trim();

    if (this.cache.artisanStatuses.has(name)) return this.cache.artisanStatuses.get(name);

    const { data, error } = await enumsApi.getArtisanStatusByCode(name, authenticatedClient);
    if (error || !data || !data.id) {
      throw new Error(`Statut artisan introuvable en base: "${name}". Vérifiez que ce statut existe.`);
    }

    this.cache.artisanStatuses.set(name, data.id);
    // console.log(`✅ Statut artisan trouvé: ${name} (ID: ${data.id})`);
    return data.id;
  }

  async getInterventionStatusId(statusName, authenticatedClient) {
    if (!statusName || statusName.trim() === '') {
      console.log('⚠️ Statut intervention vide ou null');
      return null;
    }
    const name = statusName.trim();

    if (this.cache.interventionStatuses.has(name)) return this.cache.interventionStatuses.get(name);

    const { data, error } = await enumsApi.getInterventionStatusByCode(name, authenticatedClient);
    if (error || !data || !data.id) {
      throw new Error(`Statut intervention introuvable en base: "${name}". Vérifiez que ce statut existe.`);
    }

    this.cache.interventionStatuses.set(name, data.id);
    // console.log(`✅ Statut intervention trouvé: ${name} (ID: ${data.id})`);
    return data.id;
  }

  async getInterventionStatusIdNormalized(statusLabel, authenticatedClient) {
    if (!statusLabel || statusLabel.trim() === '') {
      console.log('⚠️ Statut intervention vide ou null');
      return null;
    }

    const normalizedKey = normalizeSheetKey(statusLabel);
    const canonicalCode =
      STATUS_LOOKUP[normalizedKey] ||
      STATUS_LABEL_TO_CODE[statusLabel.trim()] ||
      STATUS_LABEL_TO_CODE[statusLabel.trim().toUpperCase()] ||
      STATUS_LABEL_TO_CODE[statusLabel.trim().toLowerCase()];

    if (!canonicalCode) {
      throw new Error(
        `Statut intervention non mappé: "${statusLabel}". Ajoutez ce statut dans STATUS_LOOKUP (mapping-constants.js).`
      );
    }

    if (this.cache.interventionStatuses.has(canonicalCode)) return this.cache.interventionStatuses.get(canonicalCode);

    const { data, error } = await enumsApi.getInterventionStatusByCode(canonicalCode, authenticatedClient);
    if (error || !data || !data.id) {
      throw new Error(
        `Statut intervention introuvable en base: "${statusLabel}" → "${canonicalCode}". Vérifiez que ce statut existe.`
      );
    }

    this.cache.interventionStatuses.set(canonicalCode, data.id);
    // console.log(`✅ Statut intervention: "${statusLabel}" → ${canonicalCode} (ID: ${data.id})`);
    return data.id;
  }

  // Exposed for backward compat
  normalizeMetierName(name) { return normalizeMetierName(name); }
  normalizeZoneName(name) { return normalizeZoneName(name); }
}

module.exports = { EnumResolver };
