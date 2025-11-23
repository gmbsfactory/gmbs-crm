-- ========================================
-- CTE 4: Cycle Time (Délai Moyen Global) - VERSION CORRIGÉE
-- ========================================
-- V2.1: Calcul du temps entre DEMANDE et INTER_TERMINEE
-- Gère les cas où :
-- - L'intervention a été créée directement en DEMANDE (pas de transition)
-- - L'intervention n'a jamais été en DEMANDE (utilise la première transition ou date de création)
-- - Filtre les transitions invalides (from_status_code = to_status_code)

WITH interventions_periode AS (
    SELECT 
      i.id, 
      i.statut_id, 
      ist.code as statut_code,
      i.metier_id, 
      i.agence_id,
      i.assigned_user_id,
      i.date as date_intervention,
      i.created_at
    FROM public.interventions i
    LEFT JOIN public.intervention_statuses ist ON ist.id = i.statut_id
    WHERE i.is_active = true
      AND i.date >= '2025-01-01T00:00:00Z'::timestamptz
      AND i.date < '2026-01-01T00:00:00Z'::timestamptz
),

-- Trouver la PREMIÈRE transition vers DEMANDE pour chaque intervention
-- OU utiliser la date de création si l'intervention a été créée en DEMANDE
first_demande_transition AS (
    SELECT 
      ip.id as intervention_id,
      COALESCE(
        MIN(CASE WHEN ist.to_status_code = 'DEMANDE' THEN ist.transition_date END),
        -- Si pas de transition vers DEMANDE mais que l'intervention a été créée en DEMANDE
        CASE WHEN ip.statut_code = 'DEMANDE' THEN ip.created_at END
      ) as date_demande
    FROM interventions_periode ip
    LEFT JOIN public.intervention_status_transitions ist 
      ON ist.intervention_id = ip.id
      AND ist.to_status_code = 'DEMANDE'
      -- Filtrer les transitions invalides (from_status_code = to_status_code)
      AND (ist.from_status_code IS NULL OR ist.from_status_code != ist.to_status_code)
    GROUP BY ip.id, ip.statut_code, ip.created_at
    HAVING COALESCE(
      MIN(CASE WHEN ist.to_status_code = 'DEMANDE' THEN ist.transition_date END),
      CASE WHEN ip.statut_code = 'DEMANDE' THEN ip.created_at END
    ) IS NOT NULL
),

-- Trouver la PREMIÈRE transition vers INTER_TERMINEE pour chaque intervention
first_terminee_transition AS (
    SELECT 
      ip.id as intervention_id,
      MIN(ist.transition_date) as date_terminee
    FROM interventions_periode ip
    INNER JOIN public.intervention_status_transitions ist 
      ON ist.intervention_id = ip.id
      AND ist.to_status_code = 'INTER_TERMINEE'
      -- Filtrer les transitions invalides (from_status_code = to_status_code)
      AND (ist.from_status_code IS NULL OR ist.from_status_code != ist.to_status_code)
    GROUP BY ip.id
),

-- Calculer le cycle time pour les interventions qui ont les deux dates
cycle_time_data AS (
    SELECT
      fdt.intervention_id,
      fdt.date_demande,
      ftt.date_terminee,
      EXTRACT(EPOCH FROM (ftt.date_terminee - fdt.date_demande)) / 86400.0 as days_diff
    FROM first_demande_transition fdt
    INNER JOIN first_terminee_transition ftt ON fdt.intervention_id = ftt.intervention_id
    WHERE ftt.date_terminee >= fdt.date_demande
)

SELECT 
  COUNT(*) as nb_interventions_avec_cycle_time,
  COALESCE(AVG(days_diff), 0)::numeric(10,2) as avg_cycle_time_days,
  COALESCE(MIN(days_diff), 0)::numeric(10,2) as min_cycle_time_days,
  COALESCE(MAX(days_diff), 0)::numeric(10,2) as max_cycle_time_days,
  COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY days_diff), 0)::numeric(10,2) as median_cycle_time_days
FROM cycle_time_data;

-- Détail des interventions avec cycle time (premières 100)
-- ... (même logique pour la requête de détail)
