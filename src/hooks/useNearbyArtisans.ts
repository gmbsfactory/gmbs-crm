import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase-client"
import { safeErrorMessage } from "@/lib/api/v2/common/error-handler"

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
  sampleSize?: number
  metier_id?: string | null
}

function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (value: number) => (value * Math.PI) / 180

  const R = 6371 // Earth radius km
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c
}

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

  const { limit, maxDistanceKm, sampleSize, metier_id } = useMemo(
    () => ({
      limit: options?.limit ?? 5,
      maxDistanceKm: options?.maxDistanceKm ?? 100,
      sampleSize: options?.sampleSize ?? 150,
      metier_id: options?.metier_id ?? null,
    }),
    [options?.limit, options?.maxDistanceKm, options?.sampleSize, options?.metier_id],
  )

  useEffect(() => {
    let cancelled = false

    async function fetchArtisans() {
      if (latitude == null || longitude == null) {
        setState({ artisans: [], loading: false, error: null })
        return
      }

      setState((prev) => ({ ...prev, loading: true, error: null }))

      // Si un metier_id est fourni, récupérer les IDs des artisans par lots pour éviter les URLs trop longues
      let artisanIdsWithMetier: string[] | null = null
      if (metier_id) {
        const BATCH_SIZE = 1000 // Taille maximale pour éviter les URLs trop longues
        const allArtisanIds: string[] = []
        let offset = 0
        let hasMore = true

        while (hasMore && !cancelled) {
          const { data: metierData, error: metierError } = await supabase
            .from("artisan_metiers")
            .select("artisan_id")
            .eq("metier_id", metier_id)
            .range(offset, offset + BATCH_SIZE - 1)

          if (cancelled) return

          if (metierError) {
            setState({ artisans: [], loading: false, error: safeErrorMessage(metierError, "la recherche d'artisans par métier") })
            return
          }

          const batchIds = metierData?.map((row) => row.artisan_id).filter(Boolean) as string[] || []
          allArtisanIds.push(...batchIds)

          hasMore = batchIds.length === BATCH_SIZE
          offset += BATCH_SIZE
        }

        artisanIdsWithMetier = allArtisanIds
        
        // Si aucun artisan n'a ce métier, retourner une liste vide
        if (artisanIdsWithMetier.length === 0) {
          setState({ artisans: [], loading: false, error: null })
          return
        }
      }

      let archiveStatusIds: string[] = []
      const { data: archiveStatuses, error: archiveStatusesError } = await supabase
        .from("artisan_statuses")
        .select("id")
        .in("code", ["ARCHIVE", "ARCHIVER"])

      if (cancelled) return

      if (archiveStatusesError) {
        console.warn("[useNearbyArtisans] Impossible de charger les statuts archivés", archiveStatusesError)
      } else {
        archiveStatusIds = archiveStatuses?.map((status) => status.id).filter(Boolean) || []
      }

      const archiveStatusFilter =
        archiveStatusIds.length > 0
          ? `(${archiveStatusIds.map((id) => `"${id}"`).join(",")})`
          : null

      // Récupérer les artisans par lots si nécessaire pour éviter les URLs trop longues
      const BATCH_SIZE = 100
      const allArtisans: any[] = []
      let queryOffset = 0
      let hasMore = true

      while (hasMore && !cancelled && allArtisans.length < sampleSize) {
        let query = supabase
          .from("artisans")
          .select(
            [
              "id",
              "prenom",
              "nom",
              "raison_sociale",
              "telephone",
              "telephone2",
              "email",
              "adresse_intervention",
              "code_postal_intervention",
              "ville_intervention",
              "intervention_latitude",
              "intervention_longitude",
              "statut_id",
              "artisan_attachments(kind, url, content_hash, derived_sizes, mime_preferred, mime_type)",
            ].join(", "),
          )
          .not("intervention_latitude", "is", null)
          .not("intervention_longitude", "is", null)

        if (archiveStatusFilter) {
          query = query.not("statut_id", "in", archiveStatusFilter)
        }

        // Filtrer par métier si nécessaire
        if (artisanIdsWithMetier && artisanIdsWithMetier.length > 0) {
          const batchIds = artisanIdsWithMetier.slice(queryOffset, queryOffset + BATCH_SIZE)
          if (batchIds.length === 0) {
            hasMore = false
            break
          }
          query = query.in("id", batchIds)
        } else {
          // Pas de filtre par métier, paginer normalement
          query = query.range(queryOffset, queryOffset + BATCH_SIZE - 1)
        }

        const { data, error } = await query.limit(BATCH_SIZE)

        if (cancelled) return

        if (error) {
          setState({ artisans: [], loading: false, error: safeErrorMessage(error, "la recherche d'artisans à proximité") })
          return
        }

        if (data && data.length > 0) {
          allArtisans.push(...data)
          if (artisanIdsWithMetier && artisanIdsWithMetier.length > 0) {
            // Filtré par métier : continuer tant qu'il y a des IDs à traiter
            hasMore = queryOffset + BATCH_SIZE < artisanIdsWithMetier.length
          } else {
            // Pas de filtre : continuer tant qu'on reçoit des données et qu'on n'a pas atteint sampleSize
            hasMore = data.length === BATCH_SIZE
          }
          queryOffset += BATCH_SIZE
        } else {
          hasMore = false
        }
      }

      const data = allArtisans.slice(0, sampleSize)

      if (cancelled) return

      const enriched =
        data?.map((row: any) => {
          const lat = Number(row.intervention_latitude)
          const lng = Number(row.intervention_longitude)

          if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            return null
          }

          const distanceKm = haversineDistanceKm(latitude, longitude, lat, lng)

          // Récupérer la photo de profil depuis les attachments
          const attachments = Array.isArray(row.artisan_attachments) 
            ? row.artisan_attachments 
            : [];
          
          const photoProfilAttachment = attachments.find(
            (att: any) => att?.kind === "photo_profil" && att?.url && att.url.trim() !== ""
          );

          // Construire les métadonnées de la photo de profil
          const photoProfilMetadata: AvatarMetadata | null = photoProfilAttachment ? {
            hash: photoProfilAttachment.content_hash || null,
            sizes: photoProfilAttachment.derived_sizes || {},
            mime_preferred: photoProfilAttachment.mime_preferred || photoProfilAttachment.mime_type || 'image/jpeg',
            baseUrl: photoProfilAttachment.url || null
          } : null;

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
          } satisfies NearbyArtisan
        }) ?? []

      const filtered = enriched
        .filter((item): item is NearbyArtisan => item !== null && item !== undefined && item.distanceKm >= 0)
        .sort((a, b) => a.distanceKm - b.distanceKm)
        .filter((artisan) => artisan.distanceKm <= maxDistanceKm)
        .slice(0, limit)

      setState({ artisans: filtered, loading: false, error: null })
    }

    fetchArtisans()

    return () => {
      cancelled = true
    }
  }, [latitude, longitude, limit, maxDistanceKm, sampleSize, metier_id])

  return state
}
