// ===== API ARTISANS V2 =====
// Gestion complète des artisans

import { supabase, getSupabaseClientForNode } from "./common/client";
import type {
  Artisan,
  ArtisanQueryParams,
  ArtisanStatsByStatus,
  BulkOperationResult,
  CreateArtisanData,
  NearbyArtisan,
  NearbyArtisansParams,
  NearbyArtisansResponse,
  PaginatedResponse,
  UpdateArtisanData,
} from "./common/types";
import {
  SUPABASE_FUNCTIONS_URL,
  getHeaders,
  handleResponse,
  mapArtisanRecord,
  getReferenceCache,
  chunkArray,
  MAX_BATCH_SIZE,
} from "./common/utils";
import { safeErrorMessage } from "@/lib/api/v2/common/error-handler";

// Utiliser le client admin dans Node.js, le client standard dans le navigateur
const supabaseClient = typeof window !== 'undefined' ? supabase : getSupabaseClientForNode();

/**
 * Filtre les artisans par métiers en divisant les requêtes en lots pour éviter les erreurs de longueur d'URL
 */
async function filterArtisansByMetiers(
  artisanIds: string[],
  metierIds: string[]
): Promise<Set<string>> {
  if (artisanIds.length === 0 || metierIds.length === 0) {
    return new Set();
  }

  const filteredIds = new Set<string>();

  // Diviser les artisanIds en lots
  const artisanIdChunks = chunkArray(artisanIds, MAX_BATCH_SIZE);

  // Pour chaque lot d'artisanIds, faire une requête
  for (const artisanIdChunk of artisanIdChunks) {
    const { data: artisansWithMetiers, error: metierError } = await supabase
      .from("artisan_metiers")
      .select("artisan_id")
      .in("metier_id", metierIds)
      .in("artisan_id", artisanIdChunk);

    if (metierError) {
      console.error("Erreur lors du filtrage par métiers:", metierError);
      throw metierError;
    }

    if (artisansWithMetiers) {
      artisansWithMetiers.forEach((am: any) => {
        if (am.artisan_id) {
          filteredIds.add(am.artisan_id);
        }
      });
    }
  }

  return filteredIds;
}

/**
 * Filtre les artisans par un seul métier en divisant les requêtes en lots
 */
async function filterArtisansByMetier(
  artisanIds: string[],
  metierId: string
): Promise<Set<string>> {
  if (artisanIds.length === 0) {
    return new Set();
  }

  const filteredIds = new Set<string>();

  // Diviser les artisanIds en lots
  const artisanIdChunks = chunkArray(artisanIds, MAX_BATCH_SIZE);

  // Pour chaque lot d'artisanIds, faire une requête
  for (const artisanIdChunk of artisanIdChunks) {
    const { data: artisansWithMetier, error: metierError } = await supabase
      .from("artisan_metiers")
      .select("artisan_id")
      .eq("metier_id", metierId)
      .in("artisan_id", artisanIdChunk);

    if (metierError) {
      console.error("Erreur lors du filtrage par métier:", metierError);
      throw metierError;
    }

    if (artisansWithMetier) {
      artisansWithMetier.forEach((am: any) => {
        if (am.artisan_id) {
          filteredIds.add(am.artisan_id);
        }
      });
    }
  }

  return filteredIds;
}

export const artisansApi = {
  // Récupérer tous les artisans (ULTRA-OPTIMISÉ avec recherche et filtres)
  async getAll(params?: ArtisanQueryParams): Promise<PaginatedResponse<Artisan>> {
    const limit = params?.limit || 100;
    const offset = params?.offset || 0;
    const hasSearch = Boolean(params?.search && params.search.trim().length >= 2);
    const searchQuery = params?.search?.trim() || "";

    // ========================================
    // RECHERCHE OPTIMISÉE VIA VUE MATÉRIALISÉE
    // ========================================
    if (hasSearch) {
      try {
        // Appeler la fonction RPC search_artisans
        const { data: searchResults, error: searchError } = await supabase.rpc("search_artisans", {
          p_query: searchQuery,
          p_limit: 10000, // Récupérer tous les résultats pour gérer la pagination correctement
          p_offset: 0,
        });

        if (searchError) {
          console.error("[artisansApi.getAll] Error in search_artisans RPC:", searchError);
          // Fallback vers l'ancienne méthode si RPC échoue
        } else if (searchResults && searchResults.length > 0) {
          // Extraire les IDs triés par pertinence
          let artisanIds: string[] = searchResults.map((r: { id?: string }) => r.id).filter((id: string | undefined): id is string => Boolean(id));

          // Filtrer par métiers AVANT de paginer (côté BD via artisan_metiers)
          if (params?.metiers && params.metiers.length > 0) {
            const filteredIds = await filterArtisansByMetiers(artisanIds, params.metiers);
            artisanIds = artisanIds.filter((id: string) => filteredIds.has(id));
          } else if (params?.metier) {
            const filteredIds = await filterArtisansByMetier(artisanIds, params.metier);
            artisanIds = artisanIds.filter((id: string) => filteredIds.has(id));
          }

          // Calculer le count total APRÈS filtrage métiers
          const totalCount = artisanIds.length;

          // Appliquer la pagination sur les IDs filtrés
          const paginatedIds = artisanIds.slice(offset, offset + limit);

          if (paginatedIds.length === 0) {
            return {
              data: [],
              pagination: {
                total: totalCount,
                limit,
                offset,
                hasMore: false,
              },
            };
          }

          // Récupérer les données complètes avec relations pour les IDs paginés
          let detailedQuery = supabase
            .from("artisans")
            .select(`
              *,
              artisan_metiers (
                metier_id,
                metiers (
                  id,
                  code,
                  label
                )
              ),
              artisan_zones (
                zone_id,
                zones (
                  id,
                  code,
                  label
                )
              ),
              artisan_attachments (
                id,
                kind,
                url,
                filename,
                mime_type,
                content_hash,
                derived_sizes,
                mime_preferred
              )
            `)
            .in("id", paginatedIds)
            .eq("is_active", true);

          // Appliquer les filtres supplémentaires
          if (params?.statuts && params.statuts.length > 0) {
            detailedQuery = detailedQuery.in("statut_id", params.statuts);
          } else if (params?.statut) {
            detailedQuery = detailedQuery.eq("statut_id", params.statut);
          }
          if (params?.gestionnaire) {
            detailedQuery = detailedQuery.eq("gestionnaire_id", params.gestionnaire);
          }
          if (params?.statut_dossier) {
            detailedQuery = detailedQuery.in("statut_dossier", ["À compléter", "incomplet", "INCOMPLET"]);
          }

          const { data: detailedData, error: detailedError } = await detailedQuery;

          if (detailedError) {
            throw new Error(`Failed to fetch detailed data: ${detailedError.message}`);
          }

          // Réordonner selon l'ordre de pertinence de la recherche
          const idToData = new Map((detailedData ?? []).map((item: any) => [item.id, item]));
          const orderedData = paginatedIds
            .map((id) => idToData.get(id))
            .filter((item): item is NonNullable<typeof item> => item !== undefined);

          const refs = await getReferenceCache();
          const transformedData = orderedData.map((item) => mapArtisanRecord(item, refs));

          return {
            data: transformedData,
            pagination: {
              total: totalCount,
              limit,
              offset,
              hasMore: offset + limit < totalCount,
            },
          };
        }
      } catch (rpcError) {
        console.error("[artisansApi.getAll] Error using search_artisans RPC, falling back to standard query:", rpcError);
        // Continue avec l'ancienne méthode en cas d'erreur
      }
    }

    // ========================================
    // MÉTHODE STANDARD (sans recherche ou fallback)
    // ========================================
    // Stratégie : Si filtrage par métiers, on récupère d'abord les IDs filtrés puis on pagine
    if (params?.metiers && params.metiers.length > 0) {
      // 1. Récupérer tous les IDs d'artisans correspondant aux filtres de base
      let idsQuery = supabase
        .from("artisans")
        .select("id")
        .eq("is_active", true);

      if (params?.statuts && params.statuts.length > 0) {
        idsQuery = idsQuery.in("statut_id", params.statuts);
      } else if (params?.statut) {
        idsQuery = idsQuery.eq("statut_id", params.statut);
      }
      if (params?.gestionnaire) {
        idsQuery = idsQuery.eq("gestionnaire_id", params.gestionnaire);
      }
      if (params?.statut_dossier) {
        idsQuery = idsQuery.in("statut_dossier", ["À compléter", "incomplet", "INCOMPLET"]);
      }

      const { data: artisansData, error: idsError } = await idsQuery;
      if (idsError) throw idsError;

      const allArtisanIds = (artisansData || []).map((a: any) => a.id);

      // 2. Filtrer par métiers
      const filteredIds = await filterArtisansByMetiers(allArtisanIds, params.metiers);
      const filteredIdsArray = Array.from(filteredIds);

      const totalCount = filteredIdsArray.length;

      // 3. Paginer les IDs filtrés
      const paginatedIds = filteredIdsArray.slice(offset, offset + limit);

      if (paginatedIds.length === 0) {
        return {
          data: [],
          pagination: {
            total: totalCount,
            limit,
            offset,
            hasMore: false,
          },
        };
      }

      // 4. Récupérer les données complètes pour les IDs paginés
      const { data: detailedData, error: detailedError } = await supabase
        .from("artisans")
        .select(`
          *,
          artisan_metiers (
            metier_id,
            metiers (
              id,
              code,
              label
            )
          ),
          artisan_zones (
            zone_id,
            zones (
              id,
              code,
              label
            )
          ),
          artisan_attachments (
            id,
            kind,
            url,
            filename,
            mime_type,
            content_hash,
            derived_sizes,
            mime_preferred
          )
        `)
        .in("id", paginatedIds)
        .order("created_at", { ascending: false });

      if (detailedError) throw detailedError;

      const refs = await getReferenceCache();
      const transformedData = (detailedData || []).map((item: any) => mapArtisanRecord(item, refs));

      return {
        data: transformedData,
        pagination: {
          total: totalCount,
          limit,
          offset,
          hasMore: offset + limit < totalCount,
        },
      };
    } else if (params?.metier) {
      // Même logique pour un seul métier
      let idsQuery = supabase
        .from("artisans")
        .select("id")
        .eq("is_active", true);

      if (params?.statuts && params.statuts.length > 0) {
        idsQuery = idsQuery.in("statut_id", params.statuts);
      } else if (params?.statut) {
        idsQuery = idsQuery.eq("statut_id", params.statut);
      }
      if (params?.gestionnaire) {
        idsQuery = idsQuery.eq("gestionnaire_id", params.gestionnaire);
      }
      if (params?.statut_dossier) {
        idsQuery = idsQuery.in("statut_dossier", ["À compléter", "incomplet", "INCOMPLET"]);
      }

      const { data: artisansData, error: idsError } = await idsQuery;
      if (idsError) throw idsError;

      const allArtisanIds = (artisansData || []).map((a: any) => a.id);

      const filteredIds = await filterArtisansByMetier(allArtisanIds, params.metier);
      const filteredIdsArray = Array.from(filteredIds);

      const totalCount = filteredIdsArray.length;

      const paginatedIds = filteredIdsArray.slice(offset, offset + limit);

      if (paginatedIds.length === 0) {
        return {
          data: [],
          pagination: {
            total: totalCount,
            limit,
            offset,
            hasMore: false,
          },
        };
      }

      const { data: detailedData, error: detailedError } = await supabase
        .from("artisans")
        .select(`
          *,
          artisan_metiers (
            metier_id,
            metiers (
              id,
              code,
              label
            )
          ),
          artisan_zones (
            zone_id,
            zones (
              id,
              code,
              label
            )
          ),
          artisan_attachments (
            id,
            kind,
            url,
            filename,
            mime_type,
            content_hash,
            derived_sizes,
            mime_preferred
          )
        `)
        .in("id", paginatedIds)
        .order("created_at", { ascending: false });

      if (detailedError) throw detailedError;

      const refs = await getReferenceCache();
      const transformedData = (detailedData || []).map((item: any) => mapArtisanRecord(item, refs));

      return {
        data: transformedData,
        pagination: {
          total: totalCount,
          limit,
          offset,
          hasMore: offset + limit < totalCount,
        },
      };
    }

    // Cas standard : pas de filtrage métier
    let query = supabase
      .from("artisans")
      .select(`
        *,
        artisan_metiers (
          metier_id,
          metiers (
            id,
            code,
            label
          )
        ),
        artisan_zones (
          zone_id,
          zones (
            id,
            code,
            label
          )
        ),
        artisan_attachments (
          id,
          kind,
          url,
          filename,
          mime_type,
          content_hash,
          derived_sizes,
          mime_preferred
        )
      `, { count: "exact" })
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    // Appliquer les filtres si nécessaire
    if (params?.statuts && params.statuts.length > 0) {
      query = query.in("statut_id", params.statuts);
    } else if (params?.statut) {
      query = query.eq("statut_id", params.statut);
    }
    if (params?.gestionnaire) {
      query = query.eq("gestionnaire_id", params.gestionnaire);
    }
    if (params?.statut_dossier) {
      query = query.in("statut_dossier", ["À compléter", "incomplet", "INCOMPLET"]);
    }

    // Pagination
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    const refs = await getReferenceCache();

    const transformedData = (data || []).map((item: any) =>
      mapArtisanRecord(item, refs)
    );

    return {
      data: transformedData,
      pagination: {
        total: count || 0,
        limit,
        offset,
        hasMore: offset + limit < (count || 0),
      },
    };
  },

  // Récupérer un artisan par ID (comme interventionsApi.getById)
  async getById(id: string, include?: string[]): Promise<Artisan & {
    artisan_metiers?: Array<{
      metier_id: string
      is_primary?: boolean | null
      metiers?: { id: string; code: string | null; label: string | null } | null
    }>
    artisan_zones?: Array<{
      zone_id: string
      zones?: { id: string; code: string | null; label: string | null } | null
    }>
    artisan_attachments?: Array<{
      id: string
      kind: string
      url: string
      filename: string | null
      created_at?: string | null
      content_hash?: string | null
      derived_sizes?: Record<string, string> | null
      mime_preferred?: string | null
      mime_type?: string | null
    }>
    artisan_absences?: Array<{
      id: string
      start_date: string | null
      end_date: string | null
      reason: string | null
      is_confirmed?: boolean | null
    }>
    status?: { id: string; code: string | null; label: string | null; color: string | null } | null
    gestionnaire?: { id: string; firstname: string | null; lastname: string | null; username: string; code_gestionnaire: string | null; color: string | null } | null
    statutDossier?: string | null
  }> {
    const { data, error } = await supabase
      .from("artisans")
      .select(`
        *,
        status:artisan_statuses(id,code,label,color),
        gestionnaire:users!artisans_gestionnaire_id_fkey(
          id,
          firstname,
          lastname,
          username,
          code_gestionnaire,
          color
        ),
        artisan_metiers (
          metier_id,
          is_primary,
          metiers (
            id,
            code,
            label
          )
        ),
        artisan_zones (
          zone_id,
          zones (
            id,
            code,
            label
          )
        ),
        artisan_attachments (
          id,
          kind,
          url,
          filename,
          created_at,
          content_hash,
          derived_sizes,
          mime_preferred,
          mime_type
        ),
        artisan_absences (
          id,
          start_date,
          end_date,
          reason,
          is_confirmed
        )
      `)
      .eq("id", id)
      .single();

    if (error) throw error;
    if (!data) throw new Error("Artisan introuvable");

    const refs = await getReferenceCache();
    const mapped = mapArtisanRecord(data, refs);

    // Préserver les relations brutes pour le formulaire
    return {
      ...mapped,
      artisan_metiers: data.artisan_metiers || [],
      artisan_zones: data.artisan_zones || [],
      artisan_attachments: data.artisan_attachments || [],
      artisan_absences: data.artisan_absences || [],
      status: data.status || null,
      gestionnaire: data.gestionnaire || null,
      statutDossier: (data as unknown as { statut_dossier?: string | null }).statut_dossier || null,
    };
  },

  // Créer un artisan
  async create(data: CreateArtisanData): Promise<Artisan> {
    const headers = await getHeaders();
    const response = await fetch(
      `${SUPABASE_FUNCTIONS_URL}/artisans-v2/artisans`,
      {
        method: "POST",
        headers,
        body: JSON.stringify(data),
      }
    );
    const raw = await handleResponse(response);
    const refs = await getReferenceCache();
    return mapArtisanRecord(raw, refs);
  },

  // Upsert un artisan (créer ou mettre à jour) via Edge Function
  async upsert(data: CreateArtisanData): Promise<Artisan> {
    const headers = await getHeaders();
    const response = await fetch(
      `${SUPABASE_FUNCTIONS_URL}/artisans-v2/artisans/upsert`,
      {
        method: "POST",
        headers,
        body: JSON.stringify(data),
      }
    );
    return handleResponse(response);
  },

  // Upsert direct via Supabase (pour import en masse)
  async upsertDirect(data: CreateArtisanData, customClient?: typeof supabase): Promise<Artisan> {
    // Utiliser le client personnalisé si fourni, sinon utiliser le client par défaut
    const client = customClient || supabaseClient;

    // Déterminer la contrainte unique à utiliser
    let onConflict = 'email';
    if (!data.email && data.siret) {
      onConflict = 'siret';
    }

    const { data: result, error } = await client
      .from('artisans')
      .upsert(data, {
        onConflict,
        ignoreDuplicates: false
      })
      .select()
      .single();

    if (error) throw new Error(`Erreur lors de l'upsert de l'artisan: ${error.message}`);

    const refs = await getReferenceCache();
    return mapArtisanRecord(result, refs);
  },

  // Modifier un artisan
  async update(id: string, data: UpdateArtisanData): Promise<Artisan> {
    const headers = await getHeaders();
    const response = await fetch(
      `${SUPABASE_FUNCTIONS_URL}/artisans-v2/artisans/${id}`,
      {
        method: "PUT",
        headers,
        body: JSON.stringify(data),
      }
    );
    const raw = await handleResponse(response);
    const refs = await getReferenceCache();
    const record = raw?.data ?? raw;
    return mapArtisanRecord(record, refs);
  },

  // Supprimer un artisan (soft delete)
  async delete(id: string): Promise<{ message: string; data: Artisan }> {
    const headers = await getHeaders();
    const response = await fetch(
      `${SUPABASE_FUNCTIONS_URL}/artisans-v2/artisans/${id}`,
      {
        method: "DELETE",
        headers,
      }
    );
    return handleResponse(response);
  },

  // Créer un document pour un artisan
  async createDocument(data: {
    artisan_id: string;
    kind: string;
    url: string;
    filename: string;
    created_at?: string;
    updated_at?: string;
  }): Promise<Record<string, unknown>> {
    const headers = await getHeaders();
    const response = await fetch(
      `${SUPABASE_FUNCTIONS_URL}/artisans-v2/artisans/${data.artisan_id}/documents`,
      {
        method: "POST",
        headers,
        body: JSON.stringify(data),
      }
    );
    return handleResponse(response);
  },

  // Créer une association métier-artisan
  async createArtisanMetier(data: {
    artisan_id: string;
    metier_id: string;
    is_primary?: boolean;
  }): Promise<Record<string, unknown>> {
    const headers = await getHeaders();
    const response = await fetch(
      `${SUPABASE_FUNCTIONS_URL}/artisans-v2/artisans/${data.artisan_id}/metiers`,
      {
        method: "POST",
        headers,
        body: JSON.stringify(data),
      }
    );
    return handleResponse(response);
  },

  // Créer une association zone-artisan
  async createArtisanZone(data: {
    artisan_id: string;
    zone_id: string;
  }): Promise<Record<string, unknown>> {
    const headers = await getHeaders();
    const response = await fetch(
      `${SUPABASE_FUNCTIONS_URL}/artisans-v2/artisans/${data.artisan_id}/zones`,
      {
        method: "POST",
        headers,
        body: JSON.stringify(data),
      }
    );
    return handleResponse(response);
  },

  // Assigner un métier à un artisan
  async assignMetier(
    artisanId: string,
    metierId: string,
    isPrimary: boolean = false
  ): Promise<Record<string, unknown>> {
    const headers = await getHeaders();
    const response = await fetch(
      `${SUPABASE_FUNCTIONS_URL}/artisans-v2/artisans/${artisanId}/metiers`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          metier_id: metierId,
          is_primary: isPrimary,
        }),
      }
    );
    return handleResponse(response);
  },

  // Assigner une zone à un artisan
  async assignZone(artisanId: string, zoneId: string): Promise<Record<string, unknown>> {
    const headers = await getHeaders();
    const response = await fetch(
      `${SUPABASE_FUNCTIONS_URL}/artisans-v2/artisans/${artisanId}/zones`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          zone_id: zoneId,
        }),
      }
    );
    return handleResponse(response);
  },

  // Insérer plusieurs métiers pour un artisan
  async insertArtisanMetiers(
    metiers: Array<{
      artisan_id: string;
      metier_id: string;
      is_primary?: boolean;
    }>
  ): Promise<BulkOperationResult> {
    const results: BulkOperationResult = { success: 0, errors: 0, details: [] };

    for (const metier of metiers) {
      try {
        const result = await this.createArtisanMetier(metier);
        results.success++;
        results.details.push({ item: metier as unknown as Record<string, unknown>, success: true, data: result });
      } catch (error: unknown) {
        results.errors++;
        results.details.push({ item: metier as unknown as Record<string, unknown>, success: false, error: safeErrorMessage(error, "l'ajout du métier artisan") });
      }
    }

    return results;
  },

  // Insérer plusieurs zones pour un artisan
  async insertArtisanZones(
    zones: Array<{
      artisan_id: string;
      zone_id: string;
    }>
  ): Promise<BulkOperationResult> {
    const results: BulkOperationResult = { success: 0, errors: 0, details: [] };

    for (const zone of zones) {
      try {
        const result = await this.createArtisanZone(zone);
        results.success++;
        results.details.push({ item: zone as unknown as Record<string, unknown>, success: true, data: result });
      } catch (error: unknown) {
        results.errors++;
        results.details.push({ item: zone as unknown as Record<string, unknown>, success: false, error: safeErrorMessage(error, "l'ajout de la zone artisan") });
      }
    }

    return results;
  },

  // Créer plusieurs artisans en lot
  async createBulk(artisans: CreateArtisanData[]): Promise<BulkOperationResult> {
    const results: BulkOperationResult = { success: 0, errors: 0, details: [] };

    for (const artisan of artisans) {
      try {
        const result = await this.create(artisan);
        results.success++;
        results.details.push({ item: artisan as unknown as Record<string, unknown>, success: true, data: result as unknown as Record<string, unknown> });
      } catch (error: unknown) {
        results.errors++;
        results.details.push({ item: artisan as unknown as Record<string, unknown>, success: false, error: safeErrorMessage(error, "la création de l'artisan") });
      }
    }

    return results;
  },

  // Récupérer les artisans par gestionnaire
  async getByGestionnaire(gestionnaireId: string, params?: ArtisanQueryParams): Promise<PaginatedResponse<Artisan>> {
    return this.getAll({ ...params, gestionnaire: gestionnaireId });
  },

  // Récupérer les artisans par statut
  async getByStatus(statusId: string, params?: ArtisanQueryParams): Promise<PaginatedResponse<Artisan>> {
    return this.getAll({ ...params, statut: statusId });
  },

  // Récupérer les artisans par métier
  async getByMetier(metierId: string, params?: ArtisanQueryParams): Promise<PaginatedResponse<Artisan>> {
    return this.getAll({ ...params, metier: metierId });
  },

  // Récupérer les artisans par zone
  async getByZone(zoneId: string, params?: ArtisanQueryParams): Promise<PaginatedResponse<Artisan>> {
    return this.getAll({ ...params, zone: zoneId });
  },

  // Rechercher par plain_nom (pour la recherche SST)
  async searchByPlainNom(searchTerm: string, params?: ArtisanQueryParams, customClient?: typeof supabaseClient): Promise<PaginatedResponse<Artisan>> {
    // Utiliser le client personnalisé si fourni, sinon utiliser supabaseClient (qui utilise getSupabaseClientForNode() dans Node.js)
    const client = customClient || supabaseClient;

    let query = client
      .from("artisans")
      .select("*", { count: "exact" })
      .eq("plain_nom", searchTerm) // Recherche exacte d'abord
      .order("created_at", { ascending: false });

    // Appliquer les autres filtres
    if (params?.statut) {
      query = query.eq("statut_id", params.statut);
    }
    if (params?.gestionnaire) {
      query = query.eq("gestionnaire_id", params.gestionnaire);
    }

    // Pagination
    const limit = params?.limit || 100;
    const offset = params?.offset || 0;
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    const refs = await getReferenceCache();

    const transformedData = (data || []).map((item: Record<string, unknown>) =>
      mapArtisanRecord(item, refs)
    );

    return {
      data: transformedData,
      pagination: {
        total: count || 0,
        limit,
        offset,
        hasMore: offset + limit < (count || 0),
      },
    };
  },

  // Rechercher des artisans par nom/prénom
  async searchByName(searchTerm: string, params?: ArtisanQueryParams): Promise<PaginatedResponse<Artisan>> {
    let query = supabase
      .from("artisans")
      .select("*", { count: "exact" })
      .or(`prenom.ilike.%${searchTerm}%,nom.ilike.%${searchTerm}%,raison_sociale.ilike.%${searchTerm}%`)
      .order("created_at", { ascending: false });

    // Appliquer les autres filtres
    if (params?.statut) {
      query = query.eq("statut_id", params.statut);
    }
    if (params?.gestionnaire) {
      query = query.eq("gestionnaire_id", params.gestionnaire);
    }

    // Pagination
    const limit = params?.limit || 100;
    const offset = params?.offset || 0;
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    const refs = await getReferenceCache();

    const transformedData = (data || []).map((item: any) =>
      mapArtisanRecord(item, refs)
    );

    return {
      data: transformedData,
      pagination: {
        total: count || 0,
        limit,
        offset,
        hasMore: offset + limit < (count || 0),
      },
    };
  },

  /**
   * Récupère les statistiques d'artisans par statut pour un gestionnaire
   * @param gestionnaireId - ID du gestionnaire (utilisateur)
   * @param startDate - Date de début (optionnelle, format ISO string)
   * @param endDate - Date de fin (optionnelle, format ISO string)
   * @returns Statistiques avec le nombre d'artisans par statut et le nombre de dossiers à compléter
   */
  async getStatsByGestionnaire(
    gestionnaireId: string,
    startDate?: string,
    endDate?: string
  ): Promise<ArtisanStatsByStatus> {
    if (!gestionnaireId) {
      throw new Error("gestionnaireId is required");
    }

    // Construire la requête avec join sur artisan_statuses
    let query = supabase
      .from("artisans")
      .select(
        `
        statut_id,
        date_ajout,
        statut_dossier,
        status:artisan_statuses!inner(id, code, label)
        `,
        { count: "exact" }
      )
      .eq("gestionnaire_id", gestionnaireId)
      .eq("is_active", true)
      .neq("status.code", "ARCHIVE");

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Erreur lors de la récupération des statistiques: ${error.message}`);
    }

    // Initialiser les compteurs
    const byStatus: Record<string, number> = {};
    const byStatusLabel: Record<string, number> = {};
    let dossiersACompleter = 0;

    // Compter les artisans par statut et les dossiers à compléter
    (data || []).forEach((item: any) => {
      const statusRaw = item.status;
      const status = Array.isArray(statusRaw) ? statusRaw[0] as { id?: string; code?: string; label?: string } | undefined : statusRaw as { id?: string; code?: string; label?: string } | null;
      if (status) {
        const code = status.code || "SANS_STATUT";
        const label = status.label || "Sans statut";

        byStatus[code] = (byStatus[code] || 0) + 1;
        byStatusLabel[label] = (byStatusLabel[label] || 0) + 1;
      } else {
        // Artisan sans statut
        byStatus["SANS_STATUT"] = (byStatus["SANS_STATUT"] || 0) + 1;
        byStatusLabel["Sans statut"] = (byStatusLabel["Sans statut"] || 0) + 1;
      }

      // Compter les dossiers à compléter
      if (item.statut_dossier === "À compléter" || item.statut_dossier === "incomplet" || item.statut_dossier === "INCOMPLET") {
        dossiersACompleter++;
      }
    });

    return {
      total: count || 0,
      by_status: byStatus,
      by_status_label: byStatusLabel,
      dossiers_a_completer: dossiersACompleter,
      period: {
        start_date: startDate || null,
        end_date: endDate || null,
      },
    };
  },

  /**
   * Récupère les 5 artisans les plus actifs pour un gestionnaire avec leur dernière intervention et statut de disponibilité
   * @param gestionnaireId - ID du gestionnaire
   * @returns Liste des artisans avec leur nombre d'interventions, dernière date d'intervention et statut de disponibilité
   */
  async getTopArtisansByGestionnaire(
    gestionnaireId: string
  ): Promise<Array<{
    artisan_id: string;
    artisan_nom: string;
    artisan_prenom: string;
    total_interventions: number;
    derniere_intervention_date: string | null;
    is_available: boolean;
    absence_reason: string | null;
    absence_end_date: string | null;
  }>> {
    if (!gestionnaireId) {
      throw new Error("gestionnaireId is required");
    }

    // Récupérer les artisans du gestionnaire avec leur nombre d'interventions
    const { data: artisansStats, error: statsError } = await supabase
      .from("artisans")
      .select(
        `
        id,
        nom,
        prenom,
        intervention_artisans!inner(
          intervention_id,
          interventions!inner(
            date,
            is_active
          )
        )
        `
      )
      .eq("gestionnaire_id", gestionnaireId)
      .eq("is_active", true);

    if (statsError) {
      throw new Error(`Erreur lors de la récupération des artisans: ${statsError.message}`);
    }

    // Compter les interventions par artisan et trouver la dernière date
    const artisanMap = new Map<string, {
      artisan_id: string;
      artisan_nom: string;
      artisan_prenom: string;
      intervention_dates: string[];
    }>();

    (artisansStats || []).forEach((artisan: any) => {
      const interventionArtisansList = artisan.intervention_artisans || [];
      const interventionDates = interventionArtisansList
        .map((ia: any) => {
          const interv = Array.isArray(ia.interventions) ? ia.interventions[0] : ia.interventions;
          return interv?.is_active ? interv?.date : null;
        })
        .filter((date: unknown): date is string => typeof date === 'string');

      if (interventionDates.length > 0) {
        artisanMap.set(artisan.id, {
          artisan_id: artisan.id,
          artisan_nom: artisan.nom || "",
          artisan_prenom: artisan.prenom || "",
          intervention_dates: interventionDates,
        });
      }
    });

    // Trier par nombre d'interventions et prendre les 5 premiers
    const topArtisans = Array.from(artisanMap.values())
      .map(artisan => ({
        ...artisan,
        total_interventions: artisan.intervention_dates.length,
        derniere_intervention_date: artisan.intervention_dates
          .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] || null,
      }))
      .sort((a, b) => b.total_interventions - a.total_interventions)
      .slice(0, 5);

    // Récupérer les absences pour vérifier la disponibilité
    const artisanIds = topArtisans.map(a => a.artisan_id);
    const now = new Date().toISOString();

    const { data: absences, error: absencesError } = await supabase
      .from("artisan_absences")
      .select("artisan_id, start_date, end_date, reason, is_confirmed")
      .in("artisan_id", artisanIds)
      .lte("start_date", now)
      .gte("end_date", now)
      .eq("is_confirmed", true);

    if (absencesError) {
      console.warn("Erreur lors de la récupération des absences:", absencesError);
    }

    // Créer un map des absences par artisan
    const absenceMap = new Map<string, { reason: string | null; end_date: string }>();
    (absences || []).forEach((absence: any) => {
      absenceMap.set(absence.artisan_id, {
        reason: absence.reason,
        end_date: absence.end_date,
      });
    });

    // Ajouter les informations de disponibilité
    return topArtisans.map(artisan => {
      const absence = absenceMap.get(artisan.artisan_id);
      return {
        artisan_id: artisan.artisan_id,
        artisan_nom: artisan.artisan_nom,
        artisan_prenom: artisan.artisan_prenom,
        total_interventions: artisan.total_interventions,
        derniere_intervention_date: artisan.derniere_intervention_date,
        is_available: !absence,
        absence_reason: absence?.reason || null,
        absence_end_date: absence?.end_date || null,
      };
    });
  },

  /**
   * Récupère les 5 dernières interventions d'un artisan avec leurs marges
   * @param artisanId - ID de l'artisan
   * @param limit - Nombre d'interventions à récupérer (défaut: 5)
   * @param startDate - Date de début (optionnelle) pour filtrer les interventions
   * @param endDate - Date de fin (optionnelle) pour filtrer les interventions
   * @returns Liste des interventions avec id_inter, date et marge
   */
  async getRecentInterventionsByArtisanWithMargins(
    artisanId: string,
    limit: number = 5,
    startDate?: string,
    endDate?: string
  ): Promise<Array<{
    id: string;
    id_inter: string | null;
    date: string;
    marge: number; // Somme des coûts de type 'marge'
    status_label: string | null;
    status_color: string | null;
    due_date: string | null;
    metier_label: string | null;
  }>> {
    if (!artisanId) {
      throw new Error("artisanId is required");
    }

    // Récupérer les interventions de l'artisan via intervention_artisans
    const { data: interventionArtisans, error: joinError } = await supabase
      .from("intervention_artisans")
      .select(
        `
        intervention_id,
        interventions!inner (
          id,
          id_inter,
          date,
          due_date,
          is_active,
          statut_id,
          status:intervention_statuses(id, code, label, color),
          metier:metiers!metier_id(id, label, code),
          intervention_costs (
            cost_type,
            amount
          )
        )
        `
      )
      .eq("artisan_id", artisanId);

    if (joinError) {
      throw new Error(`Erreur lors de la récupération des interventions: ${joinError.message}`);
    }

    if (!interventionArtisans || interventionArtisans.length === 0) {
      return [];
    }

    // Traiter les interventions et calculer les marges
    let interventionsWithMargins = interventionArtisans
      .map((ia: any) => {
        const interventionRaw = ia.interventions;
        const intervention = Array.isArray(interventionRaw) ? interventionRaw[0] : interventionRaw;
        if (!intervention || !intervention.is_active) {
          return null;
        }

        // Filtrer par période si fournie (filtrage côté client car Supabase ne permet pas de filtrer sur les relations imbriquées)
        if (startDate && intervention.date < startDate) {
          return null;
        }
        if (endDate && intervention.date > endDate) {
          return null;
        }

        // Calculer la marge (somme des coûts de type 'marge')
        let marge = 0;
        const costsList = intervention.intervention_costs;
        if (costsList && Array.isArray(costsList)) {
          costsList.forEach((cost) => {
            if (cost.cost_type === "marge" && cost.amount !== null && cost.amount !== undefined) {
              marge += Number(cost.amount);
            }
          });
        }

        // Extraire le statut depuis la relation
        const statusRaw = intervention.status;
        const status = Array.isArray(statusRaw) ? statusRaw[0] : statusRaw;
        const status_label = status?.label || null;
        const status_color = status?.color || null;

        // Extraire le métier depuis la relation
        const metierRaw = intervention.metier;
        const metier = Array.isArray(metierRaw) ? metierRaw[0] : metierRaw;
        const metier_label = metier?.label || null;

        return {
          id: intervention.id,
          id_inter: intervention.id_inter,
          date: intervention.date,
          marge,
          status_label,
          status_color,
          due_date: intervention.due_date || null,
          metier_label,
        };
      })
      .filter((item: any): item is { id: string; id_inter: string | null; date: string; marge: number; status_label: string | null; status_color: string | null; due_date: string | null; metier_label: string | null; } => item !== null)
      .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, limit);

    return interventionsWithMargins;
  },

  /**
   * Récupère les artisans d'un statut avec leurs 5 dernières interventions et marges
   * @param gestionnaireId - ID du gestionnaire
   * @param statusLabel - Label du statut (ex: "Expert", "Confirmé", etc.)
   * @param startDate - Date de début (optionnelle) pour filtrer les interventions
   * @param endDate - Date de fin (optionnelle) pour filtrer les interventions
   * @returns Liste des artisans avec leurs interventions récentes
   */
  async getArtisansByStatusWithRecentInterventions(
    gestionnaireId: string,
    statusLabel: string,
    startDate?: string,
    endDate?: string,
    maxArtisans: number = 3,
    maxInterventions: number = 3
  ): Promise<Array<{
    artisan_id: string;
    artisan_nom: string;
    artisan_prenom: string;
    recent_interventions: Array<{
      id: string;
      id_inter: string | null;
      date: string;
      marge: number;
      status_label: string | null;
      status_color: string | null;
      due_date: string | null;
      metier_label: string | null;
    }>;
  }>> {
    if (!gestionnaireId) {
      throw new Error("gestionnaireId is required");
    }
    if (!statusLabel) {
      throw new Error("statusLabel is required");
    }

    // Récupérer les artisans du gestionnaire avec le statut correspondant
    const { data: artisans, error: artisansError } = await supabase
      .from("artisans")
      .select(
        `
        id,
        nom,
        prenom,
        created_at,
        status:artisan_statuses(id, code, label)
        `
      )
      .eq("gestionnaire_id", gestionnaireId)
      .eq("is_active", true)
      .order("created_at", { ascending: false }); // Trier par date d'insertion décroissante

    if (artisansError) {
      throw new Error(`Erreur lors de la récupération des artisans: ${artisansError.message}`);
    }

    if (!artisans || artisans.length === 0) {
      return [];
    }

    // Filtrer les artisans par statut label
    const artisansByStatus = artisans.filter((artisan: any) => {
      const statusRaw = artisan.status;
      const status = Array.isArray(statusRaw) ? statusRaw[0] : statusRaw;
      return status && status.label === statusLabel;
    });

    if (artisansByStatus.length === 0) {
      return [];
    }

    // Limiter aux maxArtisans derniers artisans insérés par statut
    const topArtisansByStatus = artisansByStatus.slice(0, maxArtisans);

    // Pour chaque artisan, récupérer ses maxInterventions dernières interventions avec marges (filtrées par période si fournie)
    const artisansWithInterventions = await Promise.all(
      topArtisansByStatus.map(async (artisan: any) => {
        const recentInterventions = await this.getRecentInterventionsByArtisanWithMargins(
          artisan.id,
          maxInterventions,
          startDate,
          endDate
        );

        return {
          artisan_id: artisan.id,
          artisan_nom: artisan.nom || "",
          artisan_prenom: artisan.prenom || "",
          recent_interventions: recentInterventions,
        };
      })
    );

    // Filtrer les artisans qui ont au moins une intervention
    return artisansWithInterventions.filter(
      (artisan) => artisan.recent_interventions.length > 0
    );
  },

  /**
   * Récupère les artisans avec dossiers à compléter pour un gestionnaire
   * @param gestionnaireId - ID du gestionnaire
   * @returns Liste des artisans avec leur nom et prénom
   */
  async getArtisansWithDossiersACompleter(
    gestionnaireId: string
  ): Promise<Array<{
    artisan_id: string;
    artisan_nom: string;
    artisan_prenom: string;
  }>> {
    if (!gestionnaireId) {
      throw new Error("gestionnaireId is required");
    }

    const { data, error } = await supabase
      .from("artisans")
      .select("id, nom, prenom, statut_id, artisan_statuses!inner(code)")
      .eq("gestionnaire_id", gestionnaireId)
      .eq("is_active", true)
      .in("statut_dossier", ["À compléter", "incomplet", "INCOMPLET"])
      .neq("artisan_statuses.code", "ARCHIVE");

    if (error) {
      throw new Error(`Erreur lors de la récupération des artisans: ${error.message}`);
    }

    return (data || []).map((a: any) => ({
      artisan_id: a.id,
      artisan_nom: a.nom || "",
      artisan_prenom: a.prenom || "",
    }));
  },

  // ===== GESTION DES ABSENCES =====

  /**
   * Récupère les absences d'un artisan
   */
  async getAbsences(artisanId: string): Promise<Array<{
    id: string;
    start_date: string;
    end_date: string;
    reason: string | null;
    is_confirmed: boolean;
  }>> {
    if (!artisanId) {
      throw new Error("artisanId is required");
    }

    const { data, error } = await supabase
      .from("artisan_absences")
      .select("id, start_date, end_date, reason, is_confirmed")
      .eq("artisan_id", artisanId)
      .order("start_date", { ascending: false });

    if (error) {
      throw new Error(`Erreur lors de la récupération des absences: ${error.message}`);
    }

    return (data || []).map((absence: any) => ({
      id: absence.id,
      start_date: absence.start_date,
      end_date: absence.end_date,
      reason: absence.reason,
      is_confirmed: absence.is_confirmed ?? false,
    }));
  },

  /**
   * Crée une nouvelle absence pour un artisan
   */
  async createAbsence(artisanId: string, absence: {
    start_date: string;
    end_date: string;
    reason?: string;
    is_confirmed?: boolean;
  }): Promise<{
    id: string;
    start_date: string;
    end_date: string;
    reason: string | null;
    is_confirmed: boolean;
  }> {
    if (!artisanId) {
      throw new Error("artisanId is required");
    }
    if (!absence.start_date || !absence.end_date) {
      throw new Error("start_date and end_date are required");
    }

    const { data, error } = await supabase
      .from("artisan_absences")
      .insert({
        artisan_id: artisanId,
        start_date: absence.start_date,
        end_date: absence.end_date,
        reason: absence.reason || null,
        is_confirmed: absence.is_confirmed ?? false,
      })
      .select("id, start_date, end_date, reason, is_confirmed")
      .single();

    if (error) {
      throw new Error(`Erreur lors de la création de l'absence: ${error.message}`);
    }

    return {
      id: data.id,
      start_date: data.start_date,
      end_date: data.end_date,
      reason: data.reason,
      is_confirmed: data.is_confirmed ?? false,
    };
  },

  /**
   * Supprime une absence
   */
  async deleteAbsence(absenceId: string): Promise<void> {
    if (!absenceId) {
      throw new Error("absenceId is required");
    }

    const { error } = await supabase
      .from("artisan_absences")
      .delete()
      .eq("id", absenceId);

    if (error) {
      throw new Error(`Erreur lors de la suppression de l'absence: ${error.message}`);
    }
  },

  // ===== GESTION DES ARTISANS SUPPRIMÉS =====

  /**
   * Vérifie si un artisan supprimé existe avec cet email ou SIRET
   * @returns L'artisan supprimé si trouvé, null sinon
   */
  async checkDeletedArtisan(params: { email?: string; siret?: string }): Promise<{
    found: boolean;
    artisan?: {
      id: string;
      prenom: string | null;
      nom: string | null;
      email: string | null;
      siret: string | null;
      raison_sociale: string | null;
      status?: { id: string; code: string | null; label: string | null } | null;
    };
    deleted_at?: string;
  }> {
    const headers = await getHeaders();
    const response = await fetch(
      `${SUPABASE_FUNCTIONS_URL}/artisans-v2/artisans/check-deleted`,
      {
        method: "POST",
        headers,
        body: JSON.stringify(params),
      }
    );
    return handleResponse(response);
  },

  /**
   * Restaure un artisan supprimé avec optionnellement de nouvelles données
   */
  async restore(artisanId: string, newData?: CreateArtisanData): Promise<Artisan> {
    const headers = await getHeaders();
    const response = await fetch(
      `${SUPABASE_FUNCTIONS_URL}/artisans-v2/artisans/${artisanId}/restore`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ newData }),
      }
    );
    const result = await handleResponse(response);
    const refs = await getReferenceCache();
    return mapArtisanRecord(result.data, refs);
  },

  /**
   * Supprime définitivement un artisan (hard delete)
   * Cela libère l'email et le SIRET pour une nouvelle création
   */
  async permanentDelete(artisanId: string): Promise<void> {
    const headers = await getHeaders();
    const response = await fetch(
      `${SUPABASE_FUNCTIONS_URL}/artisans-v2/artisans/${artisanId}/permanent`,
      {
        method: "DELETE",
        headers,
      }
    );
    await handleResponse(response);
  },

  /**
   * Met à jour une absence
   */
  async updateAbsence(absenceId: string, updates: {
    start_date?: string;
    end_date?: string;
    reason?: string;
    is_confirmed?: boolean;
  }): Promise<{
    id: string;
    start_date: string;
    end_date: string;
    reason: string | null;
    is_confirmed: boolean;
  }> {
    if (!absenceId) {
      throw new Error("absenceId is required");
    }

    const { data, error } = await supabase
      .from("artisan_absences")
      .update(updates)
      .eq("id", absenceId)
      .select("id, start_date, end_date, reason, is_confirmed")
      .single();

    if (error) {
      throw new Error(`Erreur lors de la mise à jour de l'absence: ${error.message}`);
    }

    return {
      id: data.id,
      start_date: data.start_date,
      end_date: data.end_date,
      reason: data.reason,
      is_confirmed: data.is_confirmed ?? false,
    };
  },

  /**
   * Récupère le statut précédent d'un artisan depuis l'historique
   * Utile notamment pour revenir au statut précédent après un ONE_SHOT
   *
   * @param artisanId - ID de l'artisan
   * @param beforeStatusCode - Optionnel: filtrer les historiques avant un certain statut (ex: 'ONE_SHOT')
   * @returns L'ID du statut précédent ou null si aucun historique
   */
  async getPreviousStatus(
    artisanId: string,
    beforeStatusCode?: string
  ): Promise<{
    statusId: string | null;
    statusCode: string | null;
    statusLabel: string | null;
    changedAt: string | null;
  }> {
    if (!artisanId) {
      throw new Error("artisanId is required");
    }

    // Construire la requête de base
    let query = supabase
      .from("artisan_status_history")
      .select(`
        old_status_id,
        changed_at,
        artisan_statuses!artisan_status_history_old_status_id_fkey (
          code,
          label
        )
      `)
      .eq("artisan_id", artisanId)
      .not("old_status_id", "is", null)
      .order("changed_at", { ascending: false })
      .limit(1);

    // Filtrer par le statut "new_status" si spécifié
    // (pour trouver le statut juste avant de passer à ONE_SHOT par exemple)
    if (beforeStatusCode) {
      // On doit d'abord trouver l'ID du statut
      const { data: statusData } = await supabase
        .from("artisan_statuses")
        .select("id")
        .eq("code", beforeStatusCode.toUpperCase())
        .single();

      if (statusData?.id) {
        query = query.eq("new_status_id", statusData.id);
      }
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      console.error("Erreur lors de la récupération du statut précédent:", error);
      throw new Error(`Erreur lors de la récupération du statut précédent: ${error.message}`);
    }

    if (!data) {
      return {
        statusId: null,
        statusCode: null,
        statusLabel: null,
        changedAt: null,
      };
    }

    // Extraire les données du statut (jointure)
    const statusInfo = Array.isArray(data.artisan_statuses)
      ? data.artisan_statuses[0]
      : data.artisan_statuses;

    return {
      statusId: data.old_status_id,
      statusCode: statusInfo?.code || null,
      statusLabel: statusInfo?.label || null,
      changedAt: data.changed_at,
    };
  },

  // ===== FONCTIONS DE COMPTAGE =====

  /**
   * Obtient le nombre total d'artisans correspondant aux filtres basiques
   * Remplace l'ancienne fonction getArtisanTotalCount de supabase-api-v2.ts
   * 
   * @param params - Paramètres de filtrage (gestionnaire, statut)
   * @returns Le nombre total d'artisans correspondant aux filtres
   */
  async getTotalCount(
    params?: {
      gestionnaire?: string;
      statut?: string;
    }
  ): Promise<number> {
    let query = supabase
      .from("artisans")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true);

    if (params?.gestionnaire) {
      query = query.eq("gestionnaire_id", params.gestionnaire);
    }
    if (params?.statut) {
      query = query.eq("statut_id", params.statut);
    }

    const { count, error } = await query;
    if (error) throw error;

    return count ?? 0;
  },

  /**
   * Obtient le nombre total d'artisans avec tous les filtres appliqués
   * Remplace l'ancienne fonction getArtisanCountWithFilters de supabase-api-v2.ts
   * 
   * @param params - Paramètres de filtrage complets (gestionnaire, statut(s), métier(s), search, statut_dossier)
   * @returns Le nombre total d'artisans correspondant aux filtres
   */
  async getCountWithFilters(
    params?: {
      gestionnaire?: string;
      statut?: string;
      statuts?: string[];
      metier?: string;
      metiers?: string[];
      search?: string;
      statut_dossier?: string;
    }
  ): Promise<number> {
    let query = supabase
      .from("artisans")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true);

    if (params?.gestionnaire) {
      query = query.eq("gestionnaire_id", params.gestionnaire);
    }

    if (params?.statuts && params.statuts.length > 0) {
      query = query.in("statut_id", params.statuts);
    } else if (params?.statut) {
      query = query.eq("statut_id", params.statut);
    }

    if (params?.statut_dossier) {
      query = query.in("statut_dossier", ["À compléter", "incomplet", "INCOMPLET"]);
    }

    if (params?.search && params.search.trim()) {
      const term = params.search.trim();
      query = query.or(
        [
          `prenom.ilike.%${term}%`,
          `nom.ilike.%${term}%`,
          `raison_sociale.ilike.%${term}%`,
          `email.ilike.%${term}%`,
          `telephone.ilike.%${term}%`,
          `telephone2.ilike.%${term}%`,
        ].join(",")
      );
    }

    const { count, error } = await query;
    if (error) throw error;

    // Filtrage par métiers (relation many-to-many)
    if (params?.metiers && params.metiers.length > 0) {
      let idsQuery = supabase
        .from("artisans")
        .select("id")
        .eq("is_active", true);

      if (params?.gestionnaire) {
        idsQuery = idsQuery.eq("gestionnaire_id", params.gestionnaire);
      }

      if (params?.statuts && params.statuts.length > 0) {
        idsQuery = idsQuery.in("statut_id", params.statuts);
      } else if (params?.statut) {
        idsQuery = idsQuery.eq("statut_id", params.statut);
      }

      if (params?.statut_dossier) {
        idsQuery = idsQuery.in("statut_dossier", ["À compléter", "incomplet", "INCOMPLET"]);
      }

      if (params?.search && params.search.trim()) {
        const term = params.search.trim();
        idsQuery = idsQuery.or(
          [
            `prenom.ilike.%${term}%`,
            `nom.ilike.%${term}%`,
            `raison_sociale.ilike.%${term}%`,
            `email.ilike.%${term}%`,
            `telephone.ilike.%${term}%`,
            `telephone2.ilike.%${term}%`,
          ].join(",")
        );
      }

      const { data: filteredArtisans, error: idsError } = await idsQuery;
      if (idsError) throw idsError;

      if (!filteredArtisans || filteredArtisans.length === 0) {
        return 0;
      }

      const artisanIds = filteredArtisans.map((a: any) => a.id).filter(Boolean);
      if (artisanIds.length === 0) {
        return 0;
      }

      const filteredIds = await filterArtisansByMetiers(artisanIds, params.metiers);
      return filteredIds.size;
    } else if (params?.metier) {
      let idsQuery = supabase
        .from("artisans")
        .select("id")
        .eq("is_active", true);

      if (params?.gestionnaire) {
        idsQuery = idsQuery.eq("gestionnaire_id", params.gestionnaire);
      }

      if (params?.statuts && params.statuts.length > 0) {
        idsQuery = idsQuery.in("statut_id", params.statuts);
      } else if (params?.statut) {
        idsQuery = idsQuery.eq("statut_id", params.statut);
      }

      if (params?.search && params.search.trim()) {
        const term = params.search.trim();
        idsQuery = idsQuery.or(
          [
            `prenom.ilike.%${term}%`,
            `nom.ilike.%${term}%`,
            `raison_sociale.ilike.%${term}%`,
            `email.ilike.%${term}%`,
            `telephone.ilike.%${term}%`,
            `telephone2.ilike.%${term}%`,
          ].join(",")
        );
      }

      const { data: filteredArtisans, error: idsError } = await idsQuery;
      if (idsError) throw idsError;

      if (!filteredArtisans || filteredArtisans.length === 0) {
        return 0;
      }

      const artisanIds = filteredArtisans.map((a: any) => a.id).filter(Boolean);
      if (artisanIds.length === 0) {
        return 0;
      }

      const filteredIds = await filterArtisansByMetier(artisanIds, params.metier);
      return filteredIds.size;
    }

    return count ?? 0;
  },

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
    const { data: archiveStatuses, error: archiveStatusesError } = await supabase
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
        const { data: metierData, error: metierError } = await supabase
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
    let query = supabase
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
    const { data: archiveStatuses, error: archiveStatusesError } = await supabase
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
        const { data: metierData, error: metierError } = await supabase
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
    let queryBuilder = supabase
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
