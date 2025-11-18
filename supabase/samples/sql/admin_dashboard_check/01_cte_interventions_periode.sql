-- ========================================
-- CTE 1: Interventions de la période
-- ========================================
-- Base de données pour toutes les stats
-- Vérifie que toutes les interventions actives de la période sont bien récupérées

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
)
SELECT 
  COUNT(*) as total_interventions,
  COUNT(DISTINCT statut_code) as nb_statuts_differents,
  COUNT(DISTINCT metier_id) as nb_metiers_differents,
  COUNT(DISTINCT agence_id) as nb_agences_differentes,
  COUNT(DISTINCT assigned_user_id) as nb_gestionnaires_differents
FROM interventions_periode;

-- Détail des interventions (premières 100)
SELECT * 
FROM interventions_periode
ORDER BY id
LIMIT 100;

-- Vérification des valeurs NULL
SELECT 
  COUNT(*) FILTER (WHERE statut_code IS NULL) as interventions_sans_statut,
  COUNT(*) FILTER (WHERE metier_id IS NULL) as interventions_sans_metier,
  COUNT(*) FILTER (WHERE agence_id IS NULL) as interventions_sans_agence,
  COUNT(*) FILTER (WHERE assigned_user_id IS NULL) as interventions_sans_gestionnaire
FROM interventions_periode;

