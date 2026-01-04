/**
 * Service de géocodage avec Strategy Pattern
 * 
 * Orchestre plusieurs providers de géocodage et gère :
 * - Le cache des résultats
 * - La déduplication
 * - Les différents modes d'exécution (cascade, parallèle)
 * - Le fallback automatique
 */

import type {
  GeocodeProvider,
  GeocodeOptions,
  GeocodeResult,
  GeocodeServiceConfig,
  GeocodeCacheEntry,
  GeocodeExecutionMode,
} from "./types"
import { shouldPreferFrance } from "./utils/france-bounds"
import { generateCacheKey } from "./utils/normalize"
import { FrenchAddressProvider, OpenCageProvider, NominatimProvider } from "./providers"

/**
 * Configuration par défaut du service
 */
const DEFAULT_CONFIG: GeocodeServiceConfig = {
  mode: "cascade",
  cacheTtlMs: 60_000, // 1 minute
  defaultLimit: 5,
  preferFrance: true,
  verbose: false,
}

/**
 * Service de géocodage principal
 * 
 * @example
 * ```typescript
 * const service = GeocodeService.getInstance()
 * const results = await service.geocode("rue de Rivoli Paris", { limit: 5 })
 * ```
 */
export class GeocodeService {
  private static instance: GeocodeService | null = null

  private providers: GeocodeProvider[] = []
  private cache = new Map<string, GeocodeCacheEntry>()
  private config: GeocodeServiceConfig

  private constructor(config: Partial<GeocodeServiceConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.initializeDefaultProviders()
  }

  /**
   * Obtient l'instance singleton du service
   */
  static getInstance(config?: Partial<GeocodeServiceConfig>): GeocodeService {
    if (!GeocodeService.instance) {
      GeocodeService.instance = new GeocodeService(config)
    }
    return GeocodeService.instance
  }

  /**
   * Réinitialise l'instance (utile pour les tests)
   */
  static resetInstance(): void {
    GeocodeService.instance = null
  }

  /**
   * Initialise les providers par défaut
   */
  private initializeDefaultProviders(): void {
    // API Adresse France (priorité 0)
    this.registerProvider(new FrenchAddressProvider())

    // OpenCage (priorité 10) - si la clé est configurée
    const opencage = new OpenCageProvider()
    if (opencage.isAvailable()) {
      this.registerProvider(opencage)
    }

    // Nominatim (priorité 20) - toujours disponible comme fallback
    this.registerProvider(new NominatimProvider())
  }

  /**
   * Enregistre un nouveau provider
   */
  registerProvider(provider: GeocodeProvider): void {
    this.providers.push(provider)
    // Trier par priorité (plus bas = plus prioritaire)
    this.providers.sort((a, b) => a.priority - b.priority)
  }

  /**
   * Retourne la liste des providers enregistrés
   */
  getProviders(): GeocodeProvider[] {
    return [...this.providers]
  }

  /**
   * Change le mode d'exécution
   */
  setMode(mode: GeocodeExecutionMode): void {
    this.config.mode = mode
  }

  /**
   * Effectue une requête de géocodage
   */
  async geocode(query: string, options: Partial<GeocodeOptions> = {}): Promise<GeocodeResult[]> {
    const trimmedQuery = query.trim()
    if (!trimmedQuery) {
      return []
    }

    const fullOptions: GeocodeOptions = {
      limit: options.limit ?? this.config.defaultLimit,
      signal: options.signal,
      countryCode: options.countryCode ?? (this.config.preferFrance && shouldPreferFrance(trimmedQuery) ? "fr" : undefined),
      autocomplete: options.autocomplete ?? true,
      language: options.language ?? "fr",
      verbose: options.verbose ?? this.config.verbose,
    }

    if (fullOptions.verbose) {
      console.log(`[GeocodeService] Geocoding: "${trimmedQuery}"`, { mode: this.config.mode, options: fullOptions })
    }

    // Vérifier le cache
    const cacheKey = generateCacheKey(trimmedQuery, { countryCode: fullOptions.countryCode })
    const cached = this.cache.get(cacheKey)
    if (cached && cached.expiresAt > Date.now()) {
      return cached.results.slice(0, fullOptions.limit)
    }

    // Exécuter selon le mode configuré
    let results: GeocodeResult[]
    switch (this.config.mode) {
      case "parallel":
        results = await this.executeParallel(trimmedQuery, fullOptions)
        break
      case "first_success":
        results = await this.executeFirstSuccess(trimmedQuery, fullOptions)
        break
      case "cascade":
      default:
        results = await this.executeCascade(trimmedQuery, fullOptions)
        break
    }

    // Mettre en cache
    if (results.length > 0) {
      if (fullOptions.verbose) {
        console.log(`[GeocodeService] Found ${results.length} results from ${results[0]?.provider}`)
      }
      this.cache.set(cacheKey, {
        results,
        expiresAt: Date.now() + this.config.cacheTtlMs,
      })
    } else if (fullOptions.verbose) {
      console.log(`[GeocodeService] No results found for: "${trimmedQuery}"`)
    }

    return results.slice(0, fullOptions.limit)
  }

  /**
   * Mode CASCADE : Essayer les providers dans l'ordre de priorité
   * S'arrête dès qu'un provider retourne des résultats
   */
  private async executeCascade(query: string, options: GeocodeOptions): Promise<GeocodeResult[]> {
    const eligibleProviders = this.providers.filter(
      (p) => p.isAvailable() && p.supportsQuery(query, options)
    )

    if (options.verbose) {
      console.log(`[GeocodeService] Cascade mode: ${eligibleProviders.length} eligible providers`, eligibleProviders.map(p => p.name))
    }

    for (const provider of eligibleProviders) {
      try {
        if (options.verbose) {
          console.log(`[GeocodeService] Trying provider: ${provider.name}`)
        }
        const results = await provider.geocode(query, options)
        if (results.length > 0) {
          if (options.verbose) {
            console.log(`[GeocodeService] Success with provider: ${provider.name} (${results.length} results)`)
          }
          return results
        }
        if (options.verbose) {
          console.log(`[GeocodeService] Provider ${provider.name} returned no results`)
        }
      } catch (error) {
        console.warn(`[GeocodeService] Provider ${provider.name} failed:`, error)
        // Continuer avec le provider suivant
      }
    }

    // Fallback : essayer tous les providers disponibles
    if (options.verbose) {
      console.log(`[GeocodeService] Cascade fallback: trying all available providers`)
    }
    for (const provider of this.providers) {
      if (!eligibleProviders.includes(provider) && provider.isAvailable()) {
        try {
          if (options.verbose) {
            console.log(`[GeocodeService] Trying fallback provider: ${provider.name}`)
          }
          const results = await provider.geocode(query, options)
          if (results.length > 0) {
            if (options.verbose) {
              console.log(`[GeocodeService] Success with fallback provider: ${provider.name} (${results.length} results)`)
            }
            return results
          }
        } catch {
          // Ignorer les erreurs en fallback
        }
      }
    }

    return []
  }

  /**
   * Mode PARALLEL : Lancer tous les providers en parallèle et fusionner les résultats
   */
  private async executeParallel(query: string, options: GeocodeOptions): Promise<GeocodeResult[]> {
    const eligibleProviders = this.providers.filter(
      (p) => p.isAvailable() && p.supportsQuery(query, options)
    )

    const promises = eligibleProviders.map((provider) =>
      provider.geocode(query, options).catch((error) => {
        console.warn(`[GeocodeService] Provider ${provider.name} failed:`, error)
        return [] as GeocodeResult[]
      })
    )

    const settledResults = await Promise.all(promises)

    // Fusionner et dédupliquer
    return this.mergeAndDeduplicate(settledResults.flat(), options.limit)
  }

  /**
   * Mode FIRST_SUCCESS : Lancer tous les providers en parallèle et retourner le premier résultat
   */
  private async executeFirstSuccess(query: string, options: GeocodeOptions): Promise<GeocodeResult[]> {
    const eligibleProviders = this.providers.filter(
      (p) => p.isAvailable() && p.supportsQuery(query, options)
    )

    // Créer une promesse qui se résout dès qu'un provider retourne des résultats
    return new Promise((resolve) => {
      let resolved = false
      let completedCount = 0

      const tryResolve = (results: GeocodeResult[]) => {
        if (!resolved && results.length > 0) {
          resolved = true
          resolve(results)
        }
      }

      const checkComplete = () => {
        completedCount++
        if (completedCount === eligibleProviders.length && !resolved) {
          resolve([])
        }
      }

      for (const provider of eligibleProviders) {
        provider
          .geocode(query, options)
          .then(tryResolve)
          .catch(() => {
            // Ignorer les erreurs
          })
          .finally(checkComplete)
      }

      // Timeout de sécurité
      setTimeout(() => {
        if (!resolved) {
          resolve([])
        }
      }, 10_000)
    })
  }

  /**
   * Fusionne et déduplique les résultats de plusieurs providers
   */
  private mergeAndDeduplicate(results: GeocodeResult[], limit: number): GeocodeResult[] {
    const seen = new Set<string>()
    const unique: GeocodeResult[] = []

    // Trier par score décroissant puis par priorité de provider
    const sorted = [...results].sort((a, b) => {
      const scoreA = a.score ?? 0
      const scoreB = b.score ?? 0
      if (scoreB !== scoreA) {
        return scoreB - scoreA
      }
      // À score égal, préférer les providers avec une priorité plus basse
      const priorityA = this.providers.find((p) => p.name === a.provider)?.priority ?? 100
      const priorityB = this.providers.find((p) => p.name === b.provider)?.priority ?? 100
      return priorityA - priorityB
    })

    for (const result of sorted) {
      // Clé de déduplication basée sur les coordonnées arrondies
      const key = `${result.lat.toFixed(5)}|${result.lng.toFixed(5)}`
      if (!seen.has(key)) {
        seen.add(key)
        unique.push(result)
        if (unique.length >= limit) {
          break
        }
      }
    }

    return unique
  }

  /**
   * Vide le cache
   */
  clearCache(): void {
    this.cache.clear()
  }

  /**
   * Retourne les statistiques du cache
   */
  getCacheStats(): { size: number; entries: number } {
    let validEntries = 0
    const now = Date.now()
    for (const entry of this.cache.values()) {
      if (entry.expiresAt > now) {
        validEntries++
      }
    }
    return {
      size: this.cache.size,
      entries: validEntries,
    }
  }
}

/**
 * Instance par défaut du service (singleton)
 */
export const geocodeService = GeocodeService.getInstance()


