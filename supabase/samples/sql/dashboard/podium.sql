-- 1. get perdio
SELECT
  public.get_current_podium_period()


-- Get Count Period
SELECT count(*) FROM public.intervention_status_transitions 
    WHERE to_status_code = 'INTER_TERMINEE' 
    AND transition_date >= '2026-01-02 16:00:00+00' 
    AND transition_date <= '2026-01-09 16:00:00+00';

-- Get last transition date 
SELECT i.id, ist.transition_date FROM public.interventions i 
JOIN public.intervention_status_transitions ist ON ist.intervention_id = i.id 
WHERE ist.to_status_code = 'INTER_TERMINEE' 
ORDER BY ist.transition_date DESC LIMIT 5;


-- Get ranking from the period
SELECT * FROM public.get_podium_ranking_by_period('2025-12-26 16:00:00+00', '2026-01-02 16:00:00+00');