-- ========================================
-- CTE 8: Breakdown par agence
-- ========================================
-- V2.0: Avec Cycle Time
-- Comptage basé sur les transitions, pas sur le statut actuel

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
transitions_periode AS (
    SELECT 
      ist.intervention_id,
      ist.to_status_code,
      ist.transition_date
    FROM public.intervention_status_transitions ist
    INNER JOIN interventions_periode ip ON ip.id = ist.intervention_id
    WHERE ist.transition_date >= '2025-01-01T00:00:00Z'::timestamptz
      AND ist.transition_date <= '2026-01-01T00:00:00Z'::timestamptz
),
cycle_time_data AS (
    SELECT
      t_start.intervention_id,
      EXTRACT(EPOCH FROM (MIN(t_end.transition_date) - MIN(t_start.transition_date))) / 86400.0 as days_diff
    FROM public.intervention_status_transitions t_start
    JOIN public.intervention_status_transitions t_end ON t_start.intervention_id = t_end.intervention_id
    JOIN interventions_periode ip ON ip.id = t_start.intervention_id
    WHERE t_start.to_status_code = 'DEMANDE'
      AND t_end.to_status_code = 'INTER_TERMINEE'
      AND t_end.transition_date >= t_start.transition_date
    GROUP BY t_start.intervention_id
),
agency_breakdown AS (
    SELECT 
      ip.agence_id,
      COUNT(DISTINCT ip.id)::integer as total_interventions,
      COUNT(DISTINCT CASE WHEN tp.to_status_code = 'INTER_TERMINEE' THEN tp.intervention_id END)::integer as terminated_interventions,
      COALESCE(AVG(ct.days_diff), 0)::numeric(10,2) as avg_cycle_time
    FROM interventions_periode ip
    LEFT JOIN transitions_periode tp ON tp.intervention_id = ip.id
    LEFT JOIN cycle_time_data ct ON ct.intervention_id = ip.id
    WHERE ip.agence_id IS NOT NULL
    GROUP BY ip.agence_id
)
SELECT 
  ab.agence_id,
  a.label as agence_label,
  ab.total_interventions,
  ab.terminated_interventions,
  ab.avg_cycle_time,
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

