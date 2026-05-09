-- Fix: search_global() — typage du rang + bornage défensif du buffer live.
--
-- Historique:
--   - 99024 a introduit la recherche hybride MV + buffer live, avec rank real.
--   - Premier patch (commit c8fa527) : ts_rank() + littéraux numériques (0.5,
--     0.9...) sont double precision par défaut → upcast → mismatch avec la
--     signature `real` → erreur PG 42804 sur certains chemins.
--     Fix initial : caster ::real partout.
--   - Cette version : on règle le souci à la racine en passant la signature
--     en double precision. Plus de casts à maintenir, plus de risque qu'un
--     futur patch oublie un `::real` et casse la fonction. Le type TS généré
--     reste `number` (real et double precision projettent tous les deux sur
--     `number` dans les types Supabase) → aucun impact frontend.
--
-- Changement supplémentaire :
--   - LIMIT 500 sur les CTEs `recent_interventions` / `recent_artisans`.
--     Garde-fou : si le cron de refresh prend du retard (cf. alerte spec
--     §9 : seuil > 500), ou si `search_views_refresh_flags` est vide
--     (fallback epoch 1970-01-01), le buffer scannerait toute la table
--     active. Avec LIMIT 500 + ORDER BY updated_at DESC le worst-case est
--     borné — on garde au pire les 500 modifications les plus récentes.
--
-- Le type retourné change → DROP FUNCTION obligatoire avant CREATE.

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
  v_tsquery tsquery;
  v_tsquery_prefix tsquery;
  v_last_refresh timestamptz;
BEGIN
  v_normalized := trim(lower(unaccent(p_query)));

  IF v_normalized = '' THEN
    RETURN;
  END IF;

  BEGIN
    v_tsquery := websearch_to_tsquery('french', unaccent(p_query));
    v_tsquery_prefix := to_tsquery('french',
      regexp_replace(
        regexp_replace(unaccent(p_query), '''', '', 'g'),
        '\s+', ':* & ', 'g'
      ) || ':*'
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
      1 AS source_priority
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
  'Hybrid search: combines materialized view (bulk) with live buffer for near-real-time results. '
  'Live buffer scans rows modified since the last MV refresh, bounded to 500 rows per entity type '
  'as a safety net against cron lag.';
