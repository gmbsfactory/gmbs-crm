-- ============================================
-- MIGRATION: Admin Dashboard V3 Refactor
-- ============================================
-- Description: Refactoring des fonctions RPC du dashboard admin
--              Architecture modulaire : 1 fonction = 1 responsabilité
-- ============================================

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
  v_nb_interventions_demandees INTEGER;
  v_nb_interventions_terminees INTEGER;
  v_ca_total NUMERIC;
  v_couts_total NUMERIC;
  v_marge_total NUMERIC;
  v_taux_transformation NUMERIC;
  v_taux_marge NUMERIC;
  v_ca_moyen NUMERIC;
BEGIN
  -- Nombre d'interventions demandées (créées dans la période)
  SELECT COUNT(*)
  INTO v_nb_interventions_demandees
  FROM interventions i
  WHERE i.date >= p_period_start
    AND i.date <= p_period_end
    AND i.is_active = true
    AND (array_length(p_agence_ids, 1) IS NULL OR i.agence_id = ANY(p_agence_ids))
    AND (array_length(p_gestionnaire_ids, 1) IS NULL OR i.assigned_user_id = ANY(p_gestionnaire_ids))
    AND (array_length(p_metier_ids, 1) IS NULL OR i.metier_id = ANY(p_metier_ids));

  -- Nombre d'interventions terminées (créées dans la période ET statut INTER_TERMINEE)
  SELECT COUNT(*)
  INTO v_nb_interventions_terminees
  FROM interventions i
  JOIN intervention_statuses ist ON i.statut_id = ist.id
  WHERE i.date >= p_period_start
    AND i.date <= p_period_end
    AND i.is_active = true
    AND ist.code = 'INTER_TERMINEE'
    AND (array_length(p_agence_ids, 1) IS NULL OR i.agence_id = ANY(p_agence_ids))
    AND (array_length(p_gestionnaire_ids, 1) IS NULL OR i.assigned_user_id = ANY(p_gestionnaire_ids))
    AND (array_length(p_metier_ids, 1) IS NULL OR i.metier_id = ANY(p_metier_ids));

  -- CA total (uniquement interventions terminées)
  SELECT COALESCE(SUM(CASE WHEN cost.cost_type = 'intervention' THEN cost.amount ELSE 0 END), 0)
  INTO v_ca_total
  FROM interventions i
  JOIN intervention_statuses ist ON i.statut_id = ist.id
  JOIN intervention_costs cost ON i.id = cost.intervention_id
  WHERE i.date >= p_period_start
    AND i.date <= p_period_end
    AND i.is_active = true
    AND ist.code = 'INTER_TERMINEE'
    AND (array_length(p_agence_ids, 1) IS NULL OR i.agence_id = ANY(p_agence_ids))
    AND (array_length(p_gestionnaire_ids, 1) IS NULL OR i.assigned_user_id = ANY(p_gestionnaire_ids))
    AND (array_length(p_metier_ids, 1) IS NULL OR i.metier_id = ANY(p_metier_ids));

  -- Coûts totaux (uniquement interventions terminées)
  -- Formule: sst + materiel
  SELECT COALESCE(
    SUM(CASE WHEN cost.cost_type = 'sst' THEN cost.amount ELSE 0 END)
    + SUM(CASE WHEN cost.cost_type = 'materiel' THEN cost.amount ELSE 0 END),
    0
  )
  INTO v_couts_total
  FROM interventions i
  JOIN intervention_statuses ist ON i.statut_id = ist.id
  JOIN intervention_costs cost ON i.id = cost.intervention_id
  WHERE i.date >= p_period_start
    AND i.date <= p_period_end
    AND i.is_active = true
    AND ist.code = 'INTER_TERMINEE'
    AND (array_length(p_agence_ids, 1) IS NULL OR i.agence_id = ANY(p_agence_ids))
    AND (array_length(p_gestionnaire_ids, 1) IS NULL OR i.assigned_user_id = ANY(p_gestionnaire_ids))
    AND (array_length(p_metier_ids, 1) IS NULL OR i.metier_id = ANY(p_metier_ids));

  -- Calculs dérivés
  v_marge_total := v_ca_total - v_couts_total;

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

  -- Construction du résultat
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
BEGIN
  WITH interventions_periode AS (
    -- Interventions créées dans la période
    SELECT
      i.id,
      i.assigned_user_id,
      i.statut_id
    FROM interventions i
    WHERE i.date >= p_period_start
      AND i.date <= p_period_end
      AND i.is_active = true
      AND i.assigned_user_id IS NOT NULL
      AND (array_length(p_agence_ids, 1) IS NULL OR i.agence_id = ANY(p_agence_ids))
      AND (array_length(p_metier_ids, 1) IS NULL OR i.metier_id = ANY(p_metier_ids))
  ),

  interventions_terminees AS (
    -- Interventions terminées parmi celles de la période
    SELECT ip.id, ip.assigned_user_id
    FROM interventions_periode ip
    JOIN intervention_statuses ist ON ip.statut_id = ist.id
    WHERE ist.code = 'INTER_TERMINEE'
  ),

  gestionnaire_stats AS (
    SELECT
      u.id AS gestionnaire_id,
      u.firstname || ' ' || u.lastname AS gestionnaire_nom,
      u.firstname AS gestionnaire_firstname,
      u.lastname AS gestionnaire_lastname,
      u.email AS gestionnaire_email,

      -- Volume
      COUNT(DISTINCT ip.id) AS nb_interventions_prises,
      COUNT(DISTINCT it.id) AS nb_interventions_terminees,

      -- Taux completion
      CASE
        WHEN COUNT(DISTINCT ip.id) > 0
        THEN ROUND((COUNT(DISTINCT it.id)::NUMERIC / COUNT(DISTINCT ip.id)::NUMERIC) * 100, 2)
        ELSE 0
      END AS taux_completion,

      -- CA (uniquement interventions terminées)
      -- Utilise intervention_costs avec cost_type = 'intervention' pour cohérence avec get_dashboard_kpi_main_v3
      COALESCE(SUM(CASE WHEN cost.cost_type = 'intervention' THEN cost.amount ELSE 0 END), 0) AS ca_total,

      -- Coûts (uniquement interventions terminées)
      -- Formule: sst + materiel (cohérent avec get_dashboard_kpi_main_v3)
      COALESCE(
        SUM(CASE WHEN cost.cost_type = 'sst' THEN cost.amount ELSE 0 END)
        + SUM(CASE WHEN cost.cost_type = 'materiel' THEN cost.amount ELSE 0 END),
        0
      ) AS couts_total

    FROM users u
    JOIN interventions_periode ip ON u.id = ip.assigned_user_id
    LEFT JOIN interventions_terminees it ON ip.id = it.id
    LEFT JOIN intervention_costs cost ON it.id = cost.intervention_id
    GROUP BY u.id, u.firstname, u.lastname, u.email
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
BEGIN
  WITH interventions_periode AS (
    -- Interventions créées dans la période
    SELECT
      i.id,
      i.agence_id,
      i.statut_id
    FROM interventions i
    WHERE i.date >= p_period_start
      AND i.date <= p_period_end
      AND i.is_active = true
      AND (array_length(p_metier_ids, 1) IS NULL OR i.metier_id = ANY(p_metier_ids))
      AND (array_length(p_gestionnaire_ids, 1) IS NULL OR i.assigned_user_id = ANY(p_gestionnaire_ids))
  ),

  interventions_terminees AS (
    -- Interventions terminées parmi celles de la période
    SELECT ip.id, ip.agence_id
    FROM interventions_periode ip
    JOIN intervention_statuses ist ON ip.statut_id = ist.id
    WHERE ist.code = 'INTER_TERMINEE'
  ),

  agence_stats AS (
    SELECT
      a.id AS agence_id,
      a.label AS agence_nom,
      a.code AS agence_code,
      a.region AS agence_region,

      -- Volume
      COUNT(DISTINCT ip.id) AS nb_interventions_demandees,
      COUNT(DISTINCT it.id) AS nb_interventions_terminees,

      -- Taux completion
      CASE
        WHEN COUNT(DISTINCT ip.id) > 0
        THEN ROUND((COUNT(DISTINCT it.id)::NUMERIC / COUNT(DISTINCT ip.id)::NUMERIC) * 100, 2)
        ELSE 0
      END AS taux_completion,

      -- CA (uniquement interventions terminées)
      -- Utilise intervention_costs avec cost_type = 'intervention' pour cohérence avec get_dashboard_kpi_main_v3
      COALESCE(SUM(CASE WHEN cost.cost_type = 'intervention' THEN cost.amount ELSE 0 END), 0) AS ca_total,

      -- Coûts (uniquement interventions terminées)
      -- Formule: sst + materiel (cohérent avec get_dashboard_kpi_main_v3)
      COALESCE(
        SUM(CASE WHEN cost.cost_type = 'sst' THEN cost.amount ELSE 0 END)
        + SUM(CASE WHEN cost.cost_type = 'materiel' THEN cost.amount ELSE 0 END),
        0
      ) AS couts_total,

      -- Gestionnaires actifs dans l'agence
      (SELECT COUNT(DISTINCT u.id)
       FROM users u
       JOIN user_roles ur ON u.id = ur.user_id
       JOIN roles r ON ur.role_id = r.id
       JOIN interventions i ON i.assigned_user_id = u.id
       WHERE i.agence_id = a.id
         AND r.name = 'gestionnaire'
      ) AS nb_gestionnaires_actifs

    FROM agencies a
    LEFT JOIN interventions_periode ip ON a.id = ip.agence_id
    LEFT JOIN interventions_terminees it ON ip.id = it.id
    LEFT JOIN intervention_costs cost ON it.id = cost.intervention_id
    GROUP BY a.id, a.label, a.code, a.region
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
BEGIN
  -- Calculer le volume total pour les pourcentages
  SELECT COUNT(*)
  INTO v_total_volume
  FROM interventions i
  WHERE i.date >= p_period_start
    AND i.date <= p_period_end
    AND i.is_active = true
    AND (array_length(p_agence_ids, 1) IS NULL OR i.agence_id = ANY(p_agence_ids))
    AND (array_length(p_gestionnaire_ids, 1) IS NULL OR i.assigned_user_id = ANY(p_gestionnaire_ids));

  WITH interventions_periode AS (
    -- Interventions créées dans la période
    SELECT
      i.id,
      i.metier_id,
      i.statut_id
    FROM interventions i
    WHERE i.date >= p_period_start
      AND i.date <= p_period_end
      AND i.is_active = true
      AND (array_length(p_agence_ids, 1) IS NULL OR i.agence_id = ANY(p_agence_ids))
      AND (array_length(p_gestionnaire_ids, 1) IS NULL OR i.assigned_user_id = ANY(p_gestionnaire_ids))
  ),

  interventions_terminees AS (
    -- Interventions terminées parmi celles de la période
    SELECT ip.id, ip.metier_id
    FROM interventions_periode ip
    JOIN intervention_statuses ist ON ip.statut_id = ist.id
    WHERE ist.code = 'INTER_TERMINEE'
  ),

  metier_stats AS (
    SELECT
      m.id AS metier_id,
      m.label AS metier_nom,
      m.code AS metier_code,

      -- Volume
      COUNT(DISTINCT ip.id) AS nb_interventions_demandees,
      COUNT(DISTINCT it.id) AS nb_interventions_terminees,

      -- Pourcentage du volume total
      CASE
        WHEN v_total_volume > 0
        THEN ROUND((COUNT(DISTINCT ip.id)::NUMERIC / v_total_volume::NUMERIC) * 100, 2)
        ELSE 0
      END AS pourcentage_volume,

      -- Taux completion
      CASE
        WHEN COUNT(DISTINCT ip.id) > 0
        THEN ROUND((COUNT(DISTINCT it.id)::NUMERIC / COUNT(DISTINCT ip.id)::NUMERIC) * 100, 2)
        ELSE 0
      END AS taux_completion,

      -- CA (uniquement interventions terminées)
      -- Utilise intervention_costs avec cost_type = 'intervention' pour cohérence avec get_dashboard_kpi_main_v3
      COALESCE(SUM(CASE WHEN cost.cost_type = 'intervention' THEN cost.amount ELSE 0 END), 0) AS ca_total,

      -- Coûts (uniquement interventions terminées)
      -- Formule: sst + materiel (cohérent avec get_dashboard_kpi_main_v3)
      COALESCE(
        SUM(CASE WHEN cost.cost_type = 'sst' THEN cost.amount ELSE 0 END)
        + SUM(CASE WHEN cost.cost_type = 'materiel' THEN cost.amount ELSE 0 END),
        0
      ) AS couts_total

    FROM metiers m
    LEFT JOIN interventions_periode ip ON m.id = ip.metier_id
    LEFT JOIN interventions_terminees it ON ip.id = it.id
    LEFT JOIN intervention_costs cost ON it.id = cost.intervention_id
    GROUP BY m.id, m.label, m.code
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
-- SECTION 5: CYCLES MOYENS
-- ============================================

CREATE OR REPLACE FUNCTION get_dashboard_cycles_moyens_v3(
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
  v_cycle_moyen_total_jours NUMERIC;
  v_cycle_demande_prise_jours NUMERIC;
  v_cycle_prise_terminee_jours NUMERIC;
BEGIN
  WITH interventions_periode AS (
    -- Interventions créées dans la période avec filtres
    SELECT i.id
    FROM interventions i
    WHERE i.date >= p_period_start
      AND i.date <= p_period_end
      AND i.is_active = true
      AND (array_length(p_agence_ids, 1) IS NULL OR i.agence_id = ANY(p_agence_ids))
      AND (array_length(p_metier_ids, 1) IS NULL OR i.metier_id = ANY(p_metier_ids))
      AND (array_length(p_gestionnaire_ids, 1) IS NULL OR i.assigned_user_id = ANY(p_gestionnaire_ids))
  ),

  interventions_terminees AS (
    -- Uniquement les interventions terminées (statut INTER_TERMINEE)
    SELECT ip.id
    FROM interventions_periode ip
    JOIN interventions i ON ip.id = i.id
    JOIN intervention_statuses ist ON i.statut_id = ist.id
    WHERE ist.code = 'INTER_TERMINEE'
  ),

  dates_transitions AS (
    -- Pour chaque intervention terminée, récupérer les dates de transition
    SELECT
      it.id AS intervention_id,
      -- Plus vieille date pour DEMANDE
      MIN(CASE WHEN ist.to_status_code = 'DEMANDE' THEN ist.transition_date END) AS date_demande,
      -- Plus récente date pour INTER_TERMINEE
      MAX(CASE WHEN ist.to_status_code = 'INTER_TERMINEE' THEN ist.transition_date END) AS date_terminee,
      -- Date de transition vers ACCEPTE (pour cycle_demande_prise)
      MIN(CASE WHEN ist.to_status_code = 'ACCEPTE' THEN ist.transition_date END) AS date_accepte
    FROM interventions_terminees it
    JOIN intervention_status_transitions ist ON it.id = ist.intervention_id
    GROUP BY it.id
  ),

  cycles_calcules AS (
    -- Calculer les cycles en jours pour chaque intervention
    SELECT
      intervention_id,
      -- Cycle total: DEMANDE -> INTER_TERMINEE
      CASE
        WHEN date_demande IS NOT NULL AND date_terminee IS NOT NULL
        THEN EXTRACT(EPOCH FROM (date_terminee - date_demande)) / 86400.0
        ELSE NULL
      END AS cycle_total_jours,
      -- Cycle demande -> prise (DEMANDE -> ACCEPTE)
      CASE
        WHEN date_demande IS NOT NULL AND date_accepte IS NOT NULL
        THEN EXTRACT(EPOCH FROM (date_accepte - date_demande)) / 86400.0
        ELSE NULL
      END AS cycle_demande_prise_jours,
      -- Cycle prise -> terminée (ACCEPTE -> INTER_TERMINEE)
      CASE
        WHEN date_accepte IS NOT NULL AND date_terminee IS NOT NULL
        THEN EXTRACT(EPOCH FROM (date_terminee - date_accepte)) / 86400.0
        ELSE NULL
      END AS cycle_prise_terminee_jours
    FROM dates_transitions
  ),

  moyennes AS (
    -- Calculer toutes les moyennes en une seule requête
    SELECT
      COALESCE(ROUND(AVG(cycle_total_jours), 2), 0) AS cycle_moyen_total_jours,
      COALESCE(ROUND(AVG(cycle_demande_prise_jours), 2), 0) AS cycle_demande_prise_jours,
      COALESCE(ROUND(AVG(cycle_prise_terminee_jours), 2), 0) AS cycle_prise_terminee_jours
    FROM cycles_calcules
  )

  -- Récupérer les moyennes
  SELECT
    cycle_moyen_total_jours,
    cycle_demande_prise_jours,
    cycle_prise_terminee_jours
  INTO
    v_cycle_moyen_total_jours,
    v_cycle_demande_prise_jours,
    v_cycle_prise_terminee_jours
  FROM moyennes;

  -- Construction du résultat
  v_result := jsonb_build_object(
    'cycle_moyen_total_jours', v_cycle_moyen_total_jours,
    'cycle_demande_prise_jours', v_cycle_demande_prise_jours,
    'cycle_prise_terminee_jours', v_cycle_prise_terminee_jours
  );

  RETURN v_result;
END;
$$;

-- ============================================
-- SECTION 6: SPARKLINE DATA
-- ============================================

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
BEGIN
  WITH date_series AS (
    -- Générer série de dates pour la période
    SELECT generate_series(
      DATE_TRUNC('day', p_period_start),
      DATE_TRUNC('day', p_period_end),
      '1 day'::interval
    )::date AS date_jour
  ),

  interventions_par_jour AS (
    SELECT
      DATE_TRUNC('day', i.date)::date AS date_jour,
      COUNT(*) AS nb_demandees,
      COUNT(*) FILTER (WHERE ist.code = 'INTER_TERMINEE') AS nb_terminees,
      -- CA quotidien (uniquement interventions terminées)
      -- Utilise intervention_costs avec cost_type = 'intervention' pour cohérence avec get_dashboard_kpi_main_v3
      COALESCE(
        SUM(CASE 
          WHEN ist.code = 'INTER_TERMINEE' AND cost.cost_type = 'intervention' 
          THEN cost.amount 
          ELSE 0 
        END),
        0
      ) AS ca_jour,
      -- Coûts quotidiens (uniquement interventions terminées)
      -- Formule: sst + materiel (cohérent avec get_dashboard_kpi_main_v3)
      COALESCE(
        SUM(CASE 
          WHEN ist.code = 'INTER_TERMINEE' AND cost.cost_type = 'sst' 
          THEN cost.amount 
          ELSE 0 
        END)
        + SUM(CASE 
          WHEN ist.code = 'INTER_TERMINEE' AND cost.cost_type = 'materiel' 
          THEN cost.amount 
          ELSE 0 
        END),
        0
      ) AS couts_jour
    FROM interventions i
    JOIN intervention_statuses ist ON i.statut_id = ist.id
    LEFT JOIN intervention_costs cost ON i.id = cost.intervention_id
    WHERE i.date >= p_period_start
      AND i.date <= p_period_end
      AND i.is_active = true
      AND (array_length(p_agence_ids, 1) IS NULL OR i.agence_id = ANY(p_agence_ids))
      AND (array_length(p_metier_ids, 1) IS NULL OR i.metier_id = ANY(p_metier_ids))
      AND (array_length(p_gestionnaire_ids, 1) IS NULL OR i.assigned_user_id = ANY(p_gestionnaire_ids))
    GROUP BY DATE_TRUNC('day', i.date)::date
  )

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'date', ds.date_jour,
      'nb_interventions_demandees', COALESCE(ipj.nb_demandees, 0),
      'nb_interventions_terminees', COALESCE(ipj.nb_terminees, 0),
      'ca_jour', COALESCE(ipj.ca_jour, 0),
      'marge_jour', COALESCE(ipj.ca_jour, 0) - COALESCE(ipj.couts_jour, 0)
    )
    ORDER BY ds.date_jour
  ), '[]'::jsonb)
  INTO v_result
  FROM date_series ds
  LEFT JOIN interventions_par_jour ipj ON ds.date_jour = ipj.date_jour;

  RETURN v_result;
END;
$$;

-- ============================================
-- SECTION 5.5: VOLUME BY STATUS (Stacked Bar Chart)
-- ============================================

CREATE OR REPLACE FUNCTION get_dashboard_volume_by_status_v3(
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
BEGIN
  WITH date_series AS (
    -- Générer série de dates pour la période
    SELECT generate_series(
      DATE_TRUNC('day', p_period_start),
      DATE_TRUNC('day', p_period_end),
      '1 day'::interval
    )::date AS date_jour
  ),

  interventions_par_jour_et_statut AS (
    SELECT
      DATE_TRUNC('day', i.date)::date AS date_jour,
      ist.code AS status_code,
      COUNT(*) AS count
    FROM interventions i
    JOIN intervention_statuses ist ON i.statut_id = ist.id
    WHERE i.date >= p_period_start
      AND i.date <= p_period_end
      AND i.is_active = true
      AND (array_length(p_agence_ids, 1) IS NULL OR i.agence_id = ANY(p_agence_ids))
      AND (array_length(p_metier_ids, 1) IS NULL OR i.metier_id = ANY(p_metier_ids))
      AND (array_length(p_gestionnaire_ids, 1) IS NULL OR i.assigned_user_id = ANY(p_gestionnaire_ids))
      AND ist.code IN ('DEMANDE', 'DEVIS_ENVOYE', 'ACCEPTE', 'INTER_EN_COURS', 'INTER_TERMINEE')
    GROUP BY DATE_TRUNC('day', i.date)::date, ist.code
  ),

  aggregated_data AS (
    SELECT
      ds.date_jour,
      COALESCE(SUM(CASE WHEN ipjs.status_code = 'DEMANDE' THEN ipjs.count ELSE 0 END), 0) AS demande,
      COALESCE(SUM(CASE WHEN ipjs.status_code = 'DEVIS_ENVOYE' THEN ipjs.count ELSE 0 END), 0) AS devis_envoye,
      COALESCE(SUM(CASE WHEN ipjs.status_code = 'ACCEPTE' THEN ipjs.count ELSE 0 END), 0) AS accepte,
      COALESCE(SUM(CASE WHEN ipjs.status_code = 'INTER_EN_COURS' THEN ipjs.count ELSE 0 END), 0) AS en_cours,
      COALESCE(SUM(CASE WHEN ipjs.status_code = 'INTER_TERMINEE' THEN ipjs.count ELSE 0 END), 0) AS termine
    FROM date_series ds
    LEFT JOIN interventions_par_jour_et_statut ipjs ON ds.date_jour = ipjs.date_jour
    GROUP BY ds.date_jour
  )

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'date', ad.date_jour,
      'demande', ad.demande,
      'devis_envoye', ad.devis_envoye,
      'accepte', ad.accepte,
      'en_cours', ad.en_cours,
      'termine', ad.termine
    )
    ORDER BY ad.date_jour
  ), '[]'::jsonb)
  INTO v_result
  FROM aggregated_data ad;

  RETURN v_result;
END;
$$;

-- ============================================
-- SECTION 6: CONVERSION FUNNEL
-- ============================================

CREATE OR REPLACE FUNCTION get_dashboard_conversion_funnel_v3(
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
BEGIN
  /*
    Funnel de conversion progressif:
    - Compte combien d'interventions ont atteint AU MOINS chaque statut
    - Base: interventions créées dans la période
    - Progression: DEMANDE → DEVIS_ENVOYE → ACCEPTE → INTER_EN_COURS → INTER_TERMINEE
  */

  WITH base_interventions AS (
    -- Interventions créées dans la période (point de départ)
    SELECT DISTINCT i.id as intervention_id
    FROM interventions i
    WHERE i.date >= p_period_start
      AND i.date <= p_period_end
      AND i.is_active = true
      AND (array_length(p_agence_ids, 1) IS NULL OR i.agence_id = ANY(p_agence_ids))
      AND (array_length(p_metier_ids, 1) IS NULL OR i.metier_id = ANY(p_metier_ids))
      AND (array_length(p_gestionnaire_ids, 1) IS NULL OR i.assigned_user_id = ANY(p_gestionnaire_ids))
  ),

  status_ranks AS (
    -- Définir le rang de progression de chaque statut
    SELECT 1 as rank, 'DEMANDE' as status_code UNION ALL
    SELECT 2, 'DEVIS_ENVOYE' UNION ALL
    SELECT 3, 'ACCEPTE' UNION ALL
    SELECT 4, 'INTER_EN_COURS' UNION ALL
    SELECT 5, 'INTER_TERMINEE'
  ),

  last_status_reached AS (
    -- Pour chaque intervention, déterminer le rang le plus élevé atteint
    SELECT
      bi.intervention_id,
      COALESCE(MAX(sr.rank), 1) as max_rank
    FROM base_interventions bi
    LEFT JOIN intervention_status_transitions ist
      ON ist.intervention_id = bi.intervention_id
      AND ist.to_status_code IN ('DEMANDE', 'DEVIS_ENVOYE', 'ACCEPTE', 'INTER_EN_COURS', 'INTER_TERMINEE')
    LEFT JOIN status_ranks sr ON sr.status_code = ist.to_status_code
    GROUP BY bi.intervention_id
  )

  -- Construire le funnel avec comptage cumulatif
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'status_code', status_code,
      'count', count
    ) ORDER BY rank
  ), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT 1 as rank, 'DEMANDE' as status_code, COUNT(*)::integer as count
    FROM base_interventions
    UNION ALL
    SELECT 2, 'DEVIS_ENVOYE', COUNT(*)::integer
    FROM last_status_reached WHERE max_rank >= 2
    UNION ALL
    SELECT 3, 'ACCEPTE', COUNT(*)::integer
    FROM last_status_reached WHERE max_rank >= 3
    UNION ALL
    SELECT 4, 'INTER_EN_COURS', COUNT(*)::integer
    FROM last_status_reached WHERE max_rank >= 4
    UNION ALL
    SELECT 5, 'INTER_TERMINEE', COUNT(*)::integer
    FROM last_status_reached WHERE max_rank >= 5
  ) funnel;

  RETURN v_result;
END;
$$;

-- ============================================
-- SECTION 6B: STATUS BREAKDOWN
-- ============================================

CREATE OR REPLACE FUNCTION get_dashboard_status_breakdown_v3(
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
BEGIN
  /*
    Répartition actuelle par statut:
    - Compte le statut ACTUEL de chaque intervention
    - Différent du funnel (qui compte la progression)
  */

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'status_code', ist.code,
      'status_label', ist.label,
      'count', count
    ) ORDER BY count DESC
  ), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT
      i.statut_id,
      COUNT(*)::integer as count
    FROM interventions i
    WHERE i.date >= p_period_start
      AND i.date <= p_period_end
      AND i.is_active = true
      AND (array_length(p_agence_ids, 1) IS NULL OR i.agence_id = ANY(p_agence_ids))
      AND (array_length(p_metier_ids, 1) IS NULL OR i.metier_id = ANY(p_metier_ids))
      AND (array_length(p_gestionnaire_ids, 1) IS NULL OR i.assigned_user_id = ANY(p_gestionnaire_ids))
    GROUP BY i.statut_id
  ) counts
  JOIN intervention_statuses ist ON ist.id = counts.statut_id;

  RETURN v_result;
END;
$$;

-- ============================================
-- SECTION 7: ORCHESTRATOR
-- ============================================

CREATE OR REPLACE FUNCTION get_admin_dashboard_stats_v3(
  p_period_start TIMESTAMP,
  p_period_end TIMESTAMP,
  p_agence_ids UUID[] DEFAULT NULL,
  p_metier_ids UUID[] DEFAULT NULL,
  p_gestionnaire_ids UUID[] DEFAULT NULL,
  p_top_gestionnaires INTEGER DEFAULT 10,
  p_top_agences INTEGER DEFAULT 10
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'kpi_main', get_dashboard_kpi_main_v3(
      p_period_start,
      p_period_end,
      p_agence_ids,
      p_gestionnaire_ids,
      p_metier_ids
    ),
    'performance_gestionnaires', get_dashboard_performance_gestionnaires_v3(
      p_period_start,
      p_period_end,
      p_agence_ids,
      p_metier_ids,
      p_top_gestionnaires
    ),
    'performance_agences', get_dashboard_performance_agences_v3(
      p_period_start,
      p_period_end,
      p_metier_ids,
      p_gestionnaire_ids
    ),
    'performance_metiers', get_dashboard_performance_metiers_v3(
      p_period_start,
      p_period_end,
      p_agence_ids,
      p_gestionnaire_ids
    ),
    'cycles_moyens', get_dashboard_cycles_moyens_v3(
      p_period_start,
      p_period_end,
      p_agence_ids,
      p_metier_ids,
      p_gestionnaire_ids
    ),
    'sparkline_data', get_dashboard_sparkline_data_v3(
      p_period_start,
      p_period_end,
      p_agence_ids,
      p_metier_ids,
      p_gestionnaire_ids
    ),
    'volume_by_status', get_dashboard_volume_by_status_v3(
      p_period_start,
      p_period_end,
      p_agence_ids,
      p_metier_ids,
      p_gestionnaire_ids
    ),
    'conversion_funnel', get_dashboard_conversion_funnel_v3(
      p_period_start,
      p_period_end,
      p_agence_ids,
      p_metier_ids,
      p_gestionnaire_ids
    ),
    'status_breakdown', get_dashboard_status_breakdown_v3(
      p_period_start,
      p_period_end,
      p_agence_ids,
      p_metier_ids,
      p_gestionnaire_ids
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- ============================================
-- COMMENTAIRES FINAUX
-- ============================================

COMMENT ON FUNCTION get_dashboard_kpi_main_v3 IS 'V3: Returns main KPIs (interventions count, CA, margin, transformation rate)';
COMMENT ON FUNCTION get_dashboard_performance_gestionnaires_v3 IS 'V3: Returns top N managers performance sorted by CA';
COMMENT ON FUNCTION get_dashboard_performance_agences_v3 IS 'V3: Returns all agencies performance sorted by CA';
COMMENT ON FUNCTION get_dashboard_performance_metiers_v3 IS 'V3: Returns all trades performance sorted by volume';
COMMENT ON FUNCTION get_dashboard_cycles_moyens_v3 IS 'V3: Returns average cycle times (DEMANDE->INTER_TERMINEE, DEMANDE->ACCEPTE, ACCEPTE->INTER_TERMINEE)';
COMMENT ON FUNCTION get_dashboard_sparkline_data_v3 IS 'V3: Returns daily time series data for sparklines';
COMMENT ON FUNCTION get_dashboard_volume_by_status_v3 IS 'V3: Returns daily volume breakdown by status for stacked bar chart';
COMMENT ON FUNCTION get_dashboard_conversion_funnel_v3 IS 'V3: Returns conversion funnel showing progressive status achievement';
COMMENT ON FUNCTION get_dashboard_status_breakdown_v3 IS 'V3: Returns current status distribution of interventions';
COMMENT ON FUNCTION get_admin_dashboard_stats_v3 IS 'V3: Orchestrator - calls all dashboard functions and returns complete dashboard data including funnel and status breakdown';

-- ============================================
-- PERMISSIONS
-- ============================================
GRANT EXECUTE ON FUNCTION get_dashboard_kpi_main_v3 TO authenticated;
GRANT EXECUTE ON FUNCTION get_dashboard_performance_gestionnaires_v3 TO authenticated;
GRANT EXECUTE ON FUNCTION get_dashboard_performance_agences_v3 TO authenticated;
GRANT EXECUTE ON FUNCTION get_dashboard_performance_metiers_v3 TO authenticated;
GRANT EXECUTE ON FUNCTION get_dashboard_cycles_moyens_v3 TO authenticated;
GRANT EXECUTE ON FUNCTION get_dashboard_sparkline_data_v3 TO authenticated;
GRANT EXECUTE ON FUNCTION get_dashboard_volume_by_status_v3 TO authenticated;
GRANT EXECUTE ON FUNCTION get_dashboard_conversion_funnel_v3 TO authenticated;
GRANT EXECUTE ON FUNCTION get_dashboard_status_breakdown_v3 TO authenticated;
GRANT EXECUTE ON FUNCTION get_admin_dashboard_stats_v3 TO authenticated;
