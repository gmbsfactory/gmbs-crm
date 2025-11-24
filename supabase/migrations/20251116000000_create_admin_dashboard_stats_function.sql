-- ========================================
-- MIGRATION: Fonction RPC pour Dashboard Admin V2.0
-- ========================================
-- Date: 2025-11-23
-- Objectif: Réduire le nombre de requêtes SQL de 12-13 à 1 seule requête
-- Performance: Calculs côté serveur avec CTEs et GROUP BY
-- V2.0: Ajout Cycle Time, Sparklines, Funnel, Marges par Gestionnaire

-- ========================================
-- FONCTION RPC: get_admin_dashboard_stats
-- ========================================
-- Cette fonction combine toutes les requêtes du dashboard admin en une seule
-- Utilise des CTEs (Common Table Expressions) pour optimiser les performances
-- Retourne un JSONB structuré avec toutes les statistiques

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
  -- Calcul de la période précédente pour les comparaisons (Delta)
  v_interval := p_period_end - p_period_start;
  v_previous_period_start := p_period_start - v_interval;
  v_previous_period_end := p_period_start;

  WITH 
  -- CTE 1: Interventions de la période ACTUELLE (base de données pour toutes les stats)
  interventions_periode AS (
    SELECT 
      i.id, 
      i.statut_id, 
      ist.code as statut_code,
      i.metier_id, 
      i.agence_id,
      i.assigned_user_id,
      i.date as date_intervention,
      i.created_at
    FROM public.interventions i
    LEFT JOIN public.intervention_statuses ist ON ist.id = i.statut_id
    WHERE i.is_active = true
      AND i.date >= p_period_start
      AND i.date < p_period_end
      AND (p_agence_id IS NULL OR i.agence_id = p_agence_id)
      AND (p_metier_id IS NULL OR i.metier_id = p_metier_id)
  ),

  -- CTE 1b: Interventions de la période PRECEDENTE (pour calcul des deltas)
  interventions_periode_prev AS (
    SELECT 
      i.id
    FROM public.interventions i
    WHERE i.is_active = true
      AND i.date >= v_previous_period_start
      AND i.date < v_previous_period_end
      AND (p_agence_id IS NULL OR i.agence_id = p_agence_id)
      AND (p_metier_id IS NULL OR i.metier_id = p_metier_id)
  ),
  
  -- CTE 1c: Interventions liées aux gestionnaires (directement via assigned_user_id)
  interventions_gestionnaires AS (
    SELECT DISTINCT
      i.id as intervention_id,
      i.assigned_user_id as gestionnaire_id
    FROM interventions_periode i
    WHERE i.assigned_user_id IS NOT NULL
      AND (p_gestionnaire_id IS NULL OR i.assigned_user_id = p_gestionnaire_id)
  ),
  
  -- CTE 1d: Interventions filtrées (incluant le filtre gestionnaire)
  interventions_filtrees AS (
    SELECT DISTINCT ip.id, ip.date_intervention, ip.agence_id, ip.metier_id, ip.assigned_user_id, ip.statut_code, ip.created_at
    FROM interventions_periode ip
    WHERE (p_gestionnaire_id IS NULL OR ip.id IN (SELECT intervention_id FROM interventions_gestionnaires))
  ),

  -- CTE 2: Transitions de statuts pour la période (pour Funnel et Cycle Time)
  transitions_periode AS (
    SELECT 
      ist.intervention_id,
      ist.to_status_code,
      ist.transition_date,
      ip.agence_id,
      ip.assigned_user_id
    FROM public.intervention_status_transitions ist
    INNER JOIN interventions_filtrees ip ON ip.id = ist.intervention_id
    WHERE ist.transition_date >= p_period_start
      AND ist.transition_date <= p_period_end
  ),

  -- CTE 2b: Transitions pour la période précédente (pour Delta)
  transitions_periode_prev AS (
    SELECT 
      ist.intervention_id,
      ist.to_status_code
    FROM public.intervention_status_transitions ist
    INNER JOIN interventions_periode_prev ip ON ip.id = ist.intervention_id
    WHERE ist.transition_date >= v_previous_period_start
      AND ist.transition_date <= v_previous_period_end
  ),
  
  -- CTE 3: Stats principales (comptages basés sur les transitions)
  main_stats_counts AS (
    SELECT 
      COUNT(DISTINCT CASE WHEN to_status_code = p_demande_status_code THEN intervention_id END)::integer as nb_demandees,
      COUNT(DISTINCT CASE WHEN to_status_code = p_terminee_status_code THEN intervention_id END)::integer as nb_terminees,
      COUNT(DISTINCT CASE WHEN to_status_code = p_devis_status_code THEN intervention_id END)::integer as nb_devis,
      COUNT(DISTINCT CASE WHEN to_status_code = ANY(p_valid_status_codes) THEN intervention_id END)::integer as nb_valides
    FROM transitions_periode
  ),

  -- CTE 3b: Stats principales PRECEDENTES (pour Deltas)
  main_stats_counts_prev AS (
    SELECT 
      COUNT(DISTINCT CASE WHEN to_status_code = p_demande_status_code THEN intervention_id END)::integer as nb_demandees,
      COUNT(DISTINCT CASE WHEN to_status_code = p_terminee_status_code THEN intervention_id END)::integer as nb_terminees
    FROM transitions_periode_prev
  ),
  
  -- CTE 4: Cycle Time (Délai Moyen Global) - VERSION CORRIGÉE
  -- Calcul du temps entre la PREMIERE transition vers 'DEMANDE' (ou date de création si créée en DEMANDE)
  -- et la PREMIERE transition vers 'INTER_TERMINEE'
  -- Filtre les transitions invalides (from_status_code = to_status_code)
  first_demande_transition AS (
    SELECT 
      ip.id as intervention_id,
      COALESCE(
        MIN(CASE WHEN ist.to_status_code = p_demande_status_code THEN ist.transition_date END),
        -- Si pas de transition vers DEMANDE mais que l'intervention a été créée en DEMANDE
        CASE WHEN ip.statut_code = p_demande_status_code THEN ip.created_at END
      ) as date_demande
    FROM interventions_filtrees ip
    LEFT JOIN public.intervention_status_transitions ist 
      ON ist.intervention_id = ip.id
      AND ist.to_status_code = p_demande_status_code
      -- Filtrer les transitions invalides
      AND (ist.from_status_code IS NULL OR ist.from_status_code != ist.to_status_code)
    GROUP BY ip.id, ip.statut_code, ip.created_at
    HAVING COALESCE(
      MIN(CASE WHEN ist.to_status_code = p_demande_status_code THEN ist.transition_date END),
      CASE WHEN ip.statut_code = p_demande_status_code THEN ip.created_at END
    ) IS NOT NULL
  ),

  first_terminee_transition AS (
    SELECT 
      ip.id as intervention_id,
      MIN(ist.transition_date) as date_terminee
    FROM interventions_filtrees ip
    INNER JOIN public.intervention_status_transitions ist 
      ON ist.intervention_id = ip.id
      AND ist.to_status_code = p_terminee_status_code
      -- Filtrer les transitions invalides
      AND (ist.from_status_code IS NULL OR ist.from_status_code != ist.to_status_code)
    GROUP BY ip.id
  ),

  cycle_time_data AS (
    SELECT
      fdt.intervention_id,
      EXTRACT(EPOCH FROM (ftt.date_terminee - fdt.date_demande)) / 86400.0 as days_diff
    FROM first_demande_transition fdt
    INNER JOIN first_terminee_transition ftt ON fdt.intervention_id = ftt.intervention_id
    WHERE ftt.date_terminee >= fdt.date_demande
  ),

  cycle_time_stats AS (
    SELECT 
      COALESCE(AVG(days_diff), 0)::numeric(10,2) as avg_cycle_time_days
    FROM cycle_time_data
  ),

  -- CTE 5: Stats Financières (CA et Coûts) pour les interventions TERMINÉES dans la période
  financial_interventions AS (
    SELECT DISTINCT intervention_id 
    FROM transitions_periode 
    WHERE to_status_code = p_terminee_status_code
  ),

  paiements_agreges AS (
    SELECT 
      ic.intervention_id,
      SUM(ic.amount)::numeric as total_paiements
    FROM financial_interventions fi
    JOIN public.intervention_costs ic ON ic.intervention_id = fi.intervention_id
    WHERE ic.cost_type = 'intervention'
    GROUP BY ic.intervention_id
  ),
  
  couts_agreges AS (
    SELECT 
      ic.intervention_id,
      SUM(ic.amount)::numeric as total_couts
    FROM financial_interventions fi
    JOIN public.intervention_costs ic ON ic.intervention_id = fi.intervention_id
    WHERE ic.cost_type IN ('sst', 'materiel')
    GROUP BY ic.intervention_id
  ),

  global_financials AS (
    SELECT 
      COALESCE(SUM(p.total_paiements), 0)::numeric as total_paiements,
      COALESCE(SUM(c.total_couts), 0)::numeric as total_couts
    FROM financial_interventions fi
    LEFT JOIN paiements_agreges p ON p.intervention_id = fi.intervention_id
    LEFT JOIN couts_agreges c ON c.intervention_id = fi.intervention_id
  ),

  -- CTE 5b: Stats Financières pour la période PRECEDENTE
  financial_interventions_prev AS (
    SELECT DISTINCT intervention_id 
    FROM transitions_periode_prev 
    WHERE to_status_code = p_terminee_status_code
  ),

  paiements_agreges_prev AS (
    SELECT 
      ic.intervention_id,
      SUM(ic.amount)::numeric as total_paiements
    FROM financial_interventions_prev fi
    JOIN public.intervention_costs ic ON ic.intervention_id = fi.intervention_id
    WHERE ic.cost_type = 'intervention'
    GROUP BY ic.intervention_id
  ),
  
  couts_agreges_prev AS (
    SELECT 
      ic.intervention_id,
      SUM(ic.amount)::numeric as total_couts
    FROM financial_interventions_prev fi
    JOIN public.intervention_costs ic ON ic.intervention_id = fi.intervention_id
    WHERE ic.cost_type IN ('sst', 'materiel')
    GROUP BY ic.intervention_id
  ),

  global_financials_prev AS (
    SELECT 
      COALESCE(SUM(p.total_paiements), 0)::numeric as total_paiements,
      COALESCE(SUM(c.total_couts), 0)::numeric as total_couts
    FROM financial_interventions_prev fi
    LEFT JOIN paiements_agreges_prev p ON p.intervention_id = fi.intervention_id
    LEFT JOIN couts_agreges_prev c ON c.intervention_id = fi.intervention_id
  ),

  -- CTE 6: Sparklines (Données journalières pour les graphiques)
  -- Génération de la série temporelle
  time_series AS (
    SELECT generate_series(p_period_start, p_period_end - interval '1 day', interval '1 day') as day
  ),

  sparkline_data AS (
    SELECT 
      ts.day::date as date,
      COUNT(DISTINCT CASE WHEN tp.to_status_code = p_demande_status_code THEN tp.intervention_id END)::integer as count_demandees,
      COUNT(DISTINCT CASE WHEN tp.to_status_code = p_terminee_status_code THEN tp.intervention_id END)::integer as count_terminees
    FROM time_series ts
    LEFT JOIN transitions_periode tp ON date_trunc('day', tp.transition_date) = date_trunc('day', ts.day)
    GROUP BY ts.day
    ORDER BY ts.day
  ),

  -- CTE 7: Breakdown par Métier (Top 10 trié par volume)
  metier_breakdown AS (
    SELECT 
      ip.metier_id,
      COUNT(*)::integer as count
    FROM interventions_filtrees ip
    WHERE ip.metier_id IS NOT NULL
    GROUP BY ip.metier_id
    ORDER BY count DESC
    LIMIT 10
  ),

  -- CTE 8: Breakdown par Agence
  agency_breakdown AS (
    SELECT 
      ip.agence_id,
      COUNT(*)::integer as total_interventions,
      COUNT(DISTINCT CASE WHEN tp.to_status_code = p_terminee_status_code THEN tp.intervention_id END)::integer as terminated_interventions,
      COALESCE(AVG(ct.days_diff), 0)::numeric(10,2) as avg_cycle_time
    FROM interventions_filtrees ip
    LEFT JOIN transitions_periode tp ON tp.intervention_id = ip.id
    LEFT JOIN cycle_time_data ct ON ct.intervention_id = ip.id
    WHERE ip.agence_id IS NOT NULL
    GROUP BY ip.agence_id
  ),

  agency_financials AS (
    SELECT 
      ip.agence_id,
      COALESCE(SUM(p.total_paiements), 0)::numeric as total_paiements,
      COALESCE(SUM(c.total_couts), 0)::numeric as total_couts
    FROM interventions_filtrees ip
    JOIN financial_interventions fi ON fi.intervention_id = ip.id
    LEFT JOIN paiements_agreges p ON p.intervention_id = ip.id
    LEFT JOIN couts_agreges c ON c.intervention_id = ip.id
    WHERE ip.agence_id IS NOT NULL
    GROUP BY ip.agence_id
  ),

  -- CTE 9: Breakdown par Gestionnaire
  gestionnaire_breakdown AS (
    SELECT 
      ip.assigned_user_id as gestionnaire_id,
      COUNT(*)::integer as total_interventions,
      COUNT(DISTINCT CASE WHEN tp.to_status_code = p_terminee_status_code THEN tp.intervention_id END)::integer as terminated_interventions,
      COALESCE(AVG(ct.days_diff), 0)::numeric(10,2) as avg_cycle_time
    FROM interventions_filtrees ip
    LEFT JOIN transitions_periode tp ON tp.intervention_id = ip.id
    LEFT JOIN cycle_time_data ct ON ct.intervention_id = ip.id
    WHERE ip.assigned_user_id IS NOT NULL
    GROUP BY ip.assigned_user_id
  ),

  gestionnaire_financials AS (
    SELECT 
      ip.assigned_user_id as gestionnaire_id,
      COALESCE(SUM(p.total_paiements), 0)::numeric as total_paiements,
      COALESCE(SUM(c.total_couts), 0)::numeric as total_couts
    FROM interventions_filtrees ip
    JOIN financial_interventions fi ON fi.intervention_id = ip.id
    LEFT JOIN paiements_agreges p ON p.intervention_id = ip.id
    LEFT JOIN couts_agreges c ON c.intervention_id = ip.id
    WHERE ip.assigned_user_id IS NOT NULL
    GROUP BY ip.assigned_user_id
  ),

  -- CTE 10: Funnel Data (Répartition par statut pour l'entonnoir)
  status_breakdown AS (
    SELECT 
      tp.to_status_code as statut_code,
      COUNT(DISTINCT tp.intervention_id)::integer as count
    FROM transitions_periode tp
    WHERE tp.to_status_code IS NOT NULL
    GROUP BY tp.to_status_code
  )

  SELECT jsonb_build_object(
    -- Stats principales avec Deltas et Cycle Time
    'mainStats', (
      SELECT jsonb_build_object(
        'nbInterventionsDemandees', ms.nb_demandees,
        'nbInterventionsTerminees', ms.nb_terminees,
        'nbDevis', ms.nb_devis,
        'nbValides', ms.nb_valides,
        'chiffreAffaires', COALESCE(gf.total_paiements, 0),
        'couts', COALESCE(gf.total_couts, 0),
        'marge', COALESCE(gf.total_paiements, 0) - COALESCE(gf.total_couts, 0),
        'avgCycleTime', cts.avg_cycle_time_days,
        'deltaInterventions', CASE WHEN msp.nb_demandees > 0 THEN ROUND(((ms.nb_demandees - msp.nb_demandees)::numeric / msp.nb_demandees) * 100, 1) ELSE 0 END,
        'deltaChiffreAffaires', CASE WHEN gfp.total_paiements > 0 THEN ROUND(((gf.total_paiements - gfp.total_paiements)::numeric / gfp.total_paiements) * 100, 1) ELSE 0 END,
        'deltaMarge', CASE 
          WHEN (gfp.total_paiements - gfp.total_couts) > 0 
          THEN ROUND(((gf.total_paiements - gf.total_couts) - (gfp.total_paiements - gfp.total_couts))::numeric / (gfp.total_paiements - gfp.total_couts) * 100, 1) 
          ELSE 0 
        END
      )
      FROM main_stats_counts ms
      CROSS JOIN main_stats_counts_prev msp
      CROSS JOIN global_financials gf
      CROSS JOIN global_financials_prev gfp
      CROSS JOIN cycle_time_stats cts
    ),
    
    -- Sparklines pour les graphiques de tendance
    'sparklines', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'date', sd.date,
          'countDemandees', sd.count_demandees,
          'countTerminees', sd.count_terminees
        )
      )
      FROM sparkline_data sd
    ),

    -- Breakdown par statut (Funnel)
    'statusBreakdown', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'statut_code', sb.statut_code,
          'count', sb.count
        )
      ), '[]'::jsonb)
      FROM status_breakdown sb
    ),
    
    -- Breakdown par métier (Top 10)
    'metierBreakdown', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'metier_id', mb.metier_id,
          'count', mb.count
        )
      ), '[]'::jsonb)
      FROM metier_breakdown mb
    ),
    
    -- Breakdown par agence avec stats financières et Cycle Time
    'agencyBreakdown', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'agence_id', a.agence_id,
          'totalInterventions', a.total_interventions,
          'terminatedInterventions', a.terminated_interventions,
          'avgCycleTime', a.avg_cycle_time,
          'totalPaiements', COALESCE(af.total_paiements, 0),
          'totalCouts', COALESCE(af.total_couts, 0),
          'marge', COALESCE(af.total_paiements, 0) - COALESCE(af.total_couts, 0)
        )
      ), '[]'::jsonb)
      FROM agency_breakdown a
      LEFT JOIN agency_financials af ON af.agence_id = a.agence_id
    ),
    
    -- Breakdown par gestionnaire avec stats financières et Cycle Time
    'gestionnaireBreakdown', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'gestionnaire_id', g.gestionnaire_id,
          'totalInterventions', g.total_interventions,
          'terminatedInterventions', g.terminated_interventions,
          'avgCycleTime', g.avg_cycle_time,
          'totalPaiements', COALESCE(gf.total_paiements, 0),
          'totalCouts', COALESCE(gf.total_couts, 0),
          'marge', COALESCE(gf.total_paiements, 0) - COALESCE(gf.total_couts, 0)
        )
      ), '[]'::jsonb)
      FROM gestionnaire_breakdown g
      LEFT JOIN gestionnaire_financials gf ON gf.gestionnaire_id = g.gestionnaire_id
    )
  ) INTO result;
  
  RETURN result;
END;
$$;

-- Commentaire pour documentation
COMMENT ON FUNCTION public.get_admin_dashboard_stats IS 
'Fonction RPC optimisée V2.0 pour le Dashboard Admin.
Inclut:
- Stats principales avec Deltas
- Cycle Time (Délai moyen Demande -> Terminée)
- Sparklines (Données journalières)
- Funnel Data (Répartition par statut)
- Breakdown par Métier (Top 10)
- Performance Agence et Gestionnaire (avec Marge et Cycle Time)';

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_admin_dashboard_stats TO authenticated;


