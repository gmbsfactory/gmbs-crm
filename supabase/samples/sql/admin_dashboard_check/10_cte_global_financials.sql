-- ========================================
-- CTE 9: Stats financières globales
-- ========================================

WITH inter_terminees AS (
    SELECT DISTINCT intervention_id
    FROM public.intervention_status_transitions
    WHERE to_status_code = 'INTER_TERMINEE'
      AND transition_date >= '2025-01-01T00:00:00Z'::timestamptz
      AND transition_date <= '2026-01-01T00:00:00Z'::timestamptz
),
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
global_financials AS (
    SELECT 
      COALESCE((SELECT SUM(total_paiements) FROM paiements_agreges), 0)::numeric as total_paiements,
      COALESCE((SELECT SUM(total_couts) FROM couts_agreges), 0)::numeric as total_couts
)
SELECT 
  total_paiements,
  total_couts,
  (total_paiements - total_couts)::numeric as marge_brute,
  CASE 
    WHEN total_paiements > 0 
    THEN ROUND(((total_paiements - total_couts) / total_paiements * 100)::numeric, 2)
    ELSE 0 
  END as taux_marge_pourcent,
  (SELECT COUNT(*) FROM inter_terminees) as nb_interventions_terminees,
  (SELECT COUNT(*) FROM paiements_agreges) as nb_interventions_avec_paiements,
  (SELECT COUNT(*) FROM couts_agreges) as nb_interventions_avec_couts
FROM global_financials;

