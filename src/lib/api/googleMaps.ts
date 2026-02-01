// Map services utilities used to locate artisans around an intervention address via the internal geocoding API.

export type GeocodedAddress = {
  formattedAddress: string
  location: { lat: number; lng: number }
  precision?: string
}

export type NearbyPlace = {
  id: string
  name: string
  address: string
  distanceMeters?: number
  rating?: number
}

export async function geocodeAddress(address: string): Promise<GeocodedAddress | null> {
  if (!address) return null

  try {
    const endpoint = resolveGeocodeUrl(address)
    const response = await fetch(endpoint, { headers: { Accept: "application/json" } })

    if (!response.ok) {
      if (response.status !== 404) {
        console.warn("[mapServices] geocodeAddress failed", response.status, response.statusText)
      }
      return null
    }

    const payload = (await response.json()) as GeocodeApiResponse
    return {
      formattedAddress: address,
      location: { lat: payload.lat, lng: payload.lng },
      precision: payload.precision,
    }
  } catch (error) {
    console.error("[mapServices] geocodeAddress error", error)
    return null
  }
}

export async function searchNearbyArtisans(address: string, radiusMeters = 15000): Promise<NearbyPlace[]> {
  if (!address) return []

  console.debug("[mapServices] searchNearbyArtisans placeholder", { address, radiusMeters })
  return []
}

function resolveGeocodeUrl(address: string) {
  const query = encodeURIComponent(address)

  if (typeof window !== "undefined") {
    return `/api/geocode?q=${query}`
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "http://localhost:3000"
  const normalizedBase = baseUrl.replace(/\/$/, "")
  return `${normalizedBase}/api/geocode?q=${query}`
}

type GeocodeApiResponse = {
  lat: number
  lng: number
  precision?: string
}
