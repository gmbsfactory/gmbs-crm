-- Migration 00027: Correction du calcul du taux de transformation
-- Fix: Utiliser l'approche 1 - Compter les interventions créées dans la période
-- et parmi celles-ci, combien sont terminées (peu importe quand)

CREATE OR REPLACE FUNCTION public.get_admin_dashboard_stats_v2(
  p_period_start timestamptz,
  p_period_end timestamptz,
  p_demande_status_code text,
  p_devis_status_code text,
  p_accepte_status_code text,
  p_en_cours_status_code text,
  p_terminee_status_code text,
  p_att_acompte_status_code text,
  p_valid_status_codes text[],
  p_agence_id uuid DEFAULT NULL,
  p_gestionnaire_id uuid DEFAULT NULL,
  p_metier_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  result jsonb;
  v_interval interval;
  v_previous_period_start timestamptz;
  v_previous_period_end timestamptz;
  v_conversion_funnel jsonb;
  v_top_artisans jsonb;
  v_detailed_cycle_times jsonb;
BEGIN
  v_interval := p_period_end - p_period_start;
  v_previous_period_start := p_period_start - v_interval;
  v_previous_period_end := p_period_start;

  -- Appeler les nouvelles fonctions
  v_conversion_funnel := get_conversion_funnel(
    p_period_start,
    p_period_end,
    p_agence_id,
    p_gestionnaire_id,
    p_metier_id
  );

  v_top_artisans := get_top_artisans(
    p_period_start,
    p_period_end,
    5,
    p_agence_id,
    p_metier_id
  );

  v_detailed_cycle_times := get_detailed_cycle_times(
    p_period_start,
    p_period_end,
    p_agence_id,
    p_gestionnaire_id,
    p_metier_id
  );

  WITH
  -- ========================================
  -- CTE: Interventions créées dans la période
  -- ========================================
  interventions_crees_periode AS (
    SELECT i.id, i.agence_id, i.metier_id, i.assigned_user_id
    FROM interventions i
    INNER JOIN intervention_costs_cache icc ON icc.intervention_id = i.id
    WHERE i.is_active = true
      AND i.date >= p_period_start AND i.date < p_period_end
      AND (p_agence_id IS NULL OR i.agence_id = p_agence_id)
      AND (p_metier_id IS NULL OR i.metier_id = p_metier_id)
      AND (p_gestionnaire_id IS NULL OR i.assigned_user_id = p_gestionnaire_id)
  ),

  -- ========================================
  -- CTE: Interventions créées dans la période précédente
  -- ========================================
  interventions_periode_prev AS (
    SELECT i.id
    FROM interventions i
    INNER JOIN intervention_costs_cache icc ON icc.intervention_id = i.id
    WHERE i.is_active = true
      AND i.date >= v_previous_period_start AND i.date < v_previous_period_end
      AND (p_agence_id IS NULL OR i.agence_id = p_agence_id)
      AND (p_metier_id IS NULL OR i.metier_id = p_metier_id)
      AND (p_gestionnaire_id IS NULL OR i.assigned_user_id = p_gestionnaire_id)
  ),

  -- ========================================
  -- CTE: Interventions créées dans la période qui ont eu une transition DEMANDE
  -- (pour nb_demandees - approche 1)
  -- ========================================
  interventions_demandees_parmi_crees AS (
    SELECT DISTINCT ist.intervention_id
    FROM intervention_status_transitions ist
    WHERE ist.to_status_code = p_demande_status_code
      AND ist.intervention_id IN (
        SELECT id FROM interventions_crees_periode
      )
  ),

  -- ========================================
  -- CTE: Interventions créées dans la période ET terminées (peu importe quand)
  -- (pour nb_terminees - approche 1)
  -- ========================================
  interventions_terminees_parmi_crees AS (
    SELECT DISTINCT ist.intervention_id
    FROM intervention_status_transitions ist
    WHERE ist.to_status_code = p_terminee_status_code
      AND ist.intervention_id IN (
        SELECT id FROM interventions_crees_periode
      )
  ),

  -- ========================================
  -- CTE: Transitions pour autres métriques (devis, valides, etc.)
  -- On garde la logique existante pour ces métriques
  -- ========================================
  transitions_periode AS (
    SELECT ist.intervention_id, ist.to_status_code
    FROM intervention_status_transitions ist
    INNER JOIN interventions_crees_periode ip ON ip.id = ist.intervention_id
    WHERE ist.transition_date >= p_period_start AND ist.transition_date <= p_period_end
  ),

  transitions_periode_prev AS (
    SELECT ist.intervention_id, ist.to_status_code
    FROM intervention_status_transitions ist
    INNER JOIN interventions_periode_prev ip ON ip.id = ist.intervention_id
    WHERE ist.transition_date >= v_previous_period_start AND ist.transition_date <= v_previous_period_end
  ),

  -- ========================================
  -- CTE: Stats principales avec calcul corrigé pour taux de transformation
  -- ========================================
  demandees_count AS (
    SELECT COUNT(*)::int as nb_demandees
    FROM interventions_demandees_parmi_crees
  ),
  terminees_count AS (
    SELECT COUNT(*)::int as nb_terminees
    FROM interventions_terminees_parmi_crees
  ),
  autres_metriques AS (
    SELECT
      COUNT(DISTINCT CASE WHEN tp.to_status_code = p_devis_status_code THEN tp.intervention_id END)::int as nb_devis,
      COUNT(DISTINCT CASE WHEN tp.to_status_code = ANY(p_valid_status_codes) THEN tp.intervention_id END)::int as nb_valides,
      COALESCE(AVG(isc.cycle_time_days), 0)::numeric(10,2) as avg_cycle_time_days
    FROM transitions_periode tp
    LEFT JOIN intervention_status_cache isc ON isc.intervention_id = tp.intervention_id
      AND tp.to_status_code = p_terminee_status_code
  ),
  main_stats_counts AS (
    SELECT
      COALESCE(dc.nb_demandees, 0) as nb_demandees,
      COALESCE(tc.nb_terminees, 0) as nb_terminees,
      COALESCE(am.nb_devis, 0) as nb_devis,
      COALESCE(am.nb_valides, 0) as nb_valides,
      COALESCE(am.avg_cycle_time_days, 0) as avg_cycle_time_days
    FROM demandees_count dc
    CROSS JOIN terminees_count tc
    CROSS JOIN autres_metriques am
  ),

  main_stats_counts_prev AS (
    SELECT
      COUNT(DISTINCT CASE WHEN tp.to_status_code = p_demande_status_code THEN tp.intervention_id END)::int as nb_demandees,
      COUNT(DISTINCT CASE WHEN tp.to_status_code = p_terminee_status_code THEN tp.intervention_id END)::int as nb_terminees
    FROM transitions_periode_prev tp
  ),

  global_financials AS (
    SELECT
      COALESCE(SUM(icc.total_ca), 0)::numeric as total_paiements,
      COALESCE(SUM(icc.total_sst + icc.total_materiel), 0)::numeric as total_couts
    FROM interventions_crees_periode ip
    INNER JOIN intervention_status_transitions ist ON ist.intervention_id = ip.id
      AND ist.to_status_code = p_terminee_status_code
    INNER JOIN intervention_costs_cache icc ON icc.intervention_id = ip.id
  ),

  global_financials_prev AS (
    SELECT
      COALESCE(SUM(icc.total_ca), 0)::numeric as total_paiements,
      COALESCE(SUM(icc.total_sst + icc.total_materiel), 0)::numeric as total_couts
    FROM interventions_periode_prev ipp
    INNER JOIN transitions_periode_prev tpp ON tpp.intervention_id = ipp.id
      AND tpp.to_status_code = p_terminee_status_code
    INNER JOIN intervention_costs_cache icc ON icc.intervention_id = ipp.id
  ),

  metier_breakdown AS (
    SELECT ip.metier_id, COUNT(*)::int as count
    FROM interventions_crees_periode ip
    WHERE ip.metier_id IS NOT NULL
    GROUP BY ip.metier_id
    ORDER BY count DESC
    LIMIT 10
  ),

  status_breakdown AS (
    SELECT tp.to_status_code as statut_code, COUNT(DISTINCT tp.intervention_id)::int as count
    FROM transitions_periode tp
    WHERE tp.to_status_code IS NOT NULL
    GROUP BY tp.to_status_code
  )

  -- ========================================
  -- Final Result Assembly
  -- ========================================
  SELECT jsonb_build_object(
    'mainStats', (
      SELECT jsonb_build_object(
        'nbInterventionsDemandees', ms.nb_demandees,
        'nbInterventionsTerminees', ms.nb_terminees,
        'nbDevis', ms.nb_devis,
        'nbValides', ms.nb_valides,
        'chiffreAffaires', gf.total_paiements,
        'couts', gf.total_couts,
        'marge', gf.total_paiements - gf.total_couts,
        'avgCycleTime', ms.avg_cycle_time_days,
        'tauxTransformation', CASE WHEN ms.nb_demandees > 0
          THEN ROUND((ms.nb_terminees::numeric / ms.nb_demandees) * 100, 1)
          ELSE 0 END,
        'tauxMarge', CASE WHEN gf.total_paiements > 0
          THEN ROUND(((gf.total_paiements - gf.total_couts)::numeric / gf.total_paiements) * 100, 1)
          ELSE 0 END,
        'deltaInterventions', CASE WHEN msp.nb_demandees > 0
          THEN ROUND(((ms.nb_demandees - msp.nb_demandees)::numeric / msp.nb_demandees) * 100, 1)
          ELSE 0 END,
        'deltaChiffreAffaires', CASE WHEN gfp.total_paiements > 0
          THEN ROUND(((gf.total_paiements - gfp.total_paiements)::numeric / gfp.total_paiements) * 100, 1)
          ELSE 0 END,
        'deltaMarge', CASE WHEN (gfp.total_paiements - gfp.total_couts) > 0
          THEN ROUND(((gf.total_paiements - gf.total_couts) - (gfp.total_paiements - gfp.total_couts))::numeric / (gfp.total_paiements - gfp.total_couts) * 100, 1)
          ELSE 0 END
      )
      FROM main_stats_counts ms
      CROSS JOIN main_stats_counts_prev msp
      CROSS JOIN global_financials gf
      CROSS JOIN global_financials_prev gfp
    ),

    'sparklines', get_sparkline_data(
      p_period_start,
      p_period_end,
      p_demande_status_code,
      p_terminee_status_code,
      p_agence_id,
      p_gestionnaire_id
    ),

    'agencyBreakdown', get_agency_breakdown(
      p_period_start,
      p_period_end,
      p_terminee_status_code,
      p_agence_id
    ),

    'gestionnaireBreakdown', get_gestionnaire_breakdown(
      p_period_start,
      p_period_end,
      p_terminee_status_code,
      p_gestionnaire_id
    ),

    'statusBreakdown', (
      SELECT COALESCE(
        jsonb_agg(jsonb_build_object('statut_code', sb.statut_code, 'count', sb.count)),
        '[]'::jsonb
      )
      FROM status_breakdown sb
    ),

    'metierBreakdown', (
      SELECT COALESCE(
        jsonb_agg(jsonb_build_object('metier_id', mb.metier_id, 'count', mb.count)),
        '[]'::jsonb
      )
      FROM metier_breakdown mb
    ),

    -- ========================================
    -- NOUVELLES PROPRIÉTÉS
    -- ========================================
    'conversionFunnel', v_conversion_funnel,
    'topArtisans', v_top_artisans,
    'detailedCycleTimes', v_detailed_cycle_times
  ) INTO result;

  RETURN result;
END;
$$;

-- Mise à jour du commentaire
COMMENT ON FUNCTION public.get_admin_dashboard_stats_v2 IS
  'Optimized RPC v2 with corrected transformation rate calculation (Approach 1: interventions created in period, terminated anytime). Target: ~200ms';

-- ========================================
-- Summary
-- ========================================
-- ✅ CORRIGÉ: Calcul du taux de transformation
--   - nb_demandees: Interventions créées dans la période qui ont eu une transition DEMANDE
--   - nb_terminees: Interventions créées dans la période ET terminées (peu importe quand)
--   - Taux = (nb_terminees / nb_demandees) × 100
--
-- Cette approche évite le problème où des interventions créées avant la période
-- mais terminées pendant la période créaient un déséquilibre dans le calcul.
-- ========================================

