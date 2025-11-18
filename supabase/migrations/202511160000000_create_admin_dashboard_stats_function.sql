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
  p_demande_status_code text,
  p_devis_status_code text,
  p_accepte_status_code text,
  p_en_cours_status_code text,
  p_terminee_status_code text,
  p_att_acompte_status_code text,
  p_valid_status_codes text[]
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
      i.id, 
      i.statut_id, 
      ist.code as statut_code,
      i.metier_id, 
      i.agence_id,
      i.assigned_user_id
    FROM public.interventions i
    LEFT JOIN public.intervention_statuses ist ON ist.id = i.statut_id
    WHERE i.is_active = true
      AND i.date >= p_period_start
      AND i.date < p_period_end
  ),
  
  -- CTE 1b: Interventions liées aux gestionnaires (directement via assigned_user_id ou via artisans)
  interventions_gestionnaires AS (
    -- Interventions directement assignées
    SELECT DISTINCT
      i.id as intervention_id,
      i.assigned_user_id as gestionnaire_id
    FROM interventions_periode i
    WHERE i.assigned_user_id IS NOT NULL
    
    UNION
    
    -- Interventions via artisans gérés par le gestionnaire
    SELECT DISTINCT
      i.id as intervention_id,
      a.gestionnaire_id
    FROM interventions_periode i
    INNER JOIN public.intervention_artisans ia ON ia.intervention_id = i.id
    INNER JOIN public.artisans a ON a.id = ia.artisan_id
    WHERE a.gestionnaire_id IS NOT NULL
      AND a.is_active = true
  ),
  
  -- CTE 2: Interventions qui ont eu chaque statut pendant la période (basé sur les transitions)
  inter_demandees AS (
    SELECT DISTINCT intervention_id
    FROM public.intervention_status_transitions
    WHERE to_status_code = p_demande_status_code
      AND transition_date >= p_period_start
      AND transition_date <= p_period_end
  ),
  
  inter_terminees AS (
    SELECT DISTINCT intervention_id
    FROM public.intervention_status_transitions
    WHERE to_status_code = p_terminee_status_code
      AND transition_date >= p_period_start
      AND transition_date <= p_period_end
  ),
  
  inter_devis AS (
    SELECT DISTINCT intervention_id
    FROM public.intervention_status_transitions
    WHERE to_status_code = p_devis_status_code
      AND transition_date >= p_period_start
      AND transition_date <= p_period_end
  ),
  
  inter_valides AS (
    SELECT DISTINCT intervention_id
    FROM public.intervention_status_transitions
    WHERE to_status_code = ANY(p_valid_status_codes)
      AND transition_date >= p_period_start
      AND transition_date <= p_period_end
  ),
  
  -- CTE 3: Stats principales (comptages basés sur les transitions)
  main_stats AS (
    SELECT 
      (SELECT COUNT(*)::integer FROM inter_demandees) as nb_demandees,
      (SELECT COUNT(*)::integer FROM inter_terminees) as nb_terminees,
      (SELECT COUNT(*)::integer FROM inter_devis) as nb_devis,
      (SELECT COUNT(*)::integer FROM inter_valides) as nb_valides
  ),
  
  -- CTE 4: Breakdown par statut (basé sur les transitions pendant la période)
  status_breakdown AS (
    SELECT 
      ist.to_status_code as statut_code,
      COUNT(DISTINCT ist.intervention_id)::integer as count
    FROM public.intervention_status_transitions ist
    WHERE ist.transition_date >= p_period_start
      AND ist.transition_date <= p_period_end
      AND ist.to_status_code IS NOT NULL
    GROUP BY ist.to_status_code
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
  
  -- CTE 7: Chiffre d'affaires agrégé par intervention (basé sur les coûts de type 'intervention')
  paiements_agreges AS (
    SELECT 
      ic.intervention_id,
      i.agence_id,
      SUM(ic.amount)::numeric as total_paiements
    FROM inter_terminees it
    INNER JOIN public.interventions i ON i.id = it.intervention_id
    INNER JOIN public.intervention_costs ic ON ic.intervention_id = i.id
    WHERE ic.cost_type = 'intervention'
    GROUP BY ic.intervention_id, i.agence_id
  ),
  
  -- CTE 8: Coûts/Pertes agrégés par intervention (sst + materiel uniquement)
  couts_agreges AS (
    SELECT 
      ic.intervention_id,
      i.agence_id,
      SUM(ic.amount)::numeric as total_couts
    FROM inter_terminees it
    INNER JOIN public.interventions i ON i.id = it.intervention_id
    INNER JOIN public.intervention_costs ic ON ic.intervention_id = i.id
    WHERE ic.cost_type IN ('sst', 'materiel')
    GROUP BY ic.intervention_id, i.agence_id
  ),
  
  -- CTE 9: Stats financières globales
  global_financials AS (
    SELECT 
      COALESCE((SELECT SUM(total_paiements) FROM paiements_agreges), 0)::numeric as total_paiements,
      COALESCE((SELECT SUM(total_couts) FROM couts_agreges), 0)::numeric as total_couts
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
  ),
  
  -- CTE 11: Breakdown par gestionnaire (comptages)
  gestionnaire_breakdown AS (
    SELECT 
      ig.gestionnaire_id,
      COUNT(DISTINCT ig.intervention_id)::integer as total_interventions,
      COUNT(DISTINCT CASE WHEN ig.intervention_id IN (SELECT intervention_id FROM inter_terminees) THEN ig.intervention_id END)::integer as terminated_interventions
    FROM interventions_gestionnaires ig
    WHERE ig.gestionnaire_id IS NOT NULL
    GROUP BY ig.gestionnaire_id
  ),
  
  -- CTE 12: Stats financières par gestionnaire (CA et coûts)
  gestionnaire_financials AS (
    SELECT 
      ig.gestionnaire_id,
      COALESCE(SUM(p.total_paiements), 0)::numeric as total_paiements,
      COALESCE(SUM(c.total_couts), 0)::numeric as total_couts
    FROM interventions_gestionnaires ig
    INNER JOIN inter_terminees it ON it.intervention_id = ig.intervention_id
    LEFT JOIN paiements_agreges p ON p.intervention_id = ig.intervention_id
    LEFT JOIN couts_agreges c ON c.intervention_id = ig.intervention_id
    WHERE ig.gestionnaire_id IS NOT NULL
    GROUP BY ig.gestionnaire_id
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
          'statut_code', sb.statut_code,
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
    
    -- Breakdown par gestionnaire avec stats financières
    'gestionnaireBreakdown', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'gestionnaire_id', g.gestionnaire_id,
          'totalInterventions', g.total_interventions,
          'terminatedInterventions', g.terminated_interventions,
          'totalPaiements', COALESCE(gf.total_paiements, 0),
          'totalCouts', COALESCE(gf.total_couts, 0)
        )
      ), '[]'::jsonb)
      FROM gestionnaire_breakdown g
      LEFT JOIN gestionnaire_financials gf ON gf.gestionnaire_id = g.gestionnaire_id
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
Réduit le nombre de requêtes SQL de 12-13 à 1 seule requête.
Tous les comptages de statuts utilisent la table intervention_status_transitions pour être cohérents
et refléter les transitions de statut pendant la période, plutôt que le statut actuel des interventions.
Chiffre d''affaires: somme des coûts avec cost_type = ''intervention''.
Coûts/Pertes: somme des coûts avec cost_type IN (''sst'', ''materiel'').';

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_admin_dashboard_stats TO authenticated;


