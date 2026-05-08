import { supabaseClient, filterArtisansByMetiers, filterArtisansByMetier } from "./_helpers";
import type {
  Artisan,
  ArtisanQueryParams,
  BulkOperationResult,
  CreateArtisanData,
  PaginatedResponse,
  UpdateArtisanData,
} from "@/lib/api/common/types";
import {
  SUPABASE_FUNCTIONS_URL,
  getHeaders,
  handleResponse,
  mapArtisanRecord,
  getReferenceCache,
} from "@/lib/api/common/utils";
import { safeErrorMessage } from "@/lib/api/common/error-handler";

export const artisansCrud = {
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
        const { data: searchResults, error: searchError } = await supabaseClient.rpc("search_artisans", {
          p_query: searchQuery,
          p_limit: 10000, // Récupérer tous les résultats pour gérer la pagination correctement
          p_offset: 0,
        });

        if (searchError) {
          console.error("[artisansApi.getAll] Error in search_artisans RPC:", searchError);
          // Fallback vers l'ancienne méthode si RPC échoue
        } else if (searchResults && searchResults.length === 0) {
          // RPC succeeded but found nothing — return empty, don't fall through to unfiltered query
          return {
            data: [],
            pagination: { total: 0, limit, offset, hasMore: false },
          };
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
          let detailedQuery = supabaseClient
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
          if (params?.exclude_statuts && params.exclude_statuts.length > 0) {
            detailedQuery = detailedQuery.not("statut_id", "in", `(${params.exclude_statuts.map((id) => `"${id}"`).join(",")})`);
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
      let idsQuery = supabaseClient
        .from("artisans")
        .select("id")
        .eq("is_active", true);

      if (params?.statuts && params.statuts.length > 0) {
        idsQuery = idsQuery.in("statut_id", params.statuts);
      } else if (params?.statut) {
        idsQuery = idsQuery.eq("statut_id", params.statut);
      }
      if (params?.exclude_statuts && params.exclude_statuts.length > 0) {
        idsQuery = idsQuery.not("statut_id", "in", `(${params.exclude_statuts.map((id) => `"${id}"`).join(",")})`);
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
      const { data: detailedData, error: detailedError } = await supabaseClient
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
      let idsQuery = supabaseClient
        .from("artisans")
        .select("id")
        .eq("is_active", true);

      if (params?.statuts && params.statuts.length > 0) {
        idsQuery = idsQuery.in("statut_id", params.statuts);
      } else if (params?.statut) {
        idsQuery = idsQuery.eq("statut_id", params.statut);
      }
      if (params?.exclude_statuts && params.exclude_statuts.length > 0) {
        idsQuery = idsQuery.not("statut_id", "in", `(${params.exclude_statuts.map((id) => `"${id}"`).join(",")})`);
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

      const { data: detailedData, error: detailedError } = await supabaseClient
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
    let query = supabaseClient
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
    if (params?.exclude_statuts && params.exclude_statuts.length > 0) {
      query = query.not("statut_id", "in", `(${params.exclude_statuts.map((id) => `"${id}"`).join(",")})`);
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
    const { data, error } = await supabaseClient
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
  async upsertDirect(
    data: CreateArtisanData,
    customClient?: typeof supabaseClient
  ): Promise<Artisan & { _operation: 'created' | 'updated'; _matchedBy?: 'siret' | 'email' | 'telephone' }> {
    const client = customClient || supabaseClient;

    // Chercher un artisan existant par siret OU email OU telephone
    // On privilégie le siret car plus fiable métier, puis l'email, puis le téléphone
    let existingId: string | null = null;
    let matchedBy: 'siret' | 'email' | 'telephone' | undefined;

    if (data.siret) {
      const { data: bySiret } = await client
        .from('artisans')
        .select('id')
        .eq('siret', data.siret)
        .maybeSingle();
      if (bySiret) { existingId = bySiret.id; matchedBy = 'siret'; }
    }

    if (!existingId && data.email) {
      const { data: byEmail } = await client
        .from('artisans')
        .select('id')
        .eq('email', data.email)
        .maybeSingle();
      if (byEmail) { existingId = byEmail.id; matchedBy = 'email'; }
    }

    if (!existingId && data.telephone) {
      const normalizedPhone = data.telephone.replace(/[^0-9+]/g, '');
      const { data: byPhone } = await client
        .from('artisans')
        .select('id')
        .eq('telephone', normalizedPhone)
        .maybeSingle();
      if (byPhone) { existingId = byPhone.id; matchedBy = 'telephone'; }
    }

    let result;
    let error;
    const operation: 'created' | 'updated' = existingId ? 'updated' : 'created';

    if (existingId) {
      // UPDATE : artisan déjà présent, on met à jour sans toucher aux contraintes uniques
      ({ data: result, error } = await client
        .from('artisans')
        .update(data)
        .eq('id', existingId)
        .select()
        .single());
    } else {
      // INSERT : nouvel artisan
      ({ data: result, error } = await client
        .from('artisans')
        .insert(data)
        .select()
        .single());
    }

    if (error) throw new Error(`Erreur lors de l'upsert de l'artisan: ${error.message}`);

    const refs = await getReferenceCache();
    const artisan = mapArtisanRecord(result, refs);
    return Object.assign(artisan, { _operation: operation, _matchedBy: matchedBy });
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
};
