-- ========================================
-- CTE 5: Breakdown par métier
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
metier_breakdown AS (
    SELECT 
      metier_id,
      COUNT(*)::integer as count
    FROM interventions_periode
    WHERE metier_id IS NOT NULL
    GROUP BY metier_id
)
SELECT 
  mb.metier_id,
  m.label as metier_label,
  mb.count,
  ROUND((mb.count::numeric / (SELECT SUM(count) FROM metier_breakdown) * 100)::numeric, 2) as pourcentage
FROM metier_breakdown mb
LEFT JOIN public.metiers m ON m.id = mb.metier_id
ORDER BY mb.count DESC;

-- Vérification des interventions sans métier
WITH interventions_periode AS (
    SELECT 
      i.id, 
      i.metier_id
    FROM public.interventions i
    WHERE i.is_active = true
      AND i.date >= '2025-01-01T00:00:00Z'::timestamptz
      AND i.date < '2026-01-01T00:00:00Z'::timestamptz
)
SELECT 
  COUNT(*) FILTER (WHERE metier_id IS NULL) as interventions_sans_metier,
  COUNT(*) FILTER (WHERE metier_id IS NOT NULL) as interventions_avec_metier,
  COUNT(*) as total
FROM interventions_periode;

