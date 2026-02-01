import { NextRequest } from "next/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const TEST_ADDRESS = "10 rue de Rivoli, Paris"

const originalFetch = global.fetch

describe("/api/geocode", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.restoreAllMocks()
    process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000"
    process.env.OPENCAGE_API_KEY = "test-key"
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    if (originalFetch) {
      global.fetch = originalFetch
    }
    delete process.env.OPENCAGE_API_KEY
  })

  it("should geocode a valid address with OpenCage", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = input instanceof URL ? input.toString() : String(input)
      if (url.startsWith("https://api.opencagedata.com")) {
        return new Response(
          JSON.stringify({
            results: [
              {
                geometry: { lat: 48.8566, lng: 2.3522 },
                confidence: 9,
                formatted: "10 Rue de Rivoli, 75004 Paris, France",
              },
            ],
          }),
          { status: 200 },
        )
      }
      throw new Error(`Unexpected fetch call: ${url}`)
    })

    vi.stubGlobal("fetch", fetchMock)

    const { GET } = await import("../../../app/api/geocode/route")
    const request = new NextRequest(`http://localhost/api/geocode?q=${encodeURIComponent(TEST_ADDRESS)}`)
    const response = await GET(request)

    expect(response.status).toBe(200)
    const payload = (await response.json()) as { lat: number; lng: number; precision?: string }
    expect(payload.lat).toBeCloseTo(48.8566)
    expect(payload.lng).toBeCloseTo(2.3522)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("should fallback to Nominatim if OpenCage fails", async () => {
    let callCount = 0
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = input instanceof URL ? input.toString() : String(input)
      callCount += 1

      if (callCount === 1 && url.startsWith("https://api.opencagedata.com")) {
        return new Response("OpenCage failure", { status: 500 })
      }

      if (url.startsWith("https://nominatim.openstreetmap.org")) {
        return new Response(
          JSON.stringify([
            {
              lat: "45.7640",
              lon: "4.8357",
              importance: 0.8,
              display_name: "Lyon, Auvergne-Rhône-Alpes, France",
            },
          ]),
          { status: 200 },
        )
      }

      throw new Error(`Unexpected fetch call: ${url}`)
    })

    vi.stubGlobal("fetch", fetchMock)

    const { GET } = await import("../../../app/api/geocode/route")
    const request = new NextRequest(`http://localhost/api/geocode?q=${encodeURIComponent("Lyon, France")}`)
    const response = await GET(request)

    expect(response.status).toBe(200)
    const payload = (await response.json()) as { lat: number; lng: number; precision?: string }
    expect(payload.lat).toBeCloseTo(45.764)
    expect(payload.lng).toBeCloseTo(4.8357)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("should return 400 for empty query", async () => {
    const { GET } = await import("../../../app/api/geocode/route")
    const request = new NextRequest("http://localhost/api/geocode")
    const response = await GET(request)

    expect(response.status).toBe(400)
    const payload = (await response.json()) as { error: string }
    expect(payload.error).toMatch(/required/i)
  })

  it("should enforce rate limiting", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          results: [
            {
              geometry: { lat: 48.8566, lng: 2.3522 },
              confidence: 9,
              formatted: TEST_ADDRESS,
            },
          ],
        }),
        { status: 200 },
      )
    })

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
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = input instanceof URL ? input.toString() : String(input)

      if (url.startsWith("https://api.opencagedata.com")) {
        return new Response(JSON.stringify({ results: [] }), { status: 200 })
      }

      if (url.startsWith("https://nominatim.openstreetmap.org")) {
        return new Response(JSON.stringify([]), { status: 200 })
      }

      throw new Error(`Unexpected fetch call: ${url}`)
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
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = input instanceof URL ? input.toString() : String(input)

      if (url.startsWith("https://api.opencagedata.com")) {
        return new Response(
          JSON.stringify({
            results: [
              {
                geometry: { lat: 48.8566, lng: 2.3522 },
                confidence: 9,
                formatted: "Paris, Île-de-France, France",
              },
            ],
          }),
          { status: 200 },
        )
      }

      if (url.startsWith("https://nominatim.openstreetmap.org")) {
        return new Response(
          JSON.stringify([
            {
              lat: "48.866667",
              lon: "2.333333",
              importance: 0.9,
              display_name: "Paris, Département de Paris, Île-de-France, France",
            },
          ]),
          { status: 200 },
        )
      }

      throw new Error(`Unexpected fetch call: ${url}`)
    })

    vi.stubGlobal("fetch", fetchMock)

    const { GET } = await import("../../../app/api/geocode/route")
    const request = new NextRequest(`http://localhost/api/geocode?q=${encodeURIComponent("Paris")}&suggest=1&limit=3`)
    const response = await GET(request)

    expect(response.status).toBe(200)
    const payload = (await response.json()) as Array<{ label: string; lat: number; lng: number }>
    expect(payload.length).toBeGreaterThan(0)
    expect(payload[0].label).toMatch(/Paris/)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
