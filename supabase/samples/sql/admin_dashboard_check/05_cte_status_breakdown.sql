-- ========================================
-- CTE 4: Breakdown par statut
-- ========================================
-- Basé sur les transitions pendant la période

WITH status_breakdown AS (
    SELECT 
      ist.to_status_code as statut_code,
      COUNT(DISTINCT ist.intervention_id)::integer as count
    FROM public.intervention_status_transitions ist
    WHERE ist.transition_date >= '2025-01-01T00:00:00Z'::timestamptz
      AND ist.transition_date <= '2026-01-01T00:00:00Z'::timestamptz
      AND ist.to_status_code IS NOT NULL
    GROUP BY ist.to_status_code
)
SELECT 
  sb.statut_code,
  ist.label as statut_label,
  sb.count
FROM status_breakdown sb
LEFT JOIN public.intervention_statuses ist ON ist.code = sb.statut_code
ORDER BY sb.count DESC;

-- Comparaison avec le statut actuel des interventions
WITH interventions_periode AS (
    SELECT 
      i.id, 
      ist.code as statut_code
    FROM public.interventions i
    LEFT JOIN public.intervention_statuses ist ON ist.id = i.statut_id
    WHERE i.is_active = true
      AND i.date >= '2025-01-01T00:00:00Z'::timestamptz
      AND i.date < '2026-01-01T00:00:00Z'::timestamptz
),
status_actuel AS (
    SELECT 
      statut_code,
      COUNT(*)::integer as count
    FROM interventions_periode
    WHERE statut_code IS NOT NULL
    GROUP BY statut_code
),
status_transitions AS (
    SELECT 
      ist.to_status_code as statut_code,
      COUNT(DISTINCT ist.intervention_id)::integer as count
    FROM public.intervention_status_transitions ist
    WHERE ist.transition_date >= '2025-01-01T00:00:00Z'::timestamptz
      AND ist.transition_date <= '2026-01-01T00:00:00Z'::timestamptz
      AND ist.to_status_code IS NOT NULL
    GROUP BY ist.to_status_code
)
SELECT 
  COALESCE(sa.statut_code, st.statut_code) as statut_code,
  COALESCE(sa.count, 0) as count_statut_actuel,
  COALESCE(st.count, 0) as count_transitions,
  (COALESCE(st.count, 0) - COALESCE(sa.count, 0)) as difference
FROM status_actuel sa
FULL OUTER JOIN status_transitions st ON st.statut_code = sa.statut_code
ORDER BY COALESCE(st.count, sa.count) DESC;

