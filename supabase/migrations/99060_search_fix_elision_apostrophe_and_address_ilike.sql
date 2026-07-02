-- ============================================================================
-- Migration 99060 : recherche — corrige les adresses à article élidé (L'ETOILE)
-- ============================================================================
-- Bug (intervention réelle id 21290, adresse « ... RESIDENCE DE L'ETOILE 74
-- RUE D'ANJOU 44600 ST NAZAIRE ») : dans la barre de recherche du haut
-- (search_global), l'adresse était trouvée en tapant « ...DE L'E » mais plus
-- dès « ...DE L'ET » (ni pour l'adresse complète). Ce n'est PAS une limite de
-- caractères.
--
-- Cause :
--   1. Le français indexe « L'ETOILE » sous le lexème « etoile » (l'article
--      élidé « l' » est retiré).
--   2. Le constructeur de tsquery SUPPRIMAIT les apostrophes, collant
--      « L'ET » → « LET » → terme préfixe obligatoire « let:* » qui ne matche
--      jamais « etoile ». Comme tous les termes sont en ET logique, un seul
--      terme non matché renvoie 0 résultat. « L'E » « marchait » seulement
--      parce que « le » est un mot vide (ignoré) ; dès le « t », « let » n'est
--      plus un mot vide et casse le ET.
--   3. search_global ne faisait AUCUN repli ILIKE sur l'adresse d'une
--      intervention (contrairement à search_interventions) : tout reposait
--      donc sur ce full-text cassé.
-- Correctifs :
--   A. Constructeur de tsquery : on REMPLACE les apostrophes (droite ' et
--      typographique ’) par une ESPACE au lieu de les supprimer. « L'ET » →
--      « L ET » (« l »/« et » = mots vides ignorés) ; « L'ETOILE » → « etoile »
--      (matche le lexème indexé). Appliqué à search_global ET
--      search_interventions. NB : on ne touche pas aux tirets, car « -2ND »
--      est indexé « -2 »+« nd » côté document — les retirer re-créerait un
--      décalage sur l'adresse complète.
--   B. search_global : repli ILIKE sur adresse + ville (interventions), en
--      miroir de search_interventions, côté MV et côté buffer live. On
--      « unaccent » la colonne pour rester insensible aux accents.
--
-- Remplace 2 fonctions (même signature → CREATE OR REPLACE, pas de DROP,
-- pas de reconstruction de MV). Application peu coûteuse.
-- ============================================================================

-- ========================================
-- 1. search_global (barre de recherche du haut / Cmd+K)
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
  -- v_normalized : requête brute normalisée (garde apostrophes/tirets) → ILIKE.
  v_normalized := trim(lower(unaccent(p_query)));

  IF v_normalized = '' THEN
    RETURN;
  END IF;

  -- v_clean : version tokenisable. On remplace UNIQUEMENT les apostrophes
  -- (droite ' et typographique ’) par une espace, pour aligner la requête sur
  -- l'indexation française des élisions (« L'ETOILE » indexé sous « etoile »).
  -- On NE touche PAS aux tirets : « -2ND » est indexé « -2 »+« nd » côté doc,
  -- les retirer ré-introduirait un décalage (« 2nd »). Le tiret n'est gênant
  -- que pour websearch_to_tsquery (opérateur NOT) — sans effet ici car le
  -- match passe par la requête préfixe, combinée en OR.
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
  'Repli ILIKE sur adresse/ville pour les interventions (accent-insensible via unaccent).';

-- ========================================
-- 2. search_interventions (recherche de la page Interventions)
--    Même correctif de tokenisation. Les replis ILIKE (dont adresse) y
--    existaient déjà ; on aligne juste la construction des tsquery.
-- ========================================
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

  -- Tokenisation : apostrophes (élision) uniquement → espace (cf. migration 99060,
  -- on laisse les tirets pour ne pas décaler « -2ND »).
  v_clean := trim(regexp_replace(unaccent(p_query), '[''’]+', ' ', 'g'));

  BEGIN
    v_tsquery_full := websearch_to_tsquery('french', v_clean);
    v_tsquery_prefix := to_tsquery('french',
      regexp_replace(v_clean, '\s+', ':* & ', 'g') || ':*'
    );
  EXCEPTION WHEN OTHERS THEN
    -- Si la création de la requête échoue, recherche ILIKE simple (repli).
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
        WHEN isv.artisan_plain_nom ILIKE '%' || p_query || '%' THEN 2
        WHEN isv.agence_label ILIKE '%' || p_query || '%' THEN 3
        WHEN isv.contexte_intervention ILIKE '%' || p_query || '%' THEN 4
        ELSE 5
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
  'Replis ILIKE sur id_inter, artisan, agence, contexte, tenant, ville, adresse.';

-- ============================================================================
-- FIN MIGRATION 99060
-- ============================================================================
