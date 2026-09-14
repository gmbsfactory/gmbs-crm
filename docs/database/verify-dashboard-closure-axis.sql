-- Vérifications à passer après la migration 99090_dashboard_stats_on_closure_date.sql
-- (à exécuter dans le SQL editor Supabase, une requête à la fois).

-- 1) Ampleur de la pollution d'import : combien de "clôtures" sans acteur, et quand ?
--    Attendu : un pic massif les 28-29/06/2026, correctement exclu par la vue.
SELECT
  DATE_TRUNC('day', t.transition_date)::date AS jour,
  t.source,
  (t.changed_by_user_id IS NULL) AS sans_acteur,
  COUNT(*) AS nb
FROM public.intervention_status_transitions t
WHERE t.to_status_code = 'INTER_TERMINEE'
GROUP BY 1, 2, 3
ORDER BY nb DESC
LIMIT 30;

-- 2) Combien de dossiers perdent leur date de clôture à cause de la règle n°3 ?
--    Ce sont les dossiers sans aucune clôture « données réelles » (cascade
--    d'import, ou transition sans acteur) : ils sortent du CA, comportement voulu.
SELECT COUNT(*) AS dossiers_sans_cloture_exploitable
FROM (
  SELECT DISTINCT t.intervention_id
  FROM public.intervention_status_transitions t
  WHERE t.to_status_code = 'INTER_TERMINEE'
) tous
LEFT JOIN public.v_intervention_closure cl ON cl.intervention_id = tous.intervention_id
WHERE cl.intervention_id IS NULL;

-- 3) Dossiers dont le CA CHANGE de période : créés sur un mois, clôturés sur un autre.
--    C'est exactement la population que la migration déplace.
SELECT
  i.id_inter,
  i.date::date            AS date_creation,
  cl.closed_at::date      AS date_cloture,
  ist.code                AS statut_courant
FROM public.interventions i
JOIN public.v_intervention_closure cl ON cl.intervention_id = i.id
JOIN public.intervention_statuses ist ON ist.id = i.statut_id
WHERE i.is_active = true
  AND DATE_TRUNC('month', i.date) <> DATE_TRUNC('month', cl.closed_at)
ORDER BY cl.closed_at DESC
LIMIT 50;

-- 4) Dossiers dont le CA REVIENT grâce à la règle n°2 (a été clôturé, mais
--    n'est plus au statut INTER_TERMINEE : SAV ou réouverture comptabilité).
--    Ils étaient invisibles dans le CA avant cette migration.
SELECT
  ist.code AS statut_courant,
  COUNT(*) AS nb_dossiers
FROM public.interventions i
JOIN public.v_intervention_closure cl ON cl.intervention_id = i.id
JOIN public.intervention_statuses ist ON ist.id = i.statut_id
WHERE i.is_active = true
  AND ist.code <> 'INTER_TERMINEE'
GROUP BY 1
ORDER BY nb_dossiers DESC;

-- 5) Cohérence : le CA des KPI principaux doit égaler la somme du CA des
--    tables de performance (agences) et la somme des ca_jour des sparklines.
--    Remplacer les bornes par une période réelle.
WITH p AS (
  SELECT
    TIMESTAMP '2026-09-01 00:00:00' AS d,
    TIMESTAMP '2026-09-30 23:59:59' AS f
),
kpi AS (
  SELECT (get_dashboard_kpi_main_v3(p.d, p.f))->>'ca_total' AS ca FROM p
),
agences AS (
  SELECT SUM((e->>'ca_total')::numeric) AS ca
  FROM p, jsonb_array_elements(get_dashboard_performance_agences_v3(p.d, p.f)) e
),
spark AS (
  SELECT SUM((e->>'ca_jour')::numeric) AS ca
  FROM p, jsonb_array_elements(get_dashboard_sparkline_data_v3(p.d, p.f)) e
)
SELECT
  kpi.ca::numeric   AS ca_kpi,
  agences.ca        AS ca_agences,
  spark.ca          AS ca_sparklines,
  -- Les trois doivent être identiques. Un écart sur les agences signale des
  -- interventions sans agence_id (elles n'apparaissent dans aucune ligne).
  (kpi.ca::numeric = COALESCE(agences.ca, 0)) AS agences_ok,
  (kpi.ca::numeric = COALESCE(spark.ca, 0))   AS sparklines_ok
FROM kpi, agences, spark;

-- 6) Cohérence podium <-> dashboard : la vue v_intervention_closure applique le
--    MÊME périmètre que get_podium_ranking_by_period (99063). Le nombre de
--    dossiers clôturés sur la période doit donc concorder entre les deux.
--    Attendu : ecart = 0.
SELECT
  (SELECT COUNT(*)
     FROM public.v_intervention_closure cl
     JOIN public.interventions i ON i.id = cl.intervention_id
    WHERE i.is_active = true
      AND cl.closed_at >= TIMESTAMPTZ '2026-09-01 00:00:00+02'
      AND cl.closed_at <  TIMESTAMPTZ '2026-10-01 00:00:00+02') AS nb_vue,
  (SELECT COUNT(DISTINCT t.intervention_id)
     FROM public.intervention_status_transitions t
     JOIN public.interventions i ON i.id = t.intervention_id
    WHERE t.to_status_code = 'INTER_TERMINEE'
      AND t.changed_by_user_id IS NOT NULL
      AND t.transition_date >= TIMESTAMPTZ '2026-06-28T22:00:00Z'
      AND i.is_active = true
      AND t.transition_date >= TIMESTAMPTZ '2026-09-01 00:00:00+02'
      AND t.transition_date <  TIMESTAMPTZ '2026-10-01 00:00:00+02') AS nb_podium_style;
