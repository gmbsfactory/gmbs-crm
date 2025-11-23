-- ========================================
-- CTE 6: Breakdown par agence
-- ========================================
-- Avec comptage des terminées

WITH interventions_periode AS (
    SELECT 
      i.id, 
      i.statut_id, 
      ist.code as statut_code,
      i.metier_id, 
      i.agence_id,
      i.assigned_user_id
    FROM public.interventions i
    LEFT JOIN public.intervention_statuses ist ON ist.id = i.statut_id
    WHERE i.is_active = true
      AND i.date >= '2025-01-01T00:00:00Z'::timestamptz
      AND i.date < '2026-01-01T00:00:00Z'::timestamptz
),
inter_terminees AS (
    SELECT DISTINCT intervention_id
    FROM public.intervention_status_transitions
    WHERE to_status_code = 'INTER_TERMINEE'
      AND transition_date >= '2025-01-01T00:00:00Z'::timestamptz
      AND transition_date <= '2026-01-01T00:00:00Z'::timestamptz
),
agency_breakdown AS (
    SELECT 
      agence_id,
      COUNT(*)::integer as total_interventions,
      COUNT(*) FILTER (WHERE id IN (SELECT intervention_id FROM inter_terminees))::integer as terminated_interventions
    FROM interventions_periode
    WHERE agence_id IS NOT NULL
    GROUP BY agence_id
)
SELECT 
  ab.agence_id,
  a.label as agence_label,
  ab.total_interventions,
  ab.terminated_interventions,
  CASE 
    WHEN ab.total_interventions > 0 
    THEN ROUND((ab.terminated_interventions::numeric / ab.total_interventions * 100)::numeric, 2)
    ELSE 0 
  END as taux_terminaison_pourcent
FROM agency_breakdown ab
LEFT JOIN public.agencies a ON a.id = ab.agence_id
ORDER BY ab.total_interventions DESC;

-- Vérification des interventions sans agence
WITH interventions_periode AS (
    SELECT 
      i.id, 
      i.agence_id
    FROM public.interventions i
    WHERE i.is_active = true
      AND i.date >= '2025-01-01T00:00:00Z'::timestamptz
      AND i.date < '2026-01-01T00:00:00Z'::timestamptz
)
SELECT 
  COUNT(*) FILTER (WHERE agence_id IS NULL) as interventions_sans_agence,
  COUNT(*) FILTER (WHERE agence_id IS NOT NULL) as interventions_avec_agence,
  COUNT(*) as total
FROM interventions_periode;

