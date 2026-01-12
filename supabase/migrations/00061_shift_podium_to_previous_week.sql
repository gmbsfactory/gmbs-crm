-- ========================================
-- MIGRATION 00059: Shift Podium to Previous Week & Fix Ranking Logic
-- ========================================
-- Description: 
-- 1. Modifie get_current_podium_period pour retourner la SEMAINE PRÉCÉDENTE (terminée).
--    Cela garantit que le podium reste stable toute la semaine.
-- 2. Modifie get_podium_ranking_by_period pour se baser uniquement sur la date de complétion.
-- ========================================

-- 1. Mettre à jour la fonction de calcul de période
CREATE OR REPLACE FUNCTION public.get_current_podium_period()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_now timestamptz;
  v_current_friday timestamptz;
  v_period_start timestamptz;
  v_period_end timestamptz;
  v_day_of_week int;
  v_current_hour int;
BEGIN
  -- Obtenir l'heure actuelle en UTC
  v_now := now();
  v_day_of_week := EXTRACT(DOW FROM v_now);
  v_current_hour := EXTRACT(HOUR FROM v_now);

  -- Calculer le vendredi de référence à 16h (début de la semaine en cours)
  IF v_day_of_week = 5 AND v_current_hour >= 16 THEN
    v_current_friday := date_trunc('day', v_now) + interval '16 hours';
  ELSIF v_day_of_week = 5 AND v_current_hour < 16 THEN
    v_current_friday := date_trunc('day', v_now) - interval '7 days' + interval '16 hours';
  ELSE
    v_current_friday := date_trunc('day', v_now) - interval '1 day' * ((v_day_of_week + 2) % 7) + interval '16 hours';
  END IF;

  -- STABILITÉ: Pour montrer la période "terminée", on recule d'une semaine supplémentaire
  -- Ainsi, du dimanche au vendredi 15:59, on montre la semaine qui s'est terminée le vendredi précédent.
  v_period_start := v_current_friday - interval '7 days';
  v_period_end := v_current_friday;

  RETURN jsonb_build_object(
    'period_start', v_period_start,
    'period_end', v_period_end,
    'is_active', true
  );
END;
$$;

-- 2. Mettre à jour la fonction de classement (Fix Logique Complétion)
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
  interventions_base AS (
    SELECT i.id, i.assigned_user_id
    FROM public.interventions i
    WHERE i.is_active = true AND i.assigned_user_id IS NOT NULL
  ),
  
  -- Filtrer uniquement par date de transition vers TERMINEE
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

-- 3. Forcer la mise à jour de la table podium_periods
-- Cela permet aux clients de voir le changement immédiatement au prochain polling
SELECT public.refresh_current_podium_period();

-- 4. Reload PostgREST
NOTIFY pgrst, 'reload schema';

COMMENT ON FUNCTION public.get_current_podium_period IS 'Retourne la période du podium (semaine terminée précédente, de Vendredi 16h à Vendredi 16h).';
COMMENT ON FUNCTION public.get_podium_ranking_by_period IS 'Calcule le classement basé uniquement sur la date de complétion des interventions.';
