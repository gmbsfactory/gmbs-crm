/**
 * Types et interfaces pour le service de géocodage
 * 
 * Architecture basée sur le Strategy Pattern pour permettre
 * l'utilisation de différents providers de géocodage.
 */

/**
 * Résultat d'une requête de géocodage
 */
export type GeocodeResult = {
    /** Latitude */
    lat: number
    /** Longitude */
    lng: number
    /** Label formaté de l'adresse */
    label: string
    /** Score de confiance (0-1 ou 0-10 selon le provider) */
    score?: number
    /** Précision du résultat */
    precision?: string
    /** Provider qui a fourni ce résultat */
    provider: string
    /** Code postal (si disponible) */
    postcode?: string
    /** Ville (si disponible) */
    city?: string
}

/**
 * Options pour une requête de géocodage
 */
export type GeocodeOptions = {
    /** Nombre maximum de résultats */
    limit: number
    /** Signal d'annulation */
    signal?: AbortSignal
    /** Code pays pour filtrer (ex: "fr") */
    countryCode?: string
    /** Mode autocomplete (plus tolérant aux requêtes partielles) */
    autocomplete?: boolean
    /** Langue des résultats */
    language?: string
    /** Mode verbeux pour les logs */
    verbose?: boolean
}

/**
 * Mode d'exécution du service de géocodage
 */
export type GeocodeExecutionMode =
    /** Essayer les providers dans l'ordre de priorité, arrêter au premier succès */
    | "cascade"
    /** Lancer tous les providers en parallèle et fusionner les résultats */
    | "parallel"
    /** Lancer tous les providers en parallèle et retourner le premier résultat */
    | "first_success"

/**
 * Configuration du service de géocodage
 */
export type GeocodeServiceConfig = {
    /** Mode d'exécution */
    mode: GeocodeExecutionMode
    /** Durée de vie du cache en millisecondes */
    cacheTtlMs: number
    /** Nombre maximum de résultats par défaut */
    defaultLimit: number
    /** Préférer les résultats français par défaut */
    preferFrance: boolean
    /** Mode verbeux par défaut */
    verbose?: boolean
}

/**
 * Interface pour un provider de géocodage (Strategy Pattern)
 * 
 * Chaque provider implémente cette interface pour permettre
 * l'interchangeabilité.
 */
export interface GeocodeProvider {
    /** Nom unique du provider */
    readonly name: string

    /** 
     * Priorité du provider (plus bas = plus prioritaire)
     * 0 = priorité maximale
     */
    readonly priority: number

    /**
     * Vérifie si le provider est disponible (ex: clé API configurée)
     */
    isAvailable(): boolean

    /**
     * Vérifie si le provider supporte cette requête
     * (ex: API Adresse France ne supporte que les adresses françaises)
     */
    supportsQuery(query: string, options: GeocodeOptions): boolean

    /**
     * Effectue une requête de géocodage
     */
    geocode(query: string, options: GeocodeOptions): Promise<GeocodeResult[]>
}

/**
 * Entrée de cache pour les résultats de géocodage
 */
export type GeocodeCacheEntry = {
    results: GeocodeResult[]
    expiresAt: number
}

/**
 * Réponse de l'API Adresse France (BAN)
 */
export type FrenchAddressApiResponse = {
    features: Array<{
        properties: {
            label: string
            score: number
            postcode?: string
            city?: string
            context?: string
            type?: string
        }
        geometry: {
            coordinates: [number, number] // [lng, lat]
        }
    }>
}

/**
 * Réponse de l'API OpenCage
 */
export type OpenCageApiResponse = {
    results?: Array<{
        geometry: { lat: number; lng: number }
        confidence?: number
        formatted: string
        components?: {
            postcode?: string
            city?: string
            town?: string
            village?: string
        }
    }>
}

/**
 * Réponse de l'API Nominatim
 */
export type NominatimApiResponse = Array<{
    lat: string
    lon: string
    importance?: number
    display_name?: string
    address?: {
        postcode?: string
        city?: string
        town?: string
        village?: string
    }
}>

