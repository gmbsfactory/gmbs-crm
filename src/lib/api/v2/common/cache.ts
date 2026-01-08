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
  agenciesById: Map<string, ReferenceData["agencies"][number]>;
  interventionStatusesById: Map<string, ReferenceData["interventionStatuses"][number]>;
  artisanStatusesById: Map<string, ReferenceData["artisanStatuses"][number]>;
  metiersById: Map<string, ReferenceData["metiers"][number]>;
};

// Durée de validité du cache : 5 minutes
const REFERENCE_CACHE_DURATION = 5 * 60 * 1000;

/**
 * Gestionnaire centralisé du cache des données de référence
 * Utilise le pattern Singleton pour garantir une seule instance
 */
class ReferenceCacheManager {
  private static instance: ReferenceCacheManager;
  private cache: ReferenceCache | null = null;
  private fetchPromise: Promise<ReferenceCache> | null = null;

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

    // Lancer une nouvelle requête
    this.fetchPromise = this.fetchData();

    try {
      return await this.fetchPromise;
    } catch (error) {
      // En cas d'erreur, réinitialiser la promesse pour permettre de réessayer
      this.fetchPromise = null;
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






