import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase-client"
import { safeErrorMessage } from "@/lib/api/common/error-handler"

export interface AvatarMetadata {
  hash: string | null
  sizes: Record<string, string>
  mime_preferred: string
  baseUrl: string | null
}

export type NearbyArtisan = {
  id: string
  displayName: string
  distanceKm: number
  telephone: string | null
  telephone2: string | null
  email: string | null
  adresse: string | null
  ville: string | null
  codePostal: string | null
  lat: number
  lng: number
  prenom: string | null
  nom: string | null
  raison_sociale: string | null
  statut_id: string | null
  photoProfilMetadata: AvatarMetadata | null
}

type NearbyArtisanState = {
  artisans: NearbyArtisan[]
  loading: boolean
  error: string | null
}

type NearbyArtisanOptions = {
  limit?: number
  maxDistanceKm?: number
  metier_id?: string | null
}

/** Ligne renvoyee par le RPC find_nearby_artisans (migration 99072). */
type NearbyArtisanRow = {
  id: string
  prenom: string | null
  nom: string | null
  raison_sociale: string | null
  telephone: string | null
  telephone2: string | null
  email: string | null
  adresse_intervention: string | null
  code_postal_intervention: string | null
  ville_intervention: string | null
  intervention_latitude: number | null
  intervention_longitude: number | null
  statut_id: string | null
  distance_km: number | null
  photo_url: string | null
  photo_content_hash: string | null
  photo_derived_sizes: Record<string, string> | null
  photo_mime_preferred: string | null
}

/** `Number(null)` vaut 0 : on rejette explicitement null/undefined avant la conversion. */
function toFiniteNumber(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function mapRow(row: NearbyArtisanRow): NearbyArtisan | null {
  const lat = toFiniteNumber(row.intervention_latitude)
  const lng = toFiniteNumber(row.intervention_longitude)
  const distanceKm = toFiniteNumber(row.distance_km)

  if (lat === null || lng === null || distanceKm === null) {
    return null
  }

  const photoProfilMetadata: AvatarMetadata | null = row.photo_url
    ? {
        hash: row.photo_content_hash || null,
        sizes: row.photo_derived_sizes || {},
        mime_preferred: row.photo_mime_preferred || "image/jpeg",
        baseUrl: row.photo_url,
      }
    : null

  return {
    id: row.id,
    displayName:
      row.raison_sociale ||
      [row.prenom, row.nom].filter(Boolean).join(" ").trim() ||
      row.id,
    distanceKm,
    telephone: row.telephone ?? null,
    telephone2: row.telephone2 ?? null,
    email: row.email ?? null,
    adresse: row.adresse_intervention ?? null,
    ville: row.ville_intervention ?? null,
    codePostal: row.code_postal_intervention ?? null,
    lat,
    lng,
    prenom: row.prenom ?? null,
    nom: row.nom ?? null,
    raison_sociale: row.raison_sociale ?? null,
    statut_id: row.statut_id ?? null,
    photoProfilMetadata,
  }
}

/**
 * Artisans d'un metier donne, tries du plus proche au plus lointain autour d'un point.
 *
 * Le filtrage et le tri geographiques sont delegues au RPC `find_nearby_artisans`
 * (migration 99072). Le resultat est exhaustif : tous les artisans du metier sont
 * evalues, pas un echantillon.
 *
 * Historique : l'implementation precedente chargeait les artisans par lots jusqu'a
 * un plafond (`sampleSize`) PUIS calculait les distances cote client. Au-dela du
 * plafond, des artisans pourtant tres proches devenaient invisibles -- et comme
 * l'ordre de chargement n'etait pas trie, lesquels variait dans le temps.
 * Cf. intervention 22706 : le plombier le plus proche (6 km) etait le 521e charge
 * sur 572, avec un plafond a 400.
 */
export function useNearbyArtisans(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
  options?: NearbyArtisanOptions,
): NearbyArtisanState {
  const [state, setState] = useState<NearbyArtisanState>({
    artisans: [],
    loading: false,
    error: null,
  })

  const { limit, maxDistanceKm, metier_id } = useMemo(
    () => ({
      limit: options?.limit ?? 5,
      maxDistanceKm: options?.maxDistanceKm ?? 100,
      metier_id: options?.metier_id ?? null,
    }),
    [options?.limit, options?.maxDistanceKm, options?.metier_id],
  )

  useEffect(() => {
    let cancelled = false

    async function fetchArtisans() {
      // Regle metier : aucune proposition d'artisan sans metier selectionne,
      // ni sans point de reference.
      if (latitude == null || longitude == null || metier_id == null) {
        setState({ artisans: [], loading: false, error: null })
        return
      }

      setState((prev) => ({ ...prev, loading: true, error: null }))

      try {
        const { data, error } = await supabase.rpc("find_nearby_artisans", {
          p_latitude: latitude,
          p_longitude: longitude,
          p_radius_km: maxDistanceKm,
          p_metier_id: metier_id,
          p_limit: limit,
        })

        if (cancelled) return

        if (error) {
          setState({
            artisans: [],
            loading: false,
            error: safeErrorMessage(error, "la recherche d'artisans à proximité"),
          })
          return
        }

        const artisans = ((data as NearbyArtisanRow[] | null) ?? [])
          .map(mapRow)
          .filter((artisan): artisan is NearbyArtisan => artisan !== null)

        setState({ artisans, loading: false, error: null })
      } catch (err) {
        if (cancelled) return
        if (err instanceof DOMException && err.name === "AbortError") return
        setState({
          artisans: [],
          loading: false,
          error: safeErrorMessage(err, "la recherche d'artisans à proximité"),
        })
      }
    }

    fetchArtisans()

    return () => {
      cancelled = true
    }
  }, [latitude, longitude, limit, maxDistanceKm, metier_id])

  return state
}
