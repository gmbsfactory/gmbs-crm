// ===== API DOCUMENTS/ATTACHMENTS COMPLÈTE =====
// Service API Supabase - Gestion des documents et attachments
// 
// FEATURES:
// - Upload et gestion des documents
// - Support pour interventions et artisans
// - Types de documents variés (devis, photos, factures, etc.)
// - Métadonnées complètes (taille, type MIME, etc.)
// - Validation des types de fichiers
// - Gestion des URLs et stockage

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

// Types de documents supportés
const SUPPORTED_DOCUMENT_TYPES = {
  intervention: [
    'devis',
    'photos',
    'facturesGMBS',
    'facturesArtisans',
    'facturesMateriel',
    'autre',
    'a_classe'
  ],
  artisan: [
    'kbis',
    'assurance',
    'cni_recto_verso',
    'iban',
    'decharge_partenariat',
    'photo_profil',
    'portfolio',
    'autre',
    'a_classe' // Documents non classifiés automatiquement
  ]
};

// Helper pour transformer les données et extraire avatar_url
function transformDocumentData(data: any): any {
  if (Array.isArray(data)) {
    return data.map(transformDocumentData);
  }
  if (data && typeof data === 'object') {
    const transformed = { ...data };
    
    // Extraire avatar_url de l'objet users et l'ajouter comme created_by_avatar_url
    let avatarUrl = null;
    
    if (transformed.users) {
      if (Array.isArray(transformed.users) && transformed.users.length > 0) {
        // Cas où users est un tableau (relation one-to-many, ne devrait pas arriver ici)
        avatarUrl = transformed.users[0]?.avatar_url || null;
      } else if (typeof transformed.users === 'object' && transformed.users !== null) {
        // Cas où users est un objet (relation one-to-one)
        avatarUrl = transformed.users.avatar_url || null;
      }
    }
    
    // Utiliser l'avatar_url extrait ou celui déjà présent
    transformed.created_by_avatar_url = avatarUrl || transformed.created_by_avatar_url || null;
    
    // Supprimer l'objet users pour éviter la duplication
    delete transformed.users;
    
    return transformed;
  }
  return data;
}

function normalizeInterventionKind(kind: string): string {
  if (!kind) return kind;

  const trimmed = kind.trim();
  if (!trimmed) return kind;

  const lower = trimmed.toLowerCase();
  const compact = lower.replace(/[_\s-]/g, '');

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

  const legacyToAutre = new Set([
    'rapportintervention',
    'plan',
    'schema',
    'intervention',
    'cout'
  ]);
  if (legacyToAutre.has(compact)) {
    return 'autre';
  }

  return trimmed;
}

// Types pour la validation
interface CreateAttachmentRequest {
  entity_id: string;
  entity_type: 'intervention' | 'artisan';
  kind: string;
  url: string;
  filename?: string;
  mime_type?: string;
  file_size?: number;
  metadata?: any;
  created_by?: string;
  created_by_display?: string;
  created_by_code?: string;
  created_by_color?: string;
}

interface UpdateAttachmentRequest {
  kind?: string;
  filename?: string;
  mime_type?: string;
  file_size?: number;
  metadata?: any;
  created_by?: string | null;
  created_by_display?: string | null;
  created_by_code?: string | null;
  created_by_color?: string | null;
}

interface UploadDocumentRequest {
  entity_id: string;
  entity_type: 'intervention' | 'artisan';
  kind: string;
  filename: string;
  mime_type: string;
  file_size: number;
  content: string; // Base64 encoded content
  created_by?: string;
  created_by_display?: string;
  created_by_code?: string;
  created_by_color?: string;
}

serve(async (req: Request) => {
  // Handle CORS preflight requests FIRST, before any other code
  // This MUST be the very first statement to ensure OPTIONS always returns 200
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      status: 200, 
      headers: corsHeaders 
    });
  }

  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  console.log(JSON.stringify({
    level: 'info',
    requestId,
    method: req.method,
    url: req.url,
    timestamp: new Date().toISOString(),
    message: 'Documents API request started'
  }));

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const url = new URL(req.url);
    const pathSegments = url.pathname.split('/').filter(segment => segment);
    
    // Parse path: /documents/documents/{id} ou /documents/upload
    // pathSegments pour Edge Function: ['documents', 'documents', '{id}'] ou ['documents', 'upload']
    const lastSegment = pathSegments[pathSegments.length - 1];
    const secondLastSegment = pathSegments[pathSegments.length - 2];
    
    // Déterminer resource et resourceId
    let resource: string;
    let resourceId: string | null;
    
    if (secondLastSegment === 'documents' && lastSegment !== 'documents' && lastSegment !== 'upload' && lastSegment !== 'types') {
      // URL de type /documents/documents/{id}
      resource = 'documents';
      resourceId = lastSegment;
    } else {
      // URL de type /documents/documents, /documents/upload ou /documents/types
      resource = lastSegment;
      resourceId = null;
    }

    // ===== GET /documents - Liste tous les documents =====
    if (req.method === 'GET' && resource === 'documents') {
      const entityType = url.searchParams.get('entity_type');
      const entityId = url.searchParams.get('entity_id');
      const kind = url.searchParams.get('kind');
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const offset = parseInt(url.searchParams.get('offset') || '0');

      let query = supabase
        .from('intervention_attachments')
        .select(`
          id,
          intervention_id,
          kind,
          url,
          filename,
          mime_type,
          file_size,
          created_at,
          created_by,
          created_by_display,
          created_by_code,
          created_by_color,
          users!created_by(id,avatar_url)
        `);

      // Si entity_type est spécifié, utiliser la table appropriée
      if (entityType === 'artisan') {
        query = supabase
          .from('artisan_attachments')
          .select(`
            id,
            artisan_id,
            kind,
            url,
            filename,
            mime_type,
            file_size,
            content_hash,
            derived_sizes,
            mime_preferred,
            created_at,
            created_by,
            created_by_display,
            created_by_code,
            created_by_color,
            users!created_by(id,avatar_url)
          `);
      }

      // Appliquer les filtres
      if (entityId) {
        if (entityType === 'artisan') {
          query = query.eq('artisan_id', entityId);
        } else {
          query = query.eq('intervention_id', entityId);
        }
      }
      if (kind) {
        query = query.eq('kind', kind);
      }

      // Appliquer pagination
      query = query.range(offset, offset + limit - 1);

      const { data, error } = await query;

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      const responseTime = Date.now() - startTime;
      
      // Debug: vérifier la structure des données avant transformation
      if (data && data.length > 0 && process.env.NODE_ENV === 'development') {
        console.log(JSON.stringify({
          level: 'debug',
          requestId,
          sampleData: {
            id: data[0].id,
            created_by: data[0].created_by,
            users: data[0].users,
            hasUsers: !!data[0].users,
            usersType: typeof data[0].users,
            isUsersArray: Array.isArray(data[0].users),
          },
          timestamp: new Date().toISOString(),
          message: 'Sample document data before transformation'
        }));
      }
      
      console.log(JSON.stringify({
        level: 'info',
        requestId,
        responseTime,
        dataCount: data?.length || 0,
        timestamp: new Date().toISOString(),
        message: 'Documents list retrieved successfully'
      }));

      // Transformer les données pour extraire avatar_url
      const transformedData = transformDocumentData(data);

      return new Response(
        JSON.stringify({
          data: transformedData || [],
          pagination: {
            limit,
            offset,
            total: transformedData?.length || 0,
            hasMore: (transformedData?.length || 0) === limit
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== GET /documents/{id} - Document par ID =====
    if (req.method === 'GET' && resourceId && resource === 'documents') {
      const entityType = url.searchParams.get('entity_type') || 'intervention';

      let query;
      if (entityType === 'artisan') {
        query = supabase
          .from('artisan_attachments')
          .select(`
            id,
            artisan_id,
            kind,
            url,
            filename,
            mime_type,
            file_size,
            created_at,
            created_by,
            created_by_display,
            created_by_code,
            created_by_color,
            users!created_by(avatar_url)
          `)
          .eq('id', resourceId)
          .single();
      } else {
        query = supabase
          .from('intervention_attachments')
          .select(`
            id,
            intervention_id,
            kind,
            url,
            filename,
            mime_type,
            file_size,
            created_at,
            created_by,
            created_by_display,
            created_by_code,
            created_by_color,
            users!created_by(avatar_url)
          `)
          .eq('id', resourceId)
          .single();
      }

      const { data, error } = await query;

      if (error) {
        return new Response(
          JSON.stringify({ error: 'Document not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify(data),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== POST /documents - Créer un document =====
    if (req.method === 'POST' && resource === 'documents') {
      const body: CreateAttachmentRequest = await req.json();

      // Validation des données requises
      if (!body.entity_id || !body.entity_type || !body.kind || !body.url) {
        return new Response(
          JSON.stringify({ error: 'entity_id, entity_type, kind, and url are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Validation du type de document
      const canonicalKind = body.entity_type === 'intervention'
        ? normalizeInterventionKind(body.kind)
        : body.kind;

      const allowedKinds = SUPPORTED_DOCUMENT_TYPES[body.entity_type];
      if (!allowedKinds.includes(canonicalKind)) {
        return new Response(
          JSON.stringify({ 
            error: `Invalid kind for ${body.entity_type}. Allowed: ${allowedKinds.join(', ')}` 
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Pour les artisans, supprimer l'ancienne photo_profil si on en crée une nouvelle
      if (body.entity_type === 'artisan' && canonicalKind === 'photo_profil') {
        const { error: deleteError } = await supabase
          .from('artisan_attachments')
          .delete()
          .eq('artisan_id', body.entity_id)
          .eq('kind', 'photo_profil');
        
        if (deleteError) {
          console.warn('Warning: Failed to delete old photo_profil:', deleteError);
          // Ne pas faire échouer la création si la suppression échoue
        }
      }

      let query;
      if (body.entity_type === 'artisan') {
        query = supabase
          .from('artisan_attachments')
          .insert([{
            artisan_id: body.entity_id,
            kind: canonicalKind,
            url: body.url,
            filename: body.filename,
            mime_type: body.mime_type,
            file_size: body.file_size,
            created_by: body.created_by,
            created_by_display: body.created_by_display,
            created_by_code: body.created_by_code,
            created_by_color: body.created_by_color
          }])
          .select()
          .single();
      } else {
        query = supabase
          .from('intervention_attachments')
          .insert([{
            intervention_id: body.entity_id,
            kind: canonicalKind,
            url: body.url,
            filename: body.filename,
            mime_type: body.mime_type,
            file_size: body.file_size,
            created_by: body.created_by,
            created_by_display: body.created_by_display,
            created_by_code: body.created_by_code,
            created_by_color: body.created_by_color
          }])
          .select()
          .single();
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Failed to create document: ${error.message}`);
      }

      console.log(JSON.stringify({
        level: 'info',
        requestId,
        documentId: data.id,
        entityType: body.entity_type,
        entityId: body.entity_id,
        kind: canonicalKind,
        createdByDisplay: body.created_by_display || null,
        timestamp: new Date().toISOString(),
        message: 'Document created successfully'
      }));

      // Pour les photos de profil d'artisan, appeler process-avatar en arrière-plan
      if (body.entity_type === 'artisan' && canonicalKind === 'photo_profil' && body.mime_type?.startsWith('image/')) {
        // Appeler process-avatar de manière asynchrone (ne pas bloquer la réponse)
        supabase.functions.invoke('process-avatar', {
          body: {
            artisan_id: body.entity_id,
            attachment_id: data.id,
            image_url: body.url,
            mime_type: body.mime_type
          }
        }).catch((error) => {
          console.error('Error invoking process-avatar:', error);
          // Ne pas faire échouer la création si process-avatar échoue
        });
      }

      return new Response(
        JSON.stringify(data),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== POST /documents/upload - Upload un document avec contenu =====
    if (req.method === 'POST' && resource === 'upload') {
      const body: UploadDocumentRequest = await req.json();

      // Validation des données requises
      if (!body.entity_id || !body.entity_type || !body.kind || !body.content) {
        return new Response(
          JSON.stringify({ error: 'entity_id, entity_type, kind, and content are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Validation du type de document
      const canonicalKind = body.entity_type === 'intervention'
        ? normalizeInterventionKind(body.kind)
        : body.kind;

      const allowedKinds = SUPPORTED_DOCUMENT_TYPES[body.entity_type];
      if (!allowedKinds.includes(canonicalKind)) {
        return new Response(
          JSON.stringify({ 
            error: `Invalid kind for ${body.entity_type}. Allowed: ${allowedKinds.join(', ')}` 
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Générer un nom de fichier unique
      const timestamp = Date.now();
      const extension = body.filename.split('.').pop() || 'bin';
      const uniqueFilename = `${body.entity_type}_${body.entity_id}_${canonicalKind}_${timestamp}.${extension}`;

      // Décoder le contenu base64 (data:image/png;base64,... -> buffer)
      let fileBuffer: Uint8Array;
      try {
        // Enlever le préfixe "data:..." si présent
        const base64Data = body.content.includes(',') 
          ? body.content.split(',')[1] 
          : body.content;
        
        // Décoder le base64 en buffer
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        fileBuffer = bytes;
      } catch (error) {
        return new Response(
          JSON.stringify({ error: 'Invalid base64 content' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Upload vers Supabase Storage
      const storagePath = `${body.entity_type}/${body.entity_id}/${uniqueFilename}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(storagePath, fileBuffer, {
          contentType: body.mime_type,
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('Storage upload error:', uploadError);
        return new Response(
          JSON.stringify({ error: `Failed to upload to storage: ${uploadError.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Obtenir l'URL publique du fichier uploadé
      const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(storagePath);

      // Remplacer l'URL interne Docker par l'URL accessible
      // kong:8000 -> 127.0.0.1:54321 (dev) ou variable d'environnement (prod)
      const storageUrl = publicUrl.replace(
        'http://kong:8000',
        Deno.env.get('SUPABASE_PUBLIC_URL') || 'http://127.0.0.1:54321'
      );

      // Pour les artisans, supprimer l'ancienne photo_profil si on en upload une nouvelle
      if (body.entity_type === 'artisan' && canonicalKind === 'photo_profil') {
        const { error: deleteError } = await supabase
          .from('artisan_attachments')
          .delete()
          .eq('artisan_id', body.entity_id)
          .eq('kind', 'photo_profil');
        
        if (deleteError) {
          console.warn('Warning: Failed to delete old photo_profil:', deleteError);
          // Ne pas faire échouer l'upload si la suppression échoue
        }
      }

      // Créer l'enregistrement en base
      let query;
      if (body.entity_type === 'artisan') {
        query = supabase
          .from('artisan_attachments')
          .insert([{
            artisan_id: body.entity_id,
            kind: canonicalKind,
            url: storageUrl,
            filename: body.filename,
            mime_type: body.mime_type,
            file_size: body.file_size,
            created_by: body.created_by,
            created_by_display: body.created_by_display,
            created_by_code: body.created_by_code,
            created_by_color: body.created_by_color
          }])
          .select()
          .single();
      } else {
        query = supabase
          .from('intervention_attachments')
          .insert([{
            intervention_id: body.entity_id,
            kind: canonicalKind,
            url: storageUrl,
            filename: body.filename,
            mime_type: body.mime_type,
            file_size: body.file_size,
            created_by: body.created_by,
            created_by_display: body.created_by_display,
            created_by_code: body.created_by_code,
            created_by_color: body.created_by_color
          }])
          .select()
          .single();
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Failed to upload document: ${error.message}`);
      }

      console.log(JSON.stringify({
        level: 'info',
        requestId,
        documentId: data.id,
        entityType: body.entity_type,
        entityId: body.entity_id,
        kind: canonicalKind,
        filename: body.filename,
        createdByDisplay: body.created_by_display || null,
        timestamp: new Date().toISOString(),
        message: 'Document uploaded successfully'
      }));

      // Pour les photos de profil d'artisan, appeler process-avatar en arrière-plan
      if (body.entity_type === 'artisan' && canonicalKind === 'photo_profil' && data.mime_type?.startsWith('image/')) {
        // Appeler process-avatar de manière asynchrone (ne pas bloquer la réponse)
        supabase.functions.invoke('process-avatar', {
          body: {
            artisan_id: body.entity_id,
            attachment_id: data.id,
            image_url: storageUrl,
            mime_type: body.mime_type
          }
        }).catch((error) => {
          console.error('Error invoking process-avatar:', error);
          // Ne pas faire échouer l'upload si process-avatar échoue
        });
      }

      return new Response(
        JSON.stringify({
          ...data,
          url: storageUrl
        }),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== PUT /documents/{id} - Modifier un document =====
    if (req.method === 'PUT' && resourceId && resource === 'documents') {
      const body: UpdateAttachmentRequest = await req.json();
      const entityType = url.searchParams.get('entity_type') || 'intervention';

      let query;
      if (entityType === 'artisan') {
        const payload: Record<string, any> = {};
        if (body.kind !== undefined) payload.kind = body.kind;
        if (body.filename !== undefined) payload.filename = body.filename;
        if (body.mime_type !== undefined) payload.mime_type = body.mime_type;
        if (body.file_size !== undefined) payload.file_size = body.file_size;
        if (body.created_by !== undefined) payload.created_by = body.created_by;
        if (body.created_by_display !== undefined) payload.created_by_display = body.created_by_display;
        if (body.created_by_code !== undefined) payload.created_by_code = body.created_by_code;
        if (body.created_by_color !== undefined) payload.created_by_color = body.created_by_color;

        query = supabase
          .from('artisan_attachments')
          .update(payload)
          .eq('id', resourceId)
          .select()
          .single();
      } else {
        const payload: Record<string, any> = {};
        if (body.kind !== undefined) {
          payload.kind = normalizeInterventionKind(body.kind);
        }
        if (body.filename !== undefined) payload.filename = body.filename;
        if (body.mime_type !== undefined) payload.mime_type = body.mime_type;
        if (body.file_size !== undefined) payload.file_size = body.file_size;
        if (body.created_by !== undefined) payload.created_by = body.created_by;
        if (body.created_by_display !== undefined) payload.created_by_display = body.created_by_display;
        if (body.created_by_code !== undefined) payload.created_by_code = body.created_by_code;
        if (body.created_by_color !== undefined) payload.created_by_color = body.created_by_color;

        query = supabase
          .from('intervention_attachments')
          .update(payload)
          .eq('id', resourceId)
          .select()
          .single();
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Failed to update document: ${error.message}`);
      }

      console.log(JSON.stringify({
        level: 'info',
        requestId,
        documentId: resourceId,
        timestamp: new Date().toISOString(),
        message: 'Document updated successfully'
      }));

      return new Response(
        JSON.stringify(data),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== DELETE /documents/{id} - Supprimer un document =====
    if (req.method === 'DELETE' && resourceId && resource === 'documents') {
      const entityType = url.searchParams.get('entity_type') || 'intervention';

      // D'abord récupérer le document pour avoir l'URL du fichier
      let getQuery;
      if (entityType === 'artisan') {
        getQuery = supabase
          .from('artisan_attachments')
          .select('url')
          .eq('id', resourceId)
          .single();
      } else {
        getQuery = supabase
          .from('intervention_attachments')
          .select('url')
          .eq('id', resourceId)
          .single();
      }

      const { data: docData, error: getError } = await getQuery;
      
      if (getError) {
        throw new Error(`Failed to find document: ${getError.message}`);
      }

      // Extraire le chemin du fichier depuis l'URL
      // URL format: http://127.0.0.1:54321/storage/v1/object/public/documents/{path}
      if (docData?.url) {
        const urlParts = docData.url.split('/documents/');
        if (urlParts.length === 2) {
          const filePath = urlParts[1];
          
          // Supprimer le fichier du Storage
          const { error: storageError } = await supabase.storage
            .from('documents')
            .remove([filePath]);
          
          if (storageError) {
            console.warn('Failed to delete file from storage:', storageError);
            // Ne pas bloquer la suppression DB si le fichier n'existe pas dans Storage
          }
        }
      }

      // Supprimer l'enregistrement de la base de données
      let query;
      if (entityType === 'artisan') {
        query = supabase
          .from('artisan_attachments')
          .delete()
          .eq('id', resourceId)
          .select()
          .single();
      } else {
        query = supabase
          .from('intervention_attachments')
          .delete()
          .eq('id', resourceId)
          .select()
          .single();
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Failed to delete document: ${error.message}`);
      }

      console.log(JSON.stringify({
        level: 'info',
        requestId,
        documentId: resourceId,
        timestamp: new Date().toISOString(),
        message: 'Document deleted successfully (DB + Storage)'
      }));

      return new Response(
        JSON.stringify({ message: 'Document deleted successfully', data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== GET /documents/types - Obtenir les types de documents supportés =====
    if (req.method === 'GET' && resource === 'types') {
      return new Response(
        JSON.stringify({
          supported_types: SUPPORTED_DOCUMENT_TYPES,
          max_file_size: '10MB',
          allowed_mime_types: [
            'image/jpeg',
            'image/png',
            'image/gif',
            'image/heic',
            'image/heif',
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/zip',
            'video/mp4',
            'text/plain'
          ]
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    console.log(JSON.stringify({
      level: 'error',
      requestId,
      responseTime,
      error: error.message,
      timestamp: new Date().toISOString(),
      message: 'Documents API request failed'
    }));

    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
