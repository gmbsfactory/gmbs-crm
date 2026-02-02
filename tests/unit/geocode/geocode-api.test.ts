import { NextRequest } from "next/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { GeocodeService } from "@/lib/geocode/geocode-service"

const TEST_ADDRESS = "10 rue de Rivoli, Paris"

// Mock responses
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

const MOCK_OPENCAGE_RESPONSE = {
  results: [
    {
      geometry: { lat: 48.8566, lng: 2.3522 },
      confidence: 9,
      formatted: "10 Rue de Rivoli, 75004 Paris, France",
    },
  ],
}

const MOCK_NOMINATIM_RESPONSE = [
  {
    lat: "45.7640",
    lon: "4.8357",
    importance: 0.8,
    display_name: "Lyon, Auvergne-Rhône-Alpes, France",
  },
]

// Helper pour créer un mock fetch qui gère tous les providers
function createFullFetchMock(overrides: Record<string, Response | (() => Response)> = {}) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = input instanceof URL ? input.toString() : String(input)

    // Check for custom overrides first
    for (const [pattern, responseOrFn] of Object.entries(overrides)) {
      if (url.includes(pattern)) {
        return typeof responseOrFn === "function" ? responseOrFn() : responseOrFn
      }
    }

    // Default responses for each provider
    if (url.includes("api-adresse.data.gouv.fr")) {
      return new Response(JSON.stringify(MOCK_FRENCH_ADDRESS_RESPONSE), { status: 200 })
    }

    if (url.includes("api.opencagedata.com")) {
      return new Response(JSON.stringify(MOCK_OPENCAGE_RESPONSE), { status: 200 })
    }

    if (url.includes("nominatim.openstreetmap.org")) {
      return new Response(JSON.stringify(MOCK_NOMINATIM_RESPONSE), { status: 200 })
    }

    // Default empty response
    return new Response(JSON.stringify({ features: [], results: [] }), { status: 200 })
  })
}

describe("/api/geocode", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.restoreAllMocks()
    vi.spyOn(console, "error").mockImplementation(() => {})
    vi.spyOn(console, "warn").mockImplementation(() => {})
    vi.spyOn(console, "log").mockImplementation(() => {})
    process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000"
    process.env.OPENCAGE_API_KEY = "test-key"
    GeocodeService.resetInstance()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    delete process.env.OPENCAGE_API_KEY
    GeocodeService.resetInstance()
  })

  it("should geocode a valid address with OpenCage", async () => {
    // FrenchAddressProvider has priority 0, so it will be called first
    // We mock it to return empty so it falls back to OpenCage
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = input instanceof URL ? input.toString() : String(input)

      if (url.includes("api-adresse.data.gouv.fr")) {
        return new Response(JSON.stringify({ features: [] }), { status: 200 })
      }

      if (url.includes("api.opencagedata.com")) {
        return new Response(JSON.stringify(MOCK_OPENCAGE_RESPONSE), { status: 200 })
      }

      return new Response(JSON.stringify({ features: [], results: [] }), { status: 200 })
    })

    vi.stubGlobal("fetch", fetchMock)

    const { GET } = await import("../../../app/api/geocode/route")
    const request = new NextRequest(`http://localhost/api/geocode?q=${encodeURIComponent(TEST_ADDRESS)}`)
    const response = await GET(request)

    expect(response.status).toBe(200)
    const payload = (await response.json()) as { lat: number; lng: number; precision?: string }
    expect(payload.lat).toBeCloseTo(48.8566)
    expect(payload.lng).toBeCloseTo(2.3522)
  })

  it("should fallback to Nominatim if OpenCage fails", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = input instanceof URL ? input.toString() : String(input)

      // FrenchAddressProvider returns empty
      if (url.includes("api-adresse.data.gouv.fr")) {
        return new Response(JSON.stringify({ features: [] }), { status: 200 })
      }

      // OpenCage fails
      if (url.includes("api.opencagedata.com")) {
        return new Response("OpenCage failure", { status: 500 })
      }

      // Nominatim works
      if (url.includes("nominatim.openstreetmap.org")) {
        return new Response(JSON.stringify(MOCK_NOMINATIM_RESPONSE), { status: 200 })
      }

      return new Response(JSON.stringify([]), { status: 200 })
    })

    vi.stubGlobal("fetch", fetchMock)

    const { GET } = await import("../../../app/api/geocode/route")
    const request = new NextRequest(`http://localhost/api/geocode?q=${encodeURIComponent("Lyon, France")}`)
    const response = await GET(request)

    expect(response.status).toBe(200)
    const payload = (await response.json()) as { lat: number; lng: number; precision?: string }
    expect(payload.lat).toBeCloseTo(45.764)
    expect(payload.lng).toBeCloseTo(4.8357)
  })

  it("should return 400 for empty query", async () => {
    const fetchMock = createFullFetchMock()
    vi.stubGlobal("fetch", fetchMock)

    const { GET } = await import("../../../app/api/geocode/route")
    const request = new NextRequest("http://localhost/api/geocode")
    const response = await GET(request)

    expect(response.status).toBe(400)
    const payload = (await response.json()) as { error: string }
    expect(payload.error).toMatch(/required/i)
  })

  it("should enforce rate limiting", async () => {
    const fetchMock = createFullFetchMock()
    vi.stubGlobal("fetch", fetchMock)

    const { GET } = await import("../../../app/api/geocode/route")

    const requestFactory = () =>
      new NextRequest(`http://localhost/api/geocode?q=${encodeURIComponent(TEST_ADDRESS)}`, {
        headers: { "x-forwarded-for": "203.0.113.1" },
      })

    for (let index = 0; index < 60; index += 1) {
      const response = await GET(requestFactory())
      expect(response.status).toBe(200)
    }

    const limitedResponse = await GET(requestFactory())
    expect(limitedResponse.status).toBe(429)
    const payload = (await limitedResponse.json()) as { error: string }
    expect(payload.error).toMatch(/too many/i)
  })

  it("should return 404 when address not found", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({ features: [], results: [] }), { status: 200 })
    })

    vi.stubGlobal("fetch", fetchMock)

    const { GET } = await import("../../../app/api/geocode/route")
    const request = new NextRequest(`http://localhost/api/geocode?q=${encodeURIComponent("Adresse inconnue")}`)
    const response = await GET(request)

    expect(response.status).toBe(404)
    const payload = (await response.json()) as { error: string }
    expect(payload.error).toMatch(/not found/i)
  })

  it("should return suggestion list when suggest mode is enabled", async () => {
    const fetchMock = createFullFetchMock()
    vi.stubGlobal("fetch", fetchMock)

    const { GET } = await import("../../../app/api/geocode/route")
    const request = new NextRequest(`http://localhost/api/geocode?q=${encodeURIComponent("Paris")}&suggest=1&limit=3`)
    const response = await GET(request)

    expect(response.status).toBe(200)
    const payload = (await response.json()) as Array<{ label: string; lat: number; lng: number }>
    expect(payload.length).toBeGreaterThan(0)
  })
})
