-- ========================================
-- CTE 3b: Deltas (Comparaison période précédente)
-- ========================================
-- V2.0: Calcul des variations par rapport à la période précédente
-- Utilise la même durée que la période actuelle

WITH 
  period_start AS (SELECT '2025-01-01T00:00:00Z'::timestamptz as start),
  period_end AS (SELECT '2026-01-01T00:00:00Z'::timestamptz as end),
  period_interval AS (
    SELECT (SELECT end FROM period_end) - (SELECT start FROM period_start) as interval_duration
  ),
  previous_period_start AS (
    SELECT (SELECT start FROM period_start) - (SELECT interval_duration FROM period_interval) as start
  ),
  previous_period_end AS (
    SELECT (SELECT start FROM period_start) as end
  ),
-- Période ACTUELLE
interventions_periode AS (
    SELECT 
      i.id
    FROM public.interventions i
    WHERE i.is_active = true
      AND i.date >= (SELECT start FROM period_start)
      AND i.date < (SELECT end FROM period_end)
),
transitions_periode AS (
    SELECT 
      ist.intervention_id,
      ist.to_status_code
    FROM public.intervention_status_transitions ist
    INNER JOIN interventions_periode ip ON ip.id = ist.intervention_id
    WHERE ist.transition_date >= (SELECT start FROM period_start)
      AND ist.transition_date <= (SELECT end FROM period_end)
),
main_stats_counts AS (
    SELECT 
      COUNT(DISTINCT CASE WHEN to_status_code = 'DEMANDE' THEN intervention_id END)::integer as nb_demandees,
      COUNT(DISTINCT CASE WHEN to_status_code = 'INTER_TERMINEE' THEN intervention_id END)::integer as nb_terminees
    FROM transitions_periode
),
-- Période PRECEDENTE
interventions_periode_prev AS (
    SELECT 
      i.id
    FROM public.interventions i
    WHERE i.is_active = true
      AND i.date >= (SELECT start FROM previous_period_start)
      AND i.date < (SELECT end FROM previous_period_end)
),
transitions_periode_prev AS (
    SELECT 
      ist.intervention_id,
      ist.to_status_code
    FROM public.intervention_status_transitions ist
    INNER JOIN interventions_periode_prev ip ON ip.id = ist.intervention_id
    WHERE ist.transition_date >= (SELECT start FROM previous_period_start)
      AND ist.transition_date <= (SELECT end FROM previous_period_end)
),
main_stats_counts_prev AS (
    SELECT 
      COUNT(DISTINCT CASE WHEN to_status_code = 'DEMANDE' THEN intervention_id END)::integer as nb_demandees,
      COUNT(DISTINCT CASE WHEN to_status_code = 'INTER_TERMINEE' THEN intervention_id END)::integer as nb_terminees
    FROM transitions_periode_prev
)
SELECT 
  ms.nb_demandees as nb_demandees_actuel,
  msp.nb_demandees as nb_demandees_precedent,
  (ms.nb_demandees - msp.nb_demandees) as delta_absolu_demandees,
  CASE 
    WHEN msp.nb_demandees > 0 
    THEN ((ms.nb_demandees - msp.nb_demandees)::numeric / msp.nb_demandees) * 100 
    ELSE 0 
  END::numeric(10,2) as delta_pourcent_demandees,
  ms.nb_terminees as nb_terminees_actuel,
  msp.nb_terminees as nb_terminees_precedent,
  (ms.nb_terminees - msp.nb_terminees) as delta_absolu_terminees,
  CASE 
    WHEN msp.nb_terminees > 0 
    THEN ((ms.nb_terminees - msp.nb_terminees)::numeric / msp.nb_terminees) * 100 
    ELSE 0 
  END::numeric(10,2) as delta_pourcent_terminees,
  (SELECT start FROM previous_period_start) as periode_precedente_start,
  (SELECT end FROM previous_period_end) as periode_precedente_end,
  (SELECT start FROM period_start) as periode_actuelle_start,
  (SELECT end FROM period_end) as periode_actuelle_end
FROM main_stats_counts ms
CROSS JOIN main_stats_counts_prev msp;


