-- ========================================
-- CTE 3: Stats principales
-- ========================================
-- Vérifie les comptages basés sur les transitions

WITH inter_demandees AS (
    SELECT DISTINCT intervention_id
    FROM public.intervention_status_transitions
    WHERE to_status_code = 'DEMANDE'
      AND transition_date >= '2025-01-01T00:00:00Z'::timestamptz
      AND transition_date <= '2026-01-01T00:00:00Z'::timestamptz
),
inter_terminees AS (
    SELECT DISTINCT intervention_id
    FROM public.intervention_status_transitions
    WHERE to_status_code = 'INTER_TERMINEE'
      AND transition_date >= '2025-01-01T00:00:00Z'::timestamptz
      AND transition_date <= '2026-01-01T00:00:00Z'::timestamptz
),
inter_devis AS (
    SELECT DISTINCT intervention_id
    FROM public.intervention_status_transitions
    WHERE to_status_code = 'DEVIS_ENVOYE'
      AND transition_date >= '2025-01-01T00:00:00Z'::timestamptz
      AND transition_date <= '2026-01-01T00:00:00Z'::timestamptz
),
inter_valides AS (
    SELECT DISTINCT intervention_id
    FROM public.intervention_status_transitions
    WHERE to_status_code = ANY(ARRAY['DEVIS_ENVOYE', 'ACCEPTE', 'INTER_EN_COURS', 'INTER_TERMINEE', 'ATT_ACOMPTE'])
      AND transition_date >= '2025-01-01T00:00:00Z'::timestamptz
      AND transition_date <= '2026-01-01T00:00:00Z'::timestamptz
),
main_stats AS (
    SELECT 
      (SELECT COUNT(*)::integer FROM inter_demandees) as nb_demandees,
      (SELECT COUNT(*)::integer FROM inter_terminees) as nb_terminees,
      (SELECT COUNT(*)::integer FROM inter_devis) as nb_devis,
      (SELECT COUNT(*)::integer FROM inter_valides) as nb_valides
)
SELECT 
  nb_demandees,
  nb_terminees,
  nb_devis,
  nb_valides,
  CASE 
    WHEN nb_valides > 0 
    THEN ROUND((nb_devis::numeric / nb_valides * 100)::numeric, 2)
    ELSE 0 
  END as taux_transformation_pourcent
FROM main_stats;

