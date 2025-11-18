-- ========================================
-- CTE 8: Coûts/Pertes agrégés par intervention
-- ========================================
-- sst + materiel uniquement

WITH inter_terminees AS (
    SELECT DISTINCT intervention_id
    FROM public.intervention_status_transitions
    WHERE to_status_code = 'INTER_TERMINEE'
      AND transition_date >= '2025-01-01T00:00:00Z'::timestamptz
      AND transition_date <= '2026-01-01T00:00:00Z'::timestamptz
),
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
)
SELECT 
  ca.intervention_id,
  ca.agence_id,
  a.label as agence_label,
  ca.total_couts
FROM couts_agreges ca
LEFT JOIN public.agencies a ON a.id = ca.agence_id
ORDER BY ca.total_couts DESC
LIMIT 100;

-- Total global
WITH inter_terminees AS (
    SELECT DISTINCT intervention_id
    FROM public.intervention_status_transitions
    WHERE to_status_code = 'INTER_TERMINEE'
      AND transition_date >= '2025-01-01T00:00:00Z'::timestamptz
      AND transition_date <= '2026-01-01T00:00:00Z'::timestamptz
),
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
)
SELECT 
  COUNT(DISTINCT intervention_id) as nb_interventions_avec_couts,
  SUM(total_couts)::numeric as total_couts_global,
  AVG(total_couts)::numeric as moyenne_couts_par_intervention,
  MIN(total_couts)::numeric as min_couts,
  MAX(total_couts)::numeric as max_couts
FROM couts_agreges;

-- Détail par type de coût
WITH inter_terminees AS (
    SELECT DISTINCT intervention_id
    FROM public.intervention_status_transitions
    WHERE to_status_code = 'INTER_TERMINEE'
      AND transition_date >= '2025-01-01T00:00:00Z'::timestamptz
      AND transition_date <= '2026-01-01T00:00:00Z'::timestamptz
)
SELECT 
  ic.cost_type,
  COUNT(DISTINCT ic.intervention_id) as nb_interventions,
  SUM(ic.amount)::numeric as total_par_type,
  AVG(ic.amount)::numeric as moyenne_par_type
FROM inter_terminees it
INNER JOIN public.interventions i ON i.id = it.intervention_id
INNER JOIN public.intervention_costs ic ON ic.intervention_id = i.id
WHERE ic.cost_type IN ('sst', 'materiel')
GROUP BY ic.cost_type
ORDER BY ic.cost_type;

