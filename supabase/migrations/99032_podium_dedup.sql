-- ========================================
-- MIGRATION 99032: Podium — dédup défensive par intervention avant SUM
-- ========================================
-- Versionne officiellement le correctif podium déjà appliqué en prod (via runbook PR2).
-- Non destructif, idempotent (CREATE OR REPLACE).
--
-- Problème corrigé : get_podium_ranking_by_period agrégeait gestionnaire_stats sur
-- `transitions_terminees`, qui peut contenir 2 lignes par intervention si elle a 2 dates
-- distinctes de transition INTER_TERMINEE -> double comptage des paiements/coûts (marge gonflée).
-- Fix : CTE `intervention_user` (DISTINCT intervention_id, assigned_user_id) -> 1 ligne par
-- intervention avant les SUM.
-- ========================================
CREATE OR REPLACE FUNCTION public.get_podium_ranking_by_period(
  p_period_start timestamptz,
  p_period_end timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $func$
DECLARE
  result jsonb;
BEGIN
  WITH
  interventions_base AS (
    SELECT i.id, i.assigned_user_id
    FROM public.interventions i
    WHERE i.is_active = true AND i.assigned_user_id IS NOT NULL
  ),
  transitions_terminees AS (
    SELECT DISTINCT ist.intervention_id, ist.transition_date, ib.assigned_user_id
    FROM public.intervention_status_transitions ist
    INNER JOIN interventions_base ib ON ib.id = ist.intervention_id
    WHERE ist.to_status_code = 'INTER_TERMINEE'
      AND ist.transition_date >= p_period_start
      AND ist.transition_date <= p_period_end
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
  -- <<< FIX dédup : 1 ligne par intervention (au lieu de transitions_terminees) >>>
  intervention_user AS (
    SELECT DISTINCT intervention_id, assigned_user_id FROM transitions_terminees
  ),
  gestionnaire_stats AS (
    SELECT
      iu.assigned_user_id as gestionnaire_id,
      COUNT(*)::integer as total_interventions,
      COALESCE(SUM(p.total_paiements), 0)::numeric as total_paiements,
      COALESCE(SUM(c.total_couts), 0)::numeric as total_couts,
      COALESCE(SUM(p.total_paiements), 0)::numeric - COALESCE(SUM(c.total_couts), 0)::numeric as marge
    FROM intervention_user iu
    LEFT JOIN paiements_agreges p ON p.intervention_id = iu.intervention_id
    LEFT JOIN couts_agreges c ON c.intervention_id = iu.intervention_id
    GROUP BY iu.assigned_user_id
    HAVING COUNT(*) > 0
  )
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
$func$;

NOTIFY pgrst, 'reload schema';
