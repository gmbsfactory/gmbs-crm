import { supabaseClient } from "./_helpers";
import type {
  Artisan,
  ArtisanQueryParams,
  PaginatedResponse,
} from "@/lib/api/common/types";
import {
  mapArtisanRecord,
  getReferenceCache,
} from "@/lib/api/common/utils";

// Type pour permettre aux méthodes de filtres d'appeler this.getAll (résolu via spread-merge dans index.ts)
type ArtisansApiThis = {
  getAll(params?: ArtisanQueryParams): Promise<PaginatedResponse<Artisan>>;
};

export const artisansFilters = {
  // Récupérer les artisans par gestionnaire
  async getByGestionnaire(this: ArtisansApiThis, gestionnaireId: string, params?: ArtisanQueryParams): Promise<PaginatedResponse<Artisan>> {
    return this.getAll({ ...params, gestionnaire: gestionnaireId });
  },

  // Récupérer les artisans par statut
  async getByStatus(this: ArtisansApiThis, statusId: string, params?: ArtisanQueryParams): Promise<PaginatedResponse<Artisan>> {
    return this.getAll({ ...params, statut: statusId });
  },

  // Récupérer les artisans par métier
  async getByMetier(this: ArtisansApiThis, metierId: string, params?: ArtisanQueryParams): Promise<PaginatedResponse<Artisan>> {
    return this.getAll({ ...params, metier: metierId });
  },

  // Récupérer les artisans par zone
  async getByZone(this: ArtisansApiThis, zoneId: string, params?: ArtisanQueryParams): Promise<PaginatedResponse<Artisan>> {
    return this.getAll({ ...params, zone: zoneId });
  },

  // Rechercher par plain_nom (pour la recherche SST)
  async searchByPlainNom(searchTerm: string, params?: ArtisanQueryParams, customClient?: typeof supabaseClient): Promise<PaginatedResponse<Artisan>> {
    // Utiliser le client personnalisé si fourni, sinon utiliser supabaseClient (qui utilise getSupabaseClientForNode() dans Node.js)
    const client = customClient || supabaseClient;

    let query = client
      .from("artisans")
      .select("*", { count: "exact" })
      .ilike("plain_nom", `${searchTerm}%`) // Recherche insensible à la casse, préfixe
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
    let query = supabaseClient
      .from("artisans")
      .select("*", { count: "exact" })
      .or(`prenom.ilike.%${searchTerm}%,nom.ilike.%${searchTerm}%,raison_sociale.ilike.%${searchTerm}%,plain_nom.ilike.%${searchTerm}%`)
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
};
