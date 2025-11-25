-- ========================================
-- MIGRATION: Fonction RPC pour Podium Dashboard
-- ========================================
-- Date: 2025-01-20
-- Objectif: Harmoniser les calculs de performance avec le dashboard admin
-- Performance: Calculs côté serveur avec CTEs et GROUP BY
-- Utilise les mêmes règles que get_admin_dashboard_stats

-- ========================================
-- FONCTION RPC: get_podium_ranking_by_period
-- ========================================
-- Cette fonction calcule le classement des gestionnaires pour le podium
-- Utilise uniquement les interventions terminées dans la période pour les calculs financiers
-- Retourne un JSONB avec les rankings incluant CA (total_revenue) et marge (total_margin)

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
  -- CTE 1: Interventions de la période (base de données pour toutes les stats)
  interventions_periode AS (
    SELECT 
      i.id, 
      i.assigned_user_id,
      i.date as date_intervention
    FROM public.interventions i
    WHERE i.is_active = true
      AND i.date >= p_period_start
      AND i.date < p_period_end
      AND i.assigned_user_id IS NOT NULL
  ),

  -- CTE 2: Transitions vers INTER_TERMINEE dans la période
  transitions_terminees AS (
    SELECT DISTINCT
      ist.intervention_id,
      ist.transition_date
    FROM public.intervention_status_transitions ist
    INNER JOIN interventions_periode ip ON ip.id = ist.intervention_id
    WHERE ist.to_status_code = 'INTER_TERMINEE'
      AND ist.transition_date >= p_period_start
      AND ist.transition_date <= p_period_end
      -- Filtrer les transitions invalides (from_status_code = to_status_code)
      AND (ist.from_status_code IS NULL OR ist.from_status_code != ist.to_status_code)
  ),

  -- CTE 3: Interventions terminées avec leurs coûts
  financial_interventions AS (
    SELECT DISTINCT intervention_id 
    FROM transitions_terminees
  ),

  -- CTE 4: Paiements agrégés (CA) pour les interventions terminées
  paiements_agreges AS (
    SELECT 
      ic.intervention_id,
      SUM(ic.amount)::numeric as total_paiements
    FROM financial_interventions fi
    JOIN public.intervention_costs ic ON ic.intervention_id = fi.intervention_id
    WHERE ic.cost_type = 'intervention'
    GROUP BY ic.intervention_id
  ),
  
  -- CTE 5: Coûts agrégés (SST + Matériel) pour les interventions terminées
  couts_agreges AS (
    SELECT 
      ic.intervention_id,
      SUM(ic.amount)::numeric as total_couts
    FROM financial_interventions fi
    JOIN public.intervention_costs ic ON ic.intervention_id = fi.intervention_id
    WHERE ic.cost_type IN ('sst', 'materiel')
    GROUP BY ic.intervention_id
  ),

  -- CTE 6: Stats par gestionnaire
  gestionnaire_stats AS (
    SELECT 
      ip.assigned_user_id as gestionnaire_id,
      COUNT(DISTINCT fi.intervention_id)::integer as total_interventions,
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
      SELECT jsonb_agg(
        jsonb_build_object(
          'user_id', gs.gestionnaire_id,
          'total_margin', ROUND(gs.marge, 2),
          'total_revenue', ROUND(gs.total_paiements, 2),
          'total_interventions', gs.total_interventions,
          'average_margin_percentage', 
            CASE 
              WHEN gs.total_paiements > 0 
              THEN ROUND((gs.marge / gs.total_paiements) * 100, 2)
              ELSE 0 
            END
        ) ORDER BY gs.marge DESC
      )
      FROM gestionnaire_stats gs
    ), '[]'::jsonb),
    'period', jsonb_build_object(
      'start_date', p_period_start,
      'end_date', p_period_end
    )
  ) INTO result;
  
  RETURN result;
END;
$$;

-- Commentaire pour documentation
COMMENT ON FUNCTION public.get_podium_ranking_by_period IS 
'Fonction RPC pour le classement du podium des gestionnaires.
Utilise les mêmes règles que get_admin_dashboard_stats:
- Uniquement les interventions terminées dans la période
- Calculs basés sur intervention_status_transitions
- Retourne total_revenue (CA) et total_margin (marge) pour chaque gestionnaire';

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_podium_ranking_by_period TO authenticated;

