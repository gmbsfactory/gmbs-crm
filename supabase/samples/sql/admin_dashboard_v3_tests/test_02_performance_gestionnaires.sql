-- ============================================
-- TEST: Performance Gestionnaires V3
-- ============================================
-- Fonction testée: get_dashboard_performance_gestionnaires_v3
-- ============================================

\echo ''
\echo '=================================================='
\echo '   TEST 1: Top 5 gestionnaires Janvier 2024'
\echo '=================================================='
\echo ''

SELECT jsonb_pretty(
  get_dashboard_performance_gestionnaires_v3(
    '2025-01-01 00:00:00'::timestamp,
    '2025-12-31 00:00:00'::timestamp,
    NULL, -- toutes agences
    NULL, -- tous métiers
    5     -- top 5
  )
) AS "👥 Top 5 Gestionnaires par CA";

\echo ''

-- ============================================
-- TEST 2: Tous gestionnaires (top 20)
-- ============================================

\echo ''
\echo '=================================================='
\echo '   TEST 2: Top 20 gestionnaires'
\echo '=================================================='
\echo ''

SELECT jsonb_pretty(
  get_dashboard_performance_gestionnaires_v3(
    '2025-01-01 00:00:00'::timestamp,
    '2025-12-31 00:00:00'::timestamp,
    NULL,
    NULL
  )
) AS "👥 Top Gestionnaires";

\echo ''

-- ============================================
-- TEST 3: Gestionnaires pour une agence spécifique
-- ============================================

\echo ''
\echo '=================================================='
\echo '   TEST 3: Gestionnaires d''une agence'
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
  get_dashboard_performance_gestionnaires_v3(
    '2025-01-01 00:00:00'::timestamp,
    '2025-12-31 00:00:00'::timestamp,
    (SELECT id FROM agencies WHERE label IS NOT NULL ORDER BY label LIMIT 1),
    NULL,
    10
  )
) AS "👥 Gestionnaires de l'agence";

\echo ''

-- ============================================
-- TEST 4: Vérification des données (format tableau)
-- ============================================

\echo ''
\echo '=================================================='
\echo '   TEST 4: Vérification données (format tableau)'
\echo '=================================================='
\echo ''

WITH perf_data AS (
  SELECT jsonb_array_elements(
    get_dashboard_performance_gestionnaires_v3(
      '2025-01-01 00:00:00'::timestamp,
      '2025-12-31 00:00:00'::timestamp,
      NULL, NULL, 10
    )
  ) AS gestionnaire
)
SELECT
  (gestionnaire->>'gestionnaire_nom')::text AS "Gestionnaire",
  (gestionnaire->>'nb_interventions_prises')::integer AS "Inter prises",
  (gestionnaire->>'nb_interventions_terminees')::integer AS "Inter terminées",
  (gestionnaire->>'taux_completion')::numeric AS "Taux completion %",
  ROUND((gestionnaire->>'ca_total')::numeric, 2) AS "CA (€)",
  ROUND((gestionnaire->>'marge_total')::numeric, 2) AS "Marge (€)",
  (gestionnaire->>'taux_marge')::numeric AS "Taux marge %"
FROM perf_data
ORDER BY (gestionnaire->>'ca_total')::numeric DESC;

\echo ''
\echo '✅ Tests terminés'
\echo ''
