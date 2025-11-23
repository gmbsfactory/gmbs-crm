-- ========================================
-- CTE 1b: Interventions liées aux gestionnaires
-- ========================================
-- Vérifie les interventions directement assignées et via artisans

WITH interventions_periode AS (
    SELECT 
      i.id, 
      i.statut_id, 
      ist.code as statut_code,
      i.metier_id, 
      i.agence_id,
      i.assigned_user_id
    FROM public.interventions i
    INNER JOIN public.intervention_statuses ist ON ist.id = i.statut_id
    WHERE i.is_active = true
      AND i.date >= '2025-01-01T00:00:00Z'::timestamptz
      AND i.date < '2026-01-01T00:00:00Z'::timestamptz
),
interventions_gestionnaires AS (
    -- Interventions directement assignées
    SELECT DISTINCT
      i.id as intervention_id,
      i.assigned_user_id as gestionnaire_id,
      'direct' as source
    FROM interventions_periode i
    WHERE i.assigned_user_id IS NOT NULL
)
SELECT 
  gestionnaire_id,
  COUNT(DISTINCT intervention_id) as nb_interventions,
  COUNT(DISTINCT CASE WHEN source = 'direct' THEN intervention_id END) as nb_directes
FROM interventions_gestionnaires
GROUP BY gestionnaire_id
ORDER BY nb_interventions DESC;

-- Détail (premières 100)
SELECT 
  ig.intervention_id,
  ig.gestionnaire_id,
  ig.source,
  u.email as gestionnaire_email
FROM interventions_gestionnaires ig
LEFT JOIN public.users u ON u.id = ig.gestionnaire_id
ORDER BY ig.gestionnaire_id, ig.intervention_id
LIMIT 100;

