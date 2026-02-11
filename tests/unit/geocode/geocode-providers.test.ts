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

// Mock responses pour les différents providers
const MOCK_FRENCH_ADDRESS_RESPONSE = {
    features: [
        {
            geometry: { coordinates: [2.3522, 48.8566] },
            properties: {
                label: "10 Rue de Rivoli, 75001 Paris",
                name: "10 Rue de Rivoli",
                postcode: "75001",
                city: "Paris",
                context: "75, Paris, Île-de-France",
                score: 0.95,
            },
        },
    ],
}

const MOCK_NOMINATIM_RESPONSE = [
    {
        lat: "48.8566",
        lon: "2.3522",
        display_name: "10 Rue de Rivoli, 75001 Paris, France",
        address: {
            road: "Rue de Rivoli",
            postcode: "75001",
            city: "Paris",
            country: "France",
        },
    },
]

const MOCK_OPENCAGE_RESPONSE = {
    results: [
        {
            geometry: { lat: 48.8566, lng: 2.3522 },
            formatted: "10 Rue de Rivoli, 75001 Paris, France",
            components: {
                road: "Rue de Rivoli",
                postcode: "75001",
                city: "Paris",
                country: "France",
            },
            confidence: 9,
        },
    ],
}

// Helper pour créer des mock fetch
function createFetchMock(urlPatterns: Record<string, unknown>) {
    return vi.fn(async (url: string) => {
        const urlStr = url.toString()

        for (const [pattern, response] of Object.entries(urlPatterns)) {
            if (urlStr.includes(pattern)) {
                return new Response(JSON.stringify(response), {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                })
            }
        }

        // Par défaut, retourner une réponse vide
        return new Response(JSON.stringify({ features: [], results: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        })
    })
}

describe("Geocode Providers", () => {
    beforeEach(() => {
        vi.resetModules()
        vi.restoreAllMocks()
        vi.spyOn(console, "error").mockImplementation(() => { })
        vi.spyOn(console, "warn").mockImplementation(() => { })
        vi.spyOn(console, "log").mockImplementation(() => { })
        GeocodeService.resetInstance()
        process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000"
    })

    afterEach(() => {
        vi.restoreAllMocks()
        delete process.env.OPENCAGE_API_KEY
        GeocodeService.resetInstance()
    })

    describe("FrenchAddressProvider", () => {
        it("should geocode a valid French address", async () => {
            const fetchMock = createFetchMock({
                "api-adresse.data.gouv.fr": MOCK_FRENCH_ADDRESS_RESPONSE,
            })
            vi.stubGlobal("fetch", fetchMock)

            const provider = new FrenchAddressProvider()
            const results = await provider.geocode("10 rue de Rivoli, Paris", { limit: 5 })

            expect(results.length).toBeGreaterThan(0)
            expect(results[0].provider).toBe("french-address")
            expect(results[0].label).toContain("Rivoli")
            expect(results[0].postcode).toBe("75001")
            expect(results[0].city).toBe("Paris")
            expect(results[0].lat).toBeCloseTo(48.8566, 2)
            expect(results[0].lng).toBeCloseTo(2.3522, 2)
        })

        it("should return empty array for non-French addresses", async () => {
            const fetchMock = createFetchMock({
                "api-adresse.data.gouv.fr": { features: [] },
            })
            vi.stubGlobal("fetch", fetchMock)

            const provider = new FrenchAddressProvider()
            const results = await provider.geocode("1600 Amphitheatre Parkway, Mountain View, CA", {
                limit: 5,
            })

            expect(results).toHaveLength(0)
        })

        it("should handle API errors gracefully", async () => {
            const fetchMock = vi.fn(async () => {
                return new Response("Server Error", { status: 500 })
            })
            vi.stubGlobal("fetch", fetchMock)

            const provider = new FrenchAddressProvider()
            const results = await provider.geocode("10 rue de Rivoli, Paris", { limit: 5 })

            expect(results).toHaveLength(0)
        })

        it("should be available without API key", () => {
            const provider = new FrenchAddressProvider()
            expect(provider.isAvailable()).toBe(true)
        })

        it("should have priority 0 (highest)", () => {
            const provider = new FrenchAddressProvider()
            expect(provider.priority).toBe(0)
        })
    })

    describe("OpenCageProvider", () => {
        it("should geocode with valid API key", async () => {
            process.env.OPENCAGE_API_KEY = "test-key"

            const fetchMock = createFetchMock({
                "api.opencagedata.com": MOCK_OPENCAGE_RESPONSE,
            })
            vi.stubGlobal("fetch", fetchMock)

            const provider = new OpenCageProvider()
            expect(provider.isAvailable()).toBe(true)

            const results = await provider.geocode("10 rue de Rivoli, Paris", { limit: 5 })

            expect(results.length).toBeGreaterThan(0)
            expect(results[0].provider).toBe("opencage")
            expect(results[0].lat).toBeCloseTo(48.8566, 2)
            expect(results[0].lng).toBeCloseTo(2.3522, 2)
        })

        it("should not be available without API key", () => {
            delete process.env.OPENCAGE_API_KEY
            const provider = new OpenCageProvider()
            expect(provider.isAvailable()).toBe(false)
        })

        it("should return empty array when API key is missing", async () => {
            delete process.env.OPENCAGE_API_KEY
            const provider = new OpenCageProvider()
            const results = await provider.geocode("10 rue de Rivoli, Paris", { limit: 5 })
            expect(results).toHaveLength(0)
        })

        it("should handle quota exceeded errors", async () => {
            process.env.OPENCAGE_API_KEY = "test-key"

            const fetchMock = vi.fn(async () => {
                return new Response("Payment Required", { status: 402 })
            })
            vi.stubGlobal("fetch", fetchMock)

            const provider = new OpenCageProvider()
            const results = await provider.geocode("10 rue de Rivoli, Paris", { limit: 5 })

            expect(results).toHaveLength(0)
        })

        it("should have priority 10 (medium)", () => {
            const provider = new OpenCageProvider()
            expect(provider.priority).toBe(10)
        })
    })

    describe("NominatimProvider", () => {
        it("should geocode a valid address", async () => {
            const fetchMock = createFetchMock({
                "nominatim.openstreetmap.org": MOCK_NOMINATIM_RESPONSE,
            })
            vi.stubGlobal("fetch", fetchMock)

            const provider = new NominatimProvider()
            const results = await provider.geocode("10 rue de Rivoli, Paris", { limit: 5 })

            expect(results.length).toBeGreaterThan(0)
            expect(results[0].provider).toBe("nominatim")
            expect(results[0].lat).toBeCloseTo(48.8566, 2)
            expect(results[0].lng).toBeCloseTo(2.3522, 2)
        })

        it("should always be available", () => {
            const provider = new NominatimProvider()
            expect(provider.isAvailable()).toBe(true)
        })

        it("should handle rate limiting", async () => {
            const fetchMock = vi.fn(async () => {
                return new Response("Too Many Requests", { status: 429 })
            })
            vi.stubGlobal("fetch", fetchMock)

            const provider = new NominatimProvider()
            const results = await provider.geocode("10 rue de Rivoli, Paris", { limit: 5 })

            expect(results).toHaveLength(0)
        })

        it("should have priority 20 (lowest - fallback)", () => {
            const provider = new NominatimProvider()
            expect(provider.priority).toBe(20)
        })
    })

    describe("GeocodeService - Cascade Mode", () => {
        it("should use FrenchAddressProvider first for French addresses", async () => {
            const fetchMock = createFetchMock({
                "api-adresse.data.gouv.fr": MOCK_FRENCH_ADDRESS_RESPONSE,
            })
            vi.stubGlobal("fetch", fetchMock)

            const service = GeocodeService.getInstance()
            const results = await service.geocode("10 rue de Rivoli, Paris", { limit: 5 })

            expect(results.length).toBeGreaterThan(0)
            expect(results[0].provider).toBe("french-address")
            expect(results[0].lat).toBeCloseTo(48.8566, 2)
            expect(results[0].lng).toBeCloseTo(2.3522, 2)
        })

        it("should fallback to Nominatim if FrenchAddressProvider fails", async () => {
            const fetchMock = vi.fn(async (url: string) => {
                const urlStr = url.toString()
                if (urlStr.includes("api-adresse.data.gouv.fr")) {
                    return new Response(JSON.stringify({ features: [] }), { status: 200 })
                }
                if (urlStr.includes("nominatim.openstreetmap.org")) {
                    return new Response(JSON.stringify(MOCK_NOMINATIM_RESPONSE), { status: 200 })
                }
                return new Response(JSON.stringify([]), { status: 200 })
            })
            vi.stubGlobal("fetch", fetchMock)

            const service = GeocodeService.getInstance()
            const results = await service.geocode("10 rue de Rivoli, Paris", { limit: 5 })

            expect(results.length).toBeGreaterThan(0)
            // Should fallback to nominatim since french-address returned empty
            expect(results[0].provider).toBe("nominatim")
        })

        it("should cache results", async () => {
            const fetchMock = createFetchMock({
                "api-adresse.data.gouv.fr": MOCK_FRENCH_ADDRESS_RESPONSE,
            })
            vi.stubGlobal("fetch", fetchMock)

            const service = GeocodeService.getInstance()

            // First call
            const results1 = await service.geocode("10 rue de Rivoli, Paris", { limit: 5 })
            expect(results1.length).toBeGreaterThan(0)

            // Second call should use cache
            const results2 = await service.geocode("10 rue de Rivoli, Paris", { limit: 5 })
            expect(results2.length).toBeGreaterThan(0)

            // Results should be identical
            expect(results2[0].lat).toBe(results1[0].lat)
            expect(results2[0].lng).toBe(results1[0].lng)
            expect(results2[0].label).toBe(results1[0].label)
        })
    })

    describe("GeocodeService - Parallel Mode", () => {
        it("should call all providers in parallel and merge results", async () => {
            const fetchMock = createFetchMock({
                "api-adresse.data.gouv.fr": MOCK_FRENCH_ADDRESS_RESPONSE,
                "nominatim.openstreetmap.org": MOCK_NOMINATIM_RESPONSE,
            })
            vi.stubGlobal("fetch", fetchMock)

            const service = GeocodeService.getInstance()
            service.setMode("parallel")

            const results = await service.geocode("10 rue de Rivoli, Paris", { limit: 5 })

            expect(results.length).toBeGreaterThan(0)
            expect(results[0].lat).toBeCloseTo(48.8566, 2)
            expect(results[0].lng).toBeCloseTo(2.3522, 2)
        })
    })

    describe("API Route - /api/geocode", () => {
        it("should use FrenchAddressProvider for French addresses", async () => {
            const fetchMock = createFetchMock({
                "api-adresse.data.gouv.fr": MOCK_FRENCH_ADDRESS_RESPONSE,
            })
            vi.stubGlobal("fetch", fetchMock)

            const { GET } = await import("../../../app/api/geocode/route")
            const request = new NextRequest(
                `http://localhost/api/geocode?q=${encodeURIComponent("10 rue de Rivoli, Paris")}`,
            )
            const response = await GET(request)

            expect(response.status).toBe(200)
            const payload = (await response.json()) as { lat: number; lng: number }
            expect(payload.lat).toBeCloseTo(48.8566, 2)
            expect(payload.lng).toBeCloseTo(2.3522, 2)
        })

        it("should return suggestions when suggest=1", async () => {
            const fetchMock = createFetchMock({
                "api-adresse.data.gouv.fr": MOCK_FRENCH_ADDRESS_RESPONSE,
            })
            vi.stubGlobal("fetch", fetchMock)

            const { GET } = await import("../../../app/api/geocode/route")
            const request = new NextRequest(
                `http://localhost/api/geocode?q=${encodeURIComponent("Rue de Rivoli Paris")}&suggest=1&limit=5`,
            )
            const response = await GET(request)

            expect(response.status).toBe(200)
            const payload = (await response.json()) as Array<{ label: string; lat: number; lng: number }>
            expect(payload.length).toBeGreaterThan(0)
            expect(payload[0].label).toContain("Rivoli")
        })

        it("should fallback through providers when first fails", async () => {
            const fetchMock = vi.fn(async (url: string) => {
                const urlStr = url.toString()
                if (urlStr.includes("api-adresse.data.gouv.fr")) {
                    return new Response(JSON.stringify({ features: [] }), { status: 200 })
                }
                if (urlStr.includes("nominatim.openstreetmap.org")) {
                    return new Response(JSON.stringify(MOCK_NOMINATIM_RESPONSE), { status: 200 })
                }
                return new Response(JSON.stringify([]), { status: 200 })
            })
            vi.stubGlobal("fetch", fetchMock)

            const { GET } = await import("../../../app/api/geocode/route")
            const request = new NextRequest(
                `http://localhost/api/geocode?q=${encodeURIComponent("10 rue de Rivoli, Paris")}`,
            )
            const response = await GET(request)

            expect(response.status).toBe(200)
            const payload = (await response.json()) as { lat: number; lng: number }
            expect(payload.lat).toBeCloseTo(48.8566, 2)
            expect(payload.lng).toBeCloseTo(2.3522, 2)
        })

        it("should return 404 when no results found", async () => {
            const fetchMock = vi.fn(async () => {
                return new Response(JSON.stringify({ features: [], results: [] }), { status: 200 })
            })
            vi.stubGlobal("fetch", fetchMock)

            const { GET } = await import("../../../app/api/geocode/route")
            const request = new NextRequest(
                `http://localhost/api/geocode?q=${encodeURIComponent("Adresse invalide 99999")}`,
            )
            const response = await GET(request)

            // Should return 404 when no results
            expect(response.status).toBe(404)
        })
    })

    describe("Provider Priority and Order", () => {
        it("should register providers in correct priority order", () => {
            const service = GeocodeService.getInstance()
            const providers = service.getProviders()

            expect(providers.length).toBeGreaterThanOrEqual(2)

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
