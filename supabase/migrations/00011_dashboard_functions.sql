-- ========================================
-- Dashboard Functions (Admin Stats & Podium)
-- ========================================

-- Vue matérialisée pour le CA (filtre montants > 999999)
CREATE MATERIALIZED VIEW IF NOT EXISTS interventions_ca AS
SELECT 
  i.id as intervention_id,
  COALESCE(SUM(ic.amount) FILTER (WHERE ic.cost_type = 'intervention'), 0) as total_ca
FROM public.interventions i
LEFT JOIN public.intervention_costs ic ON ic.intervention_id = i.id
WHERE i.is_active = true
GROUP BY i.id
HAVING COALESCE(SUM(ic.amount) FILTER (WHERE ic.cost_type = 'intervention'), 0) < 1000000;

CREATE UNIQUE INDEX IF NOT EXISTS idx_interventions_ca_id ON interventions_ca(intervention_id);

-- ========================================
-- FONCTION: get_admin_dashboard_stats
-- ========================================

CREATE OR REPLACE FUNCTION public.get_admin_dashboard_stats(
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
BEGIN
  v_interval := p_period_end - p_period_start;
  v_previous_period_start := p_period_start - v_interval;
  v_previous_period_end := p_period_start;

  WITH 
  interventions_periode AS (
    SELECT i.id, i.statut_id, ist.code as statut_code, i.metier_id, i.agence_id,
           i.assigned_user_id, i.date as date_intervention, i.created_at
    FROM public.interventions i
    LEFT JOIN public.intervention_statuses ist ON ist.id = i.statut_id
    INNER JOIN interventions_ca ica ON ica.intervention_id = i.id
    WHERE i.is_active = true AND i.date >= p_period_start AND i.date < p_period_end
      AND (p_agence_id IS NULL OR i.agence_id = p_agence_id)
      AND (p_metier_id IS NULL OR i.metier_id = p_metier_id)
  ),
  interventions_periode_prev AS (
    SELECT i.id
    FROM public.interventions i
    INNER JOIN interventions_ca ica ON ica.intervention_id = i.id
    WHERE i.is_active = true AND i.date >= v_previous_period_start AND i.date < v_previous_period_end
      AND (p_agence_id IS NULL OR i.agence_id = p_agence_id)
      AND (p_metier_id IS NULL OR i.metier_id = p_metier_id)
  ),
  interventions_gestionnaires AS (
    SELECT DISTINCT i.id as intervention_id, i.assigned_user_id as gestionnaire_id
    FROM interventions_periode i
    WHERE i.assigned_user_id IS NOT NULL
      AND (p_gestionnaire_id IS NULL OR i.assigned_user_id = p_gestionnaire_id)
  ),
  interventions_filtrees AS (
    SELECT DISTINCT ip.id, ip.date_intervention, ip.agence_id, ip.metier_id, ip.assigned_user_id, ip.statut_code, ip.created_at
    FROM interventions_periode ip
    WHERE (p_gestionnaire_id IS NULL OR ip.id IN (SELECT intervention_id FROM interventions_gestionnaires))
  ),
  transitions_periode AS (
    SELECT ist.intervention_id, ist.to_status_code, ist.transition_date, ip.agence_id, ip.assigned_user_id
    FROM public.intervention_status_transitions ist
    INNER JOIN interventions_filtrees ip ON ip.id = ist.intervention_id
    WHERE ist.transition_date >= p_period_start AND ist.transition_date <= p_period_end
  ),
  transitions_periode_prev AS (
    SELECT ist.intervention_id, ist.to_status_code
    FROM public.intervention_status_transitions ist
    INNER JOIN interventions_periode_prev ip ON ip.id = ist.intervention_id
    WHERE ist.transition_date >= v_previous_period_start AND ist.transition_date <= v_previous_period_end
  ),
  main_stats_counts AS (
    SELECT 
      COUNT(DISTINCT CASE WHEN to_status_code = p_demande_status_code THEN intervention_id END)::integer as nb_demandees,
      COUNT(DISTINCT CASE WHEN to_status_code = p_terminee_status_code THEN intervention_id END)::integer as nb_terminees,
      COUNT(DISTINCT CASE WHEN to_status_code = p_devis_status_code THEN intervention_id END)::integer as nb_devis,
      COUNT(DISTINCT CASE WHEN to_status_code = ANY(p_valid_status_codes) THEN intervention_id END)::integer as nb_valides
    FROM transitions_periode
  ),
  main_stats_counts_prev AS (
    SELECT 
      COUNT(DISTINCT CASE WHEN to_status_code = p_demande_status_code THEN intervention_id END)::integer as nb_demandees,
      COUNT(DISTINCT CASE WHEN to_status_code = p_terminee_status_code THEN intervention_id END)::integer as nb_terminees
    FROM transitions_periode_prev
  ),
  first_demande_transition AS (
    SELECT ip.id as intervention_id,
      COALESCE(MIN(CASE WHEN ist.to_status_code = p_demande_status_code THEN ist.transition_date END),
        CASE WHEN ip.statut_code = p_demande_status_code THEN ip.created_at END) as date_demande
    FROM interventions_filtrees ip
    LEFT JOIN public.intervention_status_transitions ist ON ist.intervention_id = ip.id
      AND ist.to_status_code = p_demande_status_code
      AND (ist.from_status_code IS NULL OR ist.from_status_code != ist.to_status_code)
    GROUP BY ip.id, ip.statut_code, ip.created_at
    HAVING COALESCE(MIN(CASE WHEN ist.to_status_code = p_demande_status_code THEN ist.transition_date END),
      CASE WHEN ip.statut_code = p_demande_status_code THEN ip.created_at END) IS NOT NULL
  ),
  first_terminee_transition AS (
    SELECT ip.id as intervention_id, MIN(ist.transition_date) as date_terminee
    FROM interventions_filtrees ip
    INNER JOIN public.intervention_status_transitions ist ON ist.intervention_id = ip.id
      AND ist.to_status_code = p_terminee_status_code
      AND (ist.from_status_code IS NULL OR ist.from_status_code != ist.to_status_code)
    GROUP BY ip.id
  ),
  cycle_time_data AS (
    SELECT fdt.intervention_id, EXTRACT(EPOCH FROM (ftt.date_terminee - fdt.date_demande)) / 86400.0 as days_diff
    FROM first_demande_transition fdt
    INNER JOIN first_terminee_transition ftt ON fdt.intervention_id = ftt.intervention_id
    WHERE ftt.date_terminee >= fdt.date_demande
  ),
  cycle_time_stats AS (
    SELECT COALESCE(AVG(days_diff), 0)::numeric(10,2) as avg_cycle_time_days FROM cycle_time_data
  ),
  financial_interventions AS (
    SELECT DISTINCT intervention_id FROM transitions_periode WHERE to_status_code = p_terminee_status_code
  ),
  paiements_agreges AS (
    SELECT ic.intervention_id, SUM(ic.amount)::numeric as total_paiements
    FROM financial_interventions fi
    JOIN public.intervention_costs ic ON ic.intervention_id = fi.intervention_id
    WHERE ic.cost_type = 'intervention'
    GROUP BY ic.intervention_id
  ),
  couts_agreges AS (
    SELECT ic.intervention_id, SUM(ic.amount)::numeric as total_couts
    FROM financial_interventions fi
    JOIN public.intervention_costs ic ON ic.intervention_id = fi.intervention_id
    WHERE ic.cost_type IN ('sst', 'materiel')
    GROUP BY ic.intervention_id
  ),
  global_financials AS (
    SELECT COALESCE(SUM(p.total_paiements), 0)::numeric as total_paiements, COALESCE(SUM(c.total_couts), 0)::numeric as total_couts
    FROM financial_interventions fi
    LEFT JOIN paiements_agreges p ON p.intervention_id = fi.intervention_id
    LEFT JOIN couts_agreges c ON c.intervention_id = fi.intervention_id
  ),
  financial_interventions_prev AS (
    SELECT DISTINCT intervention_id FROM transitions_periode_prev WHERE to_status_code = p_terminee_status_code
  ),
  paiements_agreges_prev AS (
    SELECT ic.intervention_id, SUM(ic.amount)::numeric as total_paiements
    FROM financial_interventions_prev fi
    JOIN public.intervention_costs ic ON ic.intervention_id = fi.intervention_id
    WHERE ic.cost_type = 'intervention'
    GROUP BY ic.intervention_id
  ),
  couts_agreges_prev AS (
    SELECT ic.intervention_id, SUM(ic.amount)::numeric as total_couts
    FROM financial_interventions_prev fi
    JOIN public.intervention_costs ic ON ic.intervention_id = fi.intervention_id
    WHERE ic.cost_type IN ('sst', 'materiel')
    GROUP BY ic.intervention_id
  ),
  global_financials_prev AS (
    SELECT COALESCE(SUM(p.total_paiements), 0)::numeric as total_paiements, COALESCE(SUM(c.total_couts), 0)::numeric as total_couts
    FROM financial_interventions_prev fi
    LEFT JOIN paiements_agreges_prev p ON p.intervention_id = fi.intervention_id
    LEFT JOIN couts_agreges_prev c ON c.intervention_id = fi.intervention_id
  ),
  time_series AS (
    SELECT generate_series(p_period_start, p_period_end - interval '1 day', interval '1 day') as day
  ),
  sparkline_data AS (
    SELECT ts.day::date as date,
      COUNT(DISTINCT CASE WHEN tp.to_status_code = p_demande_status_code THEN tp.intervention_id END)::integer as count_demandees,
      COUNT(DISTINCT CASE WHEN tp.to_status_code = p_terminee_status_code THEN tp.intervention_id END)::integer as count_terminees
    FROM time_series ts
    LEFT JOIN transitions_periode tp ON date_trunc('day', tp.transition_date) = date_trunc('day', ts.day)
    GROUP BY ts.day ORDER BY ts.day
  ),
  metier_breakdown AS (
    SELECT 
      ip.metier_id, 
      COUNT(*)::integer as total_interventions,
      COUNT(DISTINCT CASE WHEN tp.to_status_code = p_terminee_status_code THEN tp.intervention_id END)::integer as terminated_interventions
    FROM interventions_filtrees ip 
    LEFT JOIN transitions_periode tp ON tp.intervention_id = ip.id
    WHERE ip.metier_id IS NOT NULL 
    GROUP BY ip.metier_id 
    ORDER BY total_interventions DESC LIMIT 10
  ),
  metier_financials AS (
    SELECT 
      ip.metier_id, 
      COALESCE(SUM(p.total_paiements), 0)::numeric as total_paiements, 
      COALESCE(SUM(c.total_couts), 0)::numeric as total_couts
    FROM interventions_filtrees ip
    LEFT JOIN financial_interventions fi ON fi.intervention_id = ip.id
    LEFT JOIN paiements_agreges p ON p.intervention_id = ip.id
    LEFT JOIN couts_agreges c ON c.intervention_id = ip.id
    WHERE ip.metier_id IS NOT NULL 
    GROUP BY ip.metier_id
  ),
  agency_breakdown AS (
    SELECT ip.agence_id, COUNT(*)::integer as total_interventions,
      COUNT(DISTINCT CASE WHEN tp.to_status_code = p_terminee_status_code THEN tp.intervention_id END)::integer as terminated_interventions,
      COALESCE(AVG(ct.days_diff), 0)::numeric(10,2) as avg_cycle_time
    FROM interventions_filtrees ip
    LEFT JOIN transitions_periode tp ON tp.intervention_id = ip.id
    LEFT JOIN cycle_time_data ct ON ct.intervention_id = ip.id
    WHERE ip.agence_id IS NOT NULL GROUP BY ip.agence_id
  ),
  agency_financials AS (
    SELECT ip.agence_id, COALESCE(SUM(p.total_paiements), 0)::numeric as total_paiements, COALESCE(SUM(c.total_couts), 0)::numeric as total_couts
    FROM interventions_filtrees ip
    LEFT JOIN financial_interventions fi ON fi.intervention_id = ip.id
    LEFT JOIN paiements_agreges p ON p.intervention_id = ip.id
    LEFT JOIN couts_agreges c ON c.intervention_id = ip.id
    WHERE ip.agence_id IS NOT NULL GROUP BY ip.agence_id
  ),
  gestionnaire_breakdown AS (
    SELECT ip.assigned_user_id as gestionnaire_id, COUNT(*)::integer as total_interventions,
      COUNT(DISTINCT CASE WHEN tp.to_status_code = p_terminee_status_code THEN tp.intervention_id END)::integer as terminated_interventions,
      COALESCE(AVG(ct.days_diff), 0)::numeric(10,2) as avg_cycle_time
    FROM interventions_filtrees ip
    LEFT JOIN transitions_periode tp ON tp.intervention_id = ip.id
    LEFT JOIN cycle_time_data ct ON ct.intervention_id = ip.id
    WHERE ip.assigned_user_id IS NOT NULL GROUP BY ip.assigned_user_id
  ),
  gestionnaire_financials AS (
    SELECT ip.assigned_user_id as gestionnaire_id, COALESCE(SUM(p.total_paiements), 0)::numeric as total_paiements, COALESCE(SUM(c.total_couts), 0)::numeric as total_couts
    FROM interventions_filtrees ip
    LEFT JOIN financial_interventions fi ON fi.intervention_id = ip.id
    LEFT JOIN paiements_agreges p ON p.intervention_id = ip.id
    LEFT JOIN couts_agreges c ON c.intervention_id = ip.id
    WHERE ip.assigned_user_id IS NOT NULL GROUP BY ip.assigned_user_id
  ),
  status_breakdown AS (
    SELECT tp.to_status_code as statut_code, COUNT(DISTINCT tp.intervention_id)::integer as count
    FROM transitions_periode tp WHERE tp.to_status_code IS NOT NULL GROUP BY tp.to_status_code
  ),
  conversion_funnel AS (
    WITH base_interventions AS (
      -- Interventions créées dans la période (point de départ = DEMANDE)
      SELECT DISTINCT ip.id as intervention_id
      FROM interventions_filtrees ip
      WHERE ip.created_at >= p_period_start
        AND ip.created_at <= p_period_end
    ),
    status_ranks AS (
      SELECT 1 as rank, p_demande_status_code as status_code UNION ALL
      SELECT 2, p_devis_status_code UNION ALL
      SELECT 3, p_accepte_status_code UNION ALL
      SELECT 4, p_en_cours_status_code UNION ALL
      SELECT 5, p_terminee_status_code
    ),
    last_status_reached AS (
      SELECT 
        bi.intervention_id,
        COALESCE(MAX(sr.rank), 1) as max_rank
      FROM base_interventions bi
      LEFT JOIN public.intervention_status_transitions ist
        ON ist.intervention_id = bi.intervention_id
        AND ist.transition_date >= p_period_start
        AND ist.transition_date <= p_period_end
        AND ist.to_status_code IN (p_demande_status_code, p_devis_status_code, p_accepte_status_code, p_en_cours_status_code, p_terminee_status_code)
      LEFT JOIN status_ranks sr ON sr.status_code = ist.to_status_code
      GROUP BY bi.intervention_id
    )
    SELECT 'DEMANDE' as status_code, COUNT(*)::integer as count
    FROM base_interventions
    UNION ALL
    SELECT p_devis_status_code as status_code, COUNT(*)::integer as count
    FROM last_status_reached l WHERE l.max_rank >= 2
    UNION ALL
    SELECT p_accepte_status_code as status_code, COUNT(*)::integer as count
    FROM last_status_reached l WHERE l.max_rank >= 3
    UNION ALL
    SELECT p_en_cours_status_code as status_code, COUNT(*)::integer as count
    FROM last_status_reached l WHERE l.max_rank >= 4
    UNION ALL
    SELECT p_terminee_status_code as status_code, COUNT(*)::integer as count
    FROM last_status_reached l WHERE l.max_rank >= 5
  )

  SELECT jsonb_build_object(
    'mainStats', (
      SELECT jsonb_build_object(
        'nbInterventionsDemandees', ms.nb_demandees, 'nbInterventionsTerminees', ms.nb_terminees,
        'nbDevis', ms.nb_devis, 'nbValides', ms.nb_valides,
        'chiffreAffaires', COALESCE(gf.total_paiements, 0), 'couts', COALESCE(gf.total_couts, 0),
        'marge', COALESCE(gf.total_paiements, 0) - COALESCE(gf.total_couts, 0),
        'avgCycleTime', cts.avg_cycle_time_days,
        'deltaInterventions', CASE WHEN msp.nb_demandees > 0 THEN ROUND(((ms.nb_demandees - msp.nb_demandees)::numeric / msp.nb_demandees) * 100, 1) ELSE 0 END,
        'deltaChiffreAffaires', CASE WHEN gfp.total_paiements > 0 THEN ROUND(((gf.total_paiements - gfp.total_paiements)::numeric / gfp.total_paiements) * 100, 1) ELSE 0 END,
        'deltaMarge', CASE WHEN (gfp.total_paiements - gfp.total_couts) > 0 
          THEN ROUND(((gf.total_paiements - gf.total_couts) - (gfp.total_paiements - gfp.total_couts))::numeric / (gfp.total_paiements - gfp.total_couts) * 100, 1) ELSE 0 END
      )
      FROM main_stats_counts ms CROSS JOIN main_stats_counts_prev msp CROSS JOIN global_financials gf 
      CROSS JOIN global_financials_prev gfp CROSS JOIN cycle_time_stats cts
    ),
    'sparklines', (SELECT jsonb_agg(jsonb_build_object('date', sd.date, 'countDemandees', sd.count_demandees, 'countTerminees', sd.count_terminees)) FROM sparkline_data sd),
    'statusBreakdown', (SELECT COALESCE(jsonb_agg(jsonb_build_object('statut_code', sb.statut_code, 'count', sb.count)), '[]'::jsonb) FROM status_breakdown sb),
    'conversionFunnel', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'statusCode', cf.status_code,
        'count', cf.count
      )), '[]'::jsonb)
      FROM conversion_funnel cf
    ),
    'metierBreakdown', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'metier_id', mb.metier_id,
          'totalInterventions', mb.total_interventions,
          'terminatedInterventions', mb.terminated_interventions,
          'totalPaiements', COALESCE(mf.total_paiements, 0),
          'totalCouts', COALESCE(mf.total_couts, 0),
          'marge', COALESCE(mf.total_paiements, 0) - COALESCE(mf.total_couts, 0)
        )
      ), '[]'::jsonb)
      FROM metier_breakdown mb
      LEFT JOIN metier_financials mf ON mf.metier_id = mb.metier_id
    ),
    'agencyBreakdown', (SELECT COALESCE(jsonb_agg(jsonb_build_object('agence_id', a.agence_id, 'totalInterventions', a.total_interventions, 'terminatedInterventions', a.terminated_interventions, 'avgCycleTime', a.avg_cycle_time, 'totalPaiements', COALESCE(af.total_paiements, 0), 'totalCouts', COALESCE(af.total_couts, 0), 'marge', COALESCE(af.total_paiements, 0) - COALESCE(af.total_couts, 0))), '[]'::jsonb) FROM agency_breakdown a LEFT JOIN agency_financials af ON af.agence_id = a.agence_id),
    'gestionnaireBreakdown', (SELECT COALESCE(jsonb_agg(jsonb_build_object('gestionnaire_id', g.gestionnaire_id, 'totalInterventions', g.total_interventions, 'terminatedInterventions', g.terminated_interventions, 'avgCycleTime', g.avg_cycle_time, 'totalPaiements', COALESCE(gf.total_paiements, 0), 'totalCouts', COALESCE(gf.total_couts, 0), 'marge', COALESCE(gf.total_paiements, 0) - COALESCE(gf.total_couts, 0))), '[]'::jsonb) FROM gestionnaire_breakdown g LEFT JOIN gestionnaire_financials gf ON gf.gestionnaire_id = g.gestionnaire_id)
  ) INTO result;
  
  RETURN result;
END;
$$;

COMMENT ON FUNCTION public.get_admin_dashboard_stats IS 'Fonction RPC optimisée pour le Dashboard Admin avec stats, sparklines, funnel et breakdown';
GRANT EXECUTE ON FUNCTION public.get_admin_dashboard_stats TO authenticated;

-- ========================================
-- FONCTION: get_podium_ranking_by_period
-- ========================================

CREATE OR REPLACE FUNCTION public.get_podium_ranking_by_period(
  p_period_start timestamptz,
  p_period_end timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  result jsonb;
BEGIN
  WITH 
  interventions_periode AS (
    SELECT i.id, i.assigned_user_id, i.date as date_intervention
    FROM public.interventions i
    WHERE i.is_active = true AND i.date >= p_period_start AND i.date < p_period_end AND i.assigned_user_id IS NOT NULL
  ),
  transitions_terminees AS (
    SELECT DISTINCT ist.intervention_id, ist.transition_date
    FROM public.intervention_status_transitions ist
    INNER JOIN interventions_periode ip ON ip.id = ist.intervention_id
    WHERE ist.to_status_code = 'INTER_TERMINEE'
      AND ist.transition_date >= p_period_start AND ist.transition_date <= p_period_end
      AND (ist.from_status_code IS NULL OR ist.from_status_code != ist.to_status_code)
  ),
  financial_interventions AS (
    SELECT DISTINCT intervention_id FROM transitions_terminees
  ),
  paiements_agreges AS (
    SELECT ic.intervention_id, SUM(ic.amount)::numeric as total_paiements
    FROM financial_interventions fi
    JOIN public.intervention_costs ic ON ic.intervention_id = fi.intervention_id
    WHERE ic.cost_type = 'intervention'
    GROUP BY ic.intervention_id
  ),
  couts_agreges AS (
    SELECT ic.intervention_id, SUM(ic.amount)::numeric as total_couts
    FROM financial_interventions fi
    JOIN public.intervention_costs ic ON ic.intervention_id = fi.intervention_id
    WHERE ic.cost_type IN ('sst', 'materiel')
    GROUP BY ic.intervention_id
  ),
  gestionnaire_stats AS (
    SELECT ip.assigned_user_id as gestionnaire_id, COUNT(DISTINCT fi.intervention_id)::integer as total_interventions,
      COALESCE(SUM(p.total_paiements), 0)::numeric as total_paiements,
      COALESCE(SUM(c.total_couts), 0)::numeric as total_couts,
      COALESCE(SUM(p.total_paiements), 0)::numeric - COALESCE(SUM(c.total_couts), 0)::numeric as marge
    FROM interventions_periode ip
    INNER JOIN financial_interventions fi ON fi.intervention_id = ip.id
    LEFT JOIN paiements_agreges p ON p.intervention_id = ip.id
    LEFT JOIN couts_agreges c ON c.intervention_id = ip.id
    GROUP BY ip.assigned_user_id
    HAVING COUNT(DISTINCT fi.intervention_id) > 0
  )

  SELECT jsonb_build_object(
    'rankings', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'user_id', gs.gestionnaire_id, 'total_margin', ROUND(gs.marge, 2),
        'total_revenue', ROUND(gs.total_paiements, 2), 'total_interventions', gs.total_interventions,
        'average_margin_percentage', CASE WHEN gs.total_paiements > 0 THEN ROUND((gs.marge / gs.total_paiements) * 100, 2) ELSE 0 END
      ) ORDER BY gs.marge DESC)
      FROM gestionnaire_stats gs
    ), '[]'::jsonb),
    'period', jsonb_build_object('start_date', p_period_start, 'end_date', p_period_end)
  ) INTO result;
  
  RETURN result;
END;
$$;

COMMENT ON FUNCTION public.get_podium_ranking_by_period IS 'Fonction RPC pour le classement du podium des gestionnaires';
GRANT EXECUTE ON FUNCTION public.get_podium_ranking_by_period TO authenticated;
