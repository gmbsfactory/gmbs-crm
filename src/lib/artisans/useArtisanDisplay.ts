/**
 * Hook React pour l'affichage optimisé des données artisan avec mémorisation
 *
 * Évite les recalculs inutiles lors des re-renders en mémorisant les données normalisées
 */

import { useMemo } from "react"
import type { ArtisanDisplaySource, ArtisanDisplayData, NormalizeOptions } from "./types"
import { normalizeArtisanData } from "./normalize"

/**
 * Hook React pour normaliser et mémoriser les données d'affichage d'un artisan
 *
 * Utilise `useMemo` pour éviter de recalculer les données normalisées à chaque render.
 * Particulièrement utile dans les listes d'artisans où chaque item peut re-render.
 *
 * @param artisan - Source de données artisan (NearbyArtisan ou ArtisanSearchResult), ou null
 * @param options - Options de normalisation (refData, priorité d'adresse)
 * @returns Données normalisées mémorisées, ou null si artisan est null
 *
 * @example
 * ```typescript
 * function ArtisanCard({ artisan }: { artisan: NearbyArtisan }) {
 *   const { data: refData } = useReferenceData()
 *   const displayData = useArtisanDisplay(artisan, { refData })
 *
 *   if (!displayData) return null
 *
 *   return (
 *     <div>
 *       <h3>{getDisplayName(displayData, "nom")}</h3>
 *       <p>{getFormattedAddress(displayData)}</p>
 *     </div>
 *   )
 * }
 * ```
 *
 * @example
 * // Utilisation dans une liste avec re-renders fréquents
 * ```typescript
 * function ArtisanList({ artisans }: { artisans: NearbyArtisan[] }) {
 *   const { data: refData } = useReferenceData()
 *
 *   return (
 *     <ul>
 *       {artisans.map(artisan => (
 *         <ArtisanListItem key={artisan.id} artisan={artisan} refData={refData} />
 *       ))}
 *     </ul>
 *   )
 * }
 *
 * function ArtisanListItem({ artisan, refData }) {
 *   // Les données sont mémorisées, pas de recalcul si artisan/refData ne changent pas
 *   const displayData = useArtisanDisplay(artisan, { refData })
 *
 *   return (
 *     <li>
 *       <span>{getDisplayName(displayData, "nom")}</span>
 *       <span>{displayData.statusInfo?.label}</span>
 *     </li>
 *   )
 * }
 * ```
 */
export function useArtisanDisplay(
  artisan: ArtisanDisplaySource | null,
  options: NormalizeOptions = {}
): ArtisanDisplayData | null {
  const { refData, addressPriority = 'intervention' } = options

  // Mémorisation des données normalisées
  // Dépendances : artisan (référence), refData (référence), addressPriority (valeur primitive)
  const displayData = useMemo(() => {
    if (!artisan) return null

    return normalizeArtisanData(artisan, { refData, addressPriority })
  }, [artisan, refData, addressPriority])

  return displayData
}

/**
 * Hook React pour normaliser plusieurs artisans avec mémorisation
 *
 * Optimisé pour les listes d'artisans. Mémorise le tableau complet
 * et recalcule uniquement si les dépendances changent.
 *
 * @param artisans - Tableau de sources de données artisan
 * @param options - Options de normalisation
 * @returns Tableau de données normalisées mémorisées
 *
 * @example
 * ```typescript
 * function ArtisanGrid({ artisans }: { artisans: NearbyArtisan[] }) {
 *   const { data: refData } = useReferenceData()
 *   const displayDataList = useArtisanDisplayList(artisans, { refData })
 *
 *   return (
 *     <div className="grid grid-cols-3 gap-4">
 *       {displayDataList.map((data, index) => (
 *         <ArtisanCard key={artisans[index].id} data={data} />
 *       ))}
 *     </div>
 *   )
 * }
 * ```
 */
export function useArtisanDisplayList(
  artisans: ArtisanDisplaySource[],
  options: NormalizeOptions = {}
): ArtisanDisplayData[] {
  const { refData, addressPriority = 'intervention' } = options

  // Mémorisation du tableau complet
  const displayDataList = useMemo(() => {
    return artisans.map((artisan) =>
      normalizeArtisanData(artisan, { refData, addressPriority })
    )
  }, [artisans, refData, addressPriority])

  return displayDataList
}
