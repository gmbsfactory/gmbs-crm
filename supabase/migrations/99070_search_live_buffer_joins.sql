-- ============================================================================
-- Migration 99070 : recherche temps réel sur les champs JOINTS
--                   (client, commentaires, artisan lié) dans le buffer live
-- ============================================================================
-- Bug observé :
--   Après création/modification d'un dossier, la recherche par champ DIRECT de
--   l'intervention (adresse, contexte, id_inter…) est instantanée, mais la
--   recherche par champ JOINT ne remonte le dossier qu'après le prochain refresh
--   de la vue matérialisée (jusqu'à ~1 min, davantage si le REFRESH CONCURRENTLY
--   dépasse la fenêtre du cron) :
--     - infos CLIENT (locataire / propriétaire : nom, email, téléphone)
--     - COMMENTAIRES de l'intervention
--     - ARTISAN LIÉ (nom, raison sociale, n° associé, SIRET)
--
-- Cause :
--   `search_global()` combine la MV (bulk) avec un « buffer live » qui scanne
--   les lignes modifiées depuis le dernier refresh. Mais ce buffer ne lisait que
--   les colonnes DIRECTES de `interventions` (colonne générée `search_vector`),
--   qui ne peut pas contenir de champs joints. Les champs client/commentaire/
--   artisan ne vivaient donc que dans la MV → latence jusqu'au refresh.
--
-- Correctif (fix « A » : étendre le buffer live aux tables jointes, approche
-- JOINTURE au moment de la requête — cf. spec section 14bis) :
--   1. `recent_intervention_ids` : collecte des interventions « fraîches » via
--      des sources INDEXÉES (l'intervention, son tenant, son owner, ses
--      commentaires, ou son artisan lié ont été modifiés). Évite un OR sur
--      colonnes jointes à chaque frappe.
--   2. `recent_interventions` : JOIN tenants/owner + LATERAL artisan primaire +
--      LATERAL agrégat commentaires ; tsvector combiné (i.search_vector ‖ champs
--      joints pondérés comme la MV 99021) + replis ILIKE. Miroir des poids MV.
--   3. Index de support pour les nouvelles sources de recency / jointures.
--
-- Le reste de la fonction (mv_results, recent_artisans, déduplication) est
-- STRICTEMENT identique à 99066. Aucun changement front. Signature inchangée.
--
-- Champs restant MV-only (latence refresh) : agence, métier, utilisateur
-- assigné, statut. Peuvent être ajoutés selon le même patron si besoin.
--
-- ⚠️  PROD : les CREATE INDEX ci-dessous ne sont PAS concurrents (interdit en
--   transaction de migration). Sur tables volumineuses, extraire les CREATE
--   INDEX vers un script CREATE INDEX CONCURRENTLY appliqué avant cette
--   migration (les IF NOT EXISTS rendront ceux-ci no-op).
-- ============================================================================

-- ========================================
-- 1. Index de support
-- ========================================
-- recency client
CREATE INDEX IF NOT EXISTS idx_tenants_updated_at
  ON public.tenants(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_owner_updated_at
  ON public.owner(updated_at DESC);
-- jointures inverses (depuis tenant/owner vers interventions)
CREATE INDEX IF NOT EXISTS idx_interventions_tenant_id
  ON public.interventions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_interventions_owner_id
  ON public.interventions(owner_id);
-- recency commentaires (les commentaires d'intervention modifiés récemment)
CREATE INDEX IF NOT EXISTS idx_comments_intervention_updated_at
  ON public.comments(updated_at DESC)
  WHERE entity_type = 'intervention';
-- recency assignation artisan (nouvelle assignation) + jointure vers artisans
CREATE INDEX IF NOT EXISTS idx_intervention_artisans_created_at
  ON public.intervention_artisans(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_intervention_artisans_artisan_id
  ON public.intervention_artisans(artisan_id);

-- ========================================
-- 2. search_global : buffer live étendu aux champs joints
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
  -- ── MV (bulk) : IDENTIQUE À 99066 ──────────────────────────────────────
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

  -- ── IDs d'interventions « fraîches » (sources indexées) ────────────────
  --    a) l'intervention modifiée
  --    b) son locataire (tenant) modifié
  --    c) son propriétaire (owner) modifié
  --    d) un de ses commentaires modifié/ajouté
  --    e) une nouvelle assignation d'artisan
  --    f) l'artisan primaire lié a été modifié
  recent_intervention_ids AS (
    SELECT i.id
    FROM public.interventions i
    WHERE i.is_active = true AND i.updated_at > v_last_refresh
    UNION
    SELECT i.id
    FROM public.tenants t
    JOIN public.interventions i ON i.tenant_id = t.id
    WHERE i.is_active = true AND t.updated_at > v_last_refresh
    UNION
    SELECT i.id
    FROM public.owner o
    JOIN public.interventions i ON i.owner_id = o.id
    WHERE i.is_active = true AND o.updated_at > v_last_refresh
    UNION
    SELECT i.id
    FROM public.comments c
    JOIN public.interventions i ON i.id = c.entity_id
    WHERE c.entity_type = 'intervention'
      AND i.is_active = true
      AND c.updated_at > v_last_refresh
    UNION
    SELECT i.id
    FROM public.intervention_artisans ia
    JOIN public.interventions i ON i.id = ia.intervention_id
    WHERE i.is_active = true AND ia.created_at > v_last_refresh
    UNION
    SELECT i.id
    FROM public.intervention_artisans ia
    JOIN public.artisans art ON art.id = ia.artisan_id
    JOIN public.interventions i ON i.id = ia.intervention_id
    WHERE i.is_active = true
      AND ia.is_primary = true
      AND art.updated_at > v_last_refresh
  ),

  -- ── Buffer live interventions : ÉTENDU aux champs joints ────────────────
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
        'client', NULLIF(trim(coalesce(t.plain_nom_client,
                    coalesce(t.firstname, '') || ' ' || coalesce(t.lastname, ''))), ''),
        'artisan', pa.plain_nom,
        'date', to_char(i.date, 'DD/MM/YYYY')
      ) AS metadata,
      CASE
        WHEN cv.vec @@ v_tsquery OR cv.vec @@ v_tsquery_prefix
        THEN GREATEST(
          ts_rank(cv.vec, v_tsquery)::double precision,
          ts_rank(cv.vec, v_tsquery_prefix)::double precision * 0.9
        )
        ELSE 0.3
      END AS rank,
      0 AS source_priority
    FROM public.interventions i
    JOIN recent_intervention_ids r ON r.id = i.id
    LEFT JOIN public.tenants t ON i.tenant_id = t.id
    LEFT JOIN public.owner o ON i.owner_id = o.id
    -- artisan primaire lié
    LEFT JOIN LATERAL (
      SELECT art.numero_associe, art.siret, art.plain_nom, art.raison_sociale,
             art.email, art.telephone, art.telephone2
      FROM public.intervention_artisans ia
      JOIN public.artisans art ON art.id = ia.artisan_id
      WHERE ia.intervention_id = i.id AND ia.is_primary = true
      ORDER BY ia.created_at ASC
      LIMIT 1
    ) pa ON true
    -- agrégat des commentaires de l'intervention
    LEFT JOIN LATERAL (
      SELECT string_agg(c.content, ' | ') AS commentaires
      FROM public.comments c
      WHERE c.entity_type = 'intervention' AND c.entity_id = i.id
    ) cm ON true
    -- tsvector combiné : base intervention + champs joints, pondérés comme la MV (99021)
    CROSS JOIN LATERAL (
      SELECT
        i.search_vector
        -- POIDS A : identifiants artisan
        || setweight(to_tsvector('french', f_unaccent(coalesce(pa.numero_associe, ''))), 'A')
        || setweight(to_tsvector('french', f_unaccent(coalesce(pa.siret, ''))), 'A')
        -- POIDS B : noms client + artisan
        || setweight(to_tsvector('french', f_unaccent(coalesce(t.plain_nom_client, ''))), 'B')
        || setweight(to_tsvector('french', f_unaccent(coalesce(t.firstname || ' ' || t.lastname, ''))), 'B')
        || setweight(to_tsvector('french', f_unaccent(coalesce(o.plain_nom_facturation, ''))), 'B')
        || setweight(to_tsvector('french', f_unaccent(coalesce(o.owner_firstname || ' ' || o.owner_lastname, ''))), 'B')
        || setweight(to_tsvector('french', f_unaccent(coalesce(pa.plain_nom, ''))), 'B')
        || setweight(to_tsvector('french', f_unaccent(coalesce(pa.raison_sociale, ''))), 'B')
        -- POIDS C : email + téléphone client/artisan + commentaires
        || setweight(to_tsvector('french', f_unaccent(coalesce(t.email, ''))), 'C')
        || setweight(to_tsvector('french', f_unaccent(coalesce(o.email, ''))), 'C')
        || setweight(to_tsvector('french', f_unaccent(coalesce(pa.email, ''))), 'C')
        || setweight(to_tsvector('french', f_unaccent(coalesce(regexp_replace(t.telephone, '[^0-9]', '', 'g'), ''))), 'C')
        || setweight(to_tsvector('french', f_unaccent(coalesce(regexp_replace(t.telephone2, '[^0-9]', '', 'g'), ''))), 'C')
        || setweight(to_tsvector('french', f_unaccent(coalesce(regexp_replace(o.telephone, '[^0-9]', '', 'g'), ''))), 'C')
        || setweight(to_tsvector('french', f_unaccent(coalesce(regexp_replace(o.telephone2, '[^0-9]', '', 'g'), ''))), 'C')
        || setweight(to_tsvector('french', f_unaccent(coalesce(regexp_replace(pa.telephone, '[^0-9]', '', 'g'), ''))), 'C')
        || setweight(to_tsvector('french', f_unaccent(coalesce(regexp_replace(pa.telephone2, '[^0-9]', '', 'g'), ''))), 'C')
        || setweight(to_tsvector('french', f_unaccent(coalesce(cm.commentaires, ''))), 'C')
        AS vec
    ) cv
    WHERE (p_entity_type IS NULL OR p_entity_type = 'intervention')
      AND (
        cv.vec @@ v_tsquery
        OR cv.vec @@ v_tsquery_prefix
        -- replis ILIKE « contient » : intervention directe
        OR i.id_inter ILIKE '%' || v_normalized || '%'
        OR i.reference_agence ILIKE '%' || v_normalized || '%'
        OR unaccent(i.adresse) ILIKE '%' || v_normalized || '%'
        OR unaccent(i.ville) ILIKE '%' || v_normalized || '%'
        OR i.code_postal ILIKE '%' || v_normalized || '%'
        -- replis ILIKE « contient » : client
        OR f_unaccent(coalesce(t.plain_nom_client, '')) ILIKE '%' || v_normalized || '%'
        OR f_unaccent(coalesce(t.firstname || ' ' || t.lastname, '')) ILIKE '%' || v_normalized || '%'
        OR f_unaccent(coalesce(o.plain_nom_facturation, '')) ILIKE '%' || v_normalized || '%'
        OR f_unaccent(coalesce(o.owner_firstname || ' ' || o.owner_lastname, '')) ILIKE '%' || v_normalized || '%'
        OR f_unaccent(coalesce(t.email, '')) ILIKE '%' || v_normalized || '%'
        OR f_unaccent(coalesce(o.email, '')) ILIKE '%' || v_normalized || '%'
        -- replis ILIKE « contient » : artisan lié
        OR coalesce(pa.numero_associe, '') ILIKE '%' || v_normalized || '%'
        OR f_unaccent(coalesce(pa.plain_nom, '')) ILIKE '%' || v_normalized || '%'
        OR f_unaccent(coalesce(pa.raison_sociale, '')) ILIKE '%' || v_normalized || '%'
        -- repli ILIKE « contient » : commentaires
        OR f_unaccent(coalesce(cm.commentaires, '')) ILIKE '%' || v_normalized || '%'
      )
    ORDER BY i.updated_at DESC
    LIMIT 500
  ),

  -- ── Buffer live artisans : IDENTIQUE À 99066 ───────────────────────────
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
  'Buffer live étendu (99070) aux champs JOINTS via jointure au moment de la requête : '
  'client (tenant/owner), commentaires, artisan lié — recherche temps réel avec tsvector combiné. '
  'Tokenisation FR : apostrophes (élision) et tirets remplacés par des espaces avant tsquery. '
  'Repli ILIKE (accent-insensible) sur adresse/ville/reference_agence + noms/email client/artisan + commentaires.';

-- ============================================================================
-- FIN MIGRATION 99070
-- ============================================================================
-- Vérification manuelle (avant le refresh cron, < 60s après l'écriture) :
--   -- client
--   SELECT entity_id, metadata->>'client' FROM search_global('<nom locataire>', 20, 0, NULL);
--   -- commentaire fraîchement ajouté
--   SELECT entity_id FROM search_global('<mot du commentaire>', 20, 0, NULL);
--   -- artisan fraîchement assigné
--   SELECT entity_id, metadata->>'artisan' FROM search_global('<nom artisan>', 20, 0, NULL);
--   → chaque dossier doit remonter SANS attendre le refresh de la MV.
-- ============================================================================
