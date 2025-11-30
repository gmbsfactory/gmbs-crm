-- ============================================
-- TEST: Cycles Moyens V3
-- ============================================
-- Fonction testée: get_dashboard_cycles_moyens_v3
-- ============================================
-- Tests de la logique de calcul des cycles moyens:
-- - Cycle total: DEMANDE -> INTER_TERMINEE (plus vieille DEMANDE, plus récente INTER_TERMINEE)
-- - Cycle demande -> prise: DEMANDE -> ACCEPTE
-- - Cycle prise -> terminée: ACCEPTE -> INTER_TERMINEE
-- ============================================

\echo ''
\echo '=================================================='
\echo '   TEST 1: Cycles moyens - Période complète'
\echo '=================================================='
\echo ''

SELECT jsonb_pretty(
  get_dashboard_cycles_moyens_v3(
    '2025-01-01 00:00:00'::timestamp,
    '2025-12-31 23:59:59'::timestamp,
    NULL, -- toutes agences
    NULL, -- tous métiers
    NULL  -- tous gestionnaires
  )
) AS "⏱️ Cycles Moyens - Année 2025";

\echo ''
\echo 'Résultats attendus:'
\echo '- cycle_moyen_total_jours: durée moyenne DEMANDE -> INTER_TERMINEE'
\echo '- cycle_demande_prise_jours: durée moyenne DEMANDE -> ACCEPTE'
\echo '- cycle_prise_terminee_jours: durée moyenne ACCEPTE -> INTER_TERMINEE'
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
    '2025-12-31 23:59:59'::timestamp,
    ARRAY[(SELECT id FROM agencies WHERE label IS NOT NULL ORDER BY label LIMIT 1)],
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
    '2025-12-31 23:59:59'::timestamp,
    NULL,
    ARRAY[(SELECT id FROM metiers WHERE label IS NOT NULL ORDER BY label LIMIT 1)],
    NULL
  )
) AS "⏱️ Cycles Moyens (métier)";

\echo ''

-- ============================================
-- TEST 4: Vérification détaillée des calculs
-- ============================================

\echo ''
\echo '=================================================='
\echo '   TEST 4: Vérification détaillée des calculs'
\echo '=================================================='
\echo ''

WITH interventions_periode AS (
  SELECT i.id
  FROM interventions i
  WHERE i.date >= '2025-01-01'::timestamp
    AND i.date <= '2025-12-31'::timestamp
    AND i.is_active = true
),
interventions_terminees AS (
  SELECT ip.id
  FROM interventions_periode ip
  JOIN interventions i ON ip.id = i.id
  JOIN intervention_statuses ist ON i.statut_id = ist.id
  WHERE ist.code = 'INTER_TERMINEE'
),
dates_transitions AS (
  SELECT
    it.id AS intervention_id,
    MIN(CASE WHEN ist.to_status_code = 'DEMANDE' THEN ist.transition_date END) AS date_demande,
    MAX(CASE WHEN ist.to_status_code = 'INTER_TERMINEE' THEN ist.transition_date END) AS date_terminee,
    MIN(CASE WHEN ist.to_status_code = 'ACCEPTE' THEN ist.transition_date END) AS date_accepte
  FROM interventions_terminees it
  JOIN intervention_status_transitions ist ON it.id = ist.intervention_id
  GROUP BY it.id
),
cycles_calcules AS (
  SELECT
    intervention_id,
    CASE
      WHEN date_demande IS NOT NULL AND date_terminee IS NOT NULL
      THEN EXTRACT(EPOCH FROM (date_terminee - date_demande)) / 86400.0
      ELSE NULL
    END AS cycle_total_jours,
    CASE
      WHEN date_demande IS NOT NULL AND date_accepte IS NOT NULL
      THEN EXTRACT(EPOCH FROM (date_accepte - date_demande)) / 86400.0
      ELSE NULL
    END AS cycle_demande_prise_jours,
    CASE
      WHEN date_accepte IS NOT NULL AND date_terminee IS NOT NULL
      THEN EXTRACT(EPOCH FROM (date_terminee - date_accepte)) / 86400.0
      ELSE NULL
    END AS cycle_prise_terminee_jours
  FROM dates_transitions
)
SELECT
  COUNT(*) AS "Nombre interventions terminées",
  COUNT(cycle_total_jours) AS "Avec cycle total calculable",
  COUNT(cycle_demande_prise_jours) AS "Avec cycle demande->prise calculable",
  COUNT(cycle_prise_terminee_jours) AS "Avec cycle prise->terminée calculable",
  ROUND(AVG(cycle_total_jours), 2) AS "Cycle moyen total (jours)",
  ROUND(AVG(cycle_demande_prise_jours), 2) AS "Cycle moyen demande->prise (jours)",
  ROUND(AVG(cycle_prise_terminee_jours), 2) AS "Cycle moyen prise->terminée (jours)",
  ROUND(MIN(cycle_total_jours), 2) AS "Cycle min (jours)",
  ROUND(MAX(cycle_total_jours), 2) AS "Cycle max (jours)"
FROM cycles_calcules;

\echo ''

-- ============================================
-- TEST 5: Exemples d'interventions avec cycles
-- ============================================

\echo ''
\echo '=================================================='
\echo '   TEST 5: Exemples d''interventions (top 10)'
\echo '=================================================='
\echo ''

WITH interventions_periode AS (
  SELECT i.id, i.numero_sst
  FROM interventions i
  WHERE i.date >= '2025-01-01'::timestamp
    AND i.date <= '2025-12-31'::timestamp
    AND i.is_active = true
),
interventions_terminees AS (
  SELECT ip.id, ip.numero_sst
  FROM interventions_periode ip
  JOIN interventions i ON ip.id = i.id
  JOIN intervention_statuses ist ON i.statut_id = ist.id
  WHERE ist.code = 'INTER_TERMINEE'
),
dates_transitions AS (
  SELECT
    it.id,
    it.numero_sst,
    MIN(CASE WHEN ist.to_status_code = 'DEMANDE' THEN ist.transition_date END) AS date_demande,
    MAX(CASE WHEN ist.to_status_code = 'INTER_TERMINEE' THEN ist.transition_date END) AS date_terminee
  FROM interventions_terminees it
  JOIN intervention_status_transitions ist ON it.id = ist.intervention_id
  GROUP BY it.id, it.numero_sst
)
SELECT
  numero_sst AS "Intervention",
  date_demande AS "Date DEMANDE",
  date_terminee AS "Date INTER_TERMINEE",
  ROUND(EXTRACT(EPOCH FROM (date_terminee - date_demande)) / 86400.0, 2) AS "Cycle (jours)"
FROM dates_transitions
WHERE date_demande IS NOT NULL AND date_terminee IS NOT NULL
ORDER BY date_terminee DESC
LIMIT 10;

\echo ''
\echo '✅ Tests terminés'
\echo ''
