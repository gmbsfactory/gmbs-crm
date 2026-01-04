"use server"

import { NextRequest, NextResponse } from "next/server"
import { geocodeService, type GeocodeResult } from "@/lib/geocode"

// ============================================================================
// Types
// ============================================================================

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

// ============================================================================
// Configuration
// ============================================================================

const RATE_LIMIT = 60
const RATE_WINDOW = 60_000 // 1 minute
const MAX_SUGGESTIONS = 5

// ============================================================================
// Rate limiting (in-memory, resets on server restart)
// ============================================================================

const requestCounts = new Map<string, RateLimitEntry>()

class RateLimitExceededError extends Error {
  resetAt: number

  constructor(resetAt: number) {
    super("Rate limit exceeded")
    this.name = "RateLimitExceededError"
    this.resetAt = resetAt
  }
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

// ============================================================================
// Helpers
// ============================================================================

function parseLimit(param: string | null) {
  if (!param) return 1
  const parsed = Number.parseInt(param, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 1
  }
  return Math.min(parsed, MAX_SUGGESTIONS)
}

function mapResultToResponse(result: GeocodeResult): GeocodeSuggestion {
  return {
    label: result.label,
    lat: result.lat,
    lng: result.lng,
    precision: result.precision,
  }
}

// ============================================================================
// Route Handler
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const rawQuery = searchParams.get("q")?.trim()
    const limit = parseLimit(searchParams.get("limit"))
    const suggestMode = searchParams.get("suggest") === "1"

    if (!rawQuery) {
      return NextResponse.json(
        { error: "Query parameter 'q' is required" } satisfies GeocodeError,
        { status: 400 }
      )
    }

    // Enforce rate limiting
    enforceRateLimit(getClientIdentifier(request))

    // Create abort controller for the request
    const abortController = new AbortController()

    // Use the geocode service with Strategy Pattern
    const results = await geocodeService.geocode(rawQuery, {
      limit,
      signal: abortController.signal,
      autocomplete: suggestMode,
    })

    // Suggest mode: return all results with labels
    if (suggestMode) {
      const payload = results.map(mapResultToResponse) satisfies GeocodeSuggestion[]
      const response = NextResponse.json(payload)
      response.headers.set("Cache-Control", "public, max-age=60")
      return response
    }

    // Single result mode: return the best match
    const bestMatch = results[0]
    if (!bestMatch) {
      return NextResponse.json(
        { error: "Address not found" } satisfies GeocodeError,
        { status: 404 }
      )
    }

    const response = NextResponse.json({
      lat: bestMatch.lat,
      lng: bestMatch.lng,
      precision: bestMatch.precision,
    } satisfies GeocodeResponse)
    response.headers.set("Cache-Control", "public, max-age=60")
    return response

  } catch (error) {
    if (error instanceof RateLimitExceededError) {
      return NextResponse.json(
        { error: "Too many requests" } satisfies GeocodeError,
        {
          status: 429,
          headers: {
            "Retry-After": Math.ceil((error.resetAt - Date.now()) / 1000).toString(),
          },
        }
      )
    }

    console.error("[geocode] Error:", error)
    return NextResponse.json(
      { error: "Geocoding failed" } satisfies GeocodeError,
      { status: 500 }
    )
  }
}
