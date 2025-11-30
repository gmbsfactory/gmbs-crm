-- ============================================
-- TEST: Orchestrator Dashboard V3
-- ============================================
-- Fonction testée: get_admin_dashboard_stats_v3
-- ============================================

\echo ''
\echo '=================================================='
\echo '   TEST 1: Dashboard complet Janvier 2024'
\echo '=================================================='
\echo ''

SELECT jsonb_pretty(
  get_admin_dashboard_stats_v3(
    '2025-01-01 00:00:00'::timestamp,
    '2025-12-31 00:00:00'::timestamp,
    NULL, -- toutes agences
    NULL, -- tous métiers
    NULL, -- tous gestionnaires
    5,    -- top 5 gestionnaires
    10    -- top 10 agences (mais retournera toutes les agences car pas de limite)
  )
) AS "🎯 Dashboard Complet";

\echo ''

-- ============================================
-- TEST 2: Vérification structure JSON
-- ============================================

\echo ''
\echo '=================================================='
\echo '   TEST 2: Vérification structure réponse'
\echo '=================================================='
\echo ''

WITH dashboard_result AS (
  SELECT get_admin_dashboard_stats_v3(
    '2025-01-01 00:00:00'::timestamp,
    '2025-12-31 00:00:00'::timestamp,
    NULL, NULL, NULL, 5, 10
  ) AS data
)
SELECT
  jsonb_pretty(
    jsonb_build_object(
      'structure', jsonb_build_object(
        'a_kpi_main', CASE WHEN data ? 'kpi_main' THEN '✅' ELSE '❌' END,
        'b_performance_gestionnaires', CASE WHEN data ? 'performance_gestionnaires' THEN '✅' ELSE '❌' END,
        'c_performance_agences', CASE WHEN data ? 'performance_agences' THEN '✅' ELSE '❌' END,
        'd_performance_metiers', CASE WHEN data ? 'performance_metiers' THEN '✅' ELSE '❌' END,
        'e_cycles_moyens', CASE WHEN data ? 'cycles_moyens' THEN '✅' ELSE '❌' END,
        'f_sparkline_data', CASE WHEN data ? 'sparkline_data' THEN '✅' ELSE '❌' END
      ),
      'counts', jsonb_build_object(
        'gestionnaires', jsonb_array_length(data->'performance_gestionnaires'),
        'agences', jsonb_array_length(data->'performance_agences'),
        'metiers', jsonb_array_length(data->'performance_metiers'),
        'sparkline_points', jsonb_array_length(data->'sparkline_data')
      )
    )
  ) AS "📋 Vérification Structure"
FROM dashboard_result;

\echo ''

-- ============================================
-- TEST 3: Dashboard avec filtres multiples
-- ============================================

\echo ''
\echo '=================================================='
\echo '   TEST 3: Dashboard avec filtre agence'
\echo '=================================================='
\echo ''

-- Afficher l'agence testée
SELECT '🏢 Agence testée: ' || label AS info
FROM agencies
WHERE label IS NOT NULL
ORDER BY label
LIMIT 1;

\echo ''

SELECT jsonb_pretty(
  get_admin_dashboard_stats_v3(
    '2025-01-01 00:00:00'::timestamp,
    '2025-12-31 00:00:00'::timestamp,
    (SELECT id FROM agencies WHERE label IS NOT NULL ORDER BY label LIMIT 1),
    NULL,
    NULL,
    3,
    10
  )
) AS "🎯 Dashboard (agence filtrée)";

\echo ''

-- ============================================
-- TEST 4: Extraction KPIs clés (format lisible)
-- ============================================

\echo ''
\echo '=================================================='
\echo '   TEST 4: Résumé KPIs principaux'
\echo '=================================================='
\echo ''

WITH dashboard_result AS (
  SELECT get_admin_dashboard_stats_v3(
    '2025-01-01 00:00:00'::timestamp,
    '2025-12-31 00:00:00'::timestamp,
    NULL, NULL, NULL, 5, 10
  ) AS data
)
SELECT
  '📊 JANVIER 2024 - RÉSUMÉ' AS "",
  '' AS " ",
  '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' AS "━━━"
UNION ALL
SELECT
  '🔢 Interventions demandées',
  (data->'kpi_main'->>'nb_interventions_demandees')::text,
  ''
FROM dashboard_result
UNION ALL
SELECT
  '✅ Interventions terminées',
  (data->'kpi_main'->>'nb_interventions_terminees')::text,
  ''
FROM dashboard_result
UNION ALL
SELECT
  '📈 Taux transformation',
  ROUND((data->'kpi_main'->>'taux_transformation')::numeric, 2)::text || ' %',
  ''
FROM dashboard_result
UNION ALL
SELECT
  '💰 CA Total',
  ROUND((data->'kpi_main'->>'ca_total')::numeric, 2)::text || ' €',
  ''
FROM dashboard_result
UNION ALL
SELECT
  '💵 Marge Totale',
  ROUND((data->'kpi_main'->>'marge_total')::numeric, 2)::text || ' €',
  ''
FROM dashboard_result
UNION ALL
SELECT
  '📊 Taux de marge',
  ROUND((data->'kpi_main'->>'taux_marge')::numeric, 2)::text || ' %',
  ''
FROM dashboard_result
UNION ALL
SELECT
  '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
  '',
  ''
UNION ALL
SELECT
  '👥 Nombre gestionnaires actifs',
  jsonb_array_length(data->'performance_gestionnaires')::text,
  ''
FROM dashboard_result
UNION ALL
SELECT
  '🏢 Nombre agences',
  jsonb_array_length(data->'performance_agences')::text,
  ''
FROM dashboard_result
UNION ALL
SELECT
  '🔧 Nombre métiers',
  jsonb_array_length(data->'performance_metiers')::text,
  ''
FROM dashboard_result;

\echo ''

-- ============================================
-- TEST 5: Top 3 gestionnaires
-- ============================================

\echo ''
\echo '=================================================='
\echo '   TEST 5: Top 3 Gestionnaires (CA)'
\echo '=================================================='
\echo ''

WITH dashboard_result AS (
  SELECT get_admin_dashboard_stats_v3(
    '2025-01-01 00:00:00'::timestamp,
    '2025-12-31 00:00:00'::timestamp,
    NULL, NULL, NULL, 5, 10
  ) AS data
),
gestionnaires AS (
  SELECT jsonb_array_elements(data->'performance_gestionnaires') AS gest
  FROM dashboard_result
)
SELECT
  ROW_NUMBER() OVER (ORDER BY (gest->>'ca_total')::numeric DESC) AS "Rang",
  (gest->>'gestionnaire_nom')::text AS "Gestionnaire",
  (gest->>'nb_interventions_terminees')::integer AS "Inter terminées",
  ROUND((gest->>'ca_total')::numeric, 2) AS "CA (€)",
  ROUND((gest->>'marge_total')::numeric, 2) AS "Marge (€)"
FROM gestionnaires
LIMIT 3;

\echo ''

-- ============================================
-- TEST 6: Performance globale
-- ============================================

\echo ''
\echo '=================================================='
\echo '   TEST 6: Vue Performance Globale'
\echo '=================================================='
\echo ''

WITH dashboard_result AS (
  SELECT get_admin_dashboard_stats_v3(
    '2025-01-01 00:00:00'::timestamp,
    '2025-12-31 00:00:00'::timestamp,
    NULL, NULL, NULL, 10, 10
  ) AS data
)
SELECT
  jsonb_build_object(
    'periode', '2024-01-01 au 2024-01-31',
    'kpis', jsonb_build_object(
      'interventions_demandees', (data->'kpi_main'->>'nb_interventions_demandees')::integer,
      'interventions_terminees', (data->'kpi_main'->>'nb_interventions_terminees')::integer,
      'ca_total_euros', ROUND((data->'kpi_main'->>'ca_total')::numeric, 2),
      'marge_totale_euros', ROUND((data->'kpi_main'->>'marge_total')::numeric, 2)
    ),
    'dimensions', jsonb_build_object(
      'nb_gestionnaires', jsonb_array_length(data->'performance_gestionnaires'),
      'nb_agences', jsonb_array_length(data->'performance_agences'),
      'nb_metiers', jsonb_array_length(data->'performance_metiers')
    )
  ) AS "📊 Performance Globale"
FROM dashboard_result;

\echo ''
\echo '✅ Tests terminés'
\echo ''
