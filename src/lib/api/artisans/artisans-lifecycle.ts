import { supabaseClient } from "./_helpers";
import type {
  Artisan,
  CreateArtisanData,
} from "@/lib/api/common/types";
import {
  SUPABASE_FUNCTIONS_URL,
  getHeaders,
  handleResponse,
  mapArtisanRecord,
  getReferenceCache,
} from "@/lib/api/common/utils";

export const artisansLifecycle = {
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
    let query = supabaseClient
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
      const { data: statusData } = await supabaseClient
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
};
