-- ============================================
-- MIGRATION: Dashboard admin — CA / marge sur la DATE DE CLÔTURE
-- ============================================
-- Contexte métier (décidé le 09/09/2026) :
--   Le chiffre d'affaires et la marge d'un dossier doivent être comptés dans
--   la période où le dossier a été CLÔTURÉ (passage en INTER_TERMINEE), et non
--   dans celle où il a été créé (`interventions.date`), comme le faisait la
--   migration 00018.
--
-- RÈGLES RETENUES
--   1. DOUBLE AXE. Le dashboard mélange volontairement deux axes de temps :
--        - AXE CLÔTURE  : ca_total, couts_total, marge_total, taux_marge,
--                         ca_moyen, nb_interventions_terminees, ca_jour /
--                         marge_jour des sparklines, et les colonnes
--                         correspondantes des tables de performance
--                         (gestionnaires / agences / métiers).
--        - AXE CRÉATION : nb_interventions_demandees, funnel de conversion,
--                         status breakdown, volume par statut.
--      Un dossier non clôturé n'a pas de date de clôture : le garder sur l'axe
--      création est la seule façon de continuer à voir le pipeline en cours.
--      CONSÉQUENCE ASSUMÉE : taux_transformation = terminées(clôture) /
--      demandées(création) croise deux cohortes et peut dépasser 100 % sur une
--      période où l'on clôture plus de dossiers qu'on n'en ouvre.
--
--   2. « CLÔTURÉ » = A ATTEINT INTER_TERMINEE, quel que soit le statut actuel.
--      Le workflow autorise INTER_TERMINEE -> SAV et INTER_TERMINEE ->
--      INTER_EN_COURS : avant cette migration, un dossier rouvert ou passé en
--      SAV disparaissait purement et simplement du CA. Lecture comptable : le
--      CA reste acquis. Date retenue = DERNIÈRE clôture (MAX), pour qu'un
--      dossier rouvert puis re-clôturé ne soit jamais compté deux fois.
--
--   3. PÉRIMÈTRE « DONNÉES RÉELLES ». Cf. src/lib/api/interventions/stats/
--      transitions-scope.ts : l'import des 28-29/06/2026 a recréé l'historique
--      et généré ~6 500 transitions sans acteur, datées de l'import. Les
--      prendre pour argent comptant écraserait tout le CA historique sur la
--      semaine du go-live. Une transition ne vaut donc clôture que si elle est
--      POSTÉRIEURE AU GO-LIVE et PORTÉE PAR UN ACTEUR HUMAIN
--      (`changed_by_user_id` non nul) — critère STRICTEMENT identique à celui
--      de `get_podium_ranking_by_period` (migration 99063), faute de quoi le
--      podium et les cartes du dashboard afficheraient deux marges différentes.
--      Un dossier sans clôture éligible n'entre dans aucun CA.
--
--   4. BORNE DE FIN INCLUSIVE SUR LE JOUR. La couche TS appelle avec
--      `p_period_end = <jour>T23:59:59`, ce qui perdait les clôtures des
--      dernières fractions de seconde. Les prédicats de clôture utilisent une
--      borne exclusive au jour suivant. Les prédicats sur `i.date` sont laissés
--      tels quels pour ne pas modifier l'axe création au passage.
--
-- Les signatures des fonctions et la forme du payload sont inchangées :
-- src/lib/api/interventions/stats/admin-dashboard.ts n'a pas à bouger.
-- ============================================

-- ============================================
-- SECTION 0: DATE DE CLÔTURE CANONIQUE
-- ============================================

-- Une ligne par intervention ayant réellement été clôturée au moins une fois.
-- Vue non exposée : seules les fonctions SECURITY DEFINER ci-dessous la lisent
-- (elles s'exécutent avec le rôle propriétaire), ce qui évite d'ouvrir un
-- nouveau canal de lecture sur l'historique des transitions.
CREATE OR REPLACE VIEW public.v_intervention_closure AS
SELECT
  t.intervention_id,
  MAX(t.transition_date) AS closed_at
FROM public.intervention_status_transitions t
WHERE t.to_status_code = 'INTER_TERMINEE'
  -- Règle n°3 — périmètre « données réelles », STRICTEMENT identique à celui de
  -- get_podium_ranking_by_period (migration 99063) : postérieur au go-live ET
  -- porté par un acteur humain. Toute divergence ici ferait afficher deux
  -- marges différentes entre le podium et les cartes du dashboard.
  AND t.changed_by_user_id IS NOT NULL
  AND t.transition_date >= TIMESTAMPTZ '2026-06-28T22:00:00Z'
GROUP BY t.intervention_id;

COMMENT ON VIEW public.v_intervention_closure IS
  'Date de cloture canonique d''une intervention = derniere transition vers INTER_TERMINEE dans le perimetre donnees reelles (>= go-live 29/06/2026 et acteur humain), identique a get_podium_ranking_by_period. Usage interne aux RPC du dashboard.';

REVOKE ALL ON public.v_intervention_closure FROM PUBLIC;
REVOKE ALL ON public.v_intervention_closure FROM anon, authenticated;

-- ============================================
-- SECTION 1: KPIs PRINCIPAUX
-- ============================================

CREATE OR REPLACE FUNCTION get_dashboard_kpi_main_v3(
  p_period_start TIMESTAMP,
  p_period_end TIMESTAMP,
  p_agence_ids UUID[] DEFAULT NULL,
  p_gestionnaire_ids UUID[] DEFAULT NULL,
  p_metier_ids UUID[] DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
  v_close_end TIMESTAMP;
  v_nb_interventions_demandees INTEGER;
  v_nb_interventions_terminees INTEGER;
  v_ca_total NUMERIC;
  v_couts_total NUMERIC;
  v_marge_total NUMERIC;
  v_taux_transformation NUMERIC;
  v_taux_marge NUMERIC;
  v_ca_moyen NUMERIC;
BEGIN
  -- Règle n°4 : borne de fin exclusive au jour suivant pour l'axe clôture.
  v_close_end := DATE_TRUNC('day', p_period_end) + INTERVAL '1 day';

  -- AXE CRÉATION — nombre d'interventions demandées (créées dans la période)
  SELECT COUNT(*)
  INTO v_nb_interventions_demandees
  FROM interventions i
  WHERE i.date >= p_period_start
    AND i.date <= p_period_end
    AND i.is_active = true
    AND (array_length(p_agence_ids, 1) IS NULL OR i.agence_id = ANY(p_agence_ids))
    AND (array_length(p_gestionnaire_ids, 1) IS NULL OR i.assigned_user_id = ANY(p_gestionnaire_ids))
    AND (array_length(p_metier_ids, 1) IS NULL OR i.metier_id = ANY(p_metier_ids));

  -- AXE CLÔTURE — interventions clôturées dans la période, et leur économie.
  -- Les coûts sont agrégés en LATERAL pour ne pas dupliquer le COUNT.
  SELECT
    COUNT(*),
    COALESCE(SUM(c.ca), 0),
    COALESCE(SUM(c.couts), 0)
  INTO v_nb_interventions_terminees, v_ca_total, v_couts_total
  FROM interventions i
  JOIN v_intervention_closure cl ON cl.intervention_id = i.id
  LEFT JOIN LATERAL (
    SELECT
      SUM(cost.amount) FILTER (WHERE cost.cost_type = 'intervention') AS ca,
      SUM(cost.amount) FILTER (WHERE cost.cost_type IN ('sst', 'materiel')) AS couts
    FROM intervention_costs cost
    WHERE cost.intervention_id = i.id
  ) c ON true
  WHERE cl.closed_at >= p_period_start
    AND cl.closed_at < v_close_end
    AND i.is_active = true
    AND (array_length(p_agence_ids, 1) IS NULL OR i.agence_id = ANY(p_agence_ids))
    AND (array_length(p_gestionnaire_ids, 1) IS NULL OR i.assigned_user_id = ANY(p_gestionnaire_ids))
    AND (array_length(p_metier_ids, 1) IS NULL OR i.metier_id = ANY(p_metier_ids));

  -- Calculs dérivés
  v_marge_total := v_ca_total - v_couts_total;

  -- NB : croise l'axe clôture (numérateur) et l'axe création (dénominateur).
  v_taux_transformation := CASE
    WHEN v_nb_interventions_demandees > 0
    THEN ROUND((v_nb_interventions_terminees::NUMERIC / v_nb_interventions_demandees::NUMERIC) * 100, 2)
    ELSE 0
  END;

  v_taux_marge := CASE
    WHEN v_ca_total > 0
    THEN ROUND((v_marge_total / v_ca_total) * 100, 2)
    ELSE 0
  END;

  v_ca_moyen := CASE
    WHEN v_nb_interventions_terminees > 0
    THEN ROUND(v_ca_total / v_nb_interventions_terminees, 2)
    ELSE 0
  END;

  v_result := jsonb_build_object(
    'nb_interventions_demandees', v_nb_interventions_demandees,
    'nb_interventions_terminees', v_nb_interventions_terminees,
    'taux_transformation', v_taux_transformation,
    'ca_total', v_ca_total,
    'couts_total', v_couts_total,
    'marge_total', v_marge_total,
    'taux_marge', v_taux_marge,
    'ca_moyen_par_intervention', v_ca_moyen
  );

  RETURN v_result;
END;
$$;

-- ============================================
-- SECTION 2: PERFORMANCE GESTIONNAIRES
-- ============================================

CREATE OR REPLACE FUNCTION get_dashboard_performance_gestionnaires_v3(
  p_period_start TIMESTAMP,
  p_period_end TIMESTAMP,
  p_agence_ids UUID[] DEFAULT NULL,
  p_metier_ids UUID[] DEFAULT NULL,
  p_limit INTEGER DEFAULT 30
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
  v_close_end TIMESTAMP;
BEGIN
  v_close_end := DATE_TRUNC('day', p_period_end) + INTERVAL '1 day';

  WITH volume_par_gestionnaire AS (
    -- AXE CRÉATION : volume pris en charge sur la période
    SELECT i.assigned_user_id, COUNT(*) AS nb_interventions_prises
    FROM interventions i
    WHERE i.date >= p_period_start
      AND i.date <= p_period_end
      AND i.is_active = true
      AND i.assigned_user_id IS NOT NULL
      AND (array_length(p_agence_ids, 1) IS NULL OR i.agence_id = ANY(p_agence_ids))
      AND (array_length(p_metier_ids, 1) IS NULL OR i.metier_id = ANY(p_metier_ids))
    GROUP BY i.assigned_user_id
  ),

  cloture_par_gestionnaire AS (
    -- AXE CLÔTURE : l'économie du dossier reste attribuée à son gestionnaire
    -- assigné (cf. transitions-scope.ts, règle n°4).
    SELECT
      i.assigned_user_id,
      COUNT(*) AS nb_interventions_terminees,
      COALESCE(SUM(c.ca), 0) AS ca_total,
      COALESCE(SUM(c.couts), 0) AS couts_total
    FROM interventions i
    JOIN v_intervention_closure cl ON cl.intervention_id = i.id
    LEFT JOIN LATERAL (
      SELECT
        SUM(cost.amount) FILTER (WHERE cost.cost_type = 'intervention') AS ca,
        SUM(cost.amount) FILTER (WHERE cost.cost_type IN ('sst', 'materiel')) AS couts
      FROM intervention_costs cost
      WHERE cost.intervention_id = i.id
    ) c ON true
    WHERE cl.closed_at >= p_period_start
      AND cl.closed_at < v_close_end
      AND i.is_active = true
      AND i.assigned_user_id IS NOT NULL
      AND (array_length(p_agence_ids, 1) IS NULL OR i.agence_id = ANY(p_agence_ids))
      AND (array_length(p_metier_ids, 1) IS NULL OR i.metier_id = ANY(p_metier_ids))
    GROUP BY i.assigned_user_id
  ),

  gestionnaire_stats AS (
    SELECT
      u.id AS gestionnaire_id,
      u.firstname || ' ' || u.lastname AS gestionnaire_nom,
      u.firstname AS gestionnaire_firstname,
      u.lastname AS gestionnaire_lastname,
      u.email AS gestionnaire_email,
      COALESCE(v.nb_interventions_prises, 0) AS nb_interventions_prises,
      COALESCE(cg.nb_interventions_terminees, 0) AS nb_interventions_terminees,
      CASE
        WHEN COALESCE(v.nb_interventions_prises, 0) > 0
        THEN ROUND((COALESCE(cg.nb_interventions_terminees, 0)::NUMERIC / v.nb_interventions_prises::NUMERIC) * 100, 2)
        ELSE 0
      END AS taux_completion,
      COALESCE(cg.ca_total, 0) AS ca_total,
      COALESCE(cg.couts_total, 0) AS couts_total
    FROM users u
    LEFT JOIN volume_par_gestionnaire v ON v.assigned_user_id = u.id
    LEFT JOIN cloture_par_gestionnaire cg ON cg.assigned_user_id = u.id
    -- Un gestionnaire apparaît s'il a pris OU clôturé des dossiers sur la période.
    WHERE v.assigned_user_id IS NOT NULL OR cg.assigned_user_id IS NOT NULL
  ),

  top_gestionnaires AS (
    SELECT
      gestionnaire_id,
      gestionnaire_nom,
      gestionnaire_firstname,
      gestionnaire_lastname,
      gestionnaire_email,
      nb_interventions_prises,
      nb_interventions_terminees,
      taux_completion,
      ca_total,
      couts_total,
      ca_total - couts_total AS marge_total,
      CASE
        WHEN ca_total > 0 THEN ROUND(((ca_total - couts_total) / ca_total) * 100, 2)
        ELSE 0
      END AS taux_marge
    FROM gestionnaire_stats
    ORDER BY ca_total DESC
    LIMIT p_limit
  )

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'gestionnaire_id', gestionnaire_id,
      'gestionnaire_nom', gestionnaire_nom,
      'gestionnaire_firstname', gestionnaire_firstname,
      'gestionnaire_lastname', gestionnaire_lastname,
      'gestionnaire_email', gestionnaire_email,
      'nb_interventions_prises', nb_interventions_prises,
      'nb_interventions_terminees', nb_interventions_terminees,
      'taux_completion', taux_completion,
      'ca_total', ca_total,
      'marge_total', marge_total,
      'taux_marge', taux_marge
    )
  ), '[]'::jsonb)
  INTO v_result
  FROM top_gestionnaires;

  RETURN v_result;
END;
$$;

-- ============================================
-- SECTION 3: PERFORMANCE AGENCES
-- ============================================

CREATE OR REPLACE FUNCTION get_dashboard_performance_agences_v3(
  p_period_start TIMESTAMP,
  p_period_end TIMESTAMP,
  p_metier_ids UUID[] DEFAULT NULL,
  p_gestionnaire_ids UUID[] DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
  v_close_end TIMESTAMP;
BEGIN
  v_close_end := DATE_TRUNC('day', p_period_end) + INTERVAL '1 day';

  WITH volume_par_agence AS (
    -- AXE CRÉATION
    SELECT i.agence_id, COUNT(*) AS nb_interventions_demandees
    FROM interventions i
    WHERE i.date >= p_period_start
      AND i.date <= p_period_end
      AND i.is_active = true
      AND (array_length(p_metier_ids, 1) IS NULL OR i.metier_id = ANY(p_metier_ids))
      AND (array_length(p_gestionnaire_ids, 1) IS NULL OR i.assigned_user_id = ANY(p_gestionnaire_ids))
    GROUP BY i.agence_id
  ),

  cloture_par_agence AS (
    -- AXE CLÔTURE
    SELECT
      i.agence_id,
      COUNT(*) AS nb_interventions_terminees,
      COALESCE(SUM(c.ca), 0) AS ca_total,
      COALESCE(SUM(c.couts), 0) AS couts_total
    FROM interventions i
    JOIN v_intervention_closure cl ON cl.intervention_id = i.id
    LEFT JOIN LATERAL (
      SELECT
        SUM(cost.amount) FILTER (WHERE cost.cost_type = 'intervention') AS ca,
        SUM(cost.amount) FILTER (WHERE cost.cost_type IN ('sst', 'materiel')) AS couts
      FROM intervention_costs cost
      WHERE cost.intervention_id = i.id
    ) c ON true
    WHERE cl.closed_at >= p_period_start
      AND cl.closed_at < v_close_end
      AND i.is_active = true
      AND (array_length(p_metier_ids, 1) IS NULL OR i.metier_id = ANY(p_metier_ids))
      AND (array_length(p_gestionnaire_ids, 1) IS NULL OR i.assigned_user_id = ANY(p_gestionnaire_ids))
    GROUP BY i.agence_id
  ),

  agence_stats AS (
    SELECT
      a.id AS agence_id,
      a.label AS agence_nom,
      a.code AS agence_code,
      a.region AS agence_region,
      COALESCE(v.nb_interventions_demandees, 0) AS nb_interventions_demandees,
      COALESCE(ca.nb_interventions_terminees, 0) AS nb_interventions_terminees,
      CASE
        WHEN COALESCE(v.nb_interventions_demandees, 0) > 0
        THEN ROUND((COALESCE(ca.nb_interventions_terminees, 0)::NUMERIC / v.nb_interventions_demandees::NUMERIC) * 100, 2)
        ELSE 0
      END AS taux_completion,
      COALESCE(ca.ca_total, 0) AS ca_total,
      COALESCE(ca.couts_total, 0) AS couts_total,
      (SELECT COUNT(DISTINCT u.id)
       FROM users u
       JOIN user_roles ur ON u.id = ur.user_id
       JOIN roles r ON ur.role_id = r.id
       JOIN interventions i ON i.assigned_user_id = u.id
       WHERE i.agence_id = a.id
         AND r.name = 'gestionnaire'
      ) AS nb_gestionnaires_actifs
    FROM agencies a
    LEFT JOIN volume_par_agence v ON v.agence_id = a.id
    LEFT JOIN cloture_par_agence ca ON ca.agence_id = a.id
  )

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'agence_id', agence_id,
      'agence_nom', agence_nom,
      'agence_code', agence_code,
      'agence_region', agence_region,
      'nb_interventions_demandees', nb_interventions_demandees,
      'nb_interventions_terminees', nb_interventions_terminees,
      'taux_completion', taux_completion,
      'ca_total', ca_total,
      'marge_total', ca_total - couts_total,
      'taux_marge', CASE
        WHEN ca_total > 0 THEN ROUND(((ca_total - couts_total) / ca_total) * 100, 2)
        ELSE 0
      END,
      'nb_gestionnaires_actifs', nb_gestionnaires_actifs
    )
    ORDER BY ca_total DESC
  ), '[]'::jsonb)
  INTO v_result
  FROM agence_stats;

  RETURN v_result;
END;
$$;

-- ============================================
-- SECTION 4: PERFORMANCE MÉTIERS
-- ============================================

CREATE OR REPLACE FUNCTION get_dashboard_performance_metiers_v3(
  p_period_start TIMESTAMP,
  p_period_end TIMESTAMP,
  p_agence_ids UUID[] DEFAULT NULL,
  p_gestionnaire_ids UUID[] DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
  v_total_volume INTEGER;
  v_close_end TIMESTAMP;
BEGIN
  v_close_end := DATE_TRUNC('day', p_period_end) + INTERVAL '1 day';

  -- Volume total (axe création) pour les pourcentages
  SELECT COUNT(*)
  INTO v_total_volume
  FROM interventions i
  WHERE i.date >= p_period_start
    AND i.date <= p_period_end
    AND i.is_active = true
    AND (array_length(p_agence_ids, 1) IS NULL OR i.agence_id = ANY(p_agence_ids))
    AND (array_length(p_gestionnaire_ids, 1) IS NULL OR i.assigned_user_id = ANY(p_gestionnaire_ids));

  WITH volume_par_metier AS (
    -- AXE CRÉATION
    SELECT i.metier_id, COUNT(*) AS nb_interventions_demandees
    FROM interventions i
    WHERE i.date >= p_period_start
      AND i.date <= p_period_end
      AND i.is_active = true
      AND (array_length(p_agence_ids, 1) IS NULL OR i.agence_id = ANY(p_agence_ids))
      AND (array_length(p_gestionnaire_ids, 1) IS NULL OR i.assigned_user_id = ANY(p_gestionnaire_ids))
    GROUP BY i.metier_id
  ),

  cloture_par_metier AS (
    -- AXE CLÔTURE
    SELECT
      i.metier_id,
      COUNT(*) AS nb_interventions_terminees,
      COALESCE(SUM(c.ca), 0) AS ca_total,
      COALESCE(SUM(c.couts), 0) AS couts_total
    FROM interventions i
    JOIN v_intervention_closure cl ON cl.intervention_id = i.id
    LEFT JOIN LATERAL (
      SELECT
        SUM(cost.amount) FILTER (WHERE cost.cost_type = 'intervention') AS ca,
        SUM(cost.amount) FILTER (WHERE cost.cost_type IN ('sst', 'materiel')) AS couts
      FROM intervention_costs cost
      WHERE cost.intervention_id = i.id
    ) c ON true
    WHERE cl.closed_at >= p_period_start
      AND cl.closed_at < v_close_end
      AND i.is_active = true
      AND (array_length(p_agence_ids, 1) IS NULL OR i.agence_id = ANY(p_agence_ids))
      AND (array_length(p_gestionnaire_ids, 1) IS NULL OR i.assigned_user_id = ANY(p_gestionnaire_ids))
    GROUP BY i.metier_id
  ),

  metier_stats AS (
    SELECT
      m.id AS metier_id,
      m.label AS metier_nom,
      m.code AS metier_code,
      COALESCE(v.nb_interventions_demandees, 0) AS nb_interventions_demandees,
      COALESCE(cm.nb_interventions_terminees, 0) AS nb_interventions_terminees,
      CASE
        WHEN v_total_volume > 0
        THEN ROUND((COALESCE(v.nb_interventions_demandees, 0)::NUMERIC / v_total_volume::NUMERIC) * 100, 2)
        ELSE 0
      END AS pourcentage_volume,
      CASE
        WHEN COALESCE(v.nb_interventions_demandees, 0) > 0
        THEN ROUND((COALESCE(cm.nb_interventions_terminees, 0)::NUMERIC / v.nb_interventions_demandees::NUMERIC) * 100, 2)
        ELSE 0
      END AS taux_completion,
      COALESCE(cm.ca_total, 0) AS ca_total,
      COALESCE(cm.couts_total, 0) AS couts_total
    FROM metiers m
    LEFT JOIN volume_par_metier v ON v.metier_id = m.id
    LEFT JOIN cloture_par_metier cm ON cm.metier_id = m.id
  )

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'metier_id', metier_id,
      'metier_nom', metier_nom,
      'metier_code', metier_code,
      'nb_interventions_demandees', nb_interventions_demandees,
      'nb_interventions_terminees', nb_interventions_terminees,
      'taux_completion', taux_completion,
      'pourcentage_volume', pourcentage_volume,
      'ca_total', ca_total,
      'marge_total', ca_total - couts_total,
      'taux_marge', CASE
        WHEN ca_total > 0 THEN ROUND(((ca_total - couts_total) / ca_total) * 100, 2)
        ELSE 0
      END
    )
    ORDER BY nb_interventions_demandees DESC
  ), '[]'::jsonb)
  INTO v_result
  FROM metier_stats;

  RETURN v_result;
END;
$$;

-- ============================================
-- SECTION 6: SPARKLINE DATA
-- ============================================
-- Les deux axes vivent désormais sur des dates différentes : les demandes sont
-- posées au jour de création, le CA / la marge / les clôtures au jour de
-- clôture. Chaque axe est agrégé séparément puis raccroché à la série de jours.

CREATE OR REPLACE FUNCTION get_dashboard_sparkline_data_v3(
  p_period_start TIMESTAMP,
  p_period_end TIMESTAMP,
  p_agence_ids UUID[] DEFAULT NULL,
  p_metier_ids UUID[] DEFAULT NULL,
  p_gestionnaire_ids UUID[] DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
  v_close_end TIMESTAMP;
BEGIN
  v_close_end := DATE_TRUNC('day', p_period_end) + INTERVAL '1 day';

  WITH date_series AS (
    SELECT generate_series(
      DATE_TRUNC('day', p_period_start),
      DATE_TRUNC('day', p_period_end),
      '1 day'::interval
    )::date AS date_jour
  ),

  demandes_par_jour AS (
    -- AXE CRÉATION
    SELECT
      DATE_TRUNC('day', i.date)::date AS date_jour,
      COUNT(*) AS nb_demandees
    FROM interventions i
    WHERE i.date >= p_period_start
      AND i.date <= p_period_end
      AND i.is_active = true
      AND (array_length(p_agence_ids, 1) IS NULL OR i.agence_id = ANY(p_agence_ids))
      AND (array_length(p_metier_ids, 1) IS NULL OR i.metier_id = ANY(p_metier_ids))
      AND (array_length(p_gestionnaire_ids, 1) IS NULL OR i.assigned_user_id = ANY(p_gestionnaire_ids))
    GROUP BY DATE_TRUNC('day', i.date)::date
  ),

  clotures_par_jour AS (
    -- AXE CLÔTURE
    SELECT
      DATE_TRUNC('day', cl.closed_at)::date AS date_jour,
      COUNT(*) AS nb_terminees,
      COALESCE(SUM(c.ca), 0) AS ca_jour,
      COALESCE(SUM(c.couts), 0) AS couts_jour
    FROM interventions i
    JOIN v_intervention_closure cl ON cl.intervention_id = i.id
    LEFT JOIN LATERAL (
      SELECT
        SUM(cost.amount) FILTER (WHERE cost.cost_type = 'intervention') AS ca,
        SUM(cost.amount) FILTER (WHERE cost.cost_type IN ('sst', 'materiel')) AS couts
      FROM intervention_costs cost
      WHERE cost.intervention_id = i.id
    ) c ON true
    WHERE cl.closed_at >= p_period_start
      AND cl.closed_at < v_close_end
      AND i.is_active = true
      AND (array_length(p_agence_ids, 1) IS NULL OR i.agence_id = ANY(p_agence_ids))
      AND (array_length(p_metier_ids, 1) IS NULL OR i.metier_id = ANY(p_metier_ids))
      AND (array_length(p_gestionnaire_ids, 1) IS NULL OR i.assigned_user_id = ANY(p_gestionnaire_ids))
    GROUP BY DATE_TRUNC('day', cl.closed_at)::date
  )

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'date', ds.date_jour,
      'nb_interventions_demandees', COALESCE(d.nb_demandees, 0),
      'nb_interventions_terminees', COALESCE(t.nb_terminees, 0),
      'ca_jour', COALESCE(t.ca_jour, 0),
      'marge_jour', COALESCE(t.ca_jour, 0) - COALESCE(t.couts_jour, 0)
    )
    ORDER BY ds.date_jour
  ), '[]'::jsonb)
  INTO v_result
  FROM date_series ds
  LEFT JOIN demandes_par_jour d ON ds.date_jour = d.date_jour
  LEFT JOIN clotures_par_jour t ON ds.date_jour = t.date_jour;

  RETURN v_result;
END;
$$;

-- ============================================
-- INDEX
-- ============================================
-- La vue de clôture ne scanne que les transitions vers INTER_TERMINEE :
-- index partiel dédié, bien plus sélectif sur cette requête.
CREATE INDEX IF NOT EXISTS idx_transitions_cloture
  ON public.intervention_status_transitions (intervention_id, transition_date DESC)
  WHERE to_status_code = 'INTER_TERMINEE';

-- Agrégation des coûts par intervention (LATERAL ci-dessus).
CREATE INDEX IF NOT EXISTS idx_intervention_costs_intervention_type
  ON public.intervention_costs (intervention_id, cost_type);
