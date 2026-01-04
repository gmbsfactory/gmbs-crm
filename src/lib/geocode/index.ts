/**
 * Service de géocodage avec Strategy Pattern
 * 
 * @example
 * ```typescript
 * import { geocodeService } from "@/lib/geocode"
 * 
 * const results = await geocodeService.geocode("rue de Rivoli Paris", { limit: 5 })
 * ```
 * 
 * @see docs/architecture/geocode-service.md pour la documentation complète
 */

// Service principal
export { GeocodeService, geocodeService } from "./geocode-service"

// Types
export type {
  GeocodeProvider,
  GeocodeResult,
  GeocodeOptions,
  GeocodeServiceConfig,
  GeocodeExecutionMode,
} from "./types"

// Providers
export { 
  FrenchAddressProvider, 
  OpenCageProvider, 
  NominatimProvider 
} from "./providers"

// Utilitaires
export {
  isInFrance,
  shouldPreferFrance,
  enrichAddressWithFrance,
  normalizeQueryForSearch,
  cleanQuery,
  generateCacheKey,
} from "./utils"


