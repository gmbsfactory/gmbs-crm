// ===== CACHE CENTRALISÉ POUR L'API V2 =====
// Singleton pour gérer le cache des données de référence
// Évite la duplication du cache entre les différents modules

import { referenceApi, type ReferenceData } from "@/lib/reference-api";

/**
 * Structure du cache avec les Maps d'accès rapide par ID
 */
export type ReferenceCache = {
  data: ReferenceData;
  fetchedAt: number;
  usersById: Map<string, ReferenceData["users"][number]>;
  allUsersById: Map<string, ReferenceData["allUsers"][number]>;
  agenciesById: Map<string, ReferenceData["agencies"][number]>;
  interventionStatusesById: Map<string, ReferenceData["interventionStatuses"][number]>;
  artisanStatusesById: Map<string, ReferenceData["artisanStatuses"][number]>;
  metiersById: Map<string, ReferenceData["metiers"][number]>;
};

import { REFERENCE_CACHE_DURATION, REFERENCE_CACHE_FAILURE_BACKOFF } from "./constants";

/**
 * Gestionnaire centralisé du cache des données de référence
 * Utilise le pattern Singleton pour garantir une seule instance
 */
class ReferenceCacheManager {
  private static instance: ReferenceCacheManager;
  private cache: ReferenceCache | null = null;
  private fetchPromise: Promise<ReferenceCache> | null = null;
  private lastFailureAt: number | null = null;
  private lastError: unknown = null;

  private constructor() {
    // Constructeur privé pour le pattern Singleton
  }

  /**
   * Obtenir l'instance unique du gestionnaire de cache
   */
  static getInstance(): ReferenceCacheManager {
    if (!ReferenceCacheManager.instance) {
      ReferenceCacheManager.instance = new ReferenceCacheManager();
    }
    return ReferenceCacheManager.instance;
  }

  /**
   * Obtenir le cache des données de référence
   * Récupère les données si le cache est expiré ou inexistant
   */
  async get(): Promise<ReferenceCache> {
    const now = Date.now();

    // Si le cache existe et n'est pas expiré, le retourner directement
    if (this.cache && now - this.cache.fetchedAt < REFERENCE_CACHE_DURATION) {
      return this.cache;
    }

    // Si une requête est déjà en cours, attendre son résultat
    if (this.fetchPromise) {
      return this.fetchPromise;
    }

    // Backoff après un échec récent : éviter de marteler l'API.
    // Si on a un cache périmé mais utilisable, on le sert ; sinon on rejette
    // immédiatement pour ne pas relancer un fetch qui vient d'échouer.
    if (this.lastFailureAt && now - this.lastFailureAt < REFERENCE_CACHE_FAILURE_BACKOFF) {
      if (this.cache) return this.cache;
      throw this.lastError ?? new Error('Reference cache fetch failed (in backoff)');
    }

    // Lancer une nouvelle requête
    this.fetchPromise = this.fetchData();

    try {
      const result = await this.fetchPromise;
      this.lastFailureAt = null;
      this.lastError = null;
      return result;
    } catch (error) {
      // En cas d'erreur : reset la promesse, marquer le timestamp d'échec
      // pour activer le backoff sur les appels suivants.
      this.fetchPromise = null;
      this.lastFailureAt = Date.now();
      this.lastError = error;
      throw error;
    }
  }

  /**
   * Récupérer les données de référence et construire le cache
   */
  private async fetchData(): Promise<ReferenceCache> {
    const data = await referenceApi.getAll();

    const cache: ReferenceCache = {
      data,
      fetchedAt: Date.now(),
      usersById: new Map(data.users.map((user) => [user.id, user])),
      allUsersById: new Map(data.allUsers.map((user) => [user.id, user])),
      agenciesById: new Map(data.agencies.map((agency) => [agency.id, agency])),
      interventionStatusesById: new Map(
        data.interventionStatuses.map((status) => [status.id, status])
      ),
      artisanStatusesById: new Map(
        data.artisanStatuses.map((status) => [status.id, status])
      ),
      metiersById: new Map(data.metiers.map((metier) => [metier.id, metier])),
    };

    this.cache = cache;
    this.fetchPromise = null;
    return cache;
  }

  /**
   * Invalider le cache pour forcer un rechargement
   */
  invalidate(): void {
    this.cache = null;
    this.fetchPromise = null;
  }

  /**
   * Vérifier si le cache est valide
   */
  isValid(): boolean {
    if (!this.cache) return false;
    return Date.now() - this.cache.fetchedAt < REFERENCE_CACHE_DURATION;
  }

  /**
   * Obtenir l'âge du cache en millisecondes
   */
  getAge(): number | null {
    if (!this.cache) return null;
    return Date.now() - this.cache.fetchedAt;
  }
}

// Instance singleton exportée
export const referenceCacheManager = ReferenceCacheManager.getInstance();

// Fonction utilitaire pour obtenir le cache (compatibilité avec l'ancien code)
export async function getReferenceCache(): Promise<ReferenceCache> {
  return referenceCacheManager.get();
}

// Fonction utilitaire pour invalider le cache
export function invalidateReferenceCache(): void {
  referenceCacheManager.invalidate();
}

// Ré-exporter le type ReferenceData pour faciliter les imports
export type { ReferenceData };







