-- ========================================
-- CTE 11: Breakdown par gestionnaire
-- ========================================

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
    -- Interventions directement assignées
    SELECT DISTINCT
      i.id as intervention_id,
      i.assigned_user_id as gestionnaire_id
    FROM interventions_periode i
    WHERE i.assigned_user_id IS NOT NULL
    
    UNION
    
    -- Interventions via artisans gérés par le gestionnaire
    SELECT DISTINCT
      i.id as intervention_id,
      a.gestionnaire_id
    FROM interventions_periode i
    INNER JOIN public.intervention_artisans ia ON ia.intervention_id = i.id
    INNER JOIN public.artisans a ON a.id = ia.artisan_id
    WHERE a.gestionnaire_id IS NOT NULL
      AND a.is_active = true
),
inter_terminees AS (
    SELECT DISTINCT intervention_id
    FROM public.intervention_status_transitions
    WHERE to_status_code = 'INTER_TERMINEE'
      AND transition_date >= '2025-01-01T00:00:00Z'::timestamptz
      AND transition_date <= '2026-01-01T00:00:00Z'::timestamptz
),
gestionnaire_breakdown AS (
    SELECT 
      ig.gestionnaire_id,
      COUNT(DISTINCT ig.intervention_id)::integer as total_interventions,
      COUNT(DISTINCT CASE WHEN ig.intervention_id IN (SELECT intervention_id FROM inter_terminees) THEN ig.intervention_id END)::integer as terminated_interventions
    FROM interventions_gestionnaires ig
    WHERE ig.gestionnaire_id IS NOT NULL
    GROUP BY ig.gestionnaire_id
)
SELECT 
  gb.gestionnaire_id,
  u.email as gestionnaire_email,
  u.raw_user_meta_data->>'full_name' as gestionnaire_nom,
  gb.total_interventions,
  gb.terminated_interventions,
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
    
    UNION
    
    SELECT DISTINCT
      i.id as intervention_id,
      a.gestionnaire_id
    FROM interventions_periode i
    INNER JOIN public.intervention_artisans ia ON ia.intervention_id = i.id
    INNER JOIN public.artisans a ON a.id = ia.artisan_id
    WHERE a.gestionnaire_id IS NOT NULL
      AND a.is_active = true
)
SELECT 
  (SELECT COUNT(*) FROM interventions_periode) as total_interventions,
  (SELECT COUNT(DISTINCT intervention_id) FROM interventions_gestionnaires) as interventions_avec_gestionnaire,
  (SELECT COUNT(*) FROM interventions_periode) - (SELECT COUNT(DISTINCT intervention_id) FROM interventions_gestionnaires) as interventions_sans_gestionnaire;

