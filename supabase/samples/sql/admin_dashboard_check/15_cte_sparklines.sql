-- ========================================
-- CTE 6: Sparklines (Données journalières)
-- ========================================
-- V2.0: Génération de série temporelle pour graphiques de tendance
-- Compte les transitions par jour pour DEMANDE et INTER_TERMINEE

WITH time_series AS (
    SELECT generate_series(
      '2025-01-01T00:00:00Z'::timestamptz, 
      '2026-01-01T00:00:00Z'::timestamptz - interval '1 day', 
      interval '1 day'
    ) as day
),
interventions_periode AS (
    SELECT 
      i.id, 
      i.agence_id,
      i.assigned_user_id
    FROM public.interventions i
    WHERE i.is_active = true
      AND i.date >= '2025-01-01T00:00:00Z'::timestamptz
      AND i.date < '2026-01-01T00:00:00Z'::timestamptz
),
transitions_periode AS (
    SELECT 
      ist.intervention_id,
      ist.to_status_code,
      ist.transition_date,
      ip.agence_id,
      ip.assigned_user_id
    FROM public.intervention_status_transitions ist
    INNER JOIN interventions_periode ip ON ip.id = ist.intervention_id
    WHERE ist.transition_date >= '2025-01-01T00:00:00Z'::timestamptz
      AND ist.transition_date <= '2026-01-01T00:00:00Z'::timestamptz
),
sparkline_data AS (
    SELECT 
      ts.day::date as date,
      COUNT(DISTINCT CASE WHEN tp.to_status_code = 'DEMANDE' THEN tp.intervention_id END)::integer as count_demandees,
      COUNT(DISTINCT CASE WHEN tp.to_status_code = 'INTER_TERMINEE' THEN tp.intervention_id END)::integer as count_terminees
    FROM time_series ts
    LEFT JOIN transitions_periode tp ON date_trunc('day', tp.transition_date) = date_trunc('day', ts.day)
    GROUP BY ts.day
    ORDER BY ts.day
)
SELECT 
  date,
  count_demandees,
  count_terminees,
  (count_demandees + count_terminees) as total_transitions
FROM sparkline_data
ORDER BY date;

-- Statistiques sur les sparklines
WITH time_series AS (
    SELECT generate_series(
      '2025-01-01T00:00:00Z'::timestamptz, 
      '2026-01-01T00:00:00Z'::timestamptz - interval '1 day', 
      interval '1 day'
    ) as day
),
interventions_periode AS (
    SELECT 
      i.id
    FROM public.interventions i
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
sparkline_data AS (
    SELECT 
      ts.day::date as date,
      COUNT(DISTINCT CASE WHEN tp.to_status_code = 'DEMANDE' THEN tp.intervention_id END)::integer as count_demandees,
      COUNT(DISTINCT CASE WHEN tp.to_status_code = 'INTER_TERMINEE' THEN tp.intervention_id END)::integer as count_terminees
    FROM time_series ts
    LEFT JOIN transitions_periode tp ON date_trunc('day', tp.transition_date) = date_trunc('day', ts.day)
    GROUP BY ts.day
)
SELECT 
  COUNT(*) as nb_jours,
  SUM(count_demandees) as total_demandees,
  SUM(count_terminees) as total_terminees,
  AVG(count_demandees)::numeric(10,2) as moyenne_demandees_par_jour,
  AVG(count_terminees)::numeric(10,2) as moyenne_terminees_par_jour,
  MAX(count_demandees) as max_demandees_jour,
  MAX(count_terminees) as max_terminees_jour
FROM sparkline_data;
