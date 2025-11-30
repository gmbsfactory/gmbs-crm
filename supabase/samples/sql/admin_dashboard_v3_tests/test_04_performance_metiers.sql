-- ============================================
-- TEST: Performance Métiers V3
-- ============================================
-- Fonction testée: get_dashboard_performance_metiers_v3
-- ============================================

\echo ''
\echo '=================================================='
\echo '   TEST 1: Tous métiers Janvier 2024'
\echo '=================================================='
\echo ''

SELECT jsonb_pretty(
  get_dashboard_performance_metiers_v3(
    '2025-01-01 00:00:00'::timestamp,
    '2025-12-31 00:00:00'::timestamp,
    NULL, -- toutes agences
    NULL  -- tous gestionnaires
  )
) AS "🔧 Performance Métiers par Volume";

\echo ''

-- ============================================
-- TEST 2: Métiers avec filtre agence
-- ============================================

\echo ''
\echo '=================================================='
\echo '   TEST 2: Métiers filtrés par agence'
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
  get_dashboard_performance_metiers_v3(
    '2025-01-01 00:00:00'::timestamp,
    '2025-12-31 00:00:00'::timestamp,
    (SELECT id FROM agencies WHERE label IS NOT NULL ORDER BY label LIMIT 1),
    NULL
  )
) AS "🔧 Métiers pour cette agence";

\echo ''

-- ============================================
-- TEST 3: Métiers avec filtre gestionnaire
-- ============================================

\echo ''
\echo '=================================================='
\echo '   TEST 3: Métiers pour un gestionnaire'
\echo '=================================================='
\echo ''

-- Afficher le gestionnaire testé
SELECT '👤 Gestionnaire testé: ' || u.nom || ' ' || u.prenom AS info
FROM users u
JOIN user_roles ur ON u.id = ur.user_id
JOIN roles r ON ur.role_id = r.id
WHERE r.code = 'gestionnaire'
  AND u.is_active = true
ORDER BY u.nom
LIMIT 1;

\echo ''

SELECT jsonb_pretty(
  get_dashboard_performance_metiers_v3(
    '2025-01-01 00:00:00'::timestamp,
    '2025-12-31 00:00:00'::timestamp,
    NULL,
    (SELECT u.id
     FROM users u
     JOIN user_roles ur ON u.id = ur.user_id
     JOIN roles r ON ur.role_id = r.id
     WHERE r.code = 'gestionnaire'
       AND u.is_active = true
     ORDER BY u.nom
     LIMIT 1)
  )
) AS "🔧 Métiers pour ce gestionnaire";

\echo ''

-- ============================================
-- TEST 4: Vérification données (format tableau)
-- ============================================

\echo ''
\echo '=================================================='
\echo '   TEST 4: Vérification données (format tableau)'
\echo '=================================================='
\echo ''

WITH perf_data AS (
  SELECT jsonb_array_elements(
    get_dashboard_performance_metiers_v3(
      '2025-01-01 00:00:00'::timestamp,
      '2025-12-31 00:00:00'::timestamp,
      NULL, NULL
    )
  ) AS metier
)
SELECT
  (metier->>'metier_nom')::text AS "Métier",
  (metier->>'metier_code')::text AS "Code",
  (metier->>'nb_interventions_demandees')::integer AS "Inter demandées",
  (metier->>'nb_interventions_terminees')::integer AS "Inter terminées",
  (metier->>'taux_completion')::numeric AS "Taux completion %",
  ROUND((metier->>'ca_total')::numeric, 2) AS "CA (€)",
  ROUND((metier->>'marge_total')::numeric, 2) AS "Marge (€)",
  (metier->>'taux_marge')::numeric AS "Taux marge %",
  (metier->>'pourcentage_volume')::numeric AS "% Volume"
FROM perf_data
ORDER BY (metier->>'nb_interventions_demandees')::integer DESC;

\echo ''

-- ============================================
-- TEST 5: Vérification somme pourcentages
-- ============================================

\echo ''
\echo '=================================================='
\echo '   TEST 5: Vérification somme pourcentages = 100%'
\echo '=================================================='
\echo ''

WITH perf_data AS (
  SELECT jsonb_array_elements(
    get_dashboard_performance_metiers_v3(
      '2025-01-01 00:00:00'::timestamp,
      '2025-12-31 00:00:00'::timestamp,
      NULL, NULL
    )
  ) AS metier
)
SELECT
  ROUND(SUM((metier->>'pourcentage_volume')::numeric), 2) AS "Somme % (devrait être 100.00)"
FROM perf_data;

\echo ''

-- ============================================
-- TEST 6: Comparaison volume vs détail
-- ============================================

\echo ''
\echo '=================================================='
\echo '   TEST 6: Comparaison volumes globaux'
\echo '=================================================='
\echo ''

WITH metiers_sum AS (
  SELECT
    SUM((metier->>'nb_interventions_demandees')::integer) AS total_metiers
  FROM (
    SELECT jsonb_array_elements(
      get_dashboard_performance_metiers_v3(
        '2025-01-01 00:00:00'::timestamp,
        '2025-12-31 00:00:00'::timestamp,
        NULL, NULL
      )
    ) AS metier
  ) m
),
kpi_main AS (
  SELECT (get_dashboard_kpi_main_v3(
    '2025-01-01 00:00:00'::timestamp,
    '2025-12-31 00:00:00'::timestamp,
    NULL, NULL, NULL
  )->>'nb_interventions_demandees')::integer AS total_kpi
)
SELECT
  k.total_kpi AS "Total KPI Main",
  m.total_metiers AS "Total Métiers",
  CASE
    WHEN k.total_kpi = m.total_metiers THEN '✅ Cohérent'
    ELSE '❌ Incohérent'
  END AS "Vérification"
FROM kpi_main k, metiers_sum m;

\echo ''
\echo '✅ Tests terminés'
\echo ''
