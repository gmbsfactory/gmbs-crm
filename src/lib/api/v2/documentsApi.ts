// ===== API DOCUMENTS V2 =====
// Gestion complète des documents

import type {
  ArtisanAttachment,
  CreateDocumentData,
  DocumentQueryParams,
  FileUploadData,
  InterventionAttachment,
  PaginatedResponse,
  SupportedDocumentTypes,
  UpdateDocumentData,
} from "./common/types";
import { getSupabaseFunctionsUrl, getHeaders, handleResponse } from "./common/utils";
import { safeErrorMessage } from "@/lib/api/v2/common/error-handler";
import { supabase, getSupabaseClientForNode } from "./common/client";

// Détecter si on est dans Node.js (pas de window)
const isNodeJs = typeof window === 'undefined';

/**
 * Normalise le kind d'un document pour les interventions
 * Transforme les variantes (facture_gmbs, factureGMBS, etc.) vers les valeurs canoniques (facturesGMBS)
 */
function normalizeInterventionKind(kind: string): string {
  if (!kind) return kind;

  const trimmed = kind.trim();
  if (!trimmed) return kind;

  const lower = trimmed.toLowerCase();
  const compact = lower.replace(/[_\s-]/g, '');

  // Mapping vers les valeurs canoniques avec 's' (comme dans l'Edge Function)
  const canonicalMap: Record<string, string> = {
    facturegmbs: 'facturesGMBS',
    facturesgmbs: 'facturesGMBS',
    factureartisan: 'facturesArtisans',
    facturesartisan: 'facturesArtisans',
    facturemateriel: 'facturesMateriel',
    facturesmateriel: 'facturesMateriel'
  };

  if (canonicalMap[compact]) {
    return canonicalMap[compact];
  }

  // Gérer les cas spéciaux comme 'a_classe'
  const needsClassification = [
    'aclasser',
    'aclassifier',
    'àclasser',
    'àclassifier',
    'aclasse',
    'àclasse'
  ];
  if (
    needsClassification.includes(compact) ||
    lower === 'a classer' ||
    lower === 'a classifier' ||
    lower === 'à classer' ||
    lower === 'à classifier'
  ) {
    return 'a_classe';
  }

  return trimmed;
}

export const documentsApi = {
  // Récupérer tous les documents
  async getAll(params?: DocumentQueryParams): Promise<PaginatedResponse<InterventionAttachment | ArtisanAttachment>> {
    const searchParams = new URLSearchParams();

    if (params?.entity_type)
      searchParams.append("entity_type", params.entity_type);
    if (params?.entity_id) searchParams.append("entity_id", params.entity_id);
    if (params?.kind) searchParams.append("kind", params.kind);
    if (params?.limit) searchParams.append("limit", params.limit.toString());
    if (params?.offset) searchParams.append("offset", params.offset.toString());

    const url = `${getSupabaseFunctionsUrl()}/documents/documents${
      searchParams.toString() ? `?${searchParams.toString()}` : ""
    }`;

    const headers = await getHeaders();
    const response = await fetch(url, {
      headers,
    });
    return handleResponse(response);
  },

  // Récupérer un document par ID
  async getById(
    id: string,
    entityType: "intervention" | "artisan" = "intervention"
  ): Promise<InterventionAttachment | ArtisanAttachment> {
    const url = `${getSupabaseFunctionsUrl()}/documents/documents/${id}?entity_type=${entityType}`;

    const headers = await getHeaders();
    const response = await fetch(url, {
      headers,
    });
    return handleResponse(response);
  },

  // Créer un document
  async create(data: CreateDocumentData): Promise<InterventionAttachment | ArtisanAttachment> {
    // Dans Node.js, utiliser directement Supabase (plus simple et fiable)
    if (isNodeJs) {
      const client = getSupabaseClientForNode();
      const tableName = data.entity_type === 'artisan' ? 'artisan_attachments' : 'intervention_attachments';
      const entityIdField = data.entity_type === 'artisan' ? 'artisan_id' : 'intervention_id';
      
      // Normaliser le kind pour les interventions (comme dans l'Edge Function)
      const canonicalKind = data.entity_type === 'intervention'
        ? normalizeInterventionKind(data.kind)
        : data.kind;
      
      const { data: result, error } = await client
        .from(tableName)
        .insert([{
          [entityIdField]: data.entity_id,
          kind: canonicalKind,
          url: data.url,
          filename: data.filename || null,
          mime_type: data.mime_type || null,
          file_size: data.file_size || null,
          created_by: data.created_by || null,
          created_by_display: data.created_by_display || null,
          created_by_code: data.created_by_code || null,
          created_by_color: data.created_by_color || null,
        }])
        .select()
        .single();
      
      if (error) {
        throw new Error(`Failed to create document: ${error.message}`);
      }
      
      return result;
    }
    
    // Dans le browser, utiliser les Edge Functions
    const headers = await getHeaders();
    const response = await fetch(
      `${getSupabaseFunctionsUrl()}/documents/documents`,
      {
        method: "POST",
        headers,
        body: JSON.stringify(data),
      }
    );
    return handleResponse(response);
  },

  // Upload un document avec contenu
  async upload(data: FileUploadData): Promise<InterventionAttachment | ArtisanAttachment> {
    // Dans Node.js, utiliser directement Supabase Storage (plus simple et fiable)
    if (isNodeJs) {
      const client = getSupabaseClientForNode();
      
      // Décoder le contenu base64
      let fileBuffer: Buffer;
      try {
        // Enlever le préfixe "data:..." si présent
        const base64Data = data.content.includes(',') 
          ? data.content.split(',')[1] 
          : data.content;
        
        // Décoder le base64 en buffer
        fileBuffer = Buffer.from(base64Data, 'base64');
      } catch (error: any) {
        throw new Error(`Invalid base64 content: ${error.message}`);
      }

      // Générer un nom de fichier unique (comme dans l'Edge Function)
      const timestamp = Date.now();
      const extension = data.filename.split('.').pop() || 'bin';
      
      // Normaliser le kind pour les interventions (comme dans l'Edge Function)
      const canonicalKind = data.entity_type === 'intervention'
        ? normalizeInterventionKind(data.kind)
        : data.kind;
      
      const uniqueFilename = `${data.entity_type}_${data.entity_id}_${canonicalKind}_${timestamp}.${extension}`;

      // Upload vers Supabase Storage
      const storagePath = `${data.entity_type}/${data.entity_id}/${uniqueFilename}`;
      const { data: uploadData, error: uploadError } = await client.storage
        .from('documents')
        .upload(storagePath, fileBuffer, {
          contentType: data.mime_type,
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        throw new Error(`Failed to upload to storage: ${uploadError.message}`);
      }

      // Obtenir l'URL publique du fichier uploadé
      const { data: { publicUrl } } = client.storage
        .from('documents')
        .getPublicUrl(storagePath);

      // Remplacer l'URL interne Docker par l'URL accessible
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
      const storageUrl = publicUrl.replace(
        'http://kong:8000',
        supabaseUrl.replace(/\/rest\/v1$/, '').replace(/\/$/, '') || 'http://127.0.0.1:54321'
      );

      // Créer l'enregistrement en base
      const tableName = data.entity_type === 'artisan' ? 'artisan_attachments' : 'intervention_attachments';
      const entityIdField = data.entity_type === 'artisan' ? 'artisan_id' : 'intervention_id';
      
      const { data: result, error } = await client
        .from(tableName)
        .insert([{
          [entityIdField]: data.entity_id,
          kind: canonicalKind,
          url: storageUrl,
          filename: data.filename,
          mime_type: data.mime_type,
          file_size: data.file_size,
          created_by: data.created_by || null,
          created_by_display: data.created_by_display || null,
          created_by_code: data.created_by_code || null,
          created_by_color: data.created_by_color || null,
        }])
        .select()
        .single();
      
      if (error) {
        throw new Error(`Failed to create document: ${error.message}`);
      }
      
      return result;
    }
    
    // Dans le browser, utiliser les Edge Functions
    const headers = await getHeaders();
    const response = await fetch(
      `${getSupabaseFunctionsUrl()}/documents/documents/upload`,
      {
        method: "POST",
        headers,
        body: JSON.stringify(data),
      }
    );
    return handleResponse(response);
  },

  // Modifier un document
  async update(
    id: string,
    data: UpdateDocumentData,
    entityType: "intervention" | "artisan" = "intervention"
  ): Promise<InterventionAttachment | ArtisanAttachment> {
    const url = `${getSupabaseFunctionsUrl()}/documents/documents/${id}?entity_type=${entityType}`;

    const headers = await getHeaders();
    const response = await fetch(url, {
      method: "PUT",
      headers,
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  // Supprimer un document
  async delete(
    id: string,
    entityType: "intervention" | "artisan" = "intervention"
  ): Promise<{ message: string; data: any }> {
    const url = `${getSupabaseFunctionsUrl()}/documents/documents/${id}?entity_type=${entityType}`;

    const headers = await getHeaders();
    const response = await fetch(url, {
      method: "DELETE",
      headers,
    });
    return handleResponse(response);
  },

  // Obtenir les types de documents supportés
  async getSupportedTypes(): Promise<SupportedDocumentTypes> {
    const headers = await getHeaders();
    const response = await fetch(
      `${getSupabaseFunctionsUrl()}/documents/documents/types`,
      {
        headers,
      }
    );
    return handleResponse(response);
  },

  // Récupérer les documents d'une intervention
  async getByIntervention(interventionId: string, params?: DocumentQueryParams): Promise<PaginatedResponse<InterventionAttachment>> {
    return this.getAll({ ...params, entity_type: "intervention", entity_id: interventionId }) as Promise<PaginatedResponse<InterventionAttachment>>;
  },

  // Récupérer les documents d'un artisan
  async getByArtisan(artisanId: string, params?: DocumentQueryParams): Promise<PaginatedResponse<ArtisanAttachment>> {
    return this.getAll({ ...params, entity_type: "artisan", entity_id: artisanId }) as Promise<PaginatedResponse<ArtisanAttachment>>;
  },

  // Récupérer les documents par type
  async getByKind(kind: string, params?: DocumentQueryParams): Promise<PaginatedResponse<InterventionAttachment | ArtisanAttachment>> {
    return this.getAll({ ...params, kind });
  },

  // Récupérer les documents par créateur
  async getByCreator(creatorId: string, params?: DocumentQueryParams): Promise<PaginatedResponse<InterventionAttachment | ArtisanAttachment>> {
    const searchParams = new URLSearchParams();
    searchParams.append("created_by", creatorId);
    if (params?.entity_type) searchParams.append("entity_type", params.entity_type);
    if (params?.entity_id) searchParams.append("entity_id", params.entity_id);
    if (params?.kind) searchParams.append("kind", params.kind);
    if (params?.limit) searchParams.append("limit", params.limit.toString());
    if (params?.offset) searchParams.append("offset", params.offset.toString());

    const url = `${getSupabaseFunctionsUrl()}/documents/documents/search?${searchParams.toString()}`;

    const headers = await getHeaders();
    const response = await fetch(url, {
      headers,
    });
    return handleResponse(response);
  },

  // Rechercher des documents par nom de fichier
  async searchByFilename(filename: string, params?: DocumentQueryParams): Promise<PaginatedResponse<InterventionAttachment | ArtisanAttachment>> {
    const searchParams = new URLSearchParams();
    searchParams.append("filename", filename);
    if (params?.entity_type) searchParams.append("entity_type", params.entity_type);
    if (params?.entity_id) searchParams.append("entity_id", params.entity_id);
    if (params?.kind) searchParams.append("kind", params.kind);
    if (params?.limit) searchParams.append("limit", params.limit.toString());
    if (params?.offset) searchParams.append("offset", params.offset.toString());

    const url = `${getSupabaseFunctionsUrl()}/documents/documents/search?${searchParams.toString()}`;

    const headers = await getHeaders();
    const response = await fetch(url, {
      headers,
    });
    return handleResponse(response);
  },

  // Obtenir les statistiques des documents
  async getStats(params?: { entity_type?: "intervention" | "artisan"; entity_id?: string }): Promise<{
    total: number;
    by_type: Record<string, number>;
    by_entity: Record<string, number>;
    by_kind: Record<string, number>;
    total_size: number;
    recent_count: number;
  }> {
    const searchParams = new URLSearchParams();
    if (params?.entity_type) searchParams.append("entity_type", params.entity_type);
    if (params?.entity_id) searchParams.append("entity_id", params.entity_id);

    const url = `${getSupabaseFunctionsUrl()}/documents/documents/stats${
      searchParams.toString() ? `?${searchParams.toString()}` : ""
    }`;

    const headers = await getHeaders();
    const response = await fetch(url, {
      headers,
    });
    return handleResponse(response);
  },

  // Créer plusieurs documents en lot
  async createBulk(documents: CreateDocumentData[]): Promise<{
    success: number;
    errors: number;
    details: Array<{
      item: CreateDocumentData;
      success: boolean;
      data?: any;
      error?: string;
    }>;
  }> {
    const results = { success: 0, errors: 0, details: [] as any[] };

    for (const document of documents) {
      try {
        const result = await this.create(document);
        results.success++;
        results.details.push({ item: document, success: true, data: result });
      } catch (error: unknown) {
        results.errors++;
        results.details.push({ item: document, success: false, error: safeErrorMessage(error, "la création du document") });
      }
    }

    return results;
  },

  // Upload plusieurs fichiers en lot
  async uploadBulk(files: FileUploadData[]): Promise<{
    success: number;
    errors: number;
    details: Array<{
      item: FileUploadData;
      success: boolean;
      data?: any;
      error?: string;
    }>;
  }> {
    const results = { success: 0, errors: 0, details: [] as any[] };

    for (const file of files) {
      try {
        const result = await this.upload(file);
        results.success++;
        results.details.push({ item: file, success: true, data: result });
      } catch (error: unknown) {
        results.errors++;
        results.details.push({ item: file, success: false, error: safeErrorMessage(error, "l'upload du fichier") });
      }
    }

    return results;
  },
};
