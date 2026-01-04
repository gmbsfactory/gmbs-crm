/**
 * Provider de géocodage utilisant l'API Adresse France (BAN)
 * 
 * @see https://adresse.data.gouv.fr/api-doc/adresse
 * 
 * Avantages :
 * - Gratuit et sans limite
 * - Très performant (~50-100ms)
 * - Excellent fuzzy matching pour les adresses françaises
 * - Données officielles de la Base Adresse Nationale
 */

import type { GeocodeProvider, GeocodeOptions, GeocodeResult, FrenchAddressApiResponse } from "../types"
import { shouldPreferFrance } from "../utils/france-bounds"

const API_BASE_URL = "https://api-adresse.data.gouv.fr/search/"

export class FrenchAddressProvider implements GeocodeProvider {
    readonly name = "french-address"
    readonly priority = 0 // Priorité maximale pour les adresses françaises

    /**
     * L'API Adresse France est toujours disponible (pas de clé requise)
     */
    isAvailable(): boolean {
        return true
    }

    /**
     * Supporte uniquement les requêtes qui semblent concerner la France
     */
    supportsQuery(query: string, _options: GeocodeOptions): boolean {
        return shouldPreferFrance(query)
    }

    async geocode(query: string, options: GeocodeOptions): Promise<GeocodeResult[]> {
        const { limit, signal, autocomplete = true, verbose } = options

        const endpoint = new URL(API_BASE_URL)
        endpoint.searchParams.set("q", query)
        endpoint.searchParams.set("limit", String(limit))

        if (autocomplete) {
            endpoint.searchParams.set("autocomplete", "1")
        }

        if (verbose) {
            console.log(`[${this.name}] Fetching: ${endpoint.toString()}`)
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

            const data = (await response.json()) as FrenchAddressApiResponse

            if (verbose) {
                console.log(`[${this.name}] Raw API Results:`, data.features?.length ?? 0)
                if (data.features && data.features.length > 0) {
                    data.features.slice(0, 2).forEach((f, i) => {
                        console.log(`  Result ${i + 1}: ${f.properties.label} (${f.properties.score})`)
                    })
                }
            }

            return (data.features ?? []).map((feature) => ({
                lat: feature.geometry.coordinates[1],
                lng: feature.geometry.coordinates[0],
                label: feature.properties.label,
                score: feature.properties.score,
                precision: feature.properties.type,
                provider: this.name,
                postcode: feature.properties.postcode,
                city: feature.properties.city,
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


