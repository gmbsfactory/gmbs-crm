import { supabaseClient, filterArtisansByMetiers, filterArtisansByMetier } from "./_helpers";

export const artisansCounts = {
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
    let query = supabaseClient
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
      exclude_statuts?: string[];
      metier?: string;
      metiers?: string[];
      search?: string;
      statut_dossier?: string;
    }
  ): Promise<number> {
    let query = supabaseClient
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

    if (params?.exclude_statuts && params.exclude_statuts.length > 0) {
      query = query.not("statut_id", "in", `(${params.exclude_statuts.map((id) => `"${id}"`).join(",")})`);
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
      let idsQuery = supabaseClient
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

      if (params?.exclude_statuts && params.exclude_statuts.length > 0) {
        idsQuery = idsQuery.not("statut_id", "in", `(${params.exclude_statuts.map((id) => `"${id}"`).join(",")})`);
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
      let idsQuery = supabaseClient
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

      if (params?.exclude_statuts && params.exclude_statuts.length > 0) {
        idsQuery = idsQuery.not("statut_id", "in", `(${params.exclude_statuts.map((id) => `"${id}"`).join(",")})`);
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

      const filteredIds = await filterArtisansByMetier(artisanIds, params.metier);
      return filteredIds.size;
    }

    return count ?? 0;
  },
};
