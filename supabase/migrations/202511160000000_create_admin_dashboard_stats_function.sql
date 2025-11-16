-- ========================================
-- MIGRATION: Fonction RPC pour Dashboard Admin
-- ========================================
-- Date: 2025-01-20
-- Objectif: Réduire le nombre de requêtes SQL de 12-13 à 1 seule requête
-- Performance: Calculs côté serveur avec CTEs et GROUP BY

-- ========================================
-- FONCTION RPC: get_admin_dashboard_stats
-- ========================================
-- Cette fonction combine toutes les requêtes du dashboard admin en une seule
-- Utilise des CTEs (Common Table Expressions) pour optimiser les performances
-- Retourne un JSONB structuré avec toutes les statistiques

CREATE OR REPLACE FUNCTION public.get_admin_dashboard_stats(
  p_period_start timestamptz,
  p_period_end timestamptz,
  p_demande_status_id uuid,
  p_devis_status_id uuid,
  p_accepte_status_id uuid,
  p_en_cours_status_id uuid,
  p_terminee_status_id uuid,
  p_att_acompte_status_id uuid,
  p_valid_status_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  result jsonb;
  global_paiements numeric := 0;
  global_couts numeric := 0;
BEGIN
  WITH 
  -- CTE 1: Interventions de la période (base de données pour toutes les stats)
  interventions_periode AS (
    SELECT 
      id, 
      statut_id, 
      metier_id, 
      agence_id
    FROM public.interventions
    WHERE is_active = true
      AND date >= p_period_start
      AND date < p_period_end
  ),
  
  -- CTE 2: Interventions terminées dans la période (basé sur les transitions)
  inter_terminees AS (
    SELECT DISTINCT intervention_id
    FROM public.intervention_status_transitions
    WHERE to_status_code = 'INTER_TERMINEE'
      AND transition_date >= p_period_start
      AND transition_date <= p_period_end
  ),
  
  -- CTE 3: Stats principales (comptages)
  main_stats AS (
    SELECT 
      COUNT(*) FILTER (WHERE statut_id = p_demande_status_id)::integer as nb_demandees,
      (SELECT COUNT(*)::integer FROM inter_terminees) as nb_terminees,
      COUNT(*) FILTER (WHERE statut_id = p_devis_status_id)::integer as nb_devis,
      COUNT(*) FILTER (WHERE statut_id = ANY(p_valid_status_ids))::integer as nb_valides
    FROM interventions_periode
  ),
  
  -- CTE 4: Breakdown par statut (GROUP BY pour optimiser)
  status_breakdown AS (
    SELECT 
      statut_id,
      COUNT(*)::integer as count
    FROM interventions_periode
    WHERE statut_id IS NOT NULL
    GROUP BY statut_id
  ),
  
  -- CTE 5: Breakdown par métier (GROUP BY)
  metier_breakdown AS (
    SELECT 
      metier_id,
      COUNT(*)::integer as count
    FROM interventions_periode
    WHERE metier_id IS NOT NULL
    GROUP BY metier_id
  ),
  
  -- CTE 6: Breakdown par agence (GROUP BY avec comptage des terminées)
  agency_breakdown AS (
    SELECT 
      agence_id,
      COUNT(*)::integer as total_interventions,
      COUNT(*) FILTER (WHERE id IN (SELECT intervention_id FROM inter_terminees))::integer as terminated_interventions
    FROM interventions_periode
    WHERE agence_id IS NOT NULL
    GROUP BY agence_id
  ),
  
  -- CTE 7: Paiements agrégés par intervention (pour calcul global et par agence)
  paiements_agreges AS (
    SELECT 
      ip.intervention_id,
      i.agence_id,
      SUM(ip.amount)::numeric as total_paiements
    FROM inter_terminees it
    INNER JOIN public.interventions i ON i.id = it.intervention_id
    INNER JOIN public.intervention_payments ip ON ip.intervention_id = i.id
    WHERE ip.is_received = true
    GROUP BY ip.intervention_id, i.agence_id
  ),
  
  -- CTE 8: Coûts agrégés par intervention (pour calcul global et par agence)
  couts_agreges AS (
    SELECT 
      ic.intervention_id,
      i.agence_id,
      SUM(ic.amount)::numeric as total_couts
    FROM inter_terminees it
    INNER JOIN public.interventions i ON i.id = it.intervention_id
    INNER JOIN public.intervention_costs ic ON ic.intervention_id = i.id
    GROUP BY ic.intervention_id, i.agence_id
  ),
  
  -- CTE 9: Stats financières globales
  global_financials AS (
    SELECT 
      COALESCE(SUM(p.total_paiements), 0)::numeric as total_paiements,
      COALESCE(SUM(c.total_couts), 0)::numeric as total_couts
    FROM paiements_agreges p
    FULL OUTER JOIN couts_agreges c ON c.intervention_id = p.intervention_id
  ),
  
  -- CTE 10: Stats financières par agence
  agency_financials AS (
    SELECT 
      COALESCE(a.agence_id, p.agence_id, c.agence_id) as agence_id,
      COALESCE(SUM(p.total_paiements), 0)::numeric as total_paiements,
      COALESCE(SUM(c.total_couts), 0)::numeric as total_couts
    FROM agency_breakdown a
    LEFT JOIN paiements_agreges p ON p.agence_id = a.agence_id
    LEFT JOIN couts_agreges c ON c.agence_id = a.agence_id
    GROUP BY COALESCE(a.agence_id, p.agence_id, c.agence_id)
  )
  
  SELECT jsonb_build_object(
    -- Stats principales
    'mainStats', (
      SELECT jsonb_build_object(
        'nbInterventionsDemandees', ms.nb_demandees,
        'nbInterventionsTerminees', ms.nb_terminees,
        'nbDevis', ms.nb_devis,
        'nbValides', ms.nb_valides
      )
      FROM main_stats ms
    ),
    
    -- Breakdown par statut
    'statusBreakdown', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'statut_id', sb.statut_id,
          'count', sb.count
        )
      ), '[]'::jsonb)
      FROM status_breakdown sb
    ),
    
    -- Breakdown par métier
    'metierBreakdown', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'metier_id', mb.metier_id,
          'count', mb.count
        )
      ), '[]'::jsonb)
      FROM metier_breakdown mb
    ),
    
    -- Breakdown par agence avec stats financières
    'agencyBreakdown', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'agence_id', a.agence_id,
          'totalInterventions', a.total_interventions,
          'terminatedInterventions', a.terminated_interventions,
          'totalPaiements', COALESCE(af.total_paiements, 0),
          'totalCouts', COALESCE(af.total_couts, 0)
        )
      ), '[]'::jsonb)
      FROM agency_breakdown a
      LEFT JOIN agency_financials af ON af.agence_id = a.agence_id
    ),
    
    -- Stats financières globales
    'globalFinancials', (
      SELECT jsonb_build_object(
        'totalPaiements', COALESCE(gf.total_paiements, 0),
        'totalCouts', COALESCE(gf.total_couts, 0)
      )
      FROM global_financials gf
    )
  ) INTO result;
  
  RETURN result;
END;
$$;

-- Commentaire pour documentation
COMMENT ON FUNCTION public.get_admin_dashboard_stats IS 
'Fonction RPC optimisée pour récupérer toutes les statistiques du dashboard admin en une seule requête. 
Combine les calculs de stats principales, breakdown par statut/métier/agence, et stats financières.
Réduit le nombre de requêtes SQL de 12-13 à 1 seule requête.';

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_admin_dashboard_stats TO authenticated;


