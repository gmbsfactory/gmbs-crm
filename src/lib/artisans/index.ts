/**
 * Module d'affichage unifié pour les artisans
 *
 * Ce module centralise toute la logique d'extraction et de formatage
 * des données artisan pour un affichage cohérent dans l'application.
 *
 * @module @/lib/artisans
 *
 * @example
 * ```typescript
 * import {
 *   useArtisanDisplay,
 *   getDisplayName,
 *   getFormattedAddress,
 *   type ArtisanDisplayData
 * } from '@/lib/artisans'
 *
 * function ArtisanCard({ artisan }) {
 *   const { data: refData } = useReferenceData()
 *   const displayData = useArtisanDisplay(artisan, { refData })
 *
 *   if (!displayData) return null
 *
 *   return (
 *     <div>
 *       <h3>{getDisplayName(displayData, "nom")}</h3>
 *       <p>{getFormattedAddress(displayData)}</p>
 *       {displayData.statusInfo && (
 *         <Badge style={{ color: displayData.statusInfo.color }}>
 *           {displayData.statusInfo.label}
 *         </Badge>
 *       )}
 *     </div>
 *   )
 * }
 * ```
 */

// ===== TYPES =====
export type {
  ArtisanDisplaySource,
  ArtisanDisplayData,
  DisplayMode,
  NormalizeOptions,
  AvatarMetadata,
} from "./types"

// ===== NORMALISATION =====
export { normalizeArtisanData } from "./normalize"

// ===== MODES D'AFFICHAGE =====
export { getDisplayName, getAllDisplayModes } from "./display-modes"

// ===== HELPERS =====
export {
  getAddressSegments,
  getFormattedAddress,
  getStatusInfo,
  getPrimaryMetier,
  getNumeroAssocie,
  getDistanceKm,
  getFormattedDistance,
  getAllPhones,
  hasPhone,
  hasEmail,
  hasAddress,
} from "./helpers"

// ===== HOOK REACT =====
export { useArtisanDisplay, useArtisanDisplayList } from "./useArtisanDisplay"
