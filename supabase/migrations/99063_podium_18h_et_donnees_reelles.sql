-- ============================================================================
-- 99063 — Podium : bascule vendredi 18h (Paris) + périmètre « données réelles »
-- ============================================================================
-- Demandes client du 02/07/2026 :
-- 1. La bascule hebdomadaire du podium passe de vendredi 16h à VENDREDI 18H
--    heure de Paris (semaine de podium : vendredi 18h → vendredi 18h).
-- 2. Sans assainissement, le podium affiché vendredi 03/07 à 18h couvrirait
--    la fenêtre 26/06 18h → 03/07 18h, qui contient l'import des 28-29/06
--    (milliers de transitions Terminée recréées, ex. 205 « facturées »
--    fantômes pour un seul gestionnaire). Le classement applique donc le
--    même périmètre « données réelles » que les stats du dashboard
--    (cf. src/lib/api/interventions/stats/transitions-scope.ts) :
--    transitions ≥ go-live (lun 29/06/2026 00:00 Paris) ET portées par un
--    acteur humain (changed_by_user_id non nul).
--
-- NB : CREATE OR REPLACE réinitialise les options de fonction — on repose
-- explicitement le fuseau Europe/Paris introduit par la 99045 (sinon « 18h »
-- redeviendrait 18h UTC).
-- ============================================================================

-- 1. Période du podium : vendredi 18h → vendredi 18h (Europe/Paris)
CREATE OR REPLACE FUNCTION public.get_current_podium_period()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = public
SET timezone = 'Europe/Paris'
AS $$
DECLARE
  v_now timestamptz;
  v_current_friday timestamptz;
  v_period_start timestamptz;
  v_period_end timestamptz;
  v_day_of_week int;
  v_current_hour int;
BEGIN
  -- Heure courante interprétée en Europe/Paris (SET timezone ci-dessus)
  v_now := now();
  v_day_of_week := EXTRACT(DOW FROM v_now);
  v_current_hour := EXTRACT(HOUR FROM v_now);

  -- Vendredi de référence à 18h (borne de bascule de la semaine podium)
  IF v_day_of_week = 5 AND v_current_hour >= 18 THEN
    v_current_friday := date_trunc('day', v_now) + interval '18 hours';
  ELSIF v_day_of_week = 5 AND v_current_hour < 18 THEN
    v_current_friday := date_trunc('day', v_now) - interval '7 days' + interval '18 hours';
  ELSE
    v_current_friday := date_trunc('day', v_now) - interval '1 day' * ((v_day_of_week + 2) % 7) + interval '18 hours';
  END IF;

  -- Stabilité : on affiche la semaine TERMINÉE précédente
  v_period_start := v_current_friday - interval '7 days';
  v_period_end := v_current_friday;

  RETURN jsonb_build_object(
    'period_start', v_period_start,
    'period_end', v_period_end,
    'is_active', true
  );
END;
$$;

COMMENT ON FUNCTION public.get_current_podium_period IS
  'Retourne la période du podium (semaine terminée précédente, de vendredi 18h Europe/Paris à vendredi 18h Europe/Paris).';

-- 2. Classement : périmètre « données réelles » (post go-live + acteur humain)
CREATE OR REPLACE FUNCTION public.get_podium_ranking_by_period(
  p_period_start timestamptz,
  p_period_end timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
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

  -- Date de complétion = transition vers TERMINEE.
  -- Périmètre « données réelles » : ≥ go-live (lun 29/06/2026 00:00 Paris)
  -- et acteur humain requis — exclut les transitions recréées par l'import.
  transitions_terminees AS (
    SELECT DISTINCT ist.intervention_id, ist.transition_date, ib.assigned_user_id
    FROM public.intervention_status_transitions ist
    INNER JOIN interventions_base ib ON ib.id = ist.intervention_id
    WHERE ist.to_status_code = 'INTER_TERMINEE'
      AND ist.transition_date >= p_period_start
      AND ist.transition_date <= p_period_end
      AND (ist.from_status_code IS NULL OR ist.from_status_code != ist.to_status_code)
      AND ist.changed_by_user_id IS NOT NULL
      AND ist.transition_date >= '2026-06-28T22:00:00Z'::timestamptz
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

COMMENT ON FUNCTION public.get_podium_ranking_by_period IS
  'Classement par marge sur la date de complétion (transition INTER_TERMINEE), périmètre données réelles : ≥ go-live 29/06/2026 et acteur humain requis (import exclu).';

-- 3. Cron : bascule à 18h Paris. pg_cron tourne en UTC : 18h Paris = 16h UTC
--    l'été, 17h UTC l'hiver. On exécute aux deux heures — le refresh est
--    idempotent et get_current_podium_period (Europe/Paris) fait foi, donc
--    l'exécution « en avance » d'une heure est un no-op.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh-podium-period') THEN
      PERFORM cron.unschedule('refresh-podium-period');
    END IF;
    PERFORM cron.schedule(
      'refresh-podium-period',
      '0 16,17 * * 5',
      $job$SELECT public.refresh_current_podium_period()$job$
    );
    RAISE NOTICE 'Job refresh-podium-period recalé sur 16h et 17h UTC (18h Paris été/hiver)';
  ELSE
    RAISE NOTICE 'pg_cron indisponible : job non recalé (le hook client recalcule de toute façon toutes les heures)';
  END IF;
END $$;

-- 4. Recalcule la ligne de période courante avec la borne 18h
SELECT public.refresh_current_podium_period();

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- FIN MIGRATION 99063
-- ============================================================================
