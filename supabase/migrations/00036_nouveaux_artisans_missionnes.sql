-- ============================================
-- MIGRATION: Nouveaux Artisans Missionnés
-- ============================================
-- Description: Ajoute une fonction pour compter les artisans en statut POTENTIEL
--              avec au moins une intervention, créés par le gestionnaire
-- ============================================

-- Fonction pour obtenir le nombre de nouveaux artisans missionnés par gestionnaire
CREATE OR REPLACE FUNCTION get_dashboard_nouveaux_artisans_missionnes(
  p_period_start TIMESTAMP,
  p_period_end TIMESTAMP,
  p_agence_ids UUID[] DEFAULT NULL,
  p_metier_ids UUID[] DEFAULT NULL
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
    Compte les nouveaux artisans missionnés par gestionnaire:
    - Artisans avec statut = 'POTENTIEL'
    - Ayant au moins une intervention
    - Groupés par gestionnaire_id (approximation du créateur)
    - Filtrés par agence et métier si spécifiés
  */

  WITH artisans_potentiels_avec_intervention AS (
    SELECT DISTINCT
      a.id AS artisan_id,
      a.gestionnaire_id,
      u.firstname || ' ' || u.lastname AS gestionnaire_nom,
      u.firstname AS gestionnaire_firstname,
      u.lastname AS gestionnaire_lastname,
      u.email AS gestionnaire_email
    FROM artisans a
    JOIN artisan_statuses ast ON a.statut_id = ast.id
    JOIN users u ON a.gestionnaire_id = u.id
    WHERE ast.code = 'POTENTIEL'
      AND a.gestionnaire_id IS NOT NULL
      AND EXISTS (
        -- Vérifier qu'il y a au moins une intervention pour cet artisan
        SELECT 1
        FROM interventions i
        WHERE i.artisan_id = a.id
          AND i.is_active = true
          AND i.date >= p_period_start
          AND i.date <= p_period_end
          AND (array_length(p_agence_ids, 1) IS NULL OR i.agence_id = ANY(p_agence_ids))
          AND (array_length(p_metier_ids, 1) IS NULL OR i.metier_id = ANY(p_metier_ids))
      )
  ),

  gestionnaire_artisan_stats AS (
    SELECT
      gestionnaire_id,
      gestionnaire_nom,
      gestionnaire_firstname,
      gestionnaire_lastname,
      gestionnaire_email,
      COUNT(DISTINCT artisan_id) AS nb_nouveaux_artisans_missionnes
    FROM artisans_potentiels_avec_intervention
    GROUP BY
      gestionnaire_id,
      gestionnaire_nom,
      gestionnaire_firstname,
      gestionnaire_lastname,
      gestionnaire_email
  )

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'gestionnaire_id', gestionnaire_id,
      'gestionnaire_nom', gestionnaire_nom,
      'gestionnaire_firstname', gestionnaire_firstname,
      'gestionnaire_lastname', gestionnaire_lastname,
      'gestionnaire_email', gestionnaire_email,
      'nb_nouveaux_artisans_missionnes', nb_nouveaux_artisans_missionnes
    )
    ORDER BY nb_nouveaux_artisans_missionnes DESC
  ), '[]'::jsonb)
  INTO v_result
  FROM gestionnaire_artisan_stats;

  RETURN v_result;
END;
$$;

-- Fonction pour obtenir le nombre total de nouveaux artisans missionnés (pour les KPIs globaux)
CREATE OR REPLACE FUNCTION get_dashboard_total_nouveaux_artisans_missionnes(
  p_period_start TIMESTAMP,
  p_period_end TIMESTAMP,
  p_agence_ids UUID[] DEFAULT NULL,
  p_metier_ids UUID[] DEFAULT NULL,
  p_gestionnaire_ids UUID[] DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  /*
    Compte le nombre total de nouveaux artisans missionnés:
    - Artisans avec statut = 'POTENTIEL'
    - Ayant au moins une intervention dans la période
    - Filtrés par gestionnaire, agence et métier si spécifiés
  */

  SELECT COUNT(DISTINCT a.id)
  INTO v_count
  FROM artisans a
  JOIN artisan_statuses ast ON a.statut_id = ast.id
  WHERE ast.code = 'POTENTIEL'
    AND (array_length(p_gestionnaire_ids, 1) IS NULL OR a.gestionnaire_id = ANY(p_gestionnaire_ids))
    AND EXISTS (
      SELECT 1
      FROM interventions i
      WHERE i.artisan_id = a.id
        AND i.is_active = true
        AND i.date >= p_period_start
        AND i.date <= p_period_end
        AND (array_length(p_agence_ids, 1) IS NULL OR i.agence_id = ANY(p_agence_ids))
        AND (array_length(p_metier_ids, 1) IS NULL OR i.metier_id = ANY(p_metier_ids))
    );

  RETURN COALESCE(v_count, 0);
END;
$$;

-- Mettre à jour la fonction orchestratrice pour inclure les nouveaux artisans missionnés
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
    ),
    'nouveaux_artisans_missionnes', get_dashboard_nouveaux_artisans_missionnes(
      p_period_start,
      p_period_end,
      p_agence_ids,
      p_metier_ids
    ),
    'total_nouveaux_artisans_missionnes', get_dashboard_total_nouveaux_artisans_missionnes(
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

-- Commentaires
COMMENT ON FUNCTION get_dashboard_nouveaux_artisans_missionnes IS 'Retourne le nombre de nouveaux artisans missionnés (statut POTENTIEL avec interventions) par gestionnaire';
COMMENT ON FUNCTION get_dashboard_total_nouveaux_artisans_missionnes IS 'Retourne le nombre total de nouveaux artisans missionnés (statut POTENTIEL avec interventions)';

-- Permissions
GRANT EXECUTE ON FUNCTION get_dashboard_nouveaux_artisans_missionnes TO authenticated;
GRANT EXECUTE ON FUNCTION get_dashboard_total_nouveaux_artisans_missionnes TO authenticated;
