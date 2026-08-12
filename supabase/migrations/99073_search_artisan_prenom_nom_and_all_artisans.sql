-- ============================================================================
-- Migration 99073 : recherche par NOM D'ARTISAN (prenom/nom) + TOUS les artisans
-- ============================================================================
-- Bug observé (remonté par Badr et Andrea) :
--   Taper le nom d'un artisan dans la barre de recherche de la page
--   interventions ne remonte qu'une PARTIE de ses dossiers — parfois 4 sur 10 —
--   sans logique apparente (ni statut, ni date, ni pagination).
--
-- Cause racine :
--   Le `search_vector` de `interventions_search_mv` (migration 99021) n'indexe
--   QUE `plain_nom` et `raison_sociale` de l'artisan. Les colonnes `prenom` et
--   `nom` — celles que l'UI affiche — ne sont indexées NULLE PART.
--   Or `plain_nom` n'est renseigné que par l'import CSV historique : les
--   artisans créés depuis l'application ont `plain_nom = NULL`. Pour eux, le
--   nom n'est donc jamais indexé, et les rares dossiers qui remontaient
--   matchaient par accident via un autre champ du vecteur (un commentaire ou
--   une consigne où quelqu'un avait tapé le nom à la main) — d'où le caractère
--   erratique du symptôme.
--
-- Second défaut corrigé ici :
--   Le CTE `primary_artisans` filtre `WHERE ia.is_primary = true`. Les artisans
--   SECONDAIRES d'une intervention n'étaient donc indexés d'aucune façon.
--
-- Correctif :
--   1. Nouveau CTE `all_artisans` : agrégat de TOUS les artisans liés à
--      l'intervention (plus de filtre `is_primary`), alimentant le tsvector.
--      `prenom` et `nom` y sont inclus, au poids B comme `plain_nom`.
--   2. `primary_artisans` est CONSERVÉ tel quel pour les colonnes d'AFFICHAGE
--      (la forme de retour de `search_interventions` est inchangée).
--   3. Nouvelle colonne `artisans_aggreges` exposée pour les replis ILIKE.
--   4. Le nom affiché retombe sur `prenom nom` puis `raison_sociale` quand
--      `plain_nom` est NULL (sinon l'UI affiche du vide pour ces artisans).
--   5. Même delta appliqué aux 3 endroits qui doivent rester cohérents, sinon
--      la recherche diverge entre lignes fraîches et lignes en MV :
--        - le tsvector de la MV (forme 99021),
--        - les replis ILIKE de `search_interventions` (99066),
--        - le buffer live de `search_global` (99070).
--
-- ⚠️  PROD : cette migration reconstruit `interventions_search_mv` ET
--   `global_search_mv` (DROP ... CASCADE). Le REFRESH complet des deux vues est
--   bloquant — à appliquer HORS HEURES DE POINTE.
--
-- ⚠️  PROD : les CREATE INDEX ci-dessous ne sont PAS concurrents (interdit en
--   transaction de migration). Sur tables volumineuses, extraire les CREATE
--   INDEX vers un script CREATE INDEX CONCURRENTLY appliqué avant cette
--   migration.
-- ============================================================================

-- ========================================
-- 1. Index de support (agrégat tous artisans)
-- ========================================
CREATE INDEX IF NOT EXISTS idx_intervention_artisans_intervention_id
  ON public.intervention_artisans(intervention_id);

-- ========================================
-- 2. interventions_search_mv : tsvector alimenté par TOUS les artisans
-- ========================================
DROP MATERIALIZED VIEW IF EXISTS global_search_mv CASCADE;
DROP MATERIALIZED VIEW IF EXISTS interventions_search_mv CASCADE;

CREATE MATERIALIZED VIEW interventions_search_mv AS
WITH intervention_comments AS (
  SELECT
    entity_id as intervention_id,
    string_agg(content, ' | ') as commentaires_aggreges
  FROM public.comments
  WHERE entity_type = 'intervention'
  GROUP BY entity_id
),
-- Artisan primaire : sert UNIQUEMENT aux colonnes d'affichage (inchangé).
primary_artisans AS (
  SELECT DISTINCT ON (ia.intervention_id)
    ia.intervention_id,
    ia.artisan_id,
    art.prenom,
    art.nom,
    art.plain_nom,
    art.email,
    art.telephone,
    art.telephone2,
    art.raison_sociale,
    art.siret,
    art.statut_juridique,
    art.adresse_siege_social,
    art.ville_siege_social,
    art.code_postal_siege_social,
    art.adresse_intervention,
    art.ville_intervention,
    art.code_postal_intervention,
    art.numero_associe,
    art.statut_dossier,
    art.suivi_relances_docs,
    art.date_ajout
  FROM public.intervention_artisans ia
  LEFT JOIN public.artisans art ON ia.artisan_id = art.id
  WHERE ia.is_primary = true
  ORDER BY ia.intervention_id, ia.created_at ASC
),
-- TOUS les artisans liés (primaire ET secondaires) : alimente le tsvector.
-- `prenom` et `nom` sont désormais inclus — c'est le coeur du correctif.
all_artisans AS (
  SELECT
    ia.intervention_id,
    string_agg(concat_ws(' ', art.numero_associe, art.siret), ' ')            AS ids_a,
    string_agg(concat_ws(' ', art.prenom, art.nom, art.plain_nom,
                              art.raison_sociale), ' ')                        AS noms_b,
    string_agg(coalesce(art.email, ''), ' ')                                   AS emails_c,
    string_agg(concat_ws(' ',
      regexp_replace(coalesce(art.telephone, ''), '[^0-9]', '', 'g'),
      regexp_replace(coalesce(art.telephone2, ''), '[^0-9]', '', 'g')), ' ')   AS tels_c,
    string_agg(concat_ws(' ', art.adresse_siege_social,
                              art.ville_siege_social), ' ')                    AS adresses_d
  FROM public.intervention_artisans ia
  JOIN public.artisans art ON art.id = ia.artisan_id
  GROUP BY ia.intervention_id
)
SELECT
  i.id,
  i.id_inter,
  i.created_at,
  i.updated_at,
  i.is_active,

  i.contexte_intervention,
  i.consigne_intervention,
  i.consigne_second_artisan,
  i.commentaire_agent,
  i.reference_agence,
  i.adresse,
  i.code_postal,
  i.ville,
  i.key_code,
  i.floor,
  i.apartment_number,
  i.vacant_housing_instructions,

  to_char(i.date, 'DD/MM/YYYY HH24:MI') as date_formatted,
  to_char(i.date_termine, 'DD/MM/YYYY HH24:MI') as date_termine_formatted,
  to_char(i.date_prevue, 'DD/MM/YYYY HH24:MI') as date_prevue_formatted,
  to_char(i.due_date, 'DD/MM/YYYY') as due_date_formatted,

  a.code as agence_code,
  a.label as agence_label,
  a.region as agence_region,

  t.firstname as tenant_firstname,
  t.lastname as tenant_lastname,
  t.plain_nom_client as tenant_plain_nom_client,
  t.email as tenant_email,
  t.telephone as tenant_telephone,
  t.telephone2 as tenant_telephone2,
  t.adresse as tenant_adresse,
  t.ville as tenant_ville,
  t.code_postal as tenant_code_postal,

  o.owner_firstname,
  o.owner_lastname,
  o.plain_nom_facturation as owner_plain_nom_facturation,
  o.email as owner_email,
  o.telephone as owner_telephone,
  o.telephone2 as owner_telephone2,
  o.adresse as owner_adresse,
  o.ville as owner_ville,
  o.code_postal as owner_code_postal,

  u.firstname as assigned_user_firstname,
  u.lastname as assigned_user_lastname,
  u.username as assigned_user_username,
  u.code_gestionnaire as assigned_user_code,

  s.code as statut_code,
  s.label as statut_label,
  s.color as statut_color,

  m.code as metier_code,
  m.label as metier_label,
  m.description as metier_description,

  pa.prenom as artisan_prenom,
  pa.nom as artisan_nom,
  -- `plain_nom` est NULL pour tout artisan créé hors import CSV : on retombe
  -- sur « prenom nom » puis `raison_sociale` pour que l'UI affiche un libellé.
  COALESCE(
    NULLIF(trim(pa.plain_nom), ''),
    NULLIF(trim(concat_ws(' ', pa.prenom, pa.nom)), ''),
    NULLIF(trim(pa.raison_sociale), '')
  ) as artisan_plain_nom,
  pa.email as artisan_email,
  pa.telephone as artisan_telephone,
  pa.telephone2 as artisan_telephone2,
  pa.raison_sociale as artisan_raison_sociale,
  pa.siret as artisan_siret,
  pa.statut_juridique as artisan_statut_juridique,
  pa.adresse_siege_social as artisan_adresse_siege,
  pa.ville_siege_social as artisan_ville_siege,
  pa.code_postal_siege_social as artisan_code_postal_siege,
  pa.adresse_intervention as artisan_adresse_intervention,
  pa.ville_intervention as artisan_ville_intervention,
  pa.code_postal_intervention as artisan_code_postal_intervention,
  pa.numero_associe as artisan_numero_associe,
  pa.statut_dossier as artisan_statut_dossier,
  pa.suivi_relances_docs as artisan_suivi_relances,
  to_char(pa.date_ajout, 'DD/MM/YYYY') as artisan_date_ajout,

  -- Agrégat des noms de TOUS les artisans liés : support des replis ILIKE.
  aa.noms_b as artisans_aggreges,

  ic.commentaires_aggreges,

  -- POIDS A: Identifiants critiques
  setweight(to_tsvector('french', unaccent(coalesce(i.id_inter, ''))), 'A') ||
  setweight(to_tsvector('french', unaccent(coalesce(i.reference_agence, ''))), 'A') ||
  setweight(to_tsvector('french', unaccent(coalesce(aa.ids_a, ''))), 'A') ||

  -- POIDS B: Informations principales
  setweight(to_tsvector('french', unaccent(coalesce(i.contexte_intervention, ''))), 'B') ||
  setweight(to_tsvector('french', unaccent(coalesce(a.label, ''))), 'B') ||
  -- ↓ prenom + nom + plain_nom + raison_sociale de TOUS les artisans liés
  setweight(to_tsvector('french', unaccent(coalesce(aa.noms_b, ''))), 'B') ||
  setweight(to_tsvector('french', unaccent(coalesce(t.plain_nom_client, ''))), 'B') ||
  setweight(to_tsvector('french', unaccent(coalesce(t.firstname || ' ' || t.lastname, ''))), 'B') ||
  setweight(to_tsvector('french', unaccent(coalesce(o.plain_nom_facturation, ''))), 'B') ||
  setweight(to_tsvector('french', unaccent(coalesce(o.owner_firstname || ' ' || o.owner_lastname, ''))), 'B') ||
  setweight(to_tsvector('french', unaccent(coalesce(m.label, ''))), 'B') ||

  -- POIDS C: Informations secondaires
  setweight(to_tsvector('french', unaccent(coalesce(i.consigne_intervention, ''))), 'C') ||
  setweight(to_tsvector('french', unaccent(coalesce(i.commentaire_agent, ''))), 'C') ||
  setweight(to_tsvector('french', unaccent(coalesce(i.adresse, ''))), 'C') ||
  setweight(to_tsvector('french', unaccent(coalesce(i.ville, ''))), 'C') ||
  setweight(to_tsvector('french', unaccent(coalesce(i.code_postal, ''))), 'C') ||
  setweight(to_tsvector('french', unaccent(coalesce(aa.emails_c, ''))), 'C') ||
  setweight(to_tsvector('french', unaccent(coalesce(t.email, ''))), 'C') ||
  setweight(to_tsvector('french', unaccent(coalesce(o.email, ''))), 'C') ||
  setweight(to_tsvector('french', unaccent(coalesce(u.username, ''))), 'C') ||
  setweight(to_tsvector('french', unaccent(coalesce(ic.commentaires_aggreges, ''))), 'C') ||
  setweight(to_tsvector('french', unaccent(coalesce(regexp_replace(t.telephone, '[^0-9]', '', 'g'), ''))), 'C') ||
  setweight(to_tsvector('french', unaccent(coalesce(regexp_replace(t.telephone2, '[^0-9]', '', 'g'), ''))), 'C') ||
  setweight(to_tsvector('french', unaccent(coalesce(regexp_replace(o.telephone, '[^0-9]', '', 'g'), ''))), 'C') ||
  setweight(to_tsvector('french', unaccent(coalesce(regexp_replace(o.telephone2, '[^0-9]', '', 'g'), ''))), 'C') ||
  setweight(to_tsvector('french', unaccent(coalesce(aa.tels_c, ''))), 'C') ||

  -- POIDS D: Détails et métadonnées
  setweight(to_tsvector('french', unaccent(coalesce(i.consigne_second_artisan, ''))), 'D') ||
  setweight(to_tsvector('french', unaccent(coalesce(aa.adresses_d, ''))), 'D') ||
  setweight(to_tsvector('french', unaccent(coalesce(s.label, ''))), 'D') ||
  setweight(to_tsvector('french', unaccent(coalesce(m.description, ''))), 'D')
  AS search_vector,

  i.statut_id,
  i.agence_id,
  i.metier_id,
  i.assigned_user_id,
  i.date,
  i.date_prevue,
  pa.artisan_id as primary_artisan_id

FROM public.interventions i
LEFT JOIN public.agencies a ON i.agence_id = a.id
LEFT JOIN public.tenants t ON i.tenant_id = t.id
LEFT JOIN public.owner o ON i.owner_id = o.id
LEFT JOIN public.users u ON i.assigned_user_id = u.id
LEFT JOIN public.intervention_statuses s ON i.statut_id = s.id
LEFT JOIN public.metiers m ON i.metier_id = m.id
LEFT JOIN primary_artisans pa ON i.id = pa.intervention_id
LEFT JOIN all_artisans aa ON i.id = aa.intervention_id
LEFT JOIN intervention_comments ic ON i.id = ic.intervention_id

WHERE i.is_active = true;

CREATE INDEX idx_interventions_search_vector ON interventions_search_mv USING gin(search_vector);
CREATE INDEX idx_interventions_search_statut ON interventions_search_mv(statut_id);
CREATE INDEX idx_interventions_search_agence ON interventions_search_mv(agence_id);
CREATE INDEX idx_interventions_search_assigned_user ON interventions_search_mv(assigned_user_id);
CREATE INDEX idx_interventions_search_date ON interventions_search_mv(date DESC);
-- Index UNIQUE requis par REFRESH MATERIALIZED VIEW CONCURRENTLY.
CREATE UNIQUE INDEX idx_interventions_search_id ON interventions_search_mv(id);

-- ========================================
-- 3. global_search_mv (dépend de interventions_search_mv)
-- ========================================
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
    -- exposé depuis 99066 : permet le repli ILIKE « contient » sur la référence
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

REFRESH MATERIALIZED VIEW interventions_search_mv;
REFRESH MATERIALIZED VIEW global_search_mv;

-- Le buffer live de `search_global` calcule sa fenêtre depuis ce flag : après
-- reconstruction des vues, le remettre à l'heure évite un scan inutilement
-- large (ou un trou) au premier appel.
UPDATE public.search_views_refresh_flags
SET needs_refresh = false,
    last_refresh = now()
WHERE id = 'global_search_mv';

-- ========================================
-- 4. search_interventions : replis ILIKE sur TOUS les artisans
-- ========================================
-- Signature et forme de retour INCHANGÉES. Seuls les replis ILIKE passent de
-- `artisan_plain_nom` (artisan primaire, souvent NULL) à `artisans_aggreges`
-- (tous les artisans liés, prenom/nom inclus).
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
      OR unaccent(coalesce(isv.artisans_aggreges, '')) ILIKE '%' || unaccent(p_query) || '%'
      OR isv.contexte_intervention ILIKE '%' || p_query || '%'
      OR isv.adresse ILIKE '%' || p_query || '%'
      OR isv.ville ILIKE '%' || p_query || '%'
      OR isv.tenant_firstname ILIKE '%' || p_query || '%'
      OR isv.tenant_lastname ILIKE '%' || p_query || '%'
    ORDER BY
      CASE
        WHEN isv.id_inter ILIKE '%' || p_query || '%' THEN 1
        WHEN isv.reference_agence ILIKE '%' || p_query || '%' THEN 2
        WHEN unaccent(coalesce(isv.artisans_aggreges, '')) ILIKE '%' || unaccent(p_query) || '%' THEN 3
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
        WHEN unaccent(coalesce(isv.artisans_aggreges, '')) ILIKE '%' || unaccent(p_query) || '%' THEN 0.7
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
    OR (unaccent(coalesce(isv.artisans_aggreges, '')) ILIKE '%' || unaccent(p_query) || '%')
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
  'Replis ILIKE sur id_inter, reference_agence, artisans (TOUS les artisans liés, '
  'prenom/nom/plain_nom/raison_sociale — migration 99073), agence, contexte, tenant, ville, adresse.';

-- ========================================
-- 5. search_global : buffer live aligné sur TOUS les artisans
-- ========================================
-- Delta vs 99070 : le LATERAL `pa` ne se limite plus à l'artisan primaire et
-- agrège prenom/nom ; `recent_intervention_ids` détecte aussi la modification
-- d'un artisan SECONDAIRE. Le reste est strictement identique.
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
  -- ── MV (bulk) ──────────────────────────────────────────────────────────
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
              WHEN (gsv.metadata->>'artisan')::text ILIKE '%' || v_normalized || '%' THEN 0.5
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
          OR (gsv.metadata->>'artisan')::text ILIKE '%' || v_normalized || '%'
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
  --    f) un de ses artisans liés a été modifié (primaire OU secondaire)
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
      AND art.updated_at > v_last_refresh
  ),

  -- ── Buffer live interventions : TOUS les artisans liés ──────────────────
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
        'artisan', pa.libelle_primaire,
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
    -- TOUS les artisans liés, agrégés (miroir du CTE `all_artisans` de la MV).
    -- `libelle_primaire` reste le libellé d'affichage de l'artisan primaire.
    LEFT JOIN LATERAL (
      SELECT
        string_agg(concat_ws(' ', art.numero_associe, art.siret), ' ')          AS ids_a,
        string_agg(concat_ws(' ', art.prenom, art.nom, art.plain_nom,
                                  art.raison_sociale), ' ')                     AS noms_b,
        string_agg(coalesce(art.email, ''), ' ')                                AS emails_c,
        string_agg(concat_ws(' ',
          regexp_replace(coalesce(art.telephone, ''), '[^0-9]', '', 'g'),
          regexp_replace(coalesce(art.telephone2, ''), '[^0-9]', '', 'g')), ' ') AS tels_c,
        (array_agg(
           COALESCE(
             NULLIF(trim(art.plain_nom), ''),
             NULLIF(trim(concat_ws(' ', art.prenom, art.nom)), ''),
             NULLIF(trim(art.raison_sociale), '')
           )
           ORDER BY ia.is_primary DESC NULLS LAST, ia.created_at ASC
         ))[1]                                                                  AS libelle_primaire
      FROM public.intervention_artisans ia
      JOIN public.artisans art ON art.id = ia.artisan_id
      WHERE ia.intervention_id = i.id
    ) pa ON true
    -- agrégat des commentaires de l'intervention
    LEFT JOIN LATERAL (
      SELECT string_agg(c.content, ' | ') AS commentaires
      FROM public.comments c
      WHERE c.entity_type = 'intervention' AND c.entity_id = i.id
    ) cm ON true
    -- tsvector combiné : base intervention + champs joints, pondérés comme la MV (99073)
    CROSS JOIN LATERAL (
      SELECT
        i.search_vector
        -- POIDS A : identifiants artisan
        || setweight(to_tsvector('french', f_unaccent(coalesce(pa.ids_a, ''))), 'A')
        -- POIDS B : noms client + artisan (prenom/nom inclus)
        || setweight(to_tsvector('french', f_unaccent(coalesce(t.plain_nom_client, ''))), 'B')
        || setweight(to_tsvector('french', f_unaccent(coalesce(t.firstname || ' ' || t.lastname, ''))), 'B')
        || setweight(to_tsvector('french', f_unaccent(coalesce(o.plain_nom_facturation, ''))), 'B')
        || setweight(to_tsvector('french', f_unaccent(coalesce(o.owner_firstname || ' ' || o.owner_lastname, ''))), 'B')
        || setweight(to_tsvector('french', f_unaccent(coalesce(pa.noms_b, ''))), 'B')
        -- POIDS C : email + téléphone client/artisan + commentaires
        || setweight(to_tsvector('french', f_unaccent(coalesce(t.email, ''))), 'C')
        || setweight(to_tsvector('french', f_unaccent(coalesce(o.email, ''))), 'C')
        || setweight(to_tsvector('french', f_unaccent(coalesce(pa.emails_c, ''))), 'C')
        || setweight(to_tsvector('french', f_unaccent(coalesce(regexp_replace(t.telephone, '[^0-9]', '', 'g'), ''))), 'C')
        || setweight(to_tsvector('french', f_unaccent(coalesce(regexp_replace(t.telephone2, '[^0-9]', '', 'g'), ''))), 'C')
        || setweight(to_tsvector('french', f_unaccent(coalesce(regexp_replace(o.telephone, '[^0-9]', '', 'g'), ''))), 'C')
        || setweight(to_tsvector('french', f_unaccent(coalesce(regexp_replace(o.telephone2, '[^0-9]', '', 'g'), ''))), 'C')
        || setweight(to_tsvector('french', f_unaccent(coalesce(pa.tels_c, ''))), 'C')
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
        -- replis ILIKE « contient » : TOUS les artisans liés
        OR f_unaccent(coalesce(pa.ids_a, '')) ILIKE '%' || v_normalized || '%'
        OR f_unaccent(coalesce(pa.noms_b, '')) ILIKE '%' || v_normalized || '%'
        -- repli ILIKE « contient » : commentaires
        OR f_unaccent(coalesce(cm.commentaires, '')) ILIKE '%' || v_normalized || '%'
      )
    ORDER BY i.updated_at DESC
    LIMIT 500
  ),

  -- ── Buffer live artisans : IDENTIQUE À 99070 ───────────────────────────
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
  'client (tenant/owner), commentaires, artisans liés — recherche temps réel avec tsvector combiné. '
  'Depuis 99073 : TOUS les artisans liés (primaire ET secondaires), prenom/nom inclus. '
  'Tokenisation FR : apostrophes (élision) et tirets remplacés par des espaces avant tsquery. '
  'Repli ILIKE (accent-insensible) sur adresse/ville/reference_agence + noms/email client/artisan + commentaires.';

-- ============================================================================
-- FIN MIGRATION 99073
-- ============================================================================
-- Vérification manuelle (cas ayant motivé la migration) :
--
--   -- 1. L'artisan « ABELOIHED Ajjari » (plain_nom NULL) : 10 dossiers en base.
--   --    Avant 99073 : 4 résultats. Après : 10.
--   SELECT count(*) FROM search_interventions('Ajjari', 100, 0);   -- attendu : 10
--   SELECT count(*) FROM search_global('Ajjari', 100, 0, 'intervention');
--
--   -- 2. Le libellé artisan ne doit plus être NULL pour ces dossiers.
--   SELECT id_inter, artisan_plain_nom FROM search_interventions('Ajjari', 100, 0);
--
--   -- 3. Cas signalé par Andrea (second jeu de test).
--   SELECT count(*) FROM search_interventions('Damian', 100, 0);
--
--   -- 4. Artisan SECONDAIRE : doit désormais remonter.
--   SELECT count(*) FROM search_interventions('<nom d''un artisan secondaire>', 100, 0);
--
--   -- 5. Non-régression : la recherche par id_inter / adresse / client reste OK.
--   SELECT count(*) FROM search_interventions('22418', 20, 0);      -- attendu : >= 1
-- ============================================================================
