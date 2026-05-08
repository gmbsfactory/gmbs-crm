import type { BulkOperationResult } from "@/lib/api/common/types";
import {
  SUPABASE_FUNCTIONS_URL,
  getHeaders,
  handleResponse,
} from "@/lib/api/common/utils";
import { safeErrorMessage } from "@/lib/api/common/error-handler";

export const artisansRelations = {
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
};
