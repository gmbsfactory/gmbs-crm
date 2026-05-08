import { supabaseClient } from "./_helpers";

export const artisansSearch = {
  /**
   * Récupère les artisans les plus proches d'une position géographique
   * avec support de la pagination pour le scroll infini
   */
  async getNearbyArtisans(params: {
    latitude: number;
    longitude: number;
    offset?: number;
    limit?: number;
    maxDistanceKm?: number;
    metier_id?: string | null;
  }) {
    const {
      latitude,
      longitude,
      offset = 0,
      limit = 30,
      maxDistanceKm = 100,
      metier_id = null,
    } = params;

    // Validate inputs
    if (
      latitude == null ||
      longitude == null ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ) {
      throw new Error("Invalid latitude or longitude");
    }

    /**
     * Calculate distance between two points using Haversine formula
     */
    function haversineDistanceKm(
      lat1: number,
      lon1: number,
      lat2: number,
      lon2: number
    ): number {
      const toRad = (value: number) => (value * Math.PI) / 180;
      const R = 6371; // Earth radius in km

      const dLat = toRad(lat2 - lat1);
      const dLon = toRad(lon2 - lon1);
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

      return R * c;
    }

    // Get archive status IDs to filter out
    const { data: archiveStatuses, error: archiveStatusesError } = await supabaseClient
      .from("artisan_statuses")
      .select("id")
      .eq("code", "ARCHIVE");

    if (archiveStatusesError) {
      console.warn(
        "[artisansApi.getNearbyArtisans] Failed to load archive statuses",
        archiveStatusesError
      );
    }

    const archiveStatusIds =
      archiveStatuses?.map((status: any) => status.id).filter(Boolean) || [];

    // Get artisan IDs with target metier if provided (for prioritization, not filtering)
    let artisanIdsWithTargetMetier: Set<string> = new Set();
    if (metier_id) {
      const BATCH_SIZE = 1000;
      let batchOffset = 0;
      let hasMore = true;

      while (hasMore) {
        const { data: metierData, error: metierError } = await supabaseClient
          .from("artisan_metiers")
          .select("artisan_id")
          .eq("metier_id", metier_id)
          .range(batchOffset, batchOffset + BATCH_SIZE - 1);

        if (metierError) {
          console.warn(
            "[artisansApi.getNearbyArtisans] Failed to load artisans with target metier",
            metierError
          );
          break; // Continue without prioritization if error
        }

        const batchIds =
          (metierData?.map((row: any) => row.artisan_id).filter(Boolean) as string[]) || [];
        batchIds.forEach((id) => artisanIdsWithTargetMetier.add(id));

        hasMore = batchIds.length === BATCH_SIZE;
        batchOffset += BATCH_SIZE;
      }

    }

    // Calculate bounding box for geographic pre-filtering
    // This ensures we only query artisans within the geographic area of interest
    const kmPerDegreeLat = 111; // Approximately 111 km per degree of latitude
    const kmPerDegreeLng = 111 * Math.cos((latitude * Math.PI) / 180); // Varies with latitude

    const latDelta = maxDistanceKm / kmPerDegreeLat;
    const lngDelta = maxDistanceKm / kmPerDegreeLng;

    const minLat = latitude - latDelta;
    const maxLat = latitude + latDelta;
    const minLng = longitude - lngDelta;
    const maxLng = longitude + lngDelta;

    // Fetch artisans with coordinates within the bounding box
    // No need for SAMPLE_SIZE limit since we're using geographic filtering
    let query = supabaseClient
      .from("artisans")
      .select(
        `
        id,
        prenom,
        nom,
        raison_sociale,
        numero_associe,
        telephone,
        telephone2,
        email,
        adresse_intervention,
        code_postal_intervention,
        ville_intervention,
        intervention_latitude,
        intervention_longitude,
        statut_id,
        artisan_attachments(kind, url, content_hash, derived_sizes, mime_preferred, mime_type)
      `
      )
      .not("intervention_latitude", "is", null)
      .not("intervention_longitude", "is", null)
      // Geographic bounding box filtering
      .gte("intervention_latitude", minLat)
      .lte("intervention_latitude", maxLat)
      .gte("intervention_longitude", minLng)
      .lte("intervention_longitude", maxLng);

    // Filter by archive status
    if (archiveStatusIds.length > 0) {
      query = query.not("statut_id", "in", `(${archiveStatusIds.map((id: string) => `"${id}"`).join(",")})`);
    }

    // Note: On ne filtre plus par métier, on priorise seulement dans le tri

    const { data, error } = await query;

    if (error) {
      console.error('[artisansApi.getNearbyArtisans] Query error:', error);
      throw error;
    }

    // Calculate distances and enrich data
    interface EnrichedNearbyArtisan {
      id: string;
      displayName: string;
      distanceKm: number;
      telephone: string | null;
      telephone2: string | null;
      email: string | null;
      adresse: string | null;
      ville: string | null;
      codePostal: string | null;
      lat: number;
      lng: number;
      prenom: string | null;
      nom: string | null;
      raison_sociale: string | null;
      numero_associe: string | null;
      statut_id: string | null;
      photoProfilMetadata: { hash: string | null; sizes: Record<string, string>; mime_preferred: string; baseUrl: string | null } | null;
      hasTargetMetier: boolean;
    }

    const enriched: (EnrichedNearbyArtisan | null)[] =
      data?.map((row: any) => {
        const lat = Number(row.intervention_latitude);
        const lng = Number(row.intervention_longitude);

        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          return null;
        }

        const distanceKm = haversineDistanceKm(latitude, longitude, lat, lng);

        // Get profile photo from attachments
        const attachments = Array.isArray(row.artisan_attachments)
          ? row.artisan_attachments
          : [];

        const photoProfilAttachment = attachments.find(
          (att: { kind?: string; url?: string; content_hash?: string; derived_sizes?: Record<string, unknown>; mime_preferred?: string; mime_type?: string }) =>
            att?.kind === "photo_profil" && att?.url && att.url.trim() !== ""
        );

        // Build photo profile metadata
        const photoProfilMetadata = photoProfilAttachment
          ? {
            hash: photoProfilAttachment.content_hash || null,
            sizes: (photoProfilAttachment.derived_sizes || {}) as Record<string, string>,
            mime_preferred:
              photoProfilAttachment.mime_preferred ||
              photoProfilAttachment.mime_type ||
              "image/jpeg",
            baseUrl: photoProfilAttachment.url || null,
          }
          : null;

        // Vérifier si l'artisan a le métier ciblé
        const hasTargetMetier = artisanIdsWithTargetMetier.has(row.id);

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
          numero_associe: row.numero_associe ?? null,
          statut_id: row.statut_id ?? null,
          photoProfilMetadata,
          hasTargetMetier,
        };
      }) ?? [];

    // Filter valid artisans: must have valid distance and be within range
    // Note: On ne filtre PAS par ville/codePostal car les coordonnées GPS suffisent
    const validArtisans = enriched
      .filter((item): item is EnrichedNearbyArtisan => item !== null && item !== undefined && item.distanceKm >= 0)
      .filter((artisan) => artisan.distanceKm <= maxDistanceKm)
      .sort((a, b) => {
        // Priorité 1: Artisans avec le bon métier en premier
        if (a.hasTargetMetier && !b.hasTargetMetier) return -1;
        if (!a.hasTargetMetier && b.hasTargetMetier) return 1;

        // Priorité 2: Tri par distance (pour les deux groupes)
        return a.distanceKm - b.distanceKm;
      });

    const total = validArtisans.length;

    // Apply pagination
    const paginatedArtisans = validArtisans.slice(offset, offset + limit);
    const hasMore = offset + limit < total;

    return {
      artisans: paginatedArtisans,
      hasMore,
      total,
    };
  },

  /**
   * Recherche d'artisans par texte avec tri par distance géographique et priorisation par métier
   * Remplace la recherche hardcodée dans ArtisanSearchModal
   *
   * @param searchQuery - Texte de recherche (nom, prénom, email, téléphone, etc.)
   * @param latitude - Latitude de référence pour le tri par distance (optionnel)
   * @param longitude - Longitude de référence pour le tri par distance (optionnel)
   * @param metier_id - ID du métier pour prioriser les artisans (optionnel)
   * @param limit - Nombre maximum de résultats (défaut: 50)
   * @returns Liste d'artisans triés par métier puis distance si coordonnées fournies, sinon par numero_associe
   */
  async searchArtisans(params: {
    searchQuery: string;
    latitude?: number | null;
    longitude?: number | null;
    metier_id?: string | null;
    limit?: number;
  }): Promise<{
    artisans: Array<{
      id: string;
      prenom?: string | null;
      nom?: string | null;
      plain_nom?: string | null;
      raison_sociale?: string | null;
      email?: string | null;
      telephone?: string | null;
      telephone2?: string | null;
      numero_associe?: string | null;
      adresse_intervention?: string | null;
      ville_intervention?: string | null;
      code_postal_intervention?: string | null;
      adresse_siege_social?: string | null;
      ville_siege_social?: string | null;
      code_postal_siege_social?: string | null;
      intervention_latitude?: number | null;
      intervention_longitude?: number | null;
      statut_id?: string | null;
      is_active?: boolean | null;
      status?: { id: string; code: string; label: string; color?: string | null } | null;
      metiers?: Array<{ is_primary: boolean; metier: { id: string; code: string; label: string } }> | null;
      hasTargetMetier: boolean;
      distanceKm?: number;
    }>;
    total: number;
  }> {
    const { searchQuery, latitude, longitude, metier_id = null, limit = 50 } = params;

    const trimmed = searchQuery.trim();
    if (!trimmed) {
      return { artisans: [], total: 0 };
    }

    /**
     * Fonction locale pour échapper les caractères spéciaux ILIKE
     */
    const escapeIlike = (input: string): string => {
      return input.replace(/[%_\\]/g, "\\$&");
    };

    /**
     * Fonction locale pour nettoyer un numéro de téléphone
     */
    const sanitizePhone = (input: string): string => {
      return input.replace(/\D/g, "");
    };

    /**
     * Calculate distance between two points using Haversine formula
     */
    function haversineDistanceKm(
      lat1: number,
      lon1: number,
      lat2: number,
      lon2: number
    ): number {
      const toRad = (value: number) => (value * Math.PI) / 180;
      const R = 6371; // Earth radius in km

      const dLat = toRad(lat2 - lat1);
      const dLon = toRad(lon2 - lon1);
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

      return R * c;
    }

    const pattern = escapeIlike(trimmed);
    const normalizedDigits = sanitizePhone(trimmed);

    // Construire les filtres OR pour la recherche textuelle
    const orFilters = [
      `numero_associe.ilike.*${pattern}*`,
      `plain_nom.ilike.*${pattern}*`,
      `raison_sociale.ilike.*${pattern}*`,
      `prenom.ilike.*${pattern}*`,
      `nom.ilike.*${pattern}*`,
      `email.ilike.*${pattern}*`,
    ];

    if (normalizedDigits) {
      orFilters.push(`telephone.ilike.*${normalizedDigits}*`);
      orFilters.push(`telephone2.ilike.*${normalizedDigits}*`);
    } else {
      orFilters.push(`telephone.ilike.*${pattern}*`);
      orFilters.push(`telephone2.ilike.*${pattern}*`);
    }

    // Récupérer les IDs des statuts archivés
    const { data: archiveStatuses, error: archiveStatusesError } = await supabaseClient
      .from("artisan_statuses")
      .select("id")
      .eq("code", "ARCHIVE");

    if (archiveStatusesError) {
      console.warn(
        "[artisansApi.searchArtisans] Failed to load archive statuses",
        archiveStatusesError
      );
    }

    const archiveStatusIds =
      archiveStatuses?.map((status: any) => status.id).filter(Boolean) || [];

    // Get artisan IDs with target metier if provided (for prioritization)
    let artisanIdsWithTargetMetier: Set<string> = new Set();
    if (metier_id) {
      const BATCH_SIZE = 1000;
      let batchOffset = 0;
      let hasMore = true;

      while (hasMore) {
        const { data: metierData, error: metierError } = await supabaseClient
          .from("artisan_metiers")
          .select("artisan_id")
          .eq("metier_id", metier_id)
          .range(batchOffset, batchOffset + BATCH_SIZE - 1);

        if (metierError) {
          console.warn(
            "[artisansApi.searchArtisans] Failed to load artisans with target metier",
            metierError
          );
          break; // Continue without prioritization if error
        }

        const batchIds =
          (metierData?.map((row: any) => row.artisan_id).filter(Boolean) as string[]) || [];
        batchIds.forEach((id) => artisanIdsWithTargetMetier.add(id));

        hasMore = batchIds.length === BATCH_SIZE;
        batchOffset += BATCH_SIZE;
      }

    }

    // Construire la requête Supabase
    let queryBuilder = supabaseClient
      .from("artisans")
      .select(
        `
          id,
          prenom,
          nom,
          plain_nom,
          raison_sociale,
          email,
          telephone,
          telephone2,
          numero_associe,
          adresse_intervention,
          ville_intervention,
          code_postal_intervention,
          intervention_latitude,
          intervention_longitude,
          adresse_siege_social,
          ville_siege_social,
          code_postal_siege_social,
          statut_id,
          is_active,
          status:artisan_statuses (
            id,
            code,
            label,
            color
          ),
          metiers:artisan_metiers (
            is_primary,
            metier:metiers (
              id,
              code,
              label
            )
          )
        `
      )
      .or(orFilters.join(","))
      .limit(limit);

    // Filtrer les artisans archivés
    if (archiveStatusIds.length > 0) {
      queryBuilder = queryBuilder.not(
        "statut_id",
        "in",
        `(${archiveStatusIds.map((id: string) => `"${id}"`).join(",")})`
      );
    }

    const { data, error: searchError } = await queryBuilder;

    if (searchError) {
      throw searchError;
    }

    // Transformer les données et normaliser la structure status et metiers (PostgREST retourne les joins comme des tableaux)
    let transformedData = (data || []).map((artisan: any) => {
      // Vérifier si l'artisan a le métier ciblé
      const hasTargetMetier = artisanIdsWithTargetMetier.has(artisan.id);

      // Normaliser status: PostgREST peut retourner un objet ou un tableau
      const statusRaw = artisan.status;
      const normalizedStatus = Array.isArray(statusRaw)
        ? statusRaw.length > 0 ? statusRaw[0] : null
        : statusRaw;

      // Normaliser metiers: chaque metier peut être un tableau PostgREST
      const metiersRaw = artisan.metiers;
      const normalizedMetiers = Array.isArray(metiersRaw)
        ? metiersRaw.map((m) => ({
          ...m,
          metier: Array.isArray(m.metier) ? m.metier[0] : m.metier,
        }))
        : metiersRaw;

      return {
        ...artisan,
        status: normalizedStatus as { id: string; code: string; label: string; color?: string | null } | null,
        metiers: normalizedMetiers as Array<{ is_primary: boolean; metier: { id: string; code: string; label: string } }> | null,
        hasTargetMetier,
        distanceKm: undefined as number | undefined,
      };
    });

    // Si coordonnées GPS fournies, calculer les distances et trier par métier puis distance
    if (
      latitude != null &&
      longitude != null &&
      Number.isFinite(latitude) &&
      Number.isFinite(longitude)
    ) {
      transformedData = transformedData
        .map((artisan: any) => {
          const lat = Number(artisan.intervention_latitude);
          const lng = Number(artisan.intervention_longitude);

          // Calculer la distance si l'artisan a des coordonnées valides
          if (Number.isFinite(lat) && Number.isFinite(lng)) {
            const distanceKm = haversineDistanceKm(latitude, longitude, lat, lng);
            return { ...artisan, distanceKm };
          }

          // Artisans sans coordonnées : distance infinie (placés en dernier)
          return { ...artisan, distanceKm: Infinity };
        })
        .sort((a: any, b: any) => {
          // Priorité 1: Artisans avec le bon métier en premier
          if (a.hasTargetMetier && !b.hasTargetMetier) return -1;
          if (!a.hasTargetMetier && b.hasTargetMetier) return 1;

          // Priorité 2: Tri par distance croissante
          if (a.distanceKm === Infinity && b.distanceKm === Infinity) {
            // Si les deux sans coordonnées, tri par numero_associe
            return (a.numero_associe || "").localeCompare(b.numero_associe || "");
          }
          return (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity);
        });
    } else {
      // Pas de coordonnées : tri par métier puis numero_associe
      transformedData = transformedData.sort((a: any, b: any) => {
        // Priorité 1: Artisans avec le bon métier en premier
        if (a.hasTargetMetier && !b.hasTargetMetier) return -1;
        if (!a.hasTargetMetier && b.hasTargetMetier) return 1;

        // Priorité 2: Tri par numero_associe
        return (a.numero_associe || "").localeCompare(b.numero_associe || "");
      });
    }

    return {
      artisans: transformedData,
      total: transformedData.length,
    };
  },
};
