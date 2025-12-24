// ===== API COMMENTAIRES COMPLÈTE =====
// Service API Supabase - Gestion des commentaires
// 
// FEATURES:
// - Commentaires sur interventions et artisans
// - Types de commentaires (général, technique, interne, etc.)
// - Gestion des auteurs et timestamps
// - Pagination et filtrage
// - Validation des données

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

// Types de commentaires supportés (alignés avec la contrainte de la DB)
const COMMENT_TYPES = [
  'internal',
  'external', 
  'system'
];

const REASON_TYPES = ['archive', 'done'] as const;

// Types pour la validation
interface CreateCommentRequest {
  entity_id: string;
  entity_type: 'intervention' | 'artisan' | 'client';
  content: string;
  comment_type?: string;
  is_internal?: boolean;
  author_id?: string;
  reason_type?: typeof REASON_TYPES[number] | null;
}

interface UpdateCommentRequest {
  content?: string;
  comment_type?: string;
  is_internal?: boolean;
  reason_type?: typeof REASON_TYPES[number] | null;
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
    message: 'Comments API request started'
  }));

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const url = new URL(req.url);
    const pathSegments = url.pathname.split('/').filter(Boolean);

    const functionNameIndex = pathSegments.findIndex((segment) => segment === 'comments');
    const routeSegments = functionNameIndex >= 0 ? pathSegments.slice(functionNameIndex + 1) : [];

    const primarySegment = routeSegments[0] ?? 'comments';
    const secondarySegment = routeSegments[1] ?? null;
    const tertiarySegment = routeSegments[2] ?? null;

    const resource = primarySegment;
    const resourceId =
      secondarySegment && !['types', 'stats', 'search', 'recent'].includes(secondarySegment)
        ? secondarySegment
        : null;
    const subResource = resourceId ? tertiarySegment : secondarySegment;

    // ===== GET /comments - Liste tous les commentaires =====
    if (req.method === 'GET' && resource === 'comments' && !resourceId && !subResource) {
      const entityType = url.searchParams.get('entity_type');
      const entityId = url.searchParams.get('entity_id');
      const commentType = url.searchParams.get('comment_type');
      const isInternal = url.searchParams.get('is_internal');
      const authorId = url.searchParams.get('author_id');
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const offset = parseInt(url.searchParams.get('offset') || '0');

      let query = supabase
        .from('comments')
        .select(`
          id,
          entity_id,
          entity_type,
          content,
          comment_type,
          is_internal,
          author_id,
          reason_type,
          created_at,
          updated_at,
          users!author_id(id,firstname,lastname,username,color,avatar_url)
        `)
        .order('created_at', { ascending: false });

      // Appliquer les filtres
      if (entityType) {
        query = query.eq('entity_type', entityType);
      }
      if (entityId) {
        query = query.eq('entity_id', entityId);
      }
      if (commentType) {
        query = query.eq('comment_type', commentType);
      }
      if (isInternal !== null) {
        query = query.eq('is_internal', isInternal === 'true');
      }
      if (authorId) {
        query = query.eq('author_id', authorId);
      }

      // Appliquer pagination
      query = query.range(offset, offset + limit - 1);

      const { data, error } = await query;

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      const responseTime = Date.now() - startTime;
      
      console.log(JSON.stringify({
        level: 'info',
        requestId,
        responseTime,
        dataCount: data?.length || 0,
        timestamp: new Date().toISOString(),
        message: 'Comments list retrieved successfully'
      }));

      return new Response(
        JSON.stringify({
          data: data || [],
          pagination: {
            limit,
            offset,
            total: data?.length || 0,
            hasMore: (data?.length || 0) === limit
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== GET /comments/{id} - Commentaire par ID =====
    if (req.method === 'GET' && resourceId && resource === 'comments') {
      const { data, error } = await supabase
        .from('comments')
        .select(`
          id,
          entity_id,
          entity_type,
          content,
          comment_type,
          is_internal,
          author_id,
          reason_type,
          created_at,
          updated_at,
          users!author_id(id,firstname,lastname,username,color,avatar_url)
        `)
        .eq('id', resourceId)
        .single();

      if (error) {
        return new Response(
          JSON.stringify({ error: 'Comment not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify(data),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== POST /comments - Créer un commentaire =====
    if (req.method === 'POST' && resource === 'comments' && !resourceId && !subResource) {
      const body: CreateCommentRequest = await req.json();

      // Validation des données requises
      if (!body.entity_id || !body.entity_type || !body.content) {
        return new Response(
          JSON.stringify({ error: 'entity_id, entity_type, and content are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Validation du type de commentaire
      if (body.comment_type && !COMMENT_TYPES.includes(body.comment_type)) {
        return new Response(
          JSON.stringify({ 
            error: `Invalid comment_type. Allowed: ${COMMENT_TYPES.join(', ')}` 
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (body.reason_type && !REASON_TYPES.includes(body.reason_type)) {
        return new Response(
          JSON.stringify({
            error: `Invalid reason_type. Allowed: ${REASON_TYPES.join(', ')}`
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data, error } = await supabase
        .from('comments')
        .insert([{
          entity_id: body.entity_id,
          entity_type: body.entity_type,
          content: body.content,
          comment_type: body.comment_type || 'internal',
          is_internal: body.is_internal ?? true,
          author_id: body.author_id,
          reason_type: body.reason_type ?? null
        }])
        .select(`
          id,
          entity_id,
          entity_type,
          content,
          comment_type,
          is_internal,
          author_id,
          reason_type,
          created_at,
          updated_at,
          users!author_id(id,firstname,lastname,username,color,avatar_url)
        `)
        .single();

      if (error) {
        throw new Error(`Failed to create comment: ${error.message}`);
      }

      console.log(JSON.stringify({
        level: 'info',
        requestId,
        commentId: data.id,
        entityType: body.entity_type,
        entityId: body.entity_id,
        commentType: body.comment_type,
        timestamp: new Date().toISOString(),
        message: 'Comment created successfully'
      }));

      return new Response(
        JSON.stringify(data),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== PUT /comments/{id} - Modifier un commentaire =====
    if (req.method === 'PUT' && resource === 'comments' && resourceId) {
      const body: UpdateCommentRequest = await req.json();

      // Validation du type de commentaire
      if (body.comment_type && !COMMENT_TYPES.includes(body.comment_type)) {
        return new Response(
          JSON.stringify({ 
            error: `Invalid comment_type. Allowed: ${COMMENT_TYPES.join(', ')}` 
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (body.reason_type && !REASON_TYPES.includes(body.reason_type)) {
        return new Response(
          JSON.stringify({
            error: `Invalid reason_type. Allowed: ${REASON_TYPES.join(', ')}`
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data, error } = await supabase
        .from('comments')
        .update({
          content: body.content,
          comment_type: body.comment_type,
          is_internal: body.is_internal,
          reason_type: body.reason_type ?? null,
          updated_at: new Date().toISOString()
        })
        .eq('id', resourceId)
        .select(`
          id,
          entity_id,
          entity_type,
          content,
          comment_type,
          is_internal,
          author_id,
          reason_type,
          created_at,
          updated_at,
          users!author_id(id,firstname,lastname,username,color,avatar_url)
        `)
        .single();

      if (error) {
        throw new Error(`Failed to update comment: ${error.message}`);
      }

      console.log(JSON.stringify({
        level: 'info',
        requestId,
        commentId: resourceId,
        timestamp: new Date().toISOString(),
        message: 'Comment updated successfully'
      }));

      return new Response(
        JSON.stringify(data),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== DELETE /comments/{id} - Supprimer un commentaire =====
    if (req.method === 'DELETE' && resource === 'comments' && resourceId) {
      const { data, error } = await supabase
        .from('comments')
        .delete()
        .eq('id', resourceId)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to delete comment: ${error.message}`);
      }

      console.log(JSON.stringify({
        level: 'info',
        requestId,
        commentId: resourceId,
        timestamp: new Date().toISOString(),
        message: 'Comment deleted successfully'
      }));

      return new Response(
        JSON.stringify({ message: 'Comment deleted successfully', data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== GET /comments/types - Obtenir les types de commentaires supportés =====
    if (req.method === 'GET' && resource === 'comments' && subResource === 'types') {
      return new Response(
        JSON.stringify({
          comment_types: COMMENT_TYPES,
          entity_types: ['intervention', 'artisan', 'client'],
          default_type: 'internal',
          internal_default: true
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== GET /comments/stats - Statistiques des commentaires =====
    if (req.method === 'GET' && resource === 'comments' && subResource === 'stats') {
      const entityType = url.searchParams.get('entity_type');
      const entityId = url.searchParams.get('entity_id');

      let query = supabase
        .from('comments')
        .select('comment_type, is_internal, created_at');

      if (entityType) {
        query = query.eq('entity_type', entityType);
      }
      if (entityId) {
        query = query.eq('entity_id', entityId);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Failed to get comment stats: ${error.message}`);
      }

      // Calculer les statistiques
      const stats = {
        total: data?.length || 0,
        by_type: {} as Record<string, number>,
        by_internal: { internal: 0, external: 0 },
        recent_count: 0
      };

      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      data?.forEach(comment => {
        // Par type
        const type = comment.comment_type || 'general';
        stats.by_type[type] = (stats.by_type[type] || 0) + 1;

        // Par interne/externe
        if (comment.is_internal) {
          stats.by_internal.internal++;
        } else {
          stats.by_internal.external++;
        }

        // Récent
        if (new Date(comment.created_at) > oneWeekAgo) {
          stats.recent_count++;
        }
      });

      return new Response(
        JSON.stringify(stats),
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
      message: 'Comments API request failed'
    }));

    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
