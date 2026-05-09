// ===== API INTERVENTIONS COMPLÈTE ET SCALABLE =====
// Service API Supabase - CRUD complet pour les interventions
// 
// FEATURES:
// - CRUD complet (Create, Read, Update, Delete)
// - Assignation d'artisans par gestionnaire
// - Gestion des commentaires
// - Gestion des documents/attachments
// - Gestion des coûts et paiements
// - Pagination optimisée
// - Validation des données
// - Gestion d'erreurs robuste

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';
import { getAuthUserId } from '../_shared/auth.ts';
import type {
  AssignArtisanRequest,
  CreateAttachmentRequest,
  CreateCommentRequest,
  CreateCostRequest,
  CreateInterventionRequest,
  CreatePaymentRequest,
  FilterParams,
  UpdateInterventionRequest,
} from './_lib/types.ts';
import {
  applyFilters,
  applySort,
  getCachedCount,
  INTERVENTION_ATTACHMENT_KINDS,
  normalizeInterventionAttachmentKind,
  parseListParam,
  parseSortParams,
} from './_lib/helpers.ts';
import {
  createAutomaticStatusTransitions,
  handleInterventionCompletionSideEffects,
} from './_lib/side-effects.ts';
import { handleListInterventions } from './_lib/list-handler.ts';

serve(async (req: Request) => {
  const corsHeaders = {
    ...getCorsHeaders(req),
    'Access-Control-Max-Age': '86400',
    'Cache-Control': 'no-store, no-cache, must-revalidate',
  };

  // Handle CORS preflight requests FIRST, before any other code
  // This MUST be the very first statement to ensure OPTIONS always returns 200
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      status: 200,
      headers: corsHeaders
    });
  }

  const startTime = Date.now();
  let requestId: string | undefined;

  try {
    requestId = crypto.randomUUID();

    console.log(JSON.stringify({
      level: 'info',
      requestId,
      method: req.method,
      url: req.url,
      timestamp: new Date().toISOString(),
      message: 'Interventions API request started'
    }));
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    const authUserId = await getAuthUserId(req, supabase);

    const url = new URL(req.url);
    const pathSegments = url.pathname.split('/').filter(segment => segment);

    // Parsing plus robuste pour gérer les sous-ressources
    let resource = pathSegments[pathSegments.length - 1];
    let resourceId: string | null = null;
    let subResource: string | null = null;

    // Pour /interventions-v2/interventions/{id}/artisans
    if (pathSegments.length >= 4 && pathSegments[pathSegments.length - 3] === 'interventions') {
      resourceId = pathSegments[pathSegments.length - 2];
      resource = pathSegments[pathSegments.length - 1];
    }
    // Pour /interventions-v2/interventions/light ou /interventions-v2/interventions/summary
    // Vérifier AVANT les IDs pour éviter de confondre 'light' ou 'summary' avec un ID
    else if (pathSegments.length >= 3 && pathSegments[pathSegments.length - 2] === 'interventions') {
      const lastSegment = pathSegments[pathSegments.length - 1];
      if (lastSegment === 'light' || lastSegment === 'summary') {
        resource = 'interventions';
        subResource = lastSegment;
      } else {
        // Sinon c'est probablement un ID
        resourceId = lastSegment;
        resource = 'interventions';
      }
    }
    // Pour /interventions-v2/interventions
    else if (pathSegments.length >= 2 && pathSegments[pathSegments.length - 1] === 'interventions') {
      resource = 'interventions';
    }

    // ===== GET /interventions/light - Liste légère pour warm-up =====
    if (req.method === 'GET' && resource === 'interventions' && subResource === 'light') {
      const rawLimit = Number.parseInt(url.searchParams.get('limit') ?? '100', 10);
      const clampedLimit = Math.max(1, Math.min(Number.isFinite(rawLimit) ? rawLimit : 100, 50000));
      const rawOffset = Number.parseInt(url.searchParams.get('offset') ?? '0', 10);
      const clampedOffset = Math.max(0, Number.isFinite(rawOffset) ? rawOffset : 0);

      const statutFilters = parseListParam(url.searchParams.getAll('statut'));
      const agenceFilters = parseListParam(url.searchParams.getAll('agence'));
      const metierFilters = parseListParam(url.searchParams.getAll('metier'));

      const userValues = url.searchParams.getAll('user');
      const userIds = parseListParam(
        userValues.filter((value) => value !== 'null' && value !== '__null__' && value !== 'undefined'),
      );
      const userIsNull = userValues.some((value) => value === 'null' || value === '__null__');

      const searchRaw = url.searchParams.get('search')?.trim() ?? null;
      const startDateRaw = url.searchParams.get('startDate')?.trim() ?? null;
      const endDateRaw = url.searchParams.get('endDate')?.trim() ?? null;
      const isCheckRaw = url.searchParams.get('isCheck')?.trim() ?? null;

      const filters: FilterParams = {
        search: searchRaw && searchRaw.length > 0 ? searchRaw : null,
        startDate: startDateRaw && startDateRaw.length > 0 ? startDateRaw : null,
        endDate: endDateRaw && endDateRaw.length > 0 ? endDateRaw : null,
      };

      if (isCheckRaw === 'true') {
        filters.isCheck = true;
      } else if (isCheckRaw === 'false') {
        filters.isCheck = false;
      }

      if (statutFilters.length > 0) {
        filters.statut = statutFilters;
      }
      if (agenceFilters.length > 0) {
        filters.agence = agenceFilters;
      }
      if (metierFilters.length > 0) {
        filters.metier = metierFilters;
      }
      if (userIds.length > 0) {
        filters.user = userIds;
      } else if (userIsNull) {
        filters.userIsNull = true;
      }

      // Sélection minimale pour le warm-up : uniquement les champs essentiels
      const lightSelect = 'id,id_inter,statut_id,date,date_prevue,agence_id,assigned_user_id,updated_by,metier_id,created_at,updated_at';

      const { sortBy: lightSortBy, sortDir: lightSortDir } = parseSortParams(url);

      let query = supabase
        .from('interventions')
        .select(lightSelect, { count: 'exact' })
        .eq('is_active', true);

      query = applySort(query, lightSortBy, lightSortDir);
      query = applyFilters(query, filters);
      query = query.range(clampedOffset, clampedOffset + clampedLimit - 1);

      const fetchStart = Date.now();
      const { data, error, count } = await query;
      const fetchDuration = Date.now() - fetchStart;

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      const filteredData = Array.isArray(data) ? data : [];
      const totalCount = count ?? await getCachedCount(supabase, filters);

      console.log(
        JSON.stringify({
          level: 'info',
          requestId,
          endpoint: 'light',
          responseTime: fetchDuration,
          dataCount: filteredData.length,
          totalCount,
          offset: clampedOffset,
          limit: clampedLimit,
          timestamp: new Date().toISOString(),
          message: 'Light interventions retrieved successfully',
        }),
      );

      return new Response(
        JSON.stringify({
          data: filteredData,
          pagination: {
            total: totalCount,
            limit: clampedLimit,
            offset: clampedOffset,
            hasMore: clampedOffset + clampedLimit < totalCount,
          },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ===== GET /interventions/summary - Résumé par vue =====
    if (req.method === 'GET' && resource === 'interventions' && subResource === 'summary') {
      const statutFilters = parseListParam(url.searchParams.getAll('statut'));
      const agenceFilters = parseListParam(url.searchParams.getAll('agence'));
      const metierFilters = parseListParam(url.searchParams.getAll('metier'));

      const userValues = url.searchParams.getAll('user');
      const userIds = parseListParam(
        userValues.filter((value) => value !== 'null' && value !== '__null__' && value !== 'undefined'),
      );
      const userIsNull = userValues.some((value) => value === 'null' || value === '__null__');

      const searchRaw = url.searchParams.get('search')?.trim() ?? null;
      const startDateRaw = url.searchParams.get('startDate')?.trim() ?? null;
      const endDateRaw = url.searchParams.get('endDate')?.trim() ?? null;
      const isCheckRaw = url.searchParams.get('isCheck')?.trim() ?? null;

      const filters: FilterParams = {
        search: searchRaw && searchRaw.length > 0 ? searchRaw : null,
        startDate: startDateRaw && startDateRaw.length > 0 ? startDateRaw : null,
        endDate: endDateRaw && endDateRaw.length > 0 ? endDateRaw : null,
      };

      if (isCheckRaw === 'true') {
        filters.isCheck = true;
      } else if (isCheckRaw === 'false') {
        filters.isCheck = false;
      }

      if (statutFilters.length > 0) {
        filters.statut = statutFilters;
      }
      if (agenceFilters.length > 0) {
        filters.agence = agenceFilters;
      }
      if (metierFilters.length > 0) {
        filters.metier = metierFilters;
      }
      if (userIds.length > 0) {
        filters.user = userIds;
      } else if (userIsNull) {
        filters.userIsNull = true;
      }

      // Obtenir le total avec cache
      const totalCount = await getCachedCount(supabase, filters);

      // Obtenir les compteurs par statut si aucun filtre de statut n'est appliqué
      let countsByStatus: Record<string, number> = {};
      if (!filters.statut || filters.statut.length === 0) {
        // Construire une requête avec les mêmes filtres mais sans filtre de statut
        let countQuery = supabase
          .from('interventions')
          .select('statut_id', { count: 'exact' })
          .eq('is_active', true);

        // Appliquer les autres filtres (agence, metier, user, dates, search)
        const filtersWithoutStatut: FilterParams = { ...filters };
        delete filtersWithoutStatut.statut;
        countQuery = applyFilters(countQuery, filtersWithoutStatut);

        const { data: interventions, error: statusError } = await countQuery;

        if (!statusError && interventions) {
          // Compter par statut
          const statusMap = new Map<string, number>();
          for (const item of interventions) {
            const statusId = item.statut_id;
            if (statusId) {
              statusMap.set(statusId, (statusMap.get(statusId) || 0) + 1);
            }
          }
          countsByStatus = Object.fromEntries(statusMap);
        }
      }

      console.log(
        JSON.stringify({
          level: 'info',
          requestId,
          endpoint: 'summary',
          totalCount,
          countsByStatus,
          timestamp: new Date().toISOString(),
          message: 'Interventions summary retrieved successfully',
        }),
      );

      return new Response(
        JSON.stringify({
          total: totalCount,
          countsByStatus,
          filters: {
            statut: filters.statut || [],
            agence: filters.agence || [],
            metier: filters.metier || [],
            user: filters.user || [],
            userIsNull: filters.userIsNull || false,
            startDate: filters.startDate || null,
            endDate: filters.endDate || null,
            search: filters.search || null,
          },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ===== GET /interventions - Liste paginée (handler extrait) =====
    if (req.method === 'GET' && resource === 'interventions') {
      return await handleListInterventions(req, url, corsHeaders, supabase, requestId);
    }

    // ===== GET /interventions/{id} - Intervention par ID =====
    if (req.method === 'GET' && resourceId && resource === 'interventions') {
      const includeRelations = url.searchParams.get('include')?.split(',') || [];

      const { data, error } = await supabase
        .from('interventions')
        .select(`
          id,
          id_inter,
          agence_id,
          tenant_id,
          owner_id,
          assigned_user_id,
          updated_by,
          statut_id,
          metier_id,
          date,
          date_termine,
          date_prevue,
          due_date,
          contexte_intervention,
          consigne_intervention,
          consigne_second_artisan,
          commentaire_agent,
          adresse,
          code_postal,
          ville,
          latitude,
          longitude,
          is_active,
          created_at,
          updated_at
          ${includeRelations.includes('agencies') ? ',agencies(id,label,code)' : ''}
          ${includeRelations.includes('tenants') || includeRelations.includes('clients')
            ? ',tenants:tenant_id(id,firstname,lastname,plain_nom_client,email,telephone,telephone2)'
            : ''
          }
          ${includeRelations.includes('users') ? ',users!assigned_user_id(id,firstname,lastname,username)' : ''}
          ${includeRelations.includes('statuses') ? ',intervention_statuses(id,code,label,color)' : ''}
          ${includeRelations.includes('metiers') ? ',metiers(id,label,code)' : ''}
          ${includeRelations.includes('artisans') ? ',intervention_artisans(artisan_id,role,is_primary,artisans(id,prenom,nom,telephone,email))' : ''}
          ${includeRelations.includes('costs') ? ',intervention_costs(id,cost_type,label,amount,currency,created_at)' : ''}
          ${includeRelations.includes('payments') ? ',intervention_payments(id,payment_type,amount,is_received,payment_date,reference)' : ''}
          ${includeRelations.includes('attachments') ? ',intervention_attachments(id,kind,url,filename,mime_type,file_size)' : ''}
          ${includeRelations.includes('comments') ? ',comments(id,content,comment_type,is_internal,created_at,users!author_id(firstname,lastname))' : ''}
          ${includeRelations.includes('owner') ? ',owner:owner_id(id,owner_firstname,owner_lastname,plain_nom_facturation,email,telephone)' : ''}
        `)
        .eq('id', resourceId)
        .single();

      if (error) {
        return new Response(
          JSON.stringify({ error: 'Intervention not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify(data),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== POST /interventions/upsert - Upsert une intervention =====
    if (req.method === 'POST' && resource === 'interventions' && resourceId === 'upsert') {
      const body: CreateInterventionRequest = await req.json();

      // Validation des données requises
      if (!body.date) {
        return new Response(
          JSON.stringify({ error: 'Date is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Si id_inter est fourni, chercher l'intervention existante
      if (body.id_inter) {
        const { data: existing, error: findError } = await supabase
          .from('interventions')
          .select('id, statut_id')
          .eq('id_inter', body.id_inter)
          .single();

        if (findError && findError.code !== 'PGRST116') { // PGRST116 = not found
          throw new Error(`Failed to search intervention: ${findError.message}`);
        }

        if (existing) {
          // Mettre à jour l'intervention existante
          const { data, error } = await supabase
            .from('interventions')
            .update({
              agence_id: body.agence_id,
              reference_agence: body.reference_agence ?? null,
              tenant_id: body.tenant_id ?? body.client_id ?? null,
              owner_id: body.owner_id ?? null,
              assigned_user_id: body.assigned_user_id,
              statut_id: body.statut_id,
              metier_id: body.metier_id,
              date: body.date,
              date_prevue: body.date_prevue,
              contexte_intervention: body.contexte_intervention,
              consigne_intervention: body.consigne_intervention,
              consigne_second_artisan: body.consigne_second_artisan,
              adresse: body.adresse,
              code_postal: body.code_postal,
              ville: body.ville,
              latitude: body.latitude,
              longitude: body.longitude,
              is_vacant: body.is_vacant ?? false,
              key_code: body.key_code ?? null,
              floor: body.floor ?? null,
              apartment_number: body.apartment_number ?? null,
              vacant_housing_instructions: body.vacant_housing_instructions ?? null,
              sous_statut_text: body.sous_statut_text ?? null,
              sous_statut_text_color: body.sous_statut_text_color ?? '#000000',
              sous_statut_bg_color: body.sous_statut_bg_color ?? 'transparent',
              metier_second_artisan_id: body.metier_second_artisan_id ?? null,
              updated_at: new Date().toISOString(),
              ...(authUserId ? { updated_by: authUserId } : {}),
            })
            .eq('id', existing.id)
            .select()
            .single();

          if (error) {
            throw new Error(`Failed to update intervention: ${error.message}`);
          }

          console.log(JSON.stringify({
            level: 'info',
            requestId,
            interventionId: data.id,
            idInter: data.id_inter,
            timestamp: new Date().toISOString(),
            message: 'Intervention updated via upsert'
          }));

          // Passer l'ancien statut pour gérer le downgrade
          const oldStatutIdUpsert = existing.statut_id || null;
          await handleInterventionCompletionSideEffects(supabase, data, requestId, oldStatutIdUpsert);

          return new Response(
            JSON.stringify(data),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Créer une nouvelle intervention
      const { data, error } = await supabase
        .from('interventions')
        .insert([{
          id_inter: body.id_inter,
          agence_id: body.agence_id,
          reference_agence: body.reference_agence ?? null,
          tenant_id: body.tenant_id ?? body.client_id ?? null,
          owner_id: body.owner_id ?? null,
          assigned_user_id: body.assigned_user_id,
          statut_id: body.statut_id,
          metier_id: body.metier_id,
          date: body.date,
          date_prevue: body.date_prevue,
          contexte_intervention: body.contexte_intervention,
          consigne_intervention: body.consigne_intervention,
          consigne_second_artisan: body.consigne_second_artisan,
          adresse: body.adresse,
          code_postal: body.code_postal,
          ville: body.ville,
          latitude: body.latitude,
          longitude: body.longitude,
          is_vacant: body.is_vacant ?? false,
          key_code: body.key_code ?? null,
          floor: body.floor ?? null,
          apartment_number: body.apartment_number ?? null,
          vacant_housing_instructions: body.vacant_housing_instructions ?? null,
          sous_statut_text: body.sous_statut_text ?? null,
          sous_statut_text_color: body.sous_statut_text_color ?? '#000000',
          sous_statut_bg_color: body.sous_statut_bg_color ?? 'transparent',
          metier_second_artisan_id: body.metier_second_artisan_id ?? null,
          is_active: true,
          ...(authUserId ? { created_by: authUserId, updated_by: authUserId } : {}),
        }])
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create intervention: ${error.message}`);
      }

      // Créer les transitions automatiques si un statut est défini
      await createAutomaticStatusTransitions(supabase, data.id, data.statut_id, authUserId, requestId);

      console.log(JSON.stringify({
        level: 'info',
        requestId,
        interventionId: data.id,
        idInter: data.id_inter,
        timestamp: new Date().toISOString(),
        message: 'Intervention created via upsert'
      }));

      await handleInterventionCompletionSideEffects(supabase, data, requestId);

      return new Response(
        JSON.stringify(data),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== POST /interventions - Créer une intervention =====
    if (req.method === 'POST' && resource === 'interventions') {
      const body: CreateInterventionRequest = await req.json();

      // Validation des données requises
      if (!body.date) {
        return new Response(
          JSON.stringify({ error: 'Date is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Fonction helper pour générer un nouvel id_inter en cas de collision
      const generateUniqueIdInter = async (baseIdInter: string | null | undefined): Promise<string | null> => {
        if (!baseIdInter) return null;

        // Si ce n'est pas un ID auto-généré, retourner tel quel (sera vérifié plus tard)
        if (!baseIdInter.startsWith('AUTO-')) {
          return baseIdInter;
        }

        // Pour les IDs auto-générés, vérifier l'unicité et générer un nouveau si nécessaire
        let attemptIdInter = baseIdInter;
        let attempts = 0;
        const maxAttempts = 5;

        while (attempts < maxAttempts) {
          const { data: existing } = await supabase
            .from('interventions')
            .select('id')
            .eq('id_inter', attemptIdInter)
            .maybeSingle();

          if (!existing) {
            // ID unique trouvé
            return attemptIdInter;
          }

          // Collision détectée, générer un nouvel ID
          attempts++;
          const timestampSegment = Date.now().toString().slice(-6);
          const randomSegment = Math.floor(Math.random() * 100000)
            .toString()
            .padStart(5, '0');
          const uuidSegment = crypto.randomUUID().slice(0, 8);
          attemptIdInter = `AUTO-${timestampSegment}-${randomSegment}-${uuidSegment}`;
        }

        // Si après plusieurs tentatives on a toujours une collision, retourner null
        // La base de données générera une erreur et on la gérera
        return attemptIdInter;
      };

      // Vérifier si id_inter existe déjà (sauf pour les IDs auto-générés qui seront régénérés)
      let finalIdInter = body.id_inter;
      if (finalIdInter && !finalIdInter.startsWith('AUTO-')) {
        const { data: existing, error: checkError } = await supabase
          .from('interventions')
          .select('id')
          .eq('id_inter', finalIdInter)
          .maybeSingle();

        if (checkError && checkError.code !== 'PGRST116') {
          throw new Error(`Failed to check id_inter uniqueness: ${checkError.message}`);
        }

        if (existing) {
          return new Response(
            JSON.stringify({ error: `An intervention with id_inter "${finalIdInter}" already exists` }),
            { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } else if (finalIdInter && finalIdInter.startsWith('AUTO-')) {
        // Pour les IDs auto-générés, s'assurer de l'unicité
        finalIdInter = await generateUniqueIdInter(finalIdInter) ?? finalIdInter;
      }

      const { data, error } = await supabase
        .from('interventions')
        .insert([{
          id_inter: finalIdInter,
          agence_id: body.agence_id,
          reference_agence: body.reference_agence ?? null,
          tenant_id: body.tenant_id ?? body.client_id ?? null,
          owner_id: body.owner_id ?? null,
          assigned_user_id: body.assigned_user_id,
          statut_id: body.statut_id,
          metier_id: body.metier_id,
          date: body.date,
          date_prevue: body.date_prevue,
          contexte_intervention: body.contexte_intervention,
          consigne_intervention: body.consigne_intervention,
          consigne_second_artisan: body.consigne_second_artisan,
          adresse: body.adresse,
          code_postal: body.code_postal,
          ville: body.ville,
          latitude: body.latitude,
          longitude: body.longitude,
          is_vacant: body.is_vacant ?? false,
          key_code: body.key_code ?? null,
          floor: body.floor ?? null,
          apartment_number: body.apartment_number ?? null,
          vacant_housing_instructions: body.vacant_housing_instructions ?? null,
          sous_statut_text: body.sous_statut_text ?? null,
          sous_statut_text_color: body.sous_statut_text_color ?? '#000000',
          sous_statut_bg_color: body.sous_statut_bg_color ?? 'transparent',
          metier_second_artisan_id: body.metier_second_artisan_id ?? null,
          is_active: true,
          ...(authUserId ? { created_by: authUserId, updated_by: authUserId } : {}),
        }])
        .select()
        .single();

      if (error) {
        // Si l'erreur est une violation de contrainte unique sur id_inter, essayer avec un nouvel ID
        if (error.message?.includes('duplicate key') && error.message?.includes('id_inter') && finalIdInter?.startsWith('AUTO-')) {
          console.log(JSON.stringify({
            level: 'warn',
            requestId,
            originalIdInter: finalIdInter,
            message: 'Duplicate id_inter detected, generating new one'
          }));

          // Générer un nouvel ID unique
          const newIdInter = await generateUniqueIdInter(finalIdInter);
          if (newIdInter && newIdInter !== finalIdInter) {
            // Réessayer avec le nouvel ID
            const { data: retryData, error: retryError } = await supabase
              .from('interventions')
              .insert([{
                id_inter: newIdInter,
                agence_id: body.agence_id,
                reference_agence: body.reference_agence ?? null,
                tenant_id: body.tenant_id ?? body.client_id ?? null,
                owner_id: body.owner_id ?? null,
                assigned_user_id: body.assigned_user_id,
                statut_id: body.statut_id,
                metier_id: body.metier_id,
                date: body.date,
                date_prevue: body.date_prevue,
                contexte_intervention: body.contexte_intervention,
                consigne_intervention: body.consigne_intervention,
                consigne_second_artisan: body.consigne_second_artisan,
                adresse: body.adresse,
                code_postal: body.code_postal,
                ville: body.ville,
                latitude: body.latitude,
                longitude: body.longitude,
                is_vacant: body.is_vacant ?? false,
                key_code: body.key_code ?? null,
                floor: body.floor ?? null,
                apartment_number: body.apartment_number ?? null,
                vacant_housing_instructions: body.vacant_housing_instructions ?? null,
                sous_statut_text: body.sous_statut_text ?? null,
                sous_statut_text_color: body.sous_statut_text_color ?? '#000000',
                sous_statut_bg_color: body.sous_statut_bg_color ?? 'transparent',
                metier_second_artisan_id: body.metier_second_artisan_id ?? null,
                is_active: true,
                ...(authUserId ? { created_by: authUserId, updated_by: authUserId } : {}),
              }])
              .select()
              .single();

            if (retryError) {
              throw new Error(`Failed to create intervention after retry: ${retryError.message}`);
            }

            console.log(JSON.stringify({
              level: 'info',
              requestId,
              interventionId: retryData.id,
              originalIdInter: finalIdInter,
              newIdInter: newIdInter,
              timestamp: new Date().toISOString(),
              message: 'Intervention created successfully with regenerated id_inter'
            }));

            // Créer les transitions automatiques si un statut est défini
            await createAutomaticStatusTransitions(supabase, retryData.id, retryData.statut_id, authUserId, requestId);

            await handleInterventionCompletionSideEffects(supabase, retryData, requestId);

            return new Response(
              JSON.stringify(retryData),
              { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }
        throw new Error(`Failed to create intervention: ${error.message}`);
      }

      console.log(JSON.stringify({
        level: 'info',
        requestId,
        interventionId: data.id,
        timestamp: new Date().toISOString(),
        message: 'Intervention created successfully'
      }));

      // Créer les transitions automatiques si un statut est défini
      await createAutomaticStatusTransitions(supabase, data.id, data.statut_id, authUserId, requestId);

      await handleInterventionCompletionSideEffects(supabase, data, requestId);

      return new Response(
        JSON.stringify(data),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== PUT /interventions/{id} - Modifier une intervention =====
    if (req.method === 'PUT' && resourceId && resource === 'interventions') {
      const body: UpdateInterventionRequest = await req.json();

      // Récupérer l'intervention actuelle pour avoir le statut précédent
      const { data: currentIntervention, error: fetchError } = await supabase
        .from('interventions')
        .select('statut_id')
        .eq('id', resourceId)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw new Error(`Failed to fetch current intervention: ${fetchError.message}`);
      }

      const oldStatutId = currentIntervention?.statut_id || null;

      // Si le statut change, enregistrer la transition AVANT la mise à jour
      if (body.statut_id && oldStatutId !== body.statut_id) {
        try {
          // Enregistrer la transition explicitement via la fonction SQL
          const { error: transitionError } = await supabase.rpc(
            'log_status_transition_from_api',
            {
              p_intervention_id: resourceId,
              p_from_status_id: oldStatutId,
              p_to_status_id: body.statut_id,
              p_changed_by_user_id: authUserId,
              p_metadata: {
                updated_via: 'edge_function',
                updated_at: new Date().toISOString(),
              }
            }
          );

          if (transitionError) {
            console.error(JSON.stringify({
              level: 'warn',
              requestId,
              interventionId: resourceId,
              message: 'Erreur lors de l\'enregistrement de la transition',
              error: transitionError.message,
            }));
            // Ne pas bloquer la mise à jour si l'enregistrement de la transition échoue
            // Le trigger de sécurité prendra le relais
          }
        } catch (error) {
          console.error(JSON.stringify({
            level: 'warn',
            requestId,
            interventionId: resourceId,
            message: 'Erreur lors de l\'enregistrement de la transition',
            error: error instanceof Error ? error.message : String(error),
          }));
          // Continuer quand même, le trigger de sécurité enregistrera
        }
      }

      const { data, error } = await supabase
        .from('interventions')
        .update({
          id_inter: body.id_inter,
          agence_id: body.agence_id,
          reference_agence: body.reference_agence ?? null,
          tenant_id: body.tenant_id ?? body.client_id ?? null,
          owner_id: body.owner_id ?? null,
          assigned_user_id: body.assigned_user_id,
          statut_id: body.statut_id,
          metier_id: body.metier_id,
          date: body.date,
          date_termine: body.date_termine,
          date_prevue: body.date_prevue,
          contexte_intervention: body.contexte_intervention,
          consigne_intervention: body.consigne_intervention,
          consigne_second_artisan: body.consigne_second_artisan,
          commentaire_agent: body.commentaire_agent,
          adresse: body.adresse,
          code_postal: body.code_postal,
          ville: body.ville,
          latitude: body.latitude,
          longitude: body.longitude,
          is_vacant: body.is_vacant ?? false,
          key_code: body.key_code ?? null,
          floor: body.floor ?? null,
          apartment_number: body.apartment_number ?? null,
          vacant_housing_instructions: body.vacant_housing_instructions ?? null,
          sous_statut_text: body.sous_statut_text ?? null,
          sous_statut_text_color: body.sous_statut_text_color ?? '#000000',
          sous_statut_bg_color: body.sous_statut_bg_color ?? 'transparent',
          metier_second_artisan_id: body.metier_second_artisan_id ?? null,
          is_active: body.is_active,
          updated_at: new Date().toISOString(),
          ...(authUserId ? { updated_by: authUserId } : {}),
        })
        .eq('id', resourceId)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update intervention: ${error.message}`);
      }

      console.log(JSON.stringify({
        level: 'info',
        requestId,
        interventionId: resourceId,
        timestamp: new Date().toISOString(),
        message: 'Intervention updated successfully'
      }));

      await handleInterventionCompletionSideEffects(supabase, data, requestId, oldStatutId);

      return new Response(
        JSON.stringify(data),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== DELETE /interventions/{id} - Supprimer une intervention (soft delete) =====
    if (req.method === 'DELETE' && resourceId && resource === 'interventions') {
      const { data, error } = await supabase
        .from('interventions')
        .update({
          is_active: false,
          updated_at: new Date().toISOString(),
          ...(authUserId ? { updated_by: authUserId } : {}),
        })
        .eq('id', resourceId)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to delete intervention: ${error.message}`);
      }

      console.log(JSON.stringify({
        level: 'info',
        requestId,
        interventionId: resourceId,
        timestamp: new Date().toISOString(),
        message: 'Intervention deleted successfully'
      }));

      return new Response(
        JSON.stringify({ message: 'Intervention deleted successfully', data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== POST /interventions/{id}/artisans - Assigner un artisan =====
    if (req.method === 'POST' && resourceId && resource === 'artisans') {
      const body: AssignArtisanRequest = await req.json();

      if (!body.artisan_id) {
        return new Response(
          JSON.stringify({ error: 'artisan_id is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data, error } = await supabase
        .from('intervention_artisans')
        .insert([{
          intervention_id: resourceId,
          artisan_id: body.artisan_id,
          role: body.role || 'primary',
          is_primary: body.is_primary ?? (body.role === 'primary')
        }])
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to assign artisan: ${error.message}`);
      }

      console.log(JSON.stringify({
        level: 'info',
        requestId,
        interventionId: resourceId,
        artisanId: body.artisan_id,
        timestamp: new Date().toISOString(),
        message: 'Artisan assigned successfully'
      }));

      return new Response(
        JSON.stringify(data),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== POST /interventions/{id}/comments - Ajouter un commentaire =====
    if (req.method === 'POST' && resourceId && resource === 'comments') {
      const body: CreateCommentRequest = await req.json();

      if (!body.content) {
        return new Response(
          JSON.stringify({ error: 'content is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data, error } = await supabase
        .from('comments')
        .insert([{
          entity_id: resourceId,
          entity_type: 'intervention',
          content: body.content,
          comment_type: body.comment_type || 'internal',
          is_internal: body.is_internal ?? true
        }])
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create comment: ${error.message}`);
      }

      console.log(JSON.stringify({
        level: 'info',
        requestId,
        interventionId: resourceId,
        commentId: data.id,
        timestamp: new Date().toISOString(),
        message: 'Comment created successfully'
      }));

      return new Response(
        JSON.stringify(data),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== POST /interventions/{id}/attachments - Ajouter un document =====
    if (req.method === 'POST' && resourceId && resource === 'attachments') {
      const body: CreateAttachmentRequest = await req.json();

      if (!body.kind || !body.url) {
        return new Response(
          JSON.stringify({ error: 'kind and url are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const canonicalKind = normalizeInterventionAttachmentKind(body.kind);
      if (!INTERVENTION_ATTACHMENT_KINDS.includes(canonicalKind)) {
        return new Response(
          JSON.stringify({
            error: `Invalid attachment kind. Allowed: ${INTERVENTION_ATTACHMENT_KINDS.join(', ')}`
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data, error } = await supabase
        .from('intervention_attachments')
        .insert([{
          intervention_id: resourceId,
          kind: canonicalKind,
          url: body.url,
          filename: body.filename,
          mime_type: body.mime_type,
          file_size: body.file_size
        }])
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create attachment: ${error.message}`);
      }

      console.log(JSON.stringify({
        level: 'info',
        requestId,
        interventionId: resourceId,
        attachmentId: data.id,
        timestamp: new Date().toISOString(),
        message: 'Attachment created successfully'
      }));

      return new Response(
        JSON.stringify(data),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== POST /interventions/{id}/costs - Ajouter un coût =====
    if (req.method === 'POST' && resourceId && resource === 'costs') {
      const body: CreateCostRequest = await req.json();

      if (!body.cost_type || body.amount === null || body.amount === undefined) {
        return new Response(
          JSON.stringify({ error: 'cost_type and amount are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data, error } = await supabase
        .from('intervention_costs')
        .insert([{
          intervention_id: resourceId,
          cost_type: body.cost_type,
          label: body.label,
          amount: body.amount,
          currency: body.currency || 'EUR',
          metadata: body.metadata
        }])
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create cost: ${error.message}`);
      }

      console.log(JSON.stringify({
        level: 'info',
        requestId,
        interventionId: resourceId,
        costId: data.id,
        timestamp: new Date().toISOString(),
        message: 'Cost created successfully'
      }));

      return new Response(
        JSON.stringify(data),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== POST /interventions/{id}/payments - Ajouter un paiement =====
    if (req.method === 'POST' && resourceId && resource === 'payments') {
      const body: CreatePaymentRequest = await req.json();

      if (!body.payment_type || !body.amount) {
        return new Response(
          JSON.stringify({ error: 'payment_type and amount are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data, error } = await supabase
        .from('intervention_payments')
        .insert([{
          intervention_id: resourceId,
          payment_type: body.payment_type,
          amount: body.amount,
          currency: body.currency || 'EUR',
          is_received: body.is_received ?? false,
          payment_date: body.payment_date,
          reference: body.reference
        }])
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create payment: ${error.message}`);
      }

      console.log(JSON.stringify({
        level: 'info',
        requestId,
        interventionId: resourceId,
        paymentId: data.id,
        timestamp: new Date().toISOString(),
        message: 'Payment created successfully'
      }));

      return new Response(
        JSON.stringify(data),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
      requestId: requestId || 'unknown',
      responseTime,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
      message: 'Interventions API request failed'
    }));

    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
