-- ============================================
-- TEST: Sparkline Data V3
-- ============================================
-- Fonction testée: get_dashboard_sparkline_data_v3
-- ============================================

\echo ''
\echo '=================================================='
\echo '   TEST 1: Données sparkline Janvier 2024'
\echo '=================================================='
\echo ''

SELECT jsonb_pretty(
  get_dashboard_sparkline_data_v3(
    '2025-01-01 00:00:00'::timestamp,
    '2025-12-31 00:00:00'::timestamp,
    NULL, -- toutes agences
    NULL, -- tous métiers
    NULL  -- tous gestionnaires
  )
) AS "📈 Sparkline Data (30 premiers jours)";

\echo ''

-- ============================================
-- TEST 2: Période courte (7 jours)
-- ============================================

\echo ''
\echo '=================================================='
\echo '   TEST 2: Sparkline sur 7 jours'
\echo '=================================================='
\echo ''

SELECT jsonb_pretty(
  get_dashboard_sparkline_data_v3(
    '2025-01-01 00:00:00'::timestamp,
    '2024-01-07 23:59:59'::timestamp,
    NULL, NULL, NULL
  )
) AS "📈 Sparkline Data (7 jours)";

\echo ''

-- ============================================
-- TEST 3: Avec filtre agence
-- ============================================

\echo ''
\echo '=================================================='
\echo '   TEST 3: Sparkline par agence'
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
  get_dashboard_sparkline_data_v3(
    '2025-01-01 00:00:00'::timestamp,
    '2025-12-31 00:00:00'::timestamp,
    (SELECT id FROM agencies WHERE label IS NOT NULL ORDER BY label LIMIT 1),
    NULL,
    NULL
  )
) AS "📈 Sparkline Data (agence)";

\echo ''

-- ============================================
-- TEST 4: Format tableau pour vérification
-- ============================================

\echo ''
\echo '=================================================='
\echo '   TEST 4: Vérification données (format tableau)'
\echo '=================================================='
\echo ''

WITH sparkline_data AS (
  SELECT jsonb_array_elements(
    get_dashboard_sparkline_data_v3(
      '2025-01-01 00:00:00'::timestamp,
      '2025-12-31 00:00:00'::timestamp,
      NULL, NULL, NULL
    )
  ) AS jour
)
SELECT
  (jour->>'date')::date AS "Date",
  (jour->>'nb_interventions_demandees')::integer AS "Demandées",
  (jour->>'nb_interventions_terminees')::integer AS "Terminées"
FROM sparkline_data
ORDER BY (jour->>'date')::date
LIMIT 10; -- Afficher seulement premiers 10 jours

\echo ''
\echo 'Note: Seuls les 10 premiers jours sont affichés'
\echo ''

-- ============================================
-- TEST 5: Vérification série continue de dates
-- ============================================

\echo ''
\echo '=================================================='
\echo '   TEST 5: Vérification continuité dates'
\echo '=================================================='
\echo ''

WITH sparkline_data AS (
  SELECT jsonb_array_elements(
    get_dashboard_sparkline_data_v3(
      '2025-01-01 00:00:00'::timestamp,
      '2024-01-15 23:59:59'::timestamp,
      NULL, NULL, NULL
    )
  ) AS jour
),
dates_extraites AS (
  SELECT
    (jour->>'date')::date AS date_jour,
    ROW_NUMBER() OVER (ORDER BY (jour->>'date')::date) AS row_num
  FROM sparkline_data
)
SELECT
  COUNT(*) AS "Nombre de jours",
  MIN(date_jour) AS "Première date",
  MAX(date_jour) AS "Dernière date",
  (MAX(date_jour) - MIN(date_jour) + 1) AS "Jours attendus",
  CASE
    WHEN COUNT(*) = (MAX(date_jour) - MIN(date_jour) + 1) THEN '✅ Série continue'
    ELSE '❌ Trous dans la série'
  END AS "Vérification"
FROM dates_extraites;

\echo ''

-- ============================================
-- TEST 6: Vérification cohérence totaux
-- ============================================

\echo ''
\echo '=================================================='
\echo '   TEST 6: Cohérence totaux sparkline vs KPI'
\echo '=================================================='
\echo ''

WITH sparkline_sum AS (
  SELECT
    SUM((jour->>'nb_interventions_demandees')::integer) AS total_sparkline_demandees,
    SUM((jour->>'nb_interventions_terminees')::integer) AS total_sparkline_terminees
  FROM (
    SELECT jsonb_array_elements(
      get_dashboard_sparkline_data_v3(
        '2025-01-01 00:00:00'::timestamp,
        '2025-12-31 00:00:00'::timestamp,
        NULL, NULL, NULL
      )
    ) AS jour
  ) s
),
kpi_main AS (
  SELECT
    (get_dashboard_kpi_main_v3(
      '2025-01-01 00:00:00'::timestamp,
      '2025-12-31 00:00:00'::timestamp,
      NULL, NULL, NULL
    )->>'nb_interventions_demandees')::integer AS total_kpi_demandees,
    (get_dashboard_kpi_main_v3(
      '2025-01-01 00:00:00'::timestamp,
      '2025-12-31 00:00:00'::timestamp,
      NULL, NULL, NULL
    )->>'nb_interventions_terminees')::integer AS total_kpi_terminees
)
SELECT
  k.total_kpi_demandees AS "KPI Demandées",
  s.total_sparkline_demandees AS "Sparkline Demandées",
  CASE
    WHEN k.total_kpi_demandees = s.total_sparkline_demandees THEN '✅'
    ELSE '❌'
  END AS "Cohérence demandées",
  k.total_kpi_terminees AS "KPI Terminées",
  s.total_sparkline_terminees AS "Sparkline Terminées",
  CASE
    WHEN k.total_kpi_terminees = s.total_sparkline_terminees THEN '✅'
    ELSE '❌'
  END AS "Cohérence terminées"
FROM kpi_main k, sparkline_sum s;

\echo ''
\echo '✅ Tests terminés'
\echo ''
