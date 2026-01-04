/**
 * Provider de géocodage utilisant Nominatim (OpenStreetMap)
 * 
 * @see https://nominatim.org/release-docs/latest/api/Search/
 * 
 * Avantages :
 * - Gratuit
 * - Couverture mondiale
 * - Pas de clé API requise
 * 
 * Inconvénients :
 * - Rate limiting strict (1 req/sec)
 * - Moins précis que les solutions payantes
 */

import type { GeocodeProvider, GeocodeOptions, GeocodeResult, NominatimApiResponse } from "../types"
import { enrichAddressWithFrance, isInFrance } from "../utils/france-bounds"

const API_BASE_URL = "https://nominatim.openstreetmap.org/search"

export class NominatimProvider implements GeocodeProvider {
    readonly name = "nominatim"
    readonly priority = 20 // Priorité basse (fallback)

    /**
     * Nominatim est toujours disponible
     */
    isAvailable(): boolean {
        return true
    }

    /**
     * Supporte toutes les requêtes (provider mondial)
     */
    supportsQuery(_query: string, _options: GeocodeOptions): boolean {
        return true
    }

    async geocode(query: string, options: GeocodeOptions): Promise<GeocodeResult[]> {
        const { limit, signal, countryCode, language = "fr", verbose } = options

        // Enrichir l'adresse avec "France" si le country code est fr
        const enrichedQuery = countryCode === "fr" ? enrichAddressWithFrance(query) : query

        const endpoint = new URL(API_BASE_URL)
        endpoint.searchParams.set("q", enrichedQuery)
        endpoint.searchParams.set("format", "json")
        endpoint.searchParams.set("limit", String(limit * 2)) // Prendre plus pour filtrer
        endpoint.searchParams.set("addressdetails", "1")

        if (countryCode) {
            endpoint.searchParams.set("countrycodes", countryCode)
        }

        if (verbose) {
            console.log(`[${this.name}] Fetching: ${endpoint.toString()}`)
        }

        try {
            const response = await fetch(endpoint.toString(), {
                signal,
                headers: {
                    Accept: "application/json",
                    "User-Agent": this.buildUserAgent(),
                    "Accept-Language": language,
                },
            })

            if (!response.ok) {
                console.warn(`[${this.name}] Request failed:`, response.status)
                return []
            }

            const data = (await response.json()) as NominatimApiResponse
            
            if (verbose) {
                console.log(`[${this.name}] Raw API Results:`, data?.length ?? 0)
                if (data && data.length > 0) {
                    data.slice(0, 2).forEach((f, i) => {
                        console.log(`  Result ${i+1}: ${f.display_name} (importance: ${f.importance})`)
                    })
                }
            }

            return (data ?? [])
                .filter((result) => {
                    if (!result?.lat || !result?.lon || !result?.display_name) {
                        return false
                    }
                    const lat = Number.parseFloat(result.lat)
                    const lng = Number.parseFloat(result.lon)
                    // Si on cherche en France, valider les coordonnées
                    if (countryCode === "fr") {
                        return isInFrance(lat, lng)
                    }
                    return true
                })
                .slice(0, limit)
                .map((result) => {
                    const lat = Number.parseFloat(result.lat)
                    const lng = Number.parseFloat(result.lon)
                    return {
                        lat,
                        lng,
                        label: result.display_name || "",
                        score: result.importance,
                        precision: result.importance?.toFixed(2),
                        provider: this.name,
                        postcode: result.address?.postcode,
                        city: result.address?.city || result.address?.town || result.address?.village,
                    }
                })
        } catch (error) {
            if ((error as Error)?.name === "AbortError") {
                return []
            }
            console.error(`[${this.name}] Error:`, error)
            return []
        }
    }

    private buildUserAgent(): string {
        const projectUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://localhost"
        return `GMBS-CRM/1.0 (${projectUrl})`
    }
}


