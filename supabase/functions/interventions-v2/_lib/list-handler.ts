// ===== INTERVENTIONS-V2 - LIST HANDLER =====
// Handler pour `GET /interventions` (liste paginée avec filtres, tri, recherche).
// Le plus gros handler de la fonction — extrait pour clarté.

import { type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { FilterParams } from './types.ts';
import {
  applyFilters,
  applySort,
  buildSelectClause,
  getCachedCount,
  parseListParam,
  parseSortParams,
  SORTABLE_COST_PROPERTIES,
} from './helpers.ts';

export async function handleListInterventions(
  req: Request,
  url: URL,
  corsHeaders: Record<string, string>,
  supabase: SupabaseClient,
  requestId: string,
): Promise<Response> {
  const rawLimit = Number.parseInt(url.searchParams.get('limit') ?? '100', 10);
  const clampedLimit = Math.max(1, Math.min(Number.isFinite(rawLimit) ? rawLimit : 100, 50000));
  const rawOffset = Number.parseInt(url.searchParams.get('offset') ?? '0', 10);
  const clampedOffset = Math.max(0, Number.isFinite(rawOffset) ? rawOffset : 0);

  console.log(`[Edge Function] Pagination - rawOffset: ${rawOffset}, clampedOffset: ${clampedOffset}, rawLimit: ${rawLimit}, clampedLimit: ${clampedLimit}`);

  const include = parseListParam(url.searchParams.getAll('include'));
  const extraSelect = url.searchParams.get('select');
  const artisanFilters = parseListParam(url.searchParams.getAll('artisan'));

  const statutFilters = parseListParam(url.searchParams.getAll('statut'));
  const agenceFilters = parseListParam(url.searchParams.getAll('agence'));
  const metierFilters = parseListParam(url.searchParams.getAll('metier'));

  const userValues = url.searchParams.getAll('user');
  const userIds = parseListParam(
    userValues.filter((value) => value !== 'null' && value !== '__null__' && value !== 'undefined'),
  );
  const userIsNull = userValues.some((value) => value === 'null' || value === '__null__');

  const searchRaw = url.searchParams.get('search')?.trim() ?? null;
  // Recherche par montant. L'analyse de la saisie utilisateur (« 387,78 »,
  // « sst:387 ») et la résolution de la portée sont faites côté client dans
  // `src/lib/api/interventions/search-qualifiers.ts` ; on ne reçoit ici qu'un
  // nombre déjà normalisé et des listes de types.
  const amountRaw = url.searchParams.get('amount')?.trim() ?? null;
  const amountParsed = amountRaw ? Number(amountRaw) : null;
  const amount =
    amountParsed !== null && Number.isFinite(amountParsed) ? amountParsed : null;
  const amountPaymentTypes = parseListParam(
    (url.searchParams.get('amountPaymentTypes') ?? '').split(','),
  );
  const amountCostTypes = parseListParam(
    (url.searchParams.get('amountCostTypes') ?? '').split(','),
  );
  const startDateRaw = url.searchParams.get('startDate')?.trim() ?? null;
  const endDateRaw = url.searchParams.get('endDate')?.trim() ?? null;
  const isCheckRaw = url.searchParams.get('isCheck')?.trim() ?? null;
  // Vue « Mes vérifications » : `hasPortalReport` + les statuts de revue déjà
  // résolus en UUID par le client (cf. src/lib/filter-converter.ts).
  const hasPortalReportRaw = url.searchParams.get('hasPortalReport')?.trim() ?? null;
  const portalReportStatutFilters = parseListParam(url.searchParams.getAll('portalReportStatut'));

  const filters: FilterParams = {
    search: searchRaw && searchRaw.length > 0 ? searchRaw : null,
    amount,
    startDate: startDateRaw && startDateRaw.length > 0 ? startDateRaw : null,
    endDate: endDateRaw && endDateRaw.length > 0 ? endDateRaw : null,
  };

  if (isCheckRaw === 'true') {
    filters.isCheck = true;
  } else if (isCheckRaw === 'false') {
    filters.isCheck = false;
  }

  if (hasPortalReportRaw === 'true') {
    filters.hasPortalReport = true;
  } else if (hasPortalReportRaw === 'false') {
    filters.hasPortalReport = false;
  }
  if (portalReportStatutFilters.length > 0) {
    filters.portalReportStatut = portalReportStatutFilters;
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

  const hasTextSearch = Boolean(filters.search && filters.search.length >= 2);
  const hasAmountSearch =
    amount !== null && (amountPaymentTypes.length > 0 || amountCostTypes.length > 0);
  // Les deux chemins partagent le même post-traitement (résultats limités du
  // RPC -> requête détaillée -> réordonnancement), d'où le `hasSearch` commun.
  const hasSearch = hasTextSearch || hasAmountSearch;
  const selectClause = buildSelectClause(extraSelect, include, hasSearch);

  // ========================================
  // RECHERCHE OPTIMISÉE VIA VUE MATÉRIALISÉE
  // ========================================
  if (hasSearch) {
    console.log(
      JSON.stringify({
        level: 'info',
        requestId,
        message: 'Using optimized search',
        searchQuery: filters.search,
        amountFilter: hasAmountSearch
          ? { amount, paymentTypes: amountPaymentTypes, costTypes: amountCostTypes }
          : null,
        limit: clampedLimit,
        offset: clampedOffset,
      }),
    );

    const fetchStart = Date.now();

    // Les deux RPC renvoient la même forme de résultat (id + colonnes
    // d'affichage + rank). Quand les deux sont actifs — cas d'un montant sec
    // comme « 387,78 », qui déclenche l'auto-détection sans désactiver le
    // plein-texte — on fusionne : les correspondances exactes de montant
    // d'abord, puis les correspondances textuelles non déjà présentes.
    //
    // Note pagination : avec `offset > 0`, chaque RPC pagine indépendamment
    // AVANT la fusion, le découpage est donc approximatif. Acceptable ici — un
    // filtre sur montant exact renvoie quelques lignes, jamais plusieurs pages.
    const [amountResult, textResult] = await Promise.all([
      hasAmountSearch
        ? supabase.rpc('search_interventions_by_amount', {
          p_amount: amount,
          p_payment_types: amountPaymentTypes,
          p_cost_types: amountCostTypes,
          p_limit: clampedLimit,
          p_offset: clampedOffset,
        })
        : Promise.resolve({ data: null, error: null }),
      hasTextSearch
        ? supabase.rpc('search_interventions', {
          p_query: filters.search,
          p_limit: clampedLimit,
          p_offset: clampedOffset,
        })
        : Promise.resolve({ data: null, error: null }),
    ]);

    const searchError = amountResult.error ?? textResult.error;
    const seenIds = new Set<string>();
    const searchResults = [
      ...(amountResult.data ?? []),
      ...(textResult.data ?? []),
    ].filter((row: any) => {
      if (!row?.id || seenIds.has(row.id)) return false;
      seenIds.add(row.id);
      return true;
    }).slice(0, clampedLimit);

    const fetchDuration = Date.now() - fetchStart;

    if (searchError) {
      console.error(
        JSON.stringify({
          level: 'error',
          requestId,
          error: searchError.message,
          searchQuery: filters.search,
          message: 'Failed to execute optimized search',
        }),
      );
      throw new Error(`Search error: ${searchError.message}`);
    }

    // Les résultats de search_interventions sont déjà triés par pertinence
    // MAIS ils ne contiennent que des champs limités, donc on doit TOUJOURS
    // récupérer les données complètes pour le frontend
    let filteredData = searchResults ?? [];
    const interventionIds = filteredData.map((r: any) => r.id);

    // TOUJOURS récupérer les données complètes car search_interventions ne retourne
    // que des champs limités (id, id_inter, contexte, etc.)
    if (interventionIds.length > 0) {
      let detailedQuery = supabase
        .from('interventions')
        .select(selectClause)
        .in('id', interventionIds);

      // Appliquer les filtres supplémentaires (statut, agence, métier, user)
      if (statutFilters.length > 0) {
        detailedQuery = detailedQuery.in('statut_id', statutFilters);
      }
      if (agenceFilters.length > 0) {
        detailedQuery = detailedQuery.in('agence_id', agenceFilters);
      }
      if (metierFilters.length > 0) {
        detailedQuery = detailedQuery.in('metier_id', metierFilters);
      }
      if (userIds.length > 0) {
        detailedQuery = detailedQuery.in('assigned_user_id', userIds);
      } else if (userIsNull) {
        detailedQuery = detailedQuery.is('assigned_user_id', null);
      }
      if (filters.hasPortalReport !== undefined) {
        detailedQuery = detailedQuery.eq('has_portal_report', filters.hasPortalReport);
        if (filters.hasPortalReport && portalReportStatutFilters.length > 0) {
          detailedQuery = detailedQuery.in('statut_id', portalReportStatutFilters);
        }
      }

      // Filtre isCheck dans la recherche optimisée
      if (filters.isCheck !== undefined && interventionIds.length > 0) {
        const userId = userIds.length === 1 ? userIds[0] : null;
        const { data: isCheckIds, error: rpcError } = await supabase
          .rpc('filter_interventions_ischeck', {
            p_user_id: userId,
            p_include_check: filters.isCheck
          });

        if (!rpcError && isCheckIds && Array.isArray(isCheckIds)) {
          const isCheckSet = new Set(isCheckIds.map((row: any) => row.intervention_id));
          // Filtrer les IDs de recherche pour ne garder que ceux qui sont aussi dans isCheck
          const filteredIds = interventionIds.filter((id: string) => isCheckSet.has(id));
          if (filteredIds.length === 0) {
            // Aucune intervention ne correspond aux deux critères (search ET isCheck)
            filteredData = [];
          } else {
            detailedQuery = detailedQuery.in('id', filteredIds);
          }
        }
      }

      const { data: detailedData, error: detailedError } = await detailedQuery;

      if (detailedError) {
        throw new Error(`Failed to fetch detailed data: ${detailedError.message}`);
      }

      // Réordonner selon l'ordre de pertinence de la recherche
      const idToData = new Map(
        (detailedData ?? []).map((item: any) => [item.id, item])
      );
      filteredData = interventionIds
        .map((id: string) => idToData.get(id))
        .filter((item: any) => item !== undefined);
    } else {
      filteredData = [];
    }

    // Filtrage artisan en post-traitement si nécessaire
    if (artisanFilters.length > 0) {
      const { data: artisanInterventions, error: artisanError } = await supabase
        .from('intervention_artisans')
        .select('intervention_id')
        .in('artisan_id', artisanFilters);

      if (artisanError) {
        console.error(
          JSON.stringify({
            level: 'error',
            requestId,
            error: artisanError.message,
            artisanFilters,
            message: 'Failed to filter interventions by artisan',
          }),
        );
      } else {
        const interventionIds = new Set(
          (artisanInterventions ?? [])
            .map((entry) => entry?.intervention_id as string | null)
            .filter((value): value is string => Boolean(value)),
        );
        filteredData = filteredData.filter((intervention: any) => interventionIds.has(intervention.id));
      }
    }

    // Pour le count, on fait une requête séparée avec les filtres
    const totalCount = await getCachedCount(supabase, filters);
    const hasMore = clampedOffset + clampedLimit < totalCount;

    console.log(
      JSON.stringify({
        level: 'info',
        requestId,
        responseTime: fetchDuration,
        dataCount: filteredData.length,
        totalCount,
        offset: clampedOffset,
        limit: clampedLimit,
        hasMore,
        searchOptimized: true,
        timestamp: new Date().toISOString(),
        message: 'Interventions retrieved successfully via optimized search',
      }),
    );

    return new Response(
      JSON.stringify({
        data: filteredData,
        pagination: {
          total: totalCount,
          limit: clampedLimit,
          offset: clampedOffset,
          hasMore,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  // ========================================
  // RECHERCHE CLASSIQUE (sans search)
  // ========================================
  const { sortBy, sortDir } = parseSortParams(url);

  // --- Tri via RPC pour les colonnes de coûts ---
  let costSortedIds: string[] | null = null;
  let costSortTotalCount: number | null = null;

  if (sortBy && SORTABLE_COST_PROPERTIES.has(sortBy)) {
    const { data: rpcRows, error: rpcError } = await supabase
      .rpc('get_sorted_intervention_ids', {
        p_sort_property: sortBy,
        p_sort_dir: sortDir,
        p_limit: clampedLimit,
        p_offset: clampedOffset,
        p_statut_ids: filters.statut && filters.statut.length > 0 ? filters.statut : null,
        p_agence_id: filters.agence && filters.agence.length === 1 ? filters.agence[0] : null,
        p_metier_ids: filters.metier && filters.metier.length > 0 ? filters.metier : null,
        p_user_id: filters.user && filters.user.length === 1 ? filters.user[0] : null,
        p_user_is_null: filters.userIsNull ?? false,
        // Sans ces deux paramètres, un tri sur une colonne de coût abandonnerait
        // silencieusement le filtre « Mes vérifications » (le RPC pagine seul).
        p_has_portal_report: filters.hasPortalReport ?? false,
        p_portal_report_statut_ids:
          filters.portalReportStatut && filters.portalReportStatut.length > 0
            ? filters.portalReportStatut
            : null,
        p_start_date: filters.startDate ?? null,
        p_end_date: filters.endDate ?? null,
      });

    if (rpcError) {
      console.error(JSON.stringify({
        level: 'error', requestId,
        error: rpcError.message,
        message: 'Failed to call get_sorted_intervention_ids RPC',
      }));
    } else if (rpcRows && Array.isArray(rpcRows) && rpcRows.length > 0) {
      costSortedIds = rpcRows.map((r: any) => r.intervention_id);
      costSortTotalCount = Number(rpcRows[0].total_count);
    }
  }

  let query = supabase
    .from('interventions')
    .select(selectClause, { count: costSortedIds ? undefined : 'exact' })
    .eq('is_active', true);

  if (costSortedIds && costSortedIds.length > 0) {
    // Le RPC a déjà trié et paginé — on récupère ces IDs précis
    query = query.in('id', costSortedIds);
  } else if (costSortedIds && costSortedIds.length === 0) {
    // Aucun résultat pour ce tri
    query = query.eq('id', '00000000-0000-0000-0000-000000000000');
  } else {
    // Tri classique (colonne directe ou défaut)
    query = applySort(query, sortBy, sortDir);
    query = applyFilters(query, filters);

    // Filtre isCheck : utiliser la fonction RPC pour obtenir les IDs des interventions concernées
    if (filters.isCheck !== undefined) {
      const userId = filters.user && Array.isArray(filters.user) && filters.user.length === 1
        ? filters.user[0]
        : null;

      console.log(`[Edge Function] Applying isCheck filter via RPC - isCheck: ${filters.isCheck}, userId: ${userId}`);

      const { data: isCheckIds, error: rpcError } = await supabase
        .rpc('filter_interventions_ischeck', {
          p_user_id: userId,
          p_include_check: filters.isCheck
        });

      if (rpcError) {
        console.error(
          JSON.stringify({
            level: 'error',
            requestId,
            error: rpcError.message,
            message: 'Failed to apply isCheck filter via RPC',
          }),
        );
      } else if (isCheckIds && Array.isArray(isCheckIds)) {
        const interventionIds = isCheckIds.map((row: any) => row.intervention_id);
        console.log(`[Edge Function] isCheck RPC returned ${interventionIds.length} intervention IDs`);

        if (interventionIds.length > 0) {
          query = query.in('id', interventionIds);
        } else {
          query = query.eq('id', '00000000-0000-0000-0000-000000000000');
        }
      }
    }

    // Appliquer la pagination (seulement pour le chemin classique, le RPC pagine déjà)
    query = query.range(clampedOffset, clampedOffset + clampedLimit - 1);
  }

  console.log(`[Edge Function] Requête classique avec range(${clampedOffset}, ${clampedOffset + clampedLimit - 1})`);

  const fetchStart = Date.now();
  const { data, error, count } = await query;
  const fetchDuration = Date.now() - fetchStart;

  if (data && Array.isArray(data) && data.length > 0) {
    console.log(`[Edge Function] Résultats - Premier ID: ${data[0].id}, Dernier ID: ${data[data.length - 1].id}, Total: ${data.length}`);
  } else {
    console.log(`[Edge Function] Résultats - Aucune donnée retournée`);
  }

  if (error) {
    throw new Error(`Database error: ${error.message}`);
  }

  let filteredData = Array.isArray(data) ? data : [];

  // Quand le tri vient du RPC, réordonner pour respecter l'ordre du RPC
  if (costSortedIds && costSortedIds.length > 0 && filteredData.length > 0) {
    const orderMap = new Map(costSortedIds.map((id, idx) => [id, idx]));
    filteredData.sort((a, b) => (orderMap.get(a.id) ?? 999) - (orderMap.get(b.id) ?? 999));
  }

  // Filtrage artisan en post-traitement si nécessaire
  if (artisanFilters.length > 0) {
    const { data: artisanInterventions, error: artisanError } = await supabase
      .from('intervention_artisans')
      .select('intervention_id')
      .in('artisan_id', artisanFilters);

    if (artisanError) {
      console.error(
        JSON.stringify({
          level: 'error',
          requestId,
          error: artisanError.message,
          artisanFilters,
          message: 'Failed to filter interventions by artisan',
        }),
      );
    } else {
      const interventionIds = new Set(
        (artisanInterventions ?? [])
          .map((entry) => entry?.intervention_id as string | null)
          .filter((value): value is string => Boolean(value)),
      );
      filteredData = filteredData.filter((intervention) => interventionIds.has(intervention.id));
    }
  }

  const totalCount = costSortTotalCount ?? count ?? await getCachedCount(supabase, filters);
  const hasMore = clampedOffset + clampedLimit < totalCount;

  console.log(
    JSON.stringify({
      level: 'info',
      requestId,
      responseTime: fetchDuration,
      dataCount: filteredData.length,
      totalCount,
      offset: clampedOffset,
      limit: clampedLimit,
      hasMore,
      timestamp: new Date().toISOString(),
      message: 'Interventions retrieved successfully',
    }),
  );

  return new Response(
    JSON.stringify({
      data: filteredData,
      pagination: {
        total: totalCount,
        limit: clampedLimit,
        offset: clampedOffset,
        hasMore,
      },
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
}
