-- ========================================
-- Migration: Ajouter les données financières daily aux sparklines
-- ========================================
-- Objectif: Ajouter chiffreAffaires et marge par jour dans les sparklines
-- Date: 2025-01-XX

-- ========================================
-- SECTION: Modifier la fonction get_sparkline_data
-- ========================================

CREATE OR REPLACE FUNCTION public.get_sparkline_data(
  p_period_start timestamptz,
  p_period_end timestamptz,
  p_demande_code text,
  p_terminee_code text,
  p_agence_id uuid DEFAULT NULL,
  p_gestionnaire_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_today date := CURRENT_DATE;
  v_result jsonb;
BEGIN
  -- Generate complete time series for the period
  WITH time_series AS (
    SELECT generate_series(
      p_period_start::date,
      p_period_end::date,
      interval '1 day'
    )::date as date
  ),
  historical AS (
    -- Historical data from MV (yesterday and before)
    SELECT
      transition_date as date,
      SUM(CASE WHEN to_status_code = p_demande_code THEN nb_transitions ELSE 0 END)::integer as count_demandees,
      SUM(CASE WHEN to_status_code = p_terminee_code THEN nb_transitions ELSE 0 END)::integer as count_terminees
    FROM public.mv_daily_status_transitions
    WHERE transition_date >= p_period_start::date
      AND transition_date < v_today
      AND (p_agence_id IS NULL OR agence_id = p_agence_id)
      AND (p_gestionnaire_id IS NULL OR gestionnaire_id = p_gestionnaire_id)
    GROUP BY transition_date
  ),
  realtime_today AS (
    -- Today's data in real-time
    SELECT
      v_today as date,
      COUNT(DISTINCT CASE WHEN ist.to_status_code = p_demande_code THEN ist.intervention_id END)::integer as count_demandees,
      COUNT(DISTINCT CASE WHEN ist.to_status_code = p_terminee_code THEN ist.intervention_id END)::integer as count_terminees
    FROM public.intervention_status_transitions ist
    INNER JOIN public.interventions i ON i.id = ist.intervention_id
    WHERE date_trunc('day', ist.transition_date) = v_today
      AND i.is_active = true
      AND (p_agence_id IS NULL OR i.agence_id = p_agence_id)
      AND (p_gestionnaire_id IS NULL OR i.assigned_user_id = p_gestionnaire_id)
  ),
  combined_counts AS (
    SELECT * FROM historical
    UNION ALL
    SELECT * FROM realtime_today WHERE date <= p_period_end::date
  ),
  -- Financial data: CA and marge by day based on INTER_TERMINEE transition date
  financial_data AS (
    SELECT
      date_trunc('day', ist.transition_date)::date as date,
      COALESCE(SUM(CASE WHEN ic.cost_type = 'intervention' THEN ic.amount ELSE 0 END), 0)::numeric as chiffre_affaires,
      COALESCE(SUM(CASE WHEN ic.cost_type = 'intervention' THEN ic.amount ELSE 0 END), 0)::numeric 
        - COALESCE(SUM(CASE WHEN ic.cost_type IN ('sst', 'materiel') THEN ic.amount ELSE 0 END), 0)::numeric as marge
    FROM public.intervention_status_transitions ist
    INNER JOIN public.interventions i ON i.id = ist.intervention_id
    LEFT JOIN public.intervention_costs ic ON ic.intervention_id = ist.intervention_id
    WHERE ist.to_status_code = p_terminee_code
      AND ist.transition_date >= p_period_start
      AND ist.transition_date <= p_period_end
      AND i.is_active = true
      AND (p_agence_id IS NULL OR i.agence_id = p_agence_id)
      AND (p_gestionnaire_id IS NULL OR i.assigned_user_id = p_gestionnaire_id)
    GROUP BY date_trunc('day', ist.transition_date)::date
  ),
  -- Combine time series with counts and financial data
  combined AS (
    SELECT
      ts.date,
      COALESCE(cc.count_demandees, 0)::integer as count_demandees,
      COALESCE(cc.count_terminees, 0)::integer as count_terminees,
      COALESCE(fd.chiffre_affaires, 0)::numeric as chiffre_affaires,
      COALESCE(fd.marge, 0)::numeric as marge
    FROM time_series ts
    LEFT JOIN combined_counts cc ON ts.date = cc.date
    LEFT JOIN financial_data fd ON ts.date = fd.date
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'date', c.date,
      'countDemandees', c.count_demandees,
      'countTerminees', c.count_terminees,
      'chiffreAffaires', c.chiffre_affaires,
      'marge', c.marge
    ) ORDER BY c.date
  ) INTO v_result
  FROM combined c
  WHERE c.date >= p_period_start::date AND c.date <= p_period_end::date;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

