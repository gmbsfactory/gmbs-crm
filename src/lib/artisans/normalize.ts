/**
 * Normalisation des données artisan depuis différentes sources
 *
 * Unifie NearbyArtisan et ArtisanSearchResult en une structure commune ArtisanDisplayData
 */

import type {
  ArtisanDisplaySource,
  ArtisanDisplayData,
  NormalizeOptions,
  AvatarMetadata,
} from "./types"
import type { NearbyArtisan } from "@/lib/api/v2/common/types"
import type { ArtisanSearchResult } from "@/components/artisans/ArtisanSearchModal"

/**
 * Type guard pour vérifier si l'artisan est un NearbyArtisan
 */
function isNearbyArtisan(artisan: ArtisanDisplaySource): artisan is NearbyArtisan {
  return 'displayName' in artisan && 'lat' in artisan && 'lng' in artisan
}

/**
 * Type guard pour vérifier si l'artisan est un ArtisanSearchResult
 */
function isArtisanSearchResult(artisan: ArtisanDisplaySource): artisan is ArtisanSearchResult {
  return 'metiers' in artisan || 'status' in artisan
}

/**
 * Normalise les données d'un artisan depuis différentes sources en une structure unifiée
 *
 * @param artisan - Source de données artisan (NearbyArtisan ou ArtisanSearchResult)
 * @param options - Options de normalisation (refData, priorité d'adresse)
 * @returns Données normalisées pour l'affichage
 *
 * @example
 * ```typescript
 * const nearbyArtisan: NearbyArtisan = { ... }
 * const data = normalizeArtisanData(nearbyArtisan, { refData })
 * console.log(data.address.street) // Adresse unifiée
 * ```
 */
export function normalizeArtisanData(
  artisan: ArtisanDisplaySource,
  options: NormalizeOptions = {}
): ArtisanDisplayData {
  const { refData, addressPriority = 'intervention' } = options

  // ===== Extraction des données communes =====
  const baseData = {
    prenom: artisan.prenom ?? null,
    nom: artisan.nom ?? null,
    raison_sociale: artisan.raison_sociale ?? null,
    telephone: artisan.telephone ?? null,
    telephone2: artisan.telephone2 ?? null,
    email: artisan.email ?? null,
    statut_id: artisan.statut_id ?? null,
    distanceKm: artisan.distanceKm ?? null,
  }

  // ===== Extraction du plain_nom selon la source =====
  let plain_nom: string | null = null
  if (isNearbyArtisan(artisan)) {
    // NearbyArtisan a displayName qui sert de plain_nom
    plain_nom = artisan.displayName ?? null
  } else if (isArtisanSearchResult(artisan)) {
    plain_nom = artisan.plain_nom ?? null
  }

  // ===== Extraction de l'adresse selon la source =====
  let address: ArtisanDisplayData['address']

  if (isNearbyArtisan(artisan)) {
    // NearbyArtisan a une seule adresse (intervention)
    address = {
      street: artisan.adresse ?? null,
      postalCode: artisan.codePostal ?? null,
      city: artisan.ville ?? null,
      source: artisan.adresse ? 'intervention' : null,
    }
  } else if (isArtisanSearchResult(artisan)) {
    // ArtisanSearchResult a deux adresses possibles
    const hasInterventionAddress =
      artisan.adresse_intervention ||
      artisan.ville_intervention ||
      artisan.code_postal_intervention

    const hasSiegeAddress =
      artisan.adresse_siege_social ||
      artisan.ville_siege_social ||
      artisan.code_postal_siege_social

    if (addressPriority === 'intervention' && hasInterventionAddress) {
      address = {
        street: artisan.adresse_intervention ?? null,
        postalCode: artisan.code_postal_intervention ?? null,
        city: artisan.ville_intervention ?? null,
        source: 'intervention',
      }
    } else if (addressPriority === 'siege' && hasSiegeAddress) {
      address = {
        street: artisan.adresse_siege_social ?? null,
        postalCode: artisan.code_postal_siege_social ?? null,
        city: artisan.ville_siege_social ?? null,
        source: 'siege',
      }
    } else if (hasInterventionAddress) {
      // Fallback: intervention si disponible
      address = {
        street: artisan.adresse_intervention ?? null,
        postalCode: artisan.code_postal_intervention ?? null,
        city: artisan.ville_intervention ?? null,
        source: 'intervention',
      }
    } else if (hasSiegeAddress) {
      // Fallback: siège si disponible
      address = {
        street: artisan.adresse_siege_social ?? null,
        postalCode: artisan.code_postal_siege_social ?? null,
        city: artisan.ville_siege_social ?? null,
        source: 'siege',
      }
    } else {
      // Aucune adresse disponible
      address = {
        street: null,
        postalCode: null,
        city: null,
        source: null,
      }
    }
  } else {
    // Type inconnu, adresse vide
    address = {
      street: null,
      postalCode: null,
      city: null,
      source: null,
    }
  }

  // ===== Extraction du métier principal =====
  let primaryMetier: ArtisanDisplayData['primaryMetier'] = null
  if (isArtisanSearchResult(artisan) && artisan.metiers) {
    const primary = artisan.metiers.find((m) => m.is_primary)
    if (primary) {
      primaryMetier = {
        id: primary.metier.id,
        code: primary.metier.code,
        label: primary.metier.label,
      }
    }
  }

  // ===== Résolution du statut depuis refData =====
  let statusInfo: ArtisanDisplayData['statusInfo'] = null
  if (isArtisanSearchResult(artisan) && artisan.status) {
    // ArtisanSearchResult a déjà le statut résolu
    statusInfo = {
      label: artisan.status.label,
      color: artisan.status.color ?? '#gray',
    }
  } else if (refData?.statuts && baseData.statut_id) {
    // Résolution depuis refData si disponible
    const statut = refData.statuts.find((s) => s.id === baseData.statut_id)
    if (statut) {
      statusInfo = {
        label: statut.label,
        color: statut.color ?? '#gray',
      }
    }
  }

  // ===== Extraction du numero_associe =====
  let numero_associe: string | null = null
  if (isArtisanSearchResult(artisan)) {
    numero_associe = artisan.numero_associe ?? null
  }

  // ===== Extraction des métadonnées de photo =====
  let photoProfilMetadata: AvatarMetadata | null = null
  if (isNearbyArtisan(artisan)) {
    photoProfilMetadata = artisan.photoProfilMetadata ?? null
  }

  return {
    ...baseData,
    plain_nom,
    address,
    primaryMetier,
    statusInfo,
    numero_associe,
    photoProfilMetadata,
  }
}
