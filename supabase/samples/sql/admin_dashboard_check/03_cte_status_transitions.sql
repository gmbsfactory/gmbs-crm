-- ========================================
-- CTE 2: Interventions par statut (basé sur les transitions)
-- ========================================
-- Vérifie les interventions qui ont eu chaque statut pendant la période

-- Interventions demandées
WITH inter_demandees AS (
    SELECT DISTINCT intervention_id
    FROM public.intervention_status_transitions
    WHERE to_status_code = 'DEMANDE'
      AND transition_date >= '2025-01-01T00:00:00Z'::timestamptz
      AND transition_date <= '2026-01-01T00:00:00Z'::timestamptz
)
SELECT 
  'DEMANDE' as statut_code,
  COUNT(*)::integer as count
FROM inter_demandees;

-- Interventions terminées
WITH inter_terminees AS (
    SELECT DISTINCT intervention_id
    FROM public.intervention_status_transitions
    WHERE to_status_code = 'INTER_TERMINEE'
      AND transition_date >= '2025-01-01T00:00:00Z'::timestamptz
      AND transition_date <= '2026-01-01T00:00:00Z'::timestamptz
)
SELECT 
  'INTER_TERMINEE' as statut_code,
  COUNT(*)::integer as count
FROM inter_terminees;

-- Interventions avec devis envoyé
WITH inter_devis AS (
    SELECT DISTINCT intervention_id
    FROM public.intervention_status_transitions
    WHERE to_status_code = 'DEVIS_ENVOYE'
      AND transition_date >= '2025-01-01T00:00:00Z'::timestamptz
      AND transition_date <= '2026-01-01T00:00:00Z'::timestamptz
)
SELECT 
  'DEVIS_ENVOYE' as statut_code,
  COUNT(*)::integer as count
FROM inter_devis;

-- Interventions valides (DEVIS_ENVOYE, ACCEPTE, INTER_EN_COURS, INTER_TERMINEE, ATT_ACOMPTE)
WITH inter_valides AS (
    SELECT DISTINCT intervention_id
    FROM public.intervention_status_transitions
    WHERE to_status_code = ANY(ARRAY['DEVIS_ENVOYE', 'ACCEPTE', 'INTER_EN_COURS', 'INTER_TERMINEE', 'ATT_ACOMPTE'])
      AND transition_date >= '2025-01-01T00:00:00Z'::timestamptz
      AND transition_date <= '2026-01-01T00:00:00Z'::timestamptz
)
SELECT 
  'VALIDES' as statut_code,
  COUNT(*)::integer as count
FROM inter_valides;

-- Vue d'ensemble de toutes les transitions
SELECT 
  to_status_code,
  COUNT(DISTINCT intervention_id) as nb_interventions,
  COUNT(*) as nb_transitions
FROM public.intervention_status_transitions
WHERE transition_date >= '2025-01-01T00:00:00Z'::timestamptz
  AND transition_date <= '2026-01-01T00:00:00Z'::timestamptz
  AND to_status_code IS NOT NULL
GROUP BY to_status_code
ORDER BY nb_interventions DESC;

