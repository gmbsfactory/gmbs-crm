-- ========================================
-- CTE 9: Breakdown par gestionnaire
-- ========================================
-- V2.0: Uniquement via assigned_user_id + Cycle Time

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
interventions_gestionnaires AS (
    -- V2.0: Uniquement via assigned_user_id
    SELECT DISTINCT
      i.id as intervention_id,
      i.assigned_user_id as gestionnaire_id
    FROM interventions_periode i
    WHERE i.assigned_user_id IS NOT NULL
),
transitions_periode AS (
    SELECT 
      ist.intervention_id,
      ist.to_status_code,
      ist.transition_date
    FROM public.intervention_status_transitions ist
    INNER JOIN interventions_gestionnaires ig ON ig.intervention_id = ist.intervention_id
    WHERE ist.transition_date >= '2025-01-01T00:00:00Z'::timestamptz
      AND ist.transition_date <= '2026-01-01T00:00:00Z'::timestamptz
),
cycle_time_data AS (
    SELECT
      t_start.intervention_id,
      EXTRACT(EPOCH FROM (MIN(t_end.transition_date) - MIN(t_start.transition_date))) / 86400.0 as days_diff
    FROM public.intervention_status_transitions t_start
    JOIN public.intervention_status_transitions t_end ON t_start.intervention_id = t_end.intervention_id
    JOIN interventions_gestionnaires ig ON ig.intervention_id = t_start.intervention_id
    WHERE t_start.to_status_code = 'DEMANDE'
      AND t_end.to_status_code = 'INTER_TERMINEE'
      AND t_end.transition_date >= t_start.transition_date
    GROUP BY t_start.intervention_id
),
gestionnaire_breakdown AS (
    SELECT 
      ig.gestionnaire_id,
      COUNT(DISTINCT ig.intervention_id)::integer as total_interventions,
      COUNT(DISTINCT CASE WHEN tp.to_status_code = 'INTER_TERMINEE' THEN tp.intervention_id END)::integer as terminated_interventions,
      COALESCE(AVG(ct.days_diff), 0)::numeric(10,2) as avg_cycle_time
    FROM interventions_gestionnaires ig
    LEFT JOIN transitions_periode tp ON tp.intervention_id = ig.intervention_id
    LEFT JOIN cycle_time_data ct ON ct.intervention_id = ig.intervention_id
    WHERE ig.gestionnaire_id IS NOT NULL
    GROUP BY ig.gestionnaire_id
)
SELECT 
  gb.gestionnaire_id,
  u.email as gestionnaire_email,
  u.raw_user_meta_data->>'full_name' as gestionnaire_nom,
  gb.total_interventions,
  gb.terminated_interventions,
  gb.avg_cycle_time,
  CASE 
    WHEN gb.total_interventions > 0 
    THEN ROUND((gb.terminated_interventions::numeric / gb.total_interventions * 100)::numeric, 2)
    ELSE 0 
  END as taux_terminaison_pourcent
FROM gestionnaire_breakdown gb
LEFT JOIN public.users u ON u.id = gb.gestionnaire_id
ORDER BY gb.total_interventions DESC;

-- Vérification des interventions sans gestionnaire
WITH interventions_periode AS (
    SELECT 
      i.id, 
      i.assigned_user_id
    FROM public.interventions i
    WHERE i.is_active = true
      AND i.date >= '2025-01-01T00:00:00Z'::timestamptz
      AND i.date < '2026-01-01T00:00:00Z'::timestamptz
),
interventions_gestionnaires AS (
    SELECT DISTINCT
      i.id as intervention_id,
      i.assigned_user_id as gestionnaire_id
    FROM interventions_periode i
    WHERE i.assigned_user_id IS NOT NULL
)
SELECT 
  (SELECT COUNT(*) FROM interventions_periode) as total_interventions,
  (SELECT COUNT(DISTINCT intervention_id) FROM interventions_gestionnaires) as interventions_avec_gestionnaire,
  (SELECT COUNT(*) FROM interventions_periode) - (SELECT COUNT(DISTINCT intervention_id) FROM interventions_gestionnaires) as interventions_sans_gestionnaire;

