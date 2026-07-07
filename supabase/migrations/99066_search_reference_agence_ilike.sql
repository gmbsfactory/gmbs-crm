-- ============================================================================
-- Migration 99066 : recherche par référence agence (« contient » / suffixe)
-- ============================================================================
-- Bug : taper les derniers chiffres de la référence agence (ex. « 66135 » pour
-- une réf « AG-2025-66135 ») ne remonte pas le dossier dans la barre de
-- recherche du haut (search_global) NI dans la page liste des interventions
-- (search_interventions).
--
-- Cause :
--   `reference_agence` est bien indexé en full-text (poids A), MAIS le
--   full-text ne matche que le DÉBUT des lexèmes (requête préfixe « 66135:* »).
--   Les derniers chiffres d'une référence sont un SUFFIXE de token, jamais un
--   préfixe → aucun match. Contrairement à id_inter / adresse / ville, aucun
--   repli ILIKE (« contient ») n'existait sur reference_agence.
--
-- Correctif (miroir exact de ce qui a été fait pour adresse/ville en 99060) :
--   A. global_search_mv : on expose `reference_agence` dans la metadata JSON
--      de l'intervention (la colonne existe déjà dans interventions_search_mv),
--      pour permettre un repli ILIKE côté search_global (branche MV).
--   B. search_global : repli ILIKE sur reference_agence (branche MV via
--      metadata + branche buffer live via la colonne de table).
--   C. search_interventions : repli ILIKE sur reference_agence (branche
--      principale + branche de repli d'exception). Signature inchangée.
--
-- Coût : recréation de global_search_mv (rafraîchissable CONCURRENTLY, index
--   unique présent) + CREATE OR REPLACE de 2 fonctions. Aucun changement front.
-- ============================================================================

-- ========================================
-- 1. global_search_mv : ajout de reference_agence dans la metadata
--    (identique à 99021, on insère uniquement 'reference_agence')
-- ========================================
DROP MATERIALIZED VIEW IF EXISTS global_search_mv;

CREATE MATERIALIZED VIEW global_search_mv AS
SELECT
  'intervention'::text as entity_type,
  id as entity_id,
  search_vector,
  jsonb_build_object(
    'id_inter', id_inter,
    'contexte', contexte_intervention,
    'adresse', adresse,
    'ville', ville,
    'agence', agence_label,
    'reference_agence', reference_agence,
    'artisan', artisan_plain_nom,
    'statut', statut_label,
    'statut_color', statut_color,
    'date', date_formatted,
    'assigned_user', assigned_user_username
  ) as metadata,
  created_at,
  updated_at
FROM interventions_search_mv

UNION ALL

SELECT
  'artisan'::text as entity_type,
  id as entity_id,
  search_vector,
  jsonb_build_object(
    'numero_associe', numero_associe,
    'plain_nom', plain_nom,
    'raison_sociale', raison_sociale,
    'email', email,
    'telephone', telephone,
    'ville', ville_intervention,
    'metiers', metiers_labels,
    'statut', statut_label,
    'statut_color', statut_color,
    'interventions_actives', active_interventions_count
  ) as metadata,
  created_at,
  updated_at
FROM artisans_search_mv;

CREATE INDEX idx_global_search_vector ON global_search_mv USING gin(search_vector);
CREATE INDEX idx_global_search_entity_type ON global_search_mv(entity_type);
CREATE INDEX idx_global_search_created_at ON global_search_mv(created_at DESC, entity_id);
CREATE UNIQUE INDEX idx_global_search_unique ON global_search_mv(entity_type, entity_id);

-- ========================================
-- 2. search_global (barre de recherche du haut / Cmd+K)
--    Identique à 99060 + repli ILIKE sur reference_agence.
-- ========================================
DROP FUNCTION IF EXISTS search_global(text, int, int, text);
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
  rank double precision
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_normalized text;
  v_clean text;
  v_tsquery tsquery;
  v_tsquery_prefix tsquery;
  v_last_refresh timestamptz;
BEGIN
  v_normalized := trim(lower(unaccent(p_query)));

  IF v_normalized = '' THEN
    RETURN;
  END IF;

  v_clean := trim(regexp_replace(unaccent(p_query), '[''’]+', ' ', 'g'));

  BEGIN
    v_tsquery := websearch_to_tsquery('french', v_clean);
    v_tsquery_prefix := to_tsquery('french',
      regexp_replace(v_clean, '\s+', ':* & ', 'g') || ':*'
    );
  EXCEPTION WHEN OTHERS THEN
    v_tsquery := plainto_tsquery('french', v_normalized);
    v_tsquery_prefix := v_tsquery;
  END;

  SELECT last_refresh INTO v_last_refresh
  FROM public.search_views_refresh_flags
  WHERE id = 'global_search_mv'
  LIMIT 1;

  IF v_last_refresh IS NULL THEN
    v_last_refresh := '1970-01-01'::timestamptz;
  END IF;

  RETURN QUERY
  WITH
  mv_results AS (
    SELECT
      gsv.entity_type,
      gsv.entity_id,
      gsv.metadata,
      GREATEST(
        COALESCE(ts_rank(gsv.search_vector, v_tsquery)::double precision, 0),
        COALESCE(ts_rank(gsv.search_vector, v_tsquery_prefix)::double precision * 0.9, 0),
        CASE
          WHEN gsv.entity_type = 'intervention' THEN
            CASE
              WHEN (gsv.metadata->>'agence')::text ILIKE '%' || v_normalized || '%' THEN 0.5
              WHEN (gsv.metadata->>'reference_agence')::text ILIKE '%' || v_normalized || '%' THEN 0.5
              WHEN (gsv.metadata->>'contexte')::text ILIKE '%' || v_normalized || '%' THEN 0.3
              WHEN unaccent(gsv.metadata->>'adresse') ILIKE '%' || v_normalized || '%' THEN 0.3
              WHEN unaccent(gsv.metadata->>'ville') ILIKE '%' || v_normalized || '%' THEN 0.3
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
      1 AS source_priority
    FROM global_search_mv gsv
    WHERE
      (p_entity_type IS NULL OR gsv.entity_type = p_entity_type)
      AND (
        gsv.search_vector @@ v_tsquery
        OR gsv.search_vector @@ v_tsquery_prefix
        OR (gsv.entity_type = 'intervention' AND (
          (gsv.metadata->>'agence')::text ILIKE '%' || v_normalized || '%'
          OR (gsv.metadata->>'reference_agence')::text ILIKE '%' || v_normalized || '%'
          OR (gsv.metadata->>'contexte')::text ILIKE '%' || v_normalized || '%'
          OR unaccent(gsv.metadata->>'adresse') ILIKE '%' || v_normalized || '%'
          OR unaccent(gsv.metadata->>'ville') ILIKE '%' || v_normalized || '%'
        ))
        OR (gsv.entity_type = 'artisan' AND (
          (gsv.metadata->>'numero_associe')::text ILIKE '%' || v_normalized || '%'
          OR (gsv.metadata->>'plain_nom')::text ILIKE '%' || v_normalized || '%'
          OR (gsv.metadata->>'raison_sociale')::text ILIKE '%' || v_normalized || '%'
        ))
      )
    ORDER BY rank DESC
    LIMIT p_limit * 3
  ),

  recent_interventions AS (
    SELECT
      'intervention'::text AS entity_type,
      i.id AS entity_id,
      jsonb_build_object(
        'id_inter', i.id_inter,
        'contexte', left(i.contexte_intervention, 120),
        'adresse', i.adresse,
        'ville', i.ville,
        'reference_agence', i.reference_agence,
        'date', to_char(i.date, 'DD/MM/YYYY')
      ) AS metadata,
      CASE
        WHEN i.search_vector @@ v_tsquery OR i.search_vector @@ v_tsquery_prefix
        THEN GREATEST(
          ts_rank(i.search_vector, v_tsquery)::double precision,
          ts_rank(i.search_vector, v_tsquery_prefix)::double precision * 0.9
        )
        ELSE 0.3
      END AS rank,
      0 AS source_priority
    FROM public.interventions i
    WHERE i.is_active = true
      AND i.updated_at > v_last_refresh
      AND (p_entity_type IS NULL OR p_entity_type = 'intervention')
      AND (
        i.search_vector @@ v_tsquery
        OR i.search_vector @@ v_tsquery_prefix
        OR i.id_inter ILIKE '%' || v_normalized || '%'
        OR i.reference_agence ILIKE '%' || v_normalized || '%'
        OR unaccent(i.adresse) ILIKE '%' || v_normalized || '%'
        OR unaccent(i.ville) ILIKE '%' || v_normalized || '%'
        OR i.code_postal ILIKE '%' || v_normalized || '%'
      )
    ORDER BY i.updated_at DESC
    LIMIT 500
  ),

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
          ts_rank(a.search_vector, v_tsquery)::double precision,
          ts_rank(a.search_vector, v_tsquery_prefix)::double precision * 0.9
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
    ORDER BY a.updated_at DESC
    LIMIT 500
  ),

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
    ORDER BY ar.entity_type, ar.entity_id, ar.source_priority ASC
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
  'Hybrid search: MV (bulk) + live buffer (rows modified since last refresh, borné 500/type). '
  'Tokenisation FR : apostrophes (élision) et tirets remplacés par des espaces avant tsquery. '
  'Repli ILIKE sur adresse/ville/reference_agence pour les interventions (accent-insensible via unaccent).';

-- ========================================
-- 3. search_interventions (recherche de la page Interventions)
--    Identique à 99060 + repli ILIKE sur reference_agence. Signature inchangée
--    (reference_agence sert au matching, pas retourné dans les colonnes).
-- ========================================
DROP FUNCTION IF EXISTS search_interventions(text, int, int);
CREATE OR REPLACE FUNCTION search_interventions(
  p_query text,
  p_limit int DEFAULT 20,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  id_inter text,
  contexte_intervention text,
  adresse text,
  ville text,
  agence_label text,
  artisan_plain_nom text,
  statut_label text,
  statut_color text,
  date_formatted text,
  rank real
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_query_normalized text;
  v_clean text;
  v_tsquery_full tsquery;
  v_tsquery_prefix tsquery;
BEGIN
  v_query_normalized := trim(lower(unaccent(p_query)));

  IF v_query_normalized = '' THEN
    RETURN;
  END IF;

  v_clean := trim(regexp_replace(unaccent(p_query), '[''’]+', ' ', 'g'));

  BEGIN
    v_tsquery_full := websearch_to_tsquery('french', v_clean);
    v_tsquery_prefix := to_tsquery('french',
      regexp_replace(v_clean, '\s+', ':* & ', 'g') || ':*'
    );
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY
    SELECT
      isv.id,
      isv.id_inter,
      isv.contexte_intervention,
      isv.adresse,
      isv.ville,
      isv.agence_label,
      isv.artisan_plain_nom,
      isv.statut_label,
      isv.statut_color,
      isv.date_formatted,
      1.0::real AS rank
    FROM interventions_search_mv isv
    WHERE
      isv.id_inter ILIKE '%' || p_query || '%'
      OR isv.reference_agence ILIKE '%' || p_query || '%'
      OR isv.agence_label ILIKE '%' || p_query || '%'
      OR isv.artisan_plain_nom ILIKE '%' || p_query || '%'
      OR isv.contexte_intervention ILIKE '%' || p_query || '%'
      OR isv.adresse ILIKE '%' || p_query || '%'
      OR isv.ville ILIKE '%' || p_query || '%'
      OR isv.tenant_firstname ILIKE '%' || p_query || '%'
      OR isv.tenant_lastname ILIKE '%' || p_query || '%'
    ORDER BY
      CASE
        WHEN isv.id_inter ILIKE '%' || p_query || '%' THEN 1
        WHEN isv.reference_agence ILIKE '%' || p_query || '%' THEN 2
        WHEN isv.artisan_plain_nom ILIKE '%' || p_query || '%' THEN 3
        WHEN isv.agence_label ILIKE '%' || p_query || '%' THEN 4
        WHEN isv.contexte_intervention ILIKE '%' || p_query || '%' THEN 5
        ELSE 6
      END,
      isv.date DESC
    LIMIT p_limit
    OFFSET p_offset;
    RETURN;
  END;

  RETURN QUERY
  SELECT
    isv.id,
    isv.id_inter,
    isv.contexte_intervention,
    isv.adresse,
    isv.ville,
    isv.agence_label,
    isv.artisan_plain_nom,
    isv.statut_label,
    isv.statut_color,
    isv.date_formatted,
    GREATEST(
      COALESCE(ts_rank(isv.search_vector, v_tsquery_full), 0),
      COALESCE(ts_rank(isv.search_vector, v_tsquery_prefix) * 0.9, 0),
      CASE
        WHEN isv.id_inter ILIKE '%' || p_query || '%' THEN 0.8
        ELSE 0
      END,
      CASE
        WHEN isv.reference_agence ILIKE '%' || p_query || '%' THEN 0.7
        ELSE 0
      END,
      CASE
        WHEN isv.artisan_plain_nom ILIKE '%' || p_query || '%' THEN 0.7
        ELSE 0
      END,
      CASE
        WHEN isv.agence_label ILIKE '%' || p_query || '%' THEN 0.5
        ELSE 0
      END,
      CASE
        WHEN isv.contexte_intervention ILIKE '%' || p_query || '%' THEN 0.4
        ELSE 0
      END,
      CASE
        WHEN isv.tenant_firstname ILIKE '%' || p_query || '%' THEN 0.4
        WHEN isv.tenant_lastname ILIKE '%' || p_query || '%' THEN 0.4
        ELSE 0
      END,
      CASE
        WHEN isv.ville ILIKE '%' || p_query || '%' THEN 0.3
        WHEN isv.adresse ILIKE '%' || p_query || '%' THEN 0.3
        ELSE 0
      END
    )::real AS rank
  FROM interventions_search_mv isv
  WHERE
    (isv.search_vector @@ v_tsquery_full)
    OR (isv.search_vector @@ v_tsquery_prefix)
    OR (isv.id_inter ILIKE '%' || p_query || '%')
    OR (isv.reference_agence ILIKE '%' || p_query || '%')
    OR (isv.artisan_plain_nom ILIKE '%' || p_query || '%')
    OR (isv.agence_label ILIKE '%' || p_query || '%')
    OR (isv.contexte_intervention ILIKE '%' || p_query || '%')
    OR (isv.tenant_firstname ILIKE '%' || p_query || '%')
    OR (isv.tenant_lastname ILIKE '%' || p_query || '%')
    OR (isv.ville ILIKE '%' || p_query || '%')
    OR (isv.adresse ILIKE '%' || p_query || '%')
  ORDER BY rank DESC, isv.date DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

COMMENT ON FUNCTION search_interventions IS
  'Recherche full-text interventions (page liste) avec score. Tokenisation FR : '
  'apostrophes (élision) et tirets remplacés par des espaces avant tsquery (migration 99060). '
  'Replis ILIKE sur id_inter, reference_agence, artisan, agence, contexte, tenant, ville, adresse.';

-- ========================================
-- 4. Rafraîchissement de la MV recréée
-- ========================================
REFRESH MATERIALIZED VIEW global_search_mv;

-- ============================================================================
-- FIN MIGRATION 99066
-- ============================================================================
