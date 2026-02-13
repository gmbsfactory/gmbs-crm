// ===== API CLIENTS V2 =====
// Gestion complète des clients

import type {
    BulkOperationResult,
    Client,
    CreateClientData,
    PaginatedResponse,
    UpdateClientData,
} from "./common/types";
import { SUPABASE_FUNCTIONS_URL, getHeaders, handleResponse } from "./common/utils";
import { safeErrorMessage } from "@/lib/api/v2/common/error-handler";

export const clientsApi = {
  // Récupérer tous les clients
  async getAll(params?: { limit?: number; offset?: number }): Promise<PaginatedResponse<Client>> {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.append("limit", params.limit.toString());
    if (params?.offset) searchParams.append("offset", params.offset.toString());

    const url = `${SUPABASE_FUNCTIONS_URL}/clients/clients${
      searchParams.toString() ? `?${searchParams.toString()}` : ""
    }`;

    const response = await fetch(url, {
      headers: await getHeaders(),
    });
    return handleResponse(response);
  },

  // Récupérer un client par ID
  async getById(id: string): Promise<Client> {
    const response = await fetch(
      `${SUPABASE_FUNCTIONS_URL}/clients/clients/${id}`,
      {
        headers: await getHeaders(),
      }
    );
    return handleResponse(response);
  },

  // Créer un client
  async create(data: CreateClientData): Promise<Client> {
    const response = await fetch(`${SUPABASE_FUNCTIONS_URL}/clients/clients`, {
      method: "POST",
      headers: await getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  // Modifier un client
  async update(id: string, data: UpdateClientData): Promise<Client> {
    const response = await fetch(
      `${SUPABASE_FUNCTIONS_URL}/clients/clients/${id}`,
      {
        method: "PUT",
        headers: await getHeaders(),
        body: JSON.stringify(data),
      }
    );
    return handleResponse(response);
  },

  // Supprimer un client
  async delete(id: string): Promise<{ message: string; data: Client }> {
    const response = await fetch(
      `${SUPABASE_FUNCTIONS_URL}/clients/clients/${id}`,
      {
        method: "DELETE",
        headers: await getHeaders(),
      }
    );
    return handleResponse(response);
  },

  // Insérer plusieurs clients
  async insertClients(clients: CreateClientData[]): Promise<BulkOperationResult> {
    const results = { success: 0, errors: 0, details: [] as any[] };

    for (const client of clients) {
      try {
        const result = await this.create(client);
        results.success++;
        results.details.push({ item: client, success: true, data: result });
      } catch (error: unknown) {
        results.errors++;
        results.details.push({ item: client, success: false, error: safeErrorMessage(error, "l'insertion du client") });
      }
    }

    return results;
  },

  // Rechercher des clients par nom/prénom
  async searchByName(searchTerm: string, params?: { limit?: number; offset?: number }): Promise<PaginatedResponse<Client>> {
    const searchParams = new URLSearchParams();
    searchParams.append("search", searchTerm);
    if (params?.limit) searchParams.append("limit", params.limit.toString());
    if (params?.offset) searchParams.append("offset", params.offset.toString());

    const url = `${SUPABASE_FUNCTIONS_URL}/clients/clients/search?${searchParams.toString()}`;

    const response = await fetch(url, {
      headers: await getHeaders(),
    });
    return handleResponse(response);
  },

  // Rechercher des clients par email
  async searchByEmail(email: string, params?: { limit?: number; offset?: number }): Promise<PaginatedResponse<Client>> {
    const searchParams = new URLSearchParams();
    searchParams.append("email", email);
    if (params?.limit) searchParams.append("limit", params.limit.toString());
    if (params?.offset) searchParams.append("offset", params.offset.toString());

    const url = `${SUPABASE_FUNCTIONS_URL}/clients/clients/search?${searchParams.toString()}`;

    const response = await fetch(url, {
      headers: await getHeaders(),
    });
    return handleResponse(response);
  },

  // Rechercher des clients par téléphone
  async searchByPhone(phone: string, params?: { limit?: number; offset?: number }): Promise<PaginatedResponse<Client>> {
    const searchParams = new URLSearchParams();
    searchParams.append("phone", phone);
    if (params?.limit) searchParams.append("limit", params.limit.toString());
    if (params?.offset) searchParams.append("offset", params.offset.toString());

    const url = `${SUPABASE_FUNCTIONS_URL}/clients/clients/search?${searchParams.toString()}`;

    const response = await fetch(url, {
      headers: await getHeaders(),
    });
    return handleResponse(response);
  },

  // Récupérer les clients par ville
  async getByCity(city: string, params?: { limit?: number; offset?: number }): Promise<PaginatedResponse<Client>> {
    const searchParams = new URLSearchParams();
    searchParams.append("city", city);
    if (params?.limit) searchParams.append("limit", params.limit.toString());
    if (params?.offset) searchParams.append("offset", params.offset.toString());

    const url = `${SUPABASE_FUNCTIONS_URL}/clients/clients/search?${searchParams.toString()}`;

    const response = await fetch(url, {
      headers: await getHeaders(),
    });
    return handleResponse(response);
  },

  // Récupérer les clients par code postal
  async getByPostalCode(postalCode: string, params?: { limit?: number; offset?: number }): Promise<PaginatedResponse<Client>> {
    const searchParams = new URLSearchParams();
    searchParams.append("postal_code", postalCode);
    if (params?.limit) searchParams.append("limit", params.limit.toString());
    if (params?.offset) searchParams.append("offset", params.offset.toString());

    const url = `${SUPABASE_FUNCTIONS_URL}/clients/clients/search?${searchParams.toString()}`;

    const response = await fetch(url, {
      headers: await getHeaders(),
    });
    return handleResponse(response);
  },

  // Obtenir les statistiques des clients
  async getStats(): Promise<{
    total: number;
    by_city: Record<string, number>;
    by_postal_code: Record<string, number>;
    recent_count: number;
  }> {
    const response = await fetch(
      `${SUPABASE_FUNCTIONS_URL}/clients/clients/stats`,
      {
        headers: await getHeaders(),
      }
    );
    return handleResponse(response);
  },

  // Créer plusieurs clients en lot
  async createBulk(clients: CreateClientData[]): Promise<BulkOperationResult> {
    return this.insertClients(clients);
  },
};
