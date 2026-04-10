-- ============================================================================
-- Migration: Hybrid Search with Near-Real-Time Buffer
-- Spec: docs/specs/hybrid-search-freshness.md
--
-- Problem: search_global() relies on materialized views refreshed every ~60s.
-- Newly created interventions/artisans are invisible in that window.
--
-- Solution: Combine MV (bulk) with a live buffer scanning rows modified since
-- the last refresh. Deduplication ensures live wins over stale MV rows.
-- ============================================================================

-- ========================================
-- 0. IMMUTABLE WRAPPER FOR unaccent()
--    PostgreSQL's built-in unaccent() is STABLE, not IMMUTABLE.
--    GENERATED ALWAYS AS columns require IMMUTABLE expressions.
--    This wrapper is safe: unaccent is deterministic, it just can't
--    declare itself IMMUTABLE because it depends on a dictionary config.
-- ========================================

CREATE OR REPLACE FUNCTION public.f_unaccent(text)
RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
AS $func$
  SELECT unaccent('unaccent', $1)
$func$;

-- ========================================
-- 1. GENERATED tsvector COLUMNS ON BASE TABLES
--    These power the live buffer's full-text search without joins.
-- ========================================

-- 1a. Interventions: search_vector column
--     Mirrors MV weights for all direct columns (no joins).
--     Missing vs MV: agence, tenant, owner, assigned_user, artisan, metier, commentaires (all require joins)
ALTER TABLE public.interventions
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    -- POIDS A: Identifiants critiques
    setweight(to_tsvector('french', f_unaccent(coalesce(id_inter, ''))), 'A') ||
    setweight(to_tsvector('french', f_unaccent(coalesce(reference_agence, ''))), 'A') ||
    -- POIDS B: Informations principales
    setweight(to_tsvector('french', f_unaccent(coalesce(contexte_intervention, ''))), 'B') ||
    -- POIDS C: Informations secondaires
    setweight(to_tsvector('french', f_unaccent(coalesce(consigne_intervention, ''))), 'C') ||
    setweight(to_tsvector('french', f_unaccent(coalesce(commentaire_agent, ''))), 'C') ||
    setweight(to_tsvector('french', f_unaccent(coalesce(adresse, ''))), 'C') ||
    setweight(to_tsvector('french', f_unaccent(coalesce(ville, ''))), 'C') ||
    setweight(to_tsvector('french', f_unaccent(coalesce(code_postal, ''))), 'C') ||
    -- POIDS D: Details et metadonnees
    setweight(to_tsvector('french', f_unaccent(coalesce(consigne_second_artisan, ''))), 'D') ||
    setweight(to_tsvector('french', f_unaccent(coalesce(key_code, ''))), 'D') ||
    setweight(to_tsvector('french', f_unaccent(coalesce(floor, ''))), 'D') ||
    setweight(to_tsvector('french', f_unaccent(coalesce(apartment_number, ''))), 'D')
  ) STORED;

-- 1b. Artisans: search_vector column
--     Mirrors MV weights for all direct columns (no joins).
--     Missing vs MV: metiers, zones, gestionnaire (all require joins)
ALTER TABLE public.artisans
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    -- POIDS A: Identifiants critiques
    setweight(to_tsvector('french', f_unaccent(coalesce(numero_associe, ''))), 'A') ||
    setweight(to_tsvector('french', f_unaccent(coalesce(siret, ''))), 'A') ||
    -- POIDS B: Informations principales
    setweight(to_tsvector('french', f_unaccent(
      coalesce(prenom, '') || ' ' || coalesce(nom, '')
    )), 'B') ||
    setweight(to_tsvector('french', f_unaccent(coalesce(plain_nom, ''))), 'B') ||
    setweight(to_tsvector('french', f_unaccent(coalesce(raison_sociale, ''))), 'B') ||
    -- POIDS C: Informations secondaires
    setweight(to_tsvector('french', f_unaccent(coalesce(email, ''))), 'C') ||
    setweight(to_tsvector('french', f_unaccent(coalesce(telephone, ''))), 'C') ||
    setweight(to_tsvector('french', f_unaccent(coalesce(telephone2, ''))), 'C') ||
    setweight(to_tsvector('french', f_unaccent(coalesce(ville_intervention, ''))), 'C') ||
    setweight(to_tsvector('french', f_unaccent(coalesce(ville_siege_social, ''))), 'C') ||
    -- POIDS D: Details et metadonnees
    setweight(to_tsvector('french', f_unaccent(coalesce(adresse_siege_social, ''))), 'D') ||
    setweight(to_tsvector('french', f_unaccent(coalesce(adresse_intervention, ''))), 'D') ||
    setweight(to_tsvector('french', f_unaccent(coalesce(statut_juridique, ''))), 'D') ||
    setweight(to_tsvector('french', f_unaccent(coalesce(suivi_relances_docs, ''))), 'D')
  ) STORED;

-- ========================================
-- 2. INDEXES (non-concurrent, safe inside migration transaction)
--    Production note: if running against a large live table, extract these
--    into a separate script using CREATE INDEX CONCURRENTLY (cannot run
--    inside a transaction block).
-- ========================================

-- 2a. GIN indexes for full-text on base tables
CREATE INDEX IF NOT EXISTS idx_interventions_search_vector_live
  ON public.interventions USING gin(search_vector);

CREATE INDEX IF NOT EXISTS idx_artisans_search_vector_live
  ON public.artisans USING gin(search_vector);

-- 2b. B-tree indexes for the temporal buffer window
CREATE INDEX IF NOT EXISTS idx_interventions_updated_at
  ON public.interventions(updated_at DESC) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_artisans_updated_at
  ON public.artisans(updated_at DESC) WHERE is_active = true;

-- ========================================
-- 3. REWRITE search_global() WITH HYBRID BUFFER
-- ========================================

CREATE OR REPLACE FUNCTION search_global(
  p_query text,
  p_limit int DEFAULT 20,
  p_offset int DEFAULT 0,
  p_entity_type text DEFAULT NULL
)
RETURNS TABLE (
  entity_type text,
  entity_id uuid,
  metadata jsonb,
  rank real
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_normalized text;
  v_tsquery tsquery;
  v_tsquery_prefix tsquery;
  v_last_refresh timestamptz;
BEGIN
  -- 1. Normalize query
  v_normalized := trim(lower(unaccent(p_query)));

  -- Empty query → empty result
  IF v_normalized = '' THEN
    RETURN;
  END IF;

  -- 2. Build tsqueries (full + prefix)
  BEGIN
    v_tsquery := websearch_to_tsquery('french', unaccent(p_query));
    v_tsquery_prefix := to_tsquery('french',
      regexp_replace(
        regexp_replace(unaccent(p_query), '''', '', 'g'),
        '\s+', ':* & ', 'g'
      ) || ':*'
    );
  EXCEPTION WHEN OTHERS THEN
    -- Fallback: plain tsquery (never fails)
    v_tsquery := plainto_tsquery('french', v_normalized);
    v_tsquery_prefix := v_tsquery;
  END;

  -- 3. Get last MV refresh timestamp
  SELECT last_refresh INTO v_last_refresh
  FROM public.search_views_refresh_flags
  WHERE id = 'global_search_mv'
  LIMIT 1;

  -- If never refreshed, treat all data as "recent"
  IF v_last_refresh IS NULL THEN
    v_last_refresh := '1970-01-01'::timestamptz;
  END IF;

  -- 4. Hybrid query: MV (bulk) + live buffer, deduplicated
  RETURN QUERY
  WITH
  -- A) MV results (pre-computed, rich metadata)
  mv_results AS (
    SELECT
      gsv.entity_type,
      gsv.entity_id,
      gsv.metadata,
      GREATEST(
        COALESCE(ts_rank(gsv.search_vector, v_tsquery), 0),
        COALESCE(ts_rank(gsv.search_vector, v_tsquery_prefix) * 0.9, 0),
        -- Bonus for critical field matches (preserve existing behavior)
        CASE
          WHEN gsv.entity_type = 'intervention' THEN
            CASE
              WHEN (gsv.metadata->>'agence')::text ILIKE '%' || v_normalized || '%' THEN 0.5
              WHEN (gsv.metadata->>'contexte')::text ILIKE '%' || v_normalized || '%' THEN 0.3
              ELSE 0
            END
          WHEN gsv.entity_type = 'artisan' THEN
            CASE
              WHEN (gsv.metadata->>'numero_associe')::text ILIKE '%' || v_normalized || '%' THEN 0.5
              WHEN (gsv.metadata->>'plain_nom')::text ILIKE '%' || v_normalized || '%' THEN 0.4
              WHEN (gsv.metadata->>'raison_sociale')::text ILIKE '%' || v_normalized || '%' THEN 0.3
              ELSE 0
            END
          ELSE 0
        END
      ) AS rank,
      1 AS source_priority  -- MV = low priority (overridden by live)
    FROM global_search_mv gsv
    WHERE
      (p_entity_type IS NULL OR gsv.entity_type = p_entity_type)
      AND (
        gsv.search_vector @@ v_tsquery
        OR gsv.search_vector @@ v_tsquery_prefix
        OR (gsv.entity_type = 'intervention' AND (
          (gsv.metadata->>'agence')::text ILIKE '%' || v_normalized || '%'
          OR (gsv.metadata->>'contexte')::text ILIKE '%' || v_normalized || '%'
        ))
        OR (gsv.entity_type = 'artisan' AND (
          (gsv.metadata->>'numero_associe')::text ILIKE '%' || v_normalized || '%'
          OR (gsv.metadata->>'plain_nom')::text ILIKE '%' || v_normalized || '%'
          OR (gsv.metadata->>'raison_sociale')::text ILIKE '%' || v_normalized || '%'
        ))
      )
    ORDER BY rank DESC
    LIMIT p_limit * 3  -- over-fetch to leave room for merge
  ),

  -- B) Live buffer: interventions modified since last refresh
  --    Includes ILIKE fallback for partial matches (e.g. "123" for INT-00123)
  recent_interventions AS (
    SELECT
      'intervention'::text AS entity_type,
      i.id AS entity_id,
      jsonb_build_object(
        'id_inter', i.id_inter,
        'contexte', left(i.contexte_intervention, 120),
        'adresse', i.adresse,
        'ville', i.ville,
        'date', to_char(i.date, 'DD/MM/YYYY')
      ) AS metadata,
      CASE
        WHEN i.search_vector @@ v_tsquery OR i.search_vector @@ v_tsquery_prefix
        THEN GREATEST(
          ts_rank(i.search_vector, v_tsquery),
          ts_rank(i.search_vector, v_tsquery_prefix) * 0.9
        )
        ELSE 0.3  -- Fixed score for ILIKE-only matches
      END AS rank,
      0 AS source_priority  -- Live = high priority
    FROM public.interventions i
    WHERE i.is_active = true
      AND i.updated_at > v_last_refresh
      AND (p_entity_type IS NULL OR p_entity_type = 'intervention')
      AND (
        i.search_vector @@ v_tsquery
        OR i.search_vector @@ v_tsquery_prefix
        OR i.id_inter ILIKE '%' || v_normalized || '%'
      )
  ),

  -- C) Live buffer: artisans modified since last refresh
  recent_artisans AS (
    SELECT
      'artisan'::text AS entity_type,
      a.id AS entity_id,
      jsonb_build_object(
        'numero_associe', a.numero_associe,
        'plain_nom', a.plain_nom,
        'raison_sociale', a.raison_sociale,
        'email', a.email,
        'telephone', a.telephone,
        'ville', a.ville_intervention
      ) AS metadata,
      CASE
        WHEN a.search_vector @@ v_tsquery OR a.search_vector @@ v_tsquery_prefix
        THEN GREATEST(
          ts_rank(a.search_vector, v_tsquery),
          ts_rank(a.search_vector, v_tsquery_prefix) * 0.9
        )
        ELSE 0.3
      END AS rank,
      0 AS source_priority
    FROM public.artisans a
    WHERE a.is_active = true
      AND a.updated_at > v_last_refresh
      AND (p_entity_type IS NULL OR p_entity_type = 'artisan')
      AND (
        a.search_vector @@ v_tsquery
        OR a.search_vector @@ v_tsquery_prefix
        OR a.numero_associe ILIKE '%' || v_normalized || '%'
        OR a.plain_nom ILIKE '%' || v_normalized || '%'
      )
  ),

  -- D) Union + deduplication (live wins over MV)
  all_results AS (
    SELECT * FROM mv_results
    UNION ALL
    SELECT * FROM recent_interventions
    UNION ALL
    SELECT * FROM recent_artisans
  ),

  deduplicated AS (
    SELECT DISTINCT ON (ar.entity_type, ar.entity_id)
      ar.entity_type,
      ar.entity_id,
      ar.metadata,
      ar.rank
    FROM all_results ar
    ORDER BY ar.entity_type, ar.entity_id, ar.source_priority ASC  -- 0 (live) before 1 (MV)
  )

  SELECT
    d.entity_type,
    d.entity_id,
    d.metadata,
    d.rank
  FROM deduplicated d
  ORDER BY d.rank DESC, d.entity_type, d.entity_id
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

COMMENT ON FUNCTION search_global IS
  'Hybrid search: combines materialized view (bulk) with live buffer for near-real-time results. '
  'Live buffer scans rows modified since the last MV refresh, ensuring freshly created entities '
  'appear in search within seconds instead of waiting up to 60s for the next cron refresh.';
