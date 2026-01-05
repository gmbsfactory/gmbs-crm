/**
 * Modes d'affichage pour les noms d'artisans
 *
 * Gère les différents formats d'affichage avec des fallbacks robustes
 */

import type { ArtisanDisplayData, DisplayMode } from "./types"

/**
 * Récupère le nom d'affichage d'un artisan selon le mode spécifié
 *
 * Chaque mode a une stratégie de fallback pour garantir qu'un nom est toujours retourné :
 *
 * - **Mode "nom"** (par défaut) :
 *   1. Prénom + Nom (ex: "Jean DUPONT")
 *   2. plain_nom (ex: "DUPONT Jean")
 *   3. raison_sociale (ex: "Entreprise DUPONT SARL")
 *   4. "Artisan sans nom"
 *
 * - **Mode "rs"** (raison sociale) :
 *   1. raison_sociale (ex: "Entreprise DUPONT SARL")
 *   2. Prénom + Nom (ex: "Jean DUPONT")
 *   3. plain_nom (ex: "DUPONT Jean")
 *   4. "Raison sociale inconnue"
 *
 * - **Mode "tel"** (téléphone) :
 *   1. telephone (ex: "06 12 34 56 78")
 *   2. telephone2 (ex: "01 23 45 67 89")
 *   3. "Aucun téléphone"
 *
 * @param data - Données normalisées de l'artisan
 * @param mode - Mode d'affichage ("nom", "rs", ou "tel")
 * @returns Nom formaté selon le mode avec fallback approprié
 *
 * @example
 * ```typescript
 * const data = normalizeArtisanData(artisan)
 *
 * getDisplayName(data, "nom")  // → "Jean DUPONT"
 * getDisplayName(data, "rs")   // → "Entreprise DUPONT SARL"
 * getDisplayName(data, "tel")  // → "06 12 34 56 78"
 * ```
 */
export function getDisplayName(
  data: ArtisanDisplayData,
  mode: DisplayMode = "nom"
): string {
  const strategies: Record<DisplayMode, () => string> = {
    nom: () => {
      // Stratégie 1 : Prénom + Nom
      const fullName = [data.prenom, data.nom].filter(Boolean).join(' ')
      if (fullName) {
        return fullName
      }

      // Stratégie 2 : plain_nom
      if (data.plain_nom) {
        return data.plain_nom
      }

      // Stratégie 3 : raison_sociale
      if (data.raison_sociale) {
        return data.raison_sociale
      }

      // Fallback final 
      return 'Artisan sans nom'
    },

    rs: () => {
      // Stratégie 1 : raison_sociale
      if (data.raison_sociale) {
        return data.raison_sociale
      }

      // Stratégie 2 : Prénom + Nom
      const fullName = [data.prenom, data.nom].filter(Boolean).join(' ')
      if (fullName) {
        return fullName
      }

      // Stratégie 3 : plain_nom
      if (data.plain_nom) {
        return data.plain_nom
      }

      // Fallback final
      return 'Raison sociale inconnue'
    },

    tel: () => {
      // Stratégie 1 : telephone
      if (data.telephone) {
        console.log('[getDisplayName] Mode "tel" - Retour telephone:', data.telephone)
        return data.telephone
      }

      // Stratégie 2 : telephone2
      if (data.telephone2) {
        console.log('[getDisplayName] Mode "tel" - Retour telephone2:', data.telephone2)
        return data.telephone2
      }

      // Fallback final
      console.log('[getDisplayName] Mode "tel" - Fallback: Aucun téléphone')
      return 'Aucun téléphone'
    },
  }

  const result = strategies[mode]()
  console.log('[getDisplayName] Résultat final:', result)
  return result
}

/**
 * Récupère tous les modes d'affichage pour un artisan
 *
 * Utile pour les composants qui affichent plusieurs informations
 *
 * @param data - Données normalisées de l'artisan
 * @returns Objet avec tous les modes d'affichage
 *
 * @example
 * ```typescript
 * const displays = getAllDisplayModes(data)
 * console.log(displays)
 * // {
 * //   nom: "Jean DUPONT",
 * //   rs: "Entreprise DUPONT SARL",
 * //   tel: "06 12 34 56 78"
 * // }
 * ```
 */
export function getAllDisplayModes(data: ArtisanDisplayData): Record<DisplayMode, string> {
  return {
    nom: getDisplayName(data, "nom"),
    rs: getDisplayName(data, "rs"),
    tel: getDisplayName(data, "tel"),
  }
}
