// ===== API COMMENTS V2 =====
// Gestion complète des commentaires

import type {
    Comment,
    CommentQueryParams,
    CommentStats,
    CreateCommentData,
    PaginatedResponse,
    UpdateCommentData,
} from "./common/types";
import { SUPABASE_FUNCTIONS_URL, getHeaders, handleResponse } from "./common/utils";
import { safeErrorMessage } from "@/lib/api/common/error-handler";

export const commentsApi = {
  // Récupérer tous les commentaires
  async getAll(params?: CommentQueryParams): Promise<PaginatedResponse<Comment>> {
    const searchParams = new URLSearchParams();

    if (params?.entity_type)
      searchParams.append("entity_type", params.entity_type);
    if (params?.entity_id) searchParams.append("entity_id", params.entity_id);
    if (params?.comment_type)
      searchParams.append("comment_type", params.comment_type);
    if (params?.is_internal !== undefined)
      searchParams.append("is_internal", params.is_internal.toString());
    if (params?.author_id) searchParams.append("author_id", params.author_id);
    if (params?.limit) searchParams.append("limit", params.limit.toString());
    if (params?.offset) searchParams.append("offset", params.offset.toString());

    const url = `${SUPABASE_FUNCTIONS_URL}/comments/comments${
      searchParams.toString() ? `?${searchParams.toString()}` : ""
    }`;

    const response = await fetch(url, {
      headers: await getHeaders(),
    });
    return handleResponse(response);
  },

  // Récupérer les commentaires pour une entité spécifique
  async getByEntity(
    entityType: "artisan" | "intervention",
    entityId: string,
    params?: Omit<CommentQueryParams, "entity_type" | "entity_id">,
  ): Promise<Comment[]> {
    const response = await this.getAll({
      ...params,
      entity_type: entityType,
      entity_id: entityId,
    });
    return response.data ?? [];
  },

  // Récupérer un commentaire par ID
  async getById(id: string): Promise<Comment> {
    const response = await fetch(
      `${SUPABASE_FUNCTIONS_URL}/comments/comments/${id}`,
      {
        headers: await getHeaders(),
      }
    );
    return handleResponse(response);
  },

  // Créer un commentaire
  async create(data: CreateCommentData): Promise<Comment> {
    const response = await fetch(
      `${SUPABASE_FUNCTIONS_URL}/comments/comments`,
      {
        method: "POST",
        headers: await getHeaders(),
        body: JSON.stringify(data),
      }
    );
    return handleResponse(response);
  },

  // Modifier un commentaire
  async update(id: string, data: UpdateCommentData): Promise<Comment> {
    const response = await fetch(
      `${SUPABASE_FUNCTIONS_URL}/comments/comments/${id}`,
      {
        method: "PUT",
        headers: await getHeaders(),
        body: JSON.stringify(data),
      }
    );
    return handleResponse(response);
  },

  // Supprimer un commentaire
  async delete(id: string): Promise<{ message: string; data: Comment }> {
    const response = await fetch(
      `${SUPABASE_FUNCTIONS_URL}/comments/comments/${id}`,
      {
        method: "DELETE",
        headers: await getHeaders(),
      }
    );
    return handleResponse(response);
  },

  // Obtenir les types de commentaires supportés
  async getSupportedTypes(): Promise<{
    comment_types: string[];
    entity_types: string[];
    default_type: string;
    internal_default: boolean;
  }> {
    const response = await fetch(
      `${SUPABASE_FUNCTIONS_URL}/comments/comments/types`,
      {
        headers: await getHeaders(),
      }
    );
    return handleResponse(response);
  },

  // Obtenir les statistiques des commentaires
  async getStats(params?: {
    entity_type?: "intervention" | "artisan" | "client";
    entity_id?: string;
  }): Promise<CommentStats> {
    const searchParams = new URLSearchParams();

    if (params?.entity_type)
      searchParams.append("entity_type", params.entity_type);
    if (params?.entity_id) searchParams.append("entity_id", params.entity_id);

    const url = `${SUPABASE_FUNCTIONS_URL}/comments/comments/stats${
      searchParams.toString() ? `?${searchParams.toString()}` : ""
    }`;

    const response = await fetch(url, {
      headers: await getHeaders(),
    });
    return handleResponse(response);
  },

  // Récupérer les commentaires d'une intervention
  async getByIntervention(interventionId: string, params?: CommentQueryParams): Promise<PaginatedResponse<Comment>> {
    return this.getAll({ ...params, entity_type: "intervention", entity_id: interventionId });
  },

  // Récupérer les commentaires d'un artisan
  async getByArtisan(artisanId: string, params?: CommentQueryParams): Promise<PaginatedResponse<Comment>> {
    return this.getAll({ ...params, entity_type: "artisan", entity_id: artisanId });
  },

  // Récupérer les commentaires d'un client
  async getByClient(clientId: string, params?: CommentQueryParams): Promise<PaginatedResponse<Comment>> {
    return this.getAll({ ...params, entity_type: "client", entity_id: clientId });
  },

  // Récupérer les commentaires par type
  async getByType(commentType: string, params?: CommentQueryParams): Promise<PaginatedResponse<Comment>> {
    return this.getAll({ ...params, comment_type: commentType });
  },

  // Récupérer les commentaires internes
  async getInternal(params?: CommentQueryParams): Promise<PaginatedResponse<Comment>> {
    return this.getAll({ ...params, is_internal: true });
  },

  // Récupérer les commentaires externes
  async getExternal(params?: CommentQueryParams): Promise<PaginatedResponse<Comment>> {
    return this.getAll({ ...params, is_internal: false });
  },

  // Récupérer les commentaires par auteur
  async getByAuthor(authorId: string, params?: CommentQueryParams): Promise<PaginatedResponse<Comment>> {
    return this.getAll({ ...params, author_id: authorId });
  },

  // Rechercher des commentaires par contenu
  async searchByContent(searchTerm: string, params?: CommentQueryParams): Promise<PaginatedResponse<Comment>> {
    const searchParams = new URLSearchParams();
    searchParams.append("search", searchTerm);
    if (params?.entity_type) searchParams.append("entity_type", params.entity_type);
    if (params?.entity_id) searchParams.append("entity_id", params.entity_id);
    if (params?.comment_type) searchParams.append("comment_type", params.comment_type);
    if (params?.is_internal !== undefined) searchParams.append("is_internal", params.is_internal.toString());
    if (params?.author_id) searchParams.append("author_id", params.author_id);
    if (params?.limit) searchParams.append("limit", params.limit.toString());
    if (params?.offset) searchParams.append("offset", params.offset.toString());

    const url = `${SUPABASE_FUNCTIONS_URL}/comments/comments/search?${searchParams.toString()}`;

    const response = await fetch(url, {
      headers: await getHeaders(),
    });
    return handleResponse(response);
  },

  // Récupérer les commentaires récents
  async getRecent(days: number = 7, params?: CommentQueryParams): Promise<PaginatedResponse<Comment>> {
    const searchParams = new URLSearchParams();
    searchParams.append("recent_days", days.toString());
    if (params?.entity_type) searchParams.append("entity_type", params.entity_type);
    if (params?.entity_id) searchParams.append("entity_id", params.entity_id);
    if (params?.comment_type) searchParams.append("comment_type", params.comment_type);
    if (params?.is_internal !== undefined) searchParams.append("is_internal", params.is_internal.toString());
    if (params?.author_id) searchParams.append("author_id", params.author_id);
    if (params?.limit) searchParams.append("limit", params.limit.toString());
    if (params?.offset) searchParams.append("offset", params.offset.toString());

    const url = `${SUPABASE_FUNCTIONS_URL}/comments/comments/recent?${searchParams.toString()}`;

    const response = await fetch(url, {
      headers: await getHeaders(),
    });
    return handleResponse(response);
  },

  // Créer plusieurs commentaires en lot
  async createBulk(comments: CreateCommentData[]): Promise<{
    success: number;
    errors: number;
    details: Array<{
      item: CreateCommentData;
      success: boolean;
      data?: any;
      error?: string;
    }>;
  }> {
    const results = { success: 0, errors: 0, details: [] as any[] };

    for (const comment of comments) {
      try {
        const result = await this.create(comment);
        results.success++;
        results.details.push({ item: comment, success: true, data: result });
      } catch (error: unknown) {
        results.errors++;
        results.details.push({ item: comment, success: false, error: safeErrorMessage(error, "la création du commentaire") });
      }
    }

    return results;
  },
};
