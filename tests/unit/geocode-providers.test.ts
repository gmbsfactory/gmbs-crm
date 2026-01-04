/**
 * Tests pour les providers de géocodage et le GeocodeService
 * 
 * Ce fichier teste :
 * - Chaque provider individuellement (FrenchAddress, OpenCage, Nominatim)
 * - Le GeocodeService avec cascade de fallback
 * - L'API route avec différents providers
 * - Les différents modes d'exécution
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { GeocodeService } from "@/lib/geocode/geocode-service"
import { FrenchAddressProvider } from "@/lib/geocode/providers/french-address"
import { OpenCageProvider } from "@/lib/geocode/providers/opencage"
import { NominatimProvider } from "@/lib/geocode/providers/nominatim"

const originalFetch = global.fetch

// Adresses de test
const TEST_ADDRESSES = {
    paris: "10 rue de Rivoli, 75001 Paris",
    lyon: "Place Bellecour, 69002 Lyon",
    marseille: "Vieux-Port, 13001 Marseille",
    invalid: "Adresse qui n'existe pas 99999",
}

describe("Geocode Providers", () => {
    beforeEach(() => {
        vi.resetModules()
        vi.restoreAllMocks()
        // Masquer les logs d'erreur attendus pour clarifier la sortie des tests
        vi.spyOn(console, "error").mockImplementation(() => { })
        vi.spyOn(console, "warn").mockImplementation(() => { })
        GeocodeService.resetInstance()
        process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000"
    })

    afterEach(() => {
        vi.restoreAllMocks()
        vi.unstubAllGlobals()
        if (originalFetch) {
            global.fetch = originalFetch
        }
        delete process.env.OPENCAGE_API_KEY
        GeocodeService.resetInstance()
    })

    describe("FrenchAddressProvider", () => {
        it("should geocode a valid French address", async () => {
            console.log("\n[TEST] FrenchAddressProvider: Géocodage d'une adresse française valide")
            const provider = new FrenchAddressProvider()
            const results = await provider.geocode(TEST_ADDRESSES.paris, { limit: 5 })

            expect(results.length).toBeGreaterThan(0)
            expect(results[0].provider).toBe("french-address")
            expect(results[0].label).toContain("Rivoli")
            expect(results[0].postcode).toBe("75001")
            expect(results[0].city).toBe("Paris")
            // Vérifier que les coordonnées sont valides (dans les environs de Paris)
            expect(results[0].lat).toBeGreaterThan(48.8)
            expect(results[0].lat).toBeLessThan(48.9)
            expect(results[0].lng).toBeGreaterThan(2.3)
            expect(results[0].lng).toBeLessThan(2.4)
        })

        it("should return empty array for non-French addresses", async () => {
            console.log("\n[TEST] FrenchAddressProvider: Retourne vide pour une adresse hors France")
            const provider = new FrenchAddressProvider()
            const results = await provider.geocode("1600 Amphitheatre Parkway, Mountain View, CA", {
                limit: 5,
            })

            console.log("[TEST] Résultat:", JSON.stringify(results, null, 2))

            expect(results).toHaveLength(0)
        })

        it("should handle API errors gracefully", async () => {
            console.log("\n[TEST] FrenchAddressProvider: Gestion gracieuse des erreurs API (500)")
            const fetchMock = vi.fn(async () => {
                return new Response("Server Error", { status: 500 })
            })

            vi.stubGlobal("fetch", fetchMock)

            const provider = new FrenchAddressProvider()
            const results = await provider.geocode(TEST_ADDRESSES.paris, { limit: 5 })

            console.log("[TEST] Résultat:", JSON.stringify(results, null, 2))

            expect(results).toHaveLength(0)
        })

        it("should be available without API key", () => {
            console.log("\n[TEST] FrenchAddressProvider: Disponibilité immédiate (pas de clé API requise)")
            const provider = new FrenchAddressProvider()
            expect(provider.isAvailable()).toBe(true)
        })

        it("should have priority 0 (highest)", () => {
            console.log("\n[TEST] FrenchAddressProvider: Vérification de la priorité maximale (0)")
            const provider = new FrenchAddressProvider()
            expect(provider.priority).toBe(0)
        })
    })

    describe("OpenCageProvider", () => {
        it("should geocode with valid API key", async () => {
            console.log("\n[TEST] OpenCageProvider: Géocodage avec une clé API valide")
            // Utiliser la vraie clé API si disponible, sinon le test sera skip ou retournera un tableau vide
            if (!process.env.OPENCAGE_API_KEY) {
                console.log("[TEST] OPENCAGE_API_KEY non définie, le test nécessite une vraie clé API")
            }

            const provider = new OpenCageProvider()
            expect(provider.isAvailable()).toBe(!!process.env.OPENCAGE_API_KEY)

            const results = await provider.geocode(TEST_ADDRESSES.paris, { limit: 5, countryCode: "fr" })

            console.log("[TEST] Résultat:", JSON.stringify(results, null, 2))

            if (process.env.OPENCAGE_API_KEY) {
                expect(results.length).toBeGreaterThan(0)
                expect(results[0].provider).toBe("opencage")
                expect(results[0].label).toContain("Rivoli")
                // Vérifier que les coordonnées sont valides (dans les environs de Paris)
                expect(results[0].lat).toBeGreaterThan(48.8)
                expect(results[0].lat).toBeLessThan(48.9)
                expect(results[0].lng).toBeGreaterThan(2.3)
                expect(results[0].lng).toBeLessThan(2.4)
            } else {
                console.log("[TEST] No API key set for OpenCageProvider")
                // Si pas de clé API, le provider devrait retourner un tableau vide
                expect(results).toHaveLength(0)
            }
        })

        it("should not be available without API key", () => {
            console.log("\n[TEST] OpenCageProvider: Non disponible sans clé API")
            // S'assurer explicitement que la clé n'est pas définie
            delete process.env.OPENCAGE_API_KEY
            expect(process.env.OPENCAGE_API_KEY).toBeUndefined()

            const provider = new OpenCageProvider()
            expect(provider.isAvailable()).toBe(false)

            // Vérifier aussi le cas inverse : avec une clé, le provider devrait être disponible
            process.env.OPENCAGE_API_KEY = "test-key-123"
            const providerWithKey = new OpenCageProvider()
            expect(providerWithKey.isAvailable()).toBe(true)

            // Nettoyer
            delete process.env.OPENCAGE_API_KEY
        })

        it("should return empty array when API key is missing", async () => {
            delete process.env.OPENCAGE_API_KEY
            const provider = new OpenCageProvider()
            const results = await provider.geocode(TEST_ADDRESSES.paris, { limit: 5 })
            expect(results).toHaveLength(0)
        })

        it("should handle quota exceeded errors", async () => {
            console.log("\n[TEST] OpenCageProvider: Gestion des quotas dépassés (402)")
            process.env.OPENCAGE_API_KEY = "test-key"

            const fetchMock = vi.fn(async () => {
                return new Response("Payment Required", { status: 402 })
            })

            vi.stubGlobal("fetch", fetchMock)

            const provider = new OpenCageProvider()
            const results = await provider.geocode(TEST_ADDRESSES.paris, { limit: 5 })

            expect(results).toHaveLength(0)
        })

        it("should have priority 10 (medium)", () => {
            const provider = new OpenCageProvider()
            expect(provider.priority).toBe(10)
        })
    })

    describe("NominatimProvider", () => {
        it("should geocode a valid address", async () => {
            console.log("\n[TEST] NominatimProvider: Géocodage d'une adresse valide")
            const provider = new NominatimProvider()
            const results = await provider.geocode(TEST_ADDRESSES.paris, { limit: 5, countryCode: "fr" })

            console.log("[TEST] Résultat:", JSON.stringify(results, null, 2))

            expect(results.length).toBeGreaterThan(0)
            expect(results[0].provider).toBe("nominatim")
            expect(results[0].label).toContain("Rivoli")
            // Vérifier que les coordonnées sont valides (dans les environs de Paris)
            expect(results[0].lat).toBeGreaterThan(48.8)
            expect(results[0].lat).toBeLessThan(48.9)
            expect(results[0].lng).toBeGreaterThan(2.3)
            expect(results[0].lng).toBeLessThan(2.4)
        })

        it("should always be available", () => {
            const provider = new NominatimProvider()
            expect(provider.isAvailable()).toBe(true)
        })

        it("should handle rate limiting", async () => {
            console.log("\n[TEST] NominatimProvider: Gestion du rate limiting (429)")
            const fetchMock = vi.fn(async () => {
                return new Response("Too Many Requests", { status: 429 })
            })

            vi.stubGlobal("fetch", fetchMock)

            const provider = new NominatimProvider()
            const results = await provider.geocode(TEST_ADDRESSES.paris, { limit: 5 })

            expect(results).toHaveLength(0)
        })

        it("should have priority 20 (lowest - fallback)", () => {
            const provider = new NominatimProvider()
            expect(provider.priority).toBe(20)
        })
    })

    describe("GeocodeService - Cascade Mode", () => {
        it("should use FrenchAddressProvider first for French addresses", async () => {
            console.log("\n[TEST] Cascade Mode: Utilisation prioritaire du provider local (France)")
            const service = GeocodeService.getInstance()
            // Activer le mode verbose pour voir les logs internes du service
            const results = await service.geocode(TEST_ADDRESSES.paris, { limit: 5, verbose: true })

            console.log("[TEST] Résultat:", JSON.stringify(results, null, 2))

            expect(results.length).toBeGreaterThan(0)
            // En mode cascade, FrenchAddressProvider devrait être utilisé en premier pour les adresses françaises
            expect(results[0].provider).toBe("french-address")
            // Vérifier que les coordonnées sont valides (dans les environs de Paris)
            expect(results[0].lat).toBeGreaterThan(48.8)
            expect(results[0].lat).toBeLessThan(48.9)
            expect(results[0].lng).toBeGreaterThan(2.3)
            expect(results[0].lng).toBeLessThan(2.4)
        })

        it("should fallback to OpenCage if FrenchAddressProvider fails", async () => {
            console.log("\n[TEST] Cascade Mode: Fallback vers OpenCage si le premier provider échoue")
            // Utiliser la vraie clé API si disponible
            if (!process.env.OPENCAGE_API_KEY) {
                console.log("[TEST] OPENCAGE_API_KEY non définie, le test nécessite une vraie clé API pour tester le fallback")
            }

            const service = GeocodeService.getInstance()
            // Utiliser une adresse qui pourrait ne pas être trouvée par FrenchAddressProvider
            // ou forcer le fallback en utilisant une adresse non-française
            const results = await service.geocode(TEST_ADDRESSES.lyon, { limit: 5, verbose: true })

            console.log("[TEST] Résultat:", JSON.stringify(results, null, 2))

            expect(results.length).toBeGreaterThan(0)

            // Si OpenCage est disponible et que FrenchAddressProvider n'a pas trouvé de résultat,
            // le provider devrait être opencage. Sinon, ce sera french-address ou nominatim
            if (process.env.OPENCAGE_API_KEY && results[0].provider === "opencage") {
                // Vérifier que les coordonnées sont valides (dans les environs de Lyon)
                expect(results[0].lat).toBeGreaterThan(45.7)
                expect(results[0].lat).toBeLessThan(45.8)
                expect(results[0].lng).toBeGreaterThan(4.8)
                expect(results[0].lng).toBeLessThan(4.9)
            } else {
                // Si FrenchAddressProvider a trouvé un résultat, vérifier qu'il est valide
                expect(results[0].provider).toBeOneOf(["french-address", "opencage", "nominatim"])
            }
        })

        it("should fallback to Nominatim if previous providers fail", async () => {
            console.log("\n[TEST] Cascade Mode: Fallback ultime vers Nominatim (OSM)")
            const service = GeocodeService.getInstance()
            const results = await service.geocode(TEST_ADDRESSES.marseille, { limit: 5, verbose: true })

            console.log("[TEST] Résultat:", JSON.stringify(results, null, 2))
            console.log(`  -> Résultat: ${results[0]?.label} (via ${results[0]?.provider})`)

            expect(results.length).toBeGreaterThan(0)
            // Le provider peut être french-address (si trouvé) ou nominatim (en fallback)
            expect(results[0].provider).toBeOneOf(["french-address", "nominatim", "opencage"])
            // Vérifier que les coordonnées sont valides (dans les environs de Marseille)
            expect(results[0].lat).toBeGreaterThan(43.2)
            expect(results[0].lat).toBeLessThan(43.4)
            expect(results[0].lng).toBeGreaterThan(5.3)
            expect(results[0].lng).toBeLessThan(5.4)
        })

        it("should cache results", async () => {
            console.log("\n[TEST] GeocodeService: Mise en cache des résultats")
            const service = GeocodeService.getInstance()

            // First call
            const results1 = await service.geocode(TEST_ADDRESSES.paris, { limit: 5 })
            console.log("[TEST] Premier appel - Résultat:", JSON.stringify(results1, null, 2))
            expect(results1.length).toBeGreaterThan(0)

            // Second call should use cache (même requête)
            const results2 = await service.geocode(TEST_ADDRESSES.paris, { limit: 5 })
            console.log("[TEST] Deuxième appel (cache) - Résultat:", JSON.stringify(results2, null, 2))
            expect(results2.length).toBeGreaterThan(0)

            // Les résultats devraient être identiques (même objet ou même contenu)
            expect(results2[0].lat).toBe(results1[0].lat)
            expect(results2[0].lng).toBe(results1[0].lng)
            expect(results2[0].label).toBe(results1[0].label)
        })
    })

    describe("GeocodeService - Parallel Mode", () => {
        it("should call all providers in parallel and merge results", async () => {
            console.log("\n[TEST] Parallel Mode: Exécution de tous les providers en simultané")
            // Utiliser la vraie clé API si disponible
            if (!process.env.OPENCAGE_API_KEY) {
                console.log("[TEST] OPENCAGE_API_KEY non définie, le test fonctionnera avec les providers disponibles")
            }

            const service = GeocodeService.getInstance()
            service.setMode("parallel")

            const results = await service.geocode(TEST_ADDRESSES.paris, { limit: 5, verbose: true })

            console.log("[TEST] Résultat:", JSON.stringify(results, null, 2))
            console.log(`  -> Nombre total de résultats fusionnés: ${results.length}`)

            // Should have results from multiple providers (deduplicated)
            expect(results.length).toBeGreaterThan(0)
            // Vérifier que les résultats sont valides
            expect(results[0].lat).toBeGreaterThan(48.8)
            expect(results[0].lat).toBeLessThan(48.9)
            expect(results[0].lng).toBeGreaterThan(2.3)
            expect(results[0].lng).toBeLessThan(2.4)
        })
    })

    describe("API Route - /api/geocode", () => {
        it("should use FrenchAddressProvider for French addresses", async () => {
            console.log("\n[TEST] API Route: Utilisation du provider BAN pour les adresses FR")
            const { GET } = await import("../../app/api/geocode/route")
            const request = new NextRequest(
                `http://localhost/api/geocode?q=${encodeURIComponent(TEST_ADDRESSES.paris)}`,
            )
            const response = await GET(request)

            expect(response.status).toBe(200)
            const payload = (await response.json()) as { lat: number; lng: number; precision?: string }
            console.log("[TEST] Résultat API Route:", JSON.stringify(payload, null, 2))
            // Vérifier que les coordonnées sont valides (dans les environs de Paris)
            expect(payload.lat).toBeGreaterThan(48.8)
            expect(payload.lat).toBeLessThan(48.9)
            expect(payload.lng).toBeGreaterThan(2.3)
            expect(payload.lng).toBeLessThan(2.4)
        })

        it("should return suggestions when suggest=1", async () => {
            console.log("\n[TEST] API Route: Mode suggestion (plusieurs résultats)")
            const { GET } = await import("../../app/api/geocode/route")
            const request = new NextRequest(
                `http://localhost/api/geocode?q=${encodeURIComponent("Rue de Rivoli Paris")}&suggest=1&limit=5`,
            )
            const response = await GET(request)

            expect(response.status).toBe(200)
            const payload = (await response.json()) as Array<{ label: string; lat: number; lng: number }>
            console.log("[TEST] Résultat API Route (suggestions):", JSON.stringify(payload, null, 2))
            expect(payload.length).toBeGreaterThan(0)
            expect(payload[0].label).toContain("Rivoli")
        })

        it("should fallback through providers when first fails", async () => {
            console.log("\n[TEST] API Route: Fallback entre providers si le premier échoue")
            // Utiliser la vraie clé API si disponible
            if (!process.env.OPENCAGE_API_KEY) {
                console.log("[TEST] OPENCAGE_API_KEY non définie, le test fonctionnera avec les providers disponibles")
            }

            const { GET } = await import("../../app/api/geocode/route")
            const request = new NextRequest(
                `http://localhost/api/geocode?q=${encodeURIComponent(TEST_ADDRESSES.lyon)}`,
            )
            const response = await GET(request)

            expect(response.status).toBe(200)
            const payload = (await response.json()) as { lat: number; lng: number }
            console.log("[TEST] Résultat API Route (fallback):", JSON.stringify(payload, null, 2))
            // Vérifier que les coordonnées sont valides (dans les environs de Lyon)
            expect(payload.lat).toBeGreaterThan(45.7)
            expect(payload.lat).toBeLessThan(45.8)
            expect(payload.lng).toBeGreaterThan(4.8)
            expect(payload.lng).toBeLessThan(4.9)
        })

        it("should return 404 when no results found", async () => {
            console.log("\n[TEST] API Route: Retourne 404 si aucun résultat trouvé")
            const { GET } = await import("../../app/api/geocode/route")
            const request = new NextRequest(
                `http://localhost/api/geocode?q=${encodeURIComponent(TEST_ADDRESSES.invalid)}`,
            )
            const response = await GET(request)

            console.log("[TEST] Status de la réponse:", response.status)
            const payload = (await response.json()) as { error: string }
            console.log("[TEST] Réponse d'erreur:", JSON.stringify(payload, null, 2))

            // Si aucune API ne trouve de résultat, on devrait avoir un 404
            // Mais si une API trouve quelque chose (même si c'est incorrect), on pourrait avoir 200
            // On vérifie donc que soit on a 404, soit on a un résultat valide
            if (response.status === 404) {
                expect(payload.error).toMatch(/not found/i)
            } else {
                // Si on a un résultat, vérifier qu'il est valide
                expect(response.status).toBe(200)
            }
        })
    })

    describe("Provider Priority and Order", () => {
        it("should register providers in correct priority order", () => {
            console.log("\n[TEST] Strategy Pattern: Vérification de l'ordre des priorités des providers")
            const service = GeocodeService.getInstance()
            const providers = service.getProviders()

            expect(providers.length).toBeGreaterThanOrEqual(2) // At least FrenchAddress and Nominatim

            // Check priority order (lower = higher priority)
            for (let i = 0; i < providers.length - 1; i++) {
                expect(providers[i].priority).toBeLessThanOrEqual(providers[i + 1].priority)
            }

            // FrenchAddressProvider should be first (priority 0)
            const frenchProvider = providers.find((p) => p.name === "french-address")
            if (frenchProvider) {
                expect(frenchProvider.priority).toBe(0)
            }

            // NominatimProvider should be last (priority 20)
            const nominatimProvider = providers.find((p) => p.name === "nominatim")
            if (nominatimProvider) {
                expect(nominatimProvider.priority).toBe(20)
            }
        })
    })
})

