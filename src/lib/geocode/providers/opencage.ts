/**
 * Provider de géocodage utilisant OpenCage Data
 * 
 * @see https://opencagedata.com/api
 * 
 * Avantages :
 * - Couverture mondiale
 * - Bonne précision
 * - API bien documentée
 * 
 * Inconvénients :
 * - Payant (gratuit jusqu'à 2500 req/jour)
 * - Nécessite une clé API
 */

import type { GeocodeProvider, GeocodeOptions, GeocodeResult, OpenCageApiResponse } from "../types"
import { enrichAddressWithFrance, isInFrance } from "../utils/france-bounds"

const API_BASE_URL = "https://api.opencagedata.com/geocode/v1/json"

export class OpenCageProvider implements GeocodeProvider {
    readonly name = "opencage"
    readonly priority = 10 // Priorité moyenne

    private readonly apiKey: string | undefined

    constructor() {
        this.apiKey = process.env.OPENCAGE_API_KEY
    }

    /**
     * Disponible uniquement si la clé API est configurée
     */
    isAvailable(): boolean {
        return Boolean(this.apiKey)
    }

    /**
     * Supporte toutes les requêtes (provider mondial)
     */
    supportsQuery(_query: string, _options: GeocodeOptions): boolean {
        return true
    }

    async geocode(query: string, options: GeocodeOptions): Promise<GeocodeResult[]> {
        if (!this.apiKey) {
            return []
        }

        const { limit, signal, countryCode, language = "fr", verbose } = options

        // Enrichir l'adresse avec "France" si le country code est fr
        const enrichedQuery = countryCode === "fr" ? enrichAddressWithFrance(query) : query

        const endpoint = new URL(API_BASE_URL)
        endpoint.searchParams.set("q", enrichedQuery)
        endpoint.searchParams.set("key", this.apiKey)
        endpoint.searchParams.set("limit", String(limit * 2)) // Prendre plus pour filtrer
        endpoint.searchParams.set("language", language)
        endpoint.searchParams.set("no_annotations", "1")

        if (countryCode) {
            endpoint.searchParams.set("countrycode", countryCode)
        }

        if (verbose) {
            console.log(`[${this.name}] Fetching (key hidden): ${endpoint.toString().replace(this.apiKey, 'HIDDEN')}`)
        }

        try {
            const response = await fetch(endpoint.toString(), {
                signal,
                headers: {
                    Accept: "application/json",
                },
            })

            if (!response.ok) {
                console.warn(`[${this.name}] Request failed:`, response.status)
                return []
            }

            const data = (await response.json()) as OpenCageApiResponse
            const results = data?.results ?? []

            if (verbose) {
                console.log(`[${this.name}] Raw API Results:`, results.length)
                if (results.length > 0) {
                    results.slice(0, 2).forEach((f, i) => {
                        console.log(`  Result ${i+1}: ${f.formatted} (confidence: ${f.confidence})`)
                    })
                }
            }

            return results
                .filter((result) => {
                    if (!result?.geometry?.lat || !result?.geometry?.lng || !result.formatted) {
                        return false
                    }
                    // Si on cherche en France, valider les coordonnées
                    if (countryCode === "fr") {
                        return isInFrance(result.geometry.lat, result.geometry.lng)
                    }
                    return true
                })
                .slice(0, limit)
                .map((result) => ({
                    lat: result.geometry.lat,
                    lng: result.geometry.lng,
                    label: result.formatted,
                    score: result.confidence ? result.confidence / 10 : undefined, // Normaliser 0-10 → 0-1
                    precision: result.confidence ? String(result.confidence) : undefined,
                    provider: this.name,
                    postcode: result.components?.postcode,
                    city: result.components?.city || result.components?.town || result.components?.village,
                }))
        } catch (error) {
            if ((error as Error)?.name === "AbortError") {
                return []
            }
            console.error(`[${this.name}] Error:`, error)
            return []
        }
    }
}


