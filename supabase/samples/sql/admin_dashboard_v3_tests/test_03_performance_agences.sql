-- ============================================
-- TEST: Performance Agences V3
-- ============================================
-- Fonction testée: get_dashboard_performance_agences_v3
-- ============================================

\echo ''
\echo '=================================================='
\echo '   TEST 1: Toutes agences Janvier 2024'
\echo '=================================================='
\echo ''

SELECT jsonb_pretty(
  get_dashboard_performance_agences_v3(
    '2025-01-01 00:00:00'::timestamp,
    '2025-12-31 00:00:00'::timestamp,
    NULL, -- tous métiers
    NULL  -- tous gestionnaires
  )
) AS "🏢 Performance Agences par CA";

\echo ''

-- ============================================
-- TEST 2: Agences avec filtre métier
-- ============================================

\echo ''
\echo '=================================================='
\echo '   TEST 2: Agences filtrées par métier'
\echo '=================================================='
\echo ''

-- Afficher le métier testé
SELECT '🔧 Métier testé: ' || label AS info
FROM metiers
WHERE label IS NOT NULL
ORDER BY label
LIMIT 1;

\echo ''

SELECT jsonb_pretty(
  get_dashboard_performance_agences_v3(
    '2025-01-01 00:00:00'::timestamp,
    '2025-12-31 00:00:00'::timestamp,
    (SELECT id FROM metiers WHERE label IS NOT NULL ORDER BY label LIMIT 1),
    NULL
  )
) AS "🏢 Agences pour ce métier";

\echo ''

-- ============================================
-- TEST 3: Agences avec filtre gestionnaire
-- ============================================

\echo ''
\echo '=================================================='
\echo '   TEST 3: Agences avec filtre gestionnaire'
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
  get_dashboard_performance_agences_v3(
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
) AS "🏢 Agences pour ce gestionnaire";

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
    get_dashboard_performance_agences_v3(
      '2025-01-01 00:00:00'::timestamp,
      '2025-12-31 00:00:00'::timestamp,
      NULL, NULL
    )
  ) AS agence
)
SELECT
  (agence->>'agence_nom')::text AS "Agence",
  (agence->>'agence_ville')::text AS "Ville",
  (agence->>'nb_interventions_demandees')::integer AS "Inter demandées",
  (agence->>'nb_interventions_terminees')::integer AS "Inter terminées",
  (agence->>'taux_completion')::numeric AS "Taux completion %",
  ROUND((agence->>'ca_total')::numeric, 2) AS "CA (€)",
  ROUND((agence->>'marge_total')::numeric, 2) AS "Marge (€)",
  (agence->>'taux_marge')::numeric AS "Taux marge %",
  (agence->>'nb_gestionnaires_actifs')::integer AS "Gestionnaires"
FROM perf_data
ORDER BY (agence->>'ca_total')::numeric DESC;

\echo ''

-- ============================================
-- TEST 5: Vérification nombre gestionnaires
-- ============================================

\echo ''
\echo '=================================================='
\echo '   TEST 5: Détail gestionnaires par agence'
\echo '=================================================='
\echo ''

-- Pour la première agence, afficher les gestionnaires actifs
WITH top_agence AS (
  SELECT (jsonb_array_elements(
    get_dashboard_performance_agences_v3(
      '2025-01-01 00:00:00'::timestamp,
      '2025-12-31 00:00:00'::timestamp,
      NULL, NULL
    )
  )->>'agence_id')::uuid AS agence_id
  LIMIT 1
)
SELECT
  a.label AS "Agence",
  u.nom || ' ' || u.prenom AS "Gestionnaire",
  u.email AS "Email"
FROM top_agence ta
JOIN agencies a ON ta.agence_id = a.id
JOIN users u ON u.agence_id = a.id
JOIN user_roles ur ON u.id = ur.user_id
JOIN roles r ON ur.role_id = r.id
WHERE r.code = 'gestionnaire'
  AND u.is_active = true
ORDER BY u.nom;

\echo ''
\echo '✅ Tests terminés'
\echo ''
