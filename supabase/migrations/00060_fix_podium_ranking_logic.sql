-- ========================================
-- MIGRATION 00052: Fix Podium Ranking Logic
-- ========================================
-- Description: Met à jour la fonction get_podium_ranking_by_period pour que
--              le classement soit basé UNIQUEMENT sur la date de complétion.
--              L'ancien code filtrait aussi par la date de l'intervention (i.date),
--              ce qui excluait les interventions créées avant la période.
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
  -- Interventions potentielles (actives et assignées)
  -- On ne filtre PLUS par i.date ici pour inclure les interventions créées avant la période
  interventions_base AS (
    SELECT i.id, i.assigned_user_id
    FROM public.interventions i
    WHERE i.is_active = true AND i.assigned_user_id IS NOT NULL
  ),
  
  -- Identifier les interventions TERMINEES précisément DANS la période
  -- Basé sur la date de transition vers le statut 'INTER_TERMINEE'
  transitions_terminees AS (
    SELECT DISTINCT ist.intervention_id, ist.transition_date, ib.assigned_user_id
    FROM public.intervention_status_transitions ist
    INNER JOIN interventions_base ib ON ib.id = ist.intervention_id
    WHERE ist.to_status_code = 'INTER_TERMINEE'
      AND ist.transition_date >= p_period_start 
      AND ist.transition_date <= p_period_end
      AND (ist.from_status_code IS NULL OR ist.from_status_code != ist.to_status_code)
  ),
  
  -- Liste des IDs d'interventions à prendre en compte pour les calculs financiers
  financial_interventions AS (
    SELECT DISTINCT intervention_id FROM transitions_terminees
  ),
  
  -- Agrégation des paiements (CA)
  paiements_agreges AS (
    SELECT ic.intervention_id, SUM(ic.amount)::numeric as total_paiements
    FROM financial_interventions fi
    JOIN public.intervention_costs ic ON ic.intervention_id = fi.intervention_id
    WHERE ic.cost_type = 'intervention'
    GROUP BY ic.intervention_id
  ),
  
  -- Agrégation des coûts (SST + Matériel)
  couts_agreges AS (
    SELECT ic.intervention_id, SUM(ic.amount)::numeric as total_couts
    FROM financial_interventions fi
    JOIN public.intervention_costs ic ON ic.intervention_id = fi.intervention_id
    WHERE ic.cost_type IN ('sst', 'materiel')
    GROUP BY ic.intervention_id
  ),
  
  -- Statistiques par gestionnaire
  gestionnaire_stats AS (
    SELECT 
      tt.assigned_user_id as gestionnaire_id, 
      COUNT(DISTINCT tt.intervention_id)::integer as total_interventions,
      COALESCE(SUM(p.total_paiements), 0)::numeric as total_paiements,
      COALESCE(SUM(c.total_couts), 0)::numeric as total_couts,
      COALESCE(SUM(p.total_paiements), 0)::numeric - COALESCE(SUM(c.total_couts), 0)::numeric as marge
    FROM transitions_terminees tt
    LEFT JOIN paiements_agreges p ON p.intervention_id = tt.intervention_id
    LEFT JOIN couts_agreges c ON c.intervention_id = tt.intervention_id
    GROUP BY tt.assigned_user_id
    HAVING COUNT(DISTINCT tt.intervention_id) > 0
  )

  -- Construction du résultat JSON
  SELECT jsonb_build_object(
    'rankings', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'user_id', gs.gestionnaire_id, 
        'total_margin', ROUND(gs.marge, 2),
        'total_revenue', ROUND(gs.total_paiements, 2), 
        'total_interventions', gs.total_interventions,
        'average_margin_percentage', CASE 
          WHEN gs.total_paiements > 0 THEN ROUND((gs.marge / gs.total_paiements) * 100, 2) 
          ELSE 0 
        END
      ) ORDER BY gs.marge DESC)
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

-- Recharge le cache du schéma pour que les changements soient pris en compte immédiatement par PostgREST
NOTIFY pgrst, 'reload schema';

COMMENT ON FUNCTION public.get_podium_ranking_by_period IS 'Récupère le classement podium basé sur la date de complétion des interventions dans la période.';
