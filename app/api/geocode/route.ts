"use server"

import { NextRequest, NextResponse } from "next/server"

type GeocodeResponse = {
  lat: number
  lng: number
  precision?: string
}

type GeocodeSuggestion = GeocodeResponse & {
  label: string
}

type GeocodeError = {
  error: string
}

type RateLimitEntry = {
  count: number
  resetAt: number
}

type CacheEntry = {
  data: GeocodeResponse
  expiresAt: number
}

type InternalGeocodeResult = GeocodeResponse & {
  label: string
  provider: "opencage" | "nominatim"
}

const requestCounts = new Map<string, RateLimitEntry>()
const geocodeCache = new Map<string, CacheEntry>()

const RATE_LIMIT = 60
const RATE_WINDOW = 60_000
const CACHE_TTL = 60_000
const MAX_SUGGESTIONS = 5

const NOMINATIM_BASE_URL = "https://nominatim.openstreetmap.org/search"
const DEFAULT_COUNTRY_CODE = "fr"

// Constantes pour les limites géographiques de la France
const FRANCE_BOUNDS = {
  minLat: 41.0,
  maxLat: 51.5,
  minLng: -5.0,
  maxLng: 10.0,
}

const NON_FRENCH_HINTS = [
  "belgique",
  "belgium",
  "suisse",
  "switzerland",
  "espagne",
  "spain",
  "italie",
  "italy",
  "royaume-uni",
  "united kingdom",
  "angleterre",
  "england",
  "allemagne",
  "germany",
  "portugal",
  "maroc",
  "tunisie",
  "canada",
  "usa",
  "états-unis",
  "etats-unis",
]

// Fonction pour vérifier si des coordonnées sont en France
function isInFrance(lat: number, lng: number): boolean {
  return (
    lat >= FRANCE_BOUNDS.minLat &&
    lat <= FRANCE_BOUNDS.maxLat &&
    lng >= FRANCE_BOUNDS.minLng &&
    lng <= FRANCE_BOUNDS.maxLng
  )
}

// Fonction pour enrichir l'adresse avec "France" si nécessaire
function enrichAddressWithFrance(query: string): string {
  const normalized = query.toLowerCase().trim()
  const hasFrance = normalized.includes("france") ||
    normalized.includes("fr,") ||
    normalized.endsWith(", fr")

  if (!hasFrance && normalized.length > 0) {
    return `${query.trim()}, France`
  }
  return query.trim()
}

/**
 * Normalise la requête pour améliorer le matching fuzzy.
 * Gère les articles et prépositions courants dans les adresses françaises.
 * Ex: "rue rivoli" → recherche aussi "rue de rivoli", "rue du rivoli", etc.
 */
function normalizeQueryForSearch(query: string): string[] {
  const trimmed = query.trim()
  if (!trimmed) return []

  const queries = [trimmed]
  const lower = trimmed.toLowerCase()

  // Patterns de prépositions courantes dans les adresses françaises
  const streetPatterns = [
    { prefix: /^(rue|avenue|boulevard|place|allée|impasse|chemin|passage|square|cours)\s+/i, prepositions: ["de ", "du ", "de la ", "des ", ""] },
    { prefix: /^(quai|port)\s+/i, prepositions: ["de ", "du ", "des ", ""] },
  ]

  for (const pattern of streetPatterns) {
    const match = lower.match(pattern.prefix)
    if (match) {
      const streetType = match[1]
      const rest = trimmed.slice(match[0].length)

      // Vérifier si une préposition est déjà présente
      const hasPreposition = /^(de |du |de la |des |d'|l')/i.test(rest)

      if (!hasPreposition) {
        // Ajouter des variantes avec prépositions
        for (const prep of pattern.prepositions) {
          if (prep) {
            const variant = `${streetType} ${prep}${rest}`
            if (!queries.includes(variant)) {
              queries.push(variant)
            }
          }
        }
      } else {
        // Ajouter une variante sans préposition
        const withoutPrep = rest.replace(/^(de |du |de la |des |d'|l')/i, "")
        const variant = `${streetType} ${withoutPrep}`
        if (!queries.includes(variant)) {
          queries.push(variant)
        }
      }
    }
  }

  // Limiter à 3 variantes pour éviter trop d'appels
  return queries.slice(0, 3)
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const rawQuery = searchParams.get("q")?.trim()
    const limit = parseLimit(searchParams.get("limit"))
    const suggestMode = searchParams.get("suggest") === "1"

    if (!rawQuery) {
      return NextResponse.json({ error: "Query parameter 'q' is required" } satisfies GeocodeError, { status: 400 })
    }

    enforceRateLimit(getClientIdentifier(request))

    if (!suggestMode) {
      const cached = geocodeCache.get(rawQuery.toLowerCase())
      if (cached && cached.expiresAt > Date.now()) {
        const response = NextResponse.json(cached.data)
        response.headers.set("Cache-Control", "public, max-age=60")
        return response
      }
    }

    const signal = new AbortController().signal

    const results = await geocodeAcrossProviders(rawQuery, limit, signal)

    if (suggestMode) {
      const payload = results.map(({ label, lat, lng, precision }) => ({
        label,
        lat,
        lng,
        precision,
      })) satisfies GeocodeSuggestion[]

      const response = NextResponse.json(payload)
      response.headers.set("Cache-Control", "public, max-age=60")
      return response
    }

    const bestMatch = results[0]
    if (!bestMatch) {
      return NextResponse.json({ error: "Address not found" } satisfies GeocodeError, { status: 404 })
    }

    geocodeCache.set(rawQuery.toLowerCase(), {
      data: { lat: bestMatch.lat, lng: bestMatch.lng, precision: bestMatch.precision },
      expiresAt: Date.now() + CACHE_TTL,
    })

    const response = NextResponse.json({
      lat: bestMatch.lat,
      lng: bestMatch.lng,
      precision: bestMatch.precision,
    } satisfies GeocodeResponse)
    response.headers.set("Cache-Control", "public, max-age=60")
    return response
  } catch (error) {
    if (error instanceof RateLimitExceededError) {
      return NextResponse.json({ error: "Too many requests" } satisfies GeocodeError, {
        status: 429,
        headers: {
          "Retry-After": Math.ceil((error.resetAt - Date.now()) / 1000).toString(),
        },
      })
    }

    console.error("[geocode] Error:", error)
    return NextResponse.json({ error: "Geocoding failed" } satisfies GeocodeError, { status: 500 })
  }
}

function parseLimit(param: string | null) {
  if (!param) return 1
  const parsed = Number.parseInt(param, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 1
  }
  return Math.min(parsed, MAX_SUGGESTIONS)
}

function enforceRateLimit(identifier: string) {
  const now = Date.now()
  const entry = requestCounts.get(identifier)

  if (!entry || entry.resetAt <= now) {
    requestCounts.set(identifier, { count: 1, resetAt: now + RATE_WINDOW })
    return
  }

  if (entry.count >= RATE_LIMIT) {
    throw new RateLimitExceededError(entry.resetAt)
  }

  entry.count += 1
}

function getClientIdentifier(request: NextRequest) {
  const requestWithIp = request as NextRequest & { ip?: string | null }
  const forwardedFor = request.headers.get("x-forwarded-for")
  const primaryForwarded = forwardedFor?.split(",")[0]?.trim()
  const realIp = request.headers.get("x-real-ip")?.trim()

  return requestWithIp.ip ?? primaryForwarded ?? realIp ?? "global"
}

async function geocodeAcrossProviders(query: string, limit: number, signal: AbortSignal): Promise<InternalGeocodeResult[]> {
  const seen = new Set<string>()
  const preferFrance = shouldPreferFrance(query)

  // Générer les variantes de la requête pour le fuzzy matching
  const queryVariants = normalizeQueryForSearch(query)

  // Construire toutes les promesses à exécuter en parallèle
  const promises: Promise<InternalGeocodeResult[]>[] = []

  // Pour chaque variante de requête, ajouter les appels aux providers
  for (const variant of queryVariants) {
    if (preferFrance) {
      promises.push(geocodeWithOpenCage(variant, limit, signal, DEFAULT_COUNTRY_CODE))
      promises.push(geocodeWithNominatim(variant, limit, signal, DEFAULT_COUNTRY_CODE))
    }
    promises.push(geocodeWithOpenCage(variant, limit, signal))
    promises.push(geocodeWithNominatim(variant, limit, signal))
  }

  // Exécuter tous les appels en parallèle
  const settledResults = await Promise.allSettled(promises)

  // Collecter et dédupliquer les résultats
  const allResults: InternalGeocodeResult[] = []

  for (const result of settledResults) {
    if (result.status === "fulfilled") {
      for (const entry of result.value) {
        const key = `${entry.label.toLowerCase()}|${entry.lat.toFixed(6)}|${entry.lng.toFixed(6)}`
        if (seen.has(key)) continue
        seen.add(key)
        allResults.push(entry)
      }
    }
  }

  // Trier par provider (OpenCage en premier car généralement plus précis) puis par confiance
  allResults.sort((a, b) => {
    // Priorité aux résultats OpenCage
    if (a.provider !== b.provider) {
      return a.provider === "opencage" ? -1 : 1
    }
    // Puis par précision/confiance décroissante
    const precisionA = a.precision ? Number.parseFloat(a.precision) : 0
    const precisionB = b.precision ? Number.parseFloat(b.precision) : 0
    return precisionB - precisionA
  })

  return allResults.slice(0, limit)
}

async function geocodeWithOpenCage(
  query: string,
  limit: number,
  signal: AbortSignal,
  countryCode?: string,
): Promise<InternalGeocodeResult[]> {
  const apiKey = process.env.OPENCAGE_API_KEY
  if (!apiKey) {
    return []
  }

  // Enrichir l'adresse avec "France" si on préfère la France
  const enrichedQuery = countryCode === DEFAULT_COUNTRY_CODE
    ? enrichAddressWithFrance(query)
    : query

  const endpoint = new URL("https://api.opencagedata.com/geocode/v1/json")
  endpoint.searchParams.set("q", enrichedQuery)
  endpoint.searchParams.set("key", apiKey)
  endpoint.searchParams.set("limit", String(Math.min(limit * 2, MAX_SUGGESTIONS * 2))) // Prendre plus pour filtrer
  endpoint.searchParams.set("language", "fr")
  endpoint.searchParams.set("no_annotations", "1")
  if (countryCode) {
    endpoint.searchParams.set("countrycode", countryCode)
  }

  const response = await fetch(endpoint, { signal, headers: { Accept: "application/json" } })
  if (!response.ok) {
    console.warn("[geocode] OpenCage request failed", response.status, await safeReadText(response))
    return []
  }

  const payload = (await response.json()) as OpenCageResponse | null
  const rawResults = payload?.results ?? []

  return rawResults
    .filter((result) => {
      if (!result?.geometry?.lat || !result?.geometry?.lng || !result.formatted) {
        return false
      }
      // Si on cherche spécifiquement en France, valider les coordonnées
      if (countryCode === DEFAULT_COUNTRY_CODE) {
        return isInFrance(result.geometry.lat, result.geometry.lng)
      }
      return true
    })
    .slice(0, limit)
    .map(
      (result) =>
        ({
          lat: result.geometry.lat,
          lng: result.geometry.lng,
          precision: result.confidence ? String(result.confidence) : undefined,
          label: result.formatted,
          provider: "opencage",
        }) satisfies InternalGeocodeResult,
    )
}

async function geocodeWithNominatim(
  query: string,
  limit: number,
  signal: AbortSignal,
  countryCode?: string,
): Promise<InternalGeocodeResult[]> {
  // Enrichir l'adresse avec "France" si on préfère la France
  const enrichedQuery = countryCode === DEFAULT_COUNTRY_CODE
    ? enrichAddressWithFrance(query)
    : query

  const endpoint = new URL(NOMINATIM_BASE_URL)
  endpoint.searchParams.set("q", enrichedQuery)
  endpoint.searchParams.set("format", "json")
  endpoint.searchParams.set("limit", String(Math.min(limit * 2, MAX_SUGGESTIONS * 2))) // Prendre plus pour filtrer
  endpoint.searchParams.set("addressdetails", "0")
  if (countryCode) {
    endpoint.searchParams.set("countrycodes", countryCode)
  }

  const response = await fetch(endpoint, {
    signal,
    headers: {
      Accept: "application/json",
      "User-Agent": buildNominatimUserAgent(),
      "Accept-Language": "fr",
    },
  })

  if (!response.ok) {
    console.warn("[geocode] Nominatim request failed", response.status, await safeReadText(response))
    return []
  }

  const payload = (await response.json()) as NominatimResponse | null
  const rawResults = payload ?? []

  return rawResults
    .filter((result) => {
      if (!result?.lat || !result?.lon || !result?.display_name) {
        return false
      }
      const lat = Number.parseFloat(result.lat)
      const lng = Number.parseFloat(result.lon)
      // Si on cherche spécifiquement en France, valider les coordonnées
      if (countryCode === DEFAULT_COUNTRY_CODE) {
        return isInFrance(lat, lng)
      }
      return true
    })
    .slice(0, limit)
    .map(
      (result) => {
        const lat = Number.parseFloat(result.lat)
        const lng = Number.parseFloat(result.lon)
        return {
          lat,
          lng,
          precision: result.importance ? result.importance.toFixed(2) : undefined,
          label: result.display_name || "",
          provider: "nominatim",
        } satisfies InternalGeocodeResult
      },
    )
}

function buildNominatimUserAgent() {
  const projectUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://localhost"
  return `GMBS-CRM/1.0 (${projectUrl})`
}

function shouldPreferFrance(query: string) {
  const lowered = query.toLowerCase()
  return !NON_FRENCH_HINTS.some((hint) => lowered.includes(hint))
}

async function safeReadText(response: Response) {
  try {
    return await response.text()
  } catch {
    return null
  }
}

type OpenCageResponse = {
  results?: Array<{
    geometry: { lat: number; lng: number }
    confidence?: number
    formatted: string
  }>
} | null

type NominatimResponse = Array<{
  lat: string
  lon: string
  importance?: number
  display_name?: string
}>

class RateLimitExceededError extends Error {
  resetAt: number

  constructor(resetAt: number) {
    super("Rate limit exceeded")
    this.name = "RateLimitExceededError"
    this.resetAt = resetAt
  }
}
