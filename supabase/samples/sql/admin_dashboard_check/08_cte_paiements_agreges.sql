-- ========================================
-- CTE 7: Chiffre d'affaires agrégé par intervention
-- ========================================
-- Basé sur les coûts de type 'intervention' pour les interventions terminées

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
)
SELECT 
  pa.intervention_id,
  pa.agence_id,
  a.label as agence_label,
  pa.total_paiements
FROM paiements_agreges pa
LEFT JOIN public.agencies a ON a.id = pa.agence_id
ORDER BY pa.total_paiements DESC
LIMIT 100;

-- Total global
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
)
SELECT 
  COUNT(DISTINCT intervention_id) as nb_interventions_avec_paiements,
  SUM(total_paiements)::numeric as total_paiements_global,
  AVG(total_paiements)::numeric as moyenne_paiements_par_intervention,
  MIN(total_paiements)::numeric as min_paiements,
  MAX(total_paiements)::numeric as max_paiements
FROM paiements_agreges;

-- Vérification des interventions terminées sans paiements
WITH inter_terminees AS (
    SELECT DISTINCT intervention_id
    FROM public.intervention_status_transitions
    WHERE to_status_code = 'INTER_TERMINEE'
      AND transition_date >= '2025-01-01T00:00:00Z'::timestamptz
      AND transition_date <= '2026-01-01T00:00:00Z'::timestamptz
),
paiements_agreges AS (
    SELECT DISTINCT intervention_id
    FROM inter_terminees it
    INNER JOIN public.interventions i ON i.id = it.intervention_id
    INNER JOIN public.intervention_costs ic ON ic.intervention_id = i.id
    WHERE ic.cost_type = 'intervention'
)
SELECT 
  (SELECT COUNT(*) FROM inter_terminees) as total_interventions_terminees,
  (SELECT COUNT(*) FROM paiements_agreges) as interventions_avec_paiements,
  (SELECT COUNT(*) FROM inter_terminees) - (SELECT COUNT(*) FROM paiements_agreges) as interventions_sans_paiements;

