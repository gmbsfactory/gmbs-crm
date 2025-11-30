-- ============================================
-- TEST: Cycles Moyens V3
-- ============================================
-- Fonction testée: get_dashboard_cycles_moyens_v3
-- ============================================
-- Note: Cette fonction est actuellement un placeholder
--       Les tests réels seront implémentés avec la logique
--       détaillée des cycles par statut
-- ============================================

\echo ''
\echo '=================================================='
\echo '   TEST 1: Cycles moyens Janvier 2024'
\echo '=================================================='
\echo ''

SELECT jsonb_pretty(
  get_dashboard_cycles_moyens_v3(
    '2025-01-01 00:00:00'::timestamp,
    '2025-12-31 00:00:00'::timestamp,
    NULL, -- toutes agences
    NULL, -- tous métiers
    NULL  -- tous gestionnaires
  )
) AS "⏱️ Cycles Moyens";

\echo ''

-- ============================================
-- TEST 2: Cycles avec filtre agence
-- ============================================

\echo ''
\echo '=================================================='
\echo '   TEST 2: Cycles moyens par agence'
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
  get_dashboard_cycles_moyens_v3(
    '2025-01-01 00:00:00'::timestamp,
    '2025-12-31 00:00:00'::timestamp,
    (SELECT id FROM agencies WHERE label IS NOT NULL ORDER BY label LIMIT 1),
    NULL,
    NULL
  )
) AS "⏱️ Cycles Moyens (agence)";

\echo ''

-- ============================================
-- TEST 3: Cycles avec filtre métier
-- ============================================

\echo ''
\echo '=================================================='
\echo '   TEST 3: Cycles moyens par métier'
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
  get_dashboard_cycles_moyens_v3(
    '2025-01-01 00:00:00'::timestamp,
    '2025-12-31 00:00:00'::timestamp,
    NULL,
    (SELECT id FROM metiers WHERE label IS NOT NULL ORDER BY label LIMIT 1),
    NULL
  )
) AS "⏱️ Cycles Moyens (métier)";

\echo ''

-- ============================================
-- TEST 4: Exploration table transitions (TODO)
-- ============================================

\echo ''
\echo '=================================================='
\echo '   TEST 4: Exploration transitions pour cycles'
\echo '   (base pour implémentation future)'
\echo '=================================================='
\echo ''

-- Afficher exemple de transitions pour une intervention terminée
WITH sample_intervention AS (
  SELECT i.id, i.numero_sst
  FROM interventions i
  JOIN intervention_statuses ist ON i.statut_id = ist.id
  WHERE ist.code = 'INTER_TERMINEE'
    AND i.date >= '2024-01-01'
    AND i.date <= '2024-01-31'
    AND i.is_active = true
  LIMIT 1
)
SELECT
  si.numero_sst AS "Intervention",
  ist.code AS "Statut",
  ist.label AS "Libellé",
  itr.transitioned_at AS "Date transition",
  EXTRACT(EPOCH FROM (
    LEAD(itr.transitioned_at) OVER (ORDER BY itr.transitioned_at) - itr.transitioned_at
  )) / 3600 AS "Durée dans statut (heures)"
FROM sample_intervention si
JOIN intervention_status_transitions itr ON si.id = itr.intervention_id
JOIN intervention_statuses ist ON itr.to_status_id = ist.id
ORDER BY itr.transitioned_at;

\echo ''

-- ============================================
-- TEST 5: Statistiques transitions globales
-- ============================================

\echo ''
\echo '=================================================='
\echo '   TEST 5: Statistiques transitions période'
\echo '=================================================='
\echo ''

WITH interventions_periode AS (
  SELECT i.id
  FROM interventions i
  WHERE i.date >= '2024-01-01'
    AND i.date <= '2024-01-31'
    AND i.is_active = true
)
SELECT
  ist.code AS "Statut",
  COUNT(*) AS "Nombre transitions",
  COUNT(DISTINCT itr.intervention_id) AS "Interventions concernées"
FROM intervention_status_transitions itr
JOIN intervention_statuses ist ON itr.to_status_id = ist.id
JOIN interventions_periode ip ON itr.intervention_id = ip.id
GROUP BY ist.code, ist.label
ORDER BY COUNT(*) DESC;

\echo ''
\echo '⚠️  Fonction placeholder - Tests complets à implémenter'
\echo '✅ Tests structurels terminés'
\echo ''
