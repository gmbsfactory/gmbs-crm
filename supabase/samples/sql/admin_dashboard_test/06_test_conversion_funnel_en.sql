-- =====================================================
-- TEST: Detailed Conversion Funnel Analysis
-- =====================================================
-- This file analyzes funnel data and helps understand
-- how interventions are distributed across statuses
-- =====================================================

-- Define test period (adjust as needed)
-- Default: full year
\set period_start '''2024-01-01'''::timestamptz
\set period_end '''2024-12-31'''::timestamptz

-- Optional filters (NULL = no filter)
\set agence_id NULL
\set gestionnaire_id NULL
\set metier_id NULL

-- =====================================================
-- STEP 1: All transitions during the period
-- =====================================================
\echo '=========================================='
\echo 'STEP 1: All transitions in the period'
\echo '=========================================='

SELECT
  ist.intervention_id,
  i.id_inter,
  ist.from_status_code,
  ist.to_status_code,
  ist.transition_date,
  i.agence_id,
  i.assigned_user_id as gestionnaire_id,
  i.metier_id
FROM intervention_status_transitions ist
INNER JOIN interventions i ON i.id = ist.intervention_id
WHERE ist.transition_date >= :period_start
  AND ist.transition_date <= :period_end
  AND (:agence_id IS NULL OR i.agence_id = :agence_id)
  AND (:gestionnaire_id IS NULL OR i.assigned_user_id = :gestionnaire_id)
  AND (:metier_id IS NULL OR i.metier_id = :metier_id)
ORDER BY ist.intervention_id, ist.transition_date
LIMIT 50;

-- =====================================================
-- STEP 2: CTE status_reached (current funnel logic)
-- =====================================================
\echo ''
\echo '=========================================='
\echo 'STEP 2: CTE status_reached - First time each intervention reaches a status'
\echo '=========================================='

WITH status_reached AS (
  SELECT
    DISTINCT ON (ist.intervention_id, ist.to_status_code)
    ist.intervention_id,
    i.id_inter,
    ist.to_status_code,
    MIN(ist.transition_date) OVER (
      PARTITION BY ist.intervention_id, ist.to_status_code
    ) as first_reached_at
  FROM intervention_status_transitions ist
  INNER JOIN interventions i ON i.id = ist.intervention_id
  WHERE ist.transition_date >= :period_start
    AND ist.transition_date <= :period_end
    AND (:agence_id IS NULL OR i.agence_id = :agence_id)
    AND (:gestionnaire_id IS NULL OR i.assigned_user_id = :gestionnaire_id)
    AND (:metier_id IS NULL OR i.metier_id = :metier_id)
)
SELECT *
FROM status_reached
ORDER BY intervention_id, to_status_code
LIMIT 100;

-- =====================================================
-- STEP 3: Count interventions by status reached
-- =====================================================
\echo ''
\echo '=========================================='
\echo 'STEP 3: Number of interventions that REACHED each status'
\echo '=========================================='

WITH status_reached AS (
  SELECT
    DISTINCT ON (ist.intervention_id, ist.to_status_code)
    ist.intervention_id,
    ist.to_status_code,
    MIN(ist.transition_date) OVER (
      PARTITION BY ist.intervention_id, ist.to_status_code
    ) as first_reached_at
  FROM intervention_status_transitions ist
  INNER JOIN interventions i ON i.id = ist.intervention_id
  WHERE ist.transition_date >= :period_start
    AND ist.transition_date <= :period_end
    AND (:agence_id IS NULL OR i.agence_id = :agence_id)
    AND (:gestionnaire_id IS NULL OR i.assigned_user_id = :gestionnaire_id)
    AND (:metier_id IS NULL OR i.metier_id = :metier_id)
)
SELECT
  to_status_code,
  COUNT(DISTINCT intervention_id) as nb_interventions,
  COUNT(*) as nb_total_transitions
FROM status_reached
GROUP BY to_status_code
ORDER BY nb_interventions DESC;

-- =====================================================
-- STEP 4: Complete funnel with conversion rates
-- =====================================================
\echo ''
\echo '=========================================='
\echo 'STEP 4: Complete funnel with conversion rates (CURRENT LOGIC - BROKEN!)'
\echo '=========================================='

WITH status_reached AS (
  SELECT
    DISTINCT ON (ist.intervention_id, ist.to_status_code)
    ist.intervention_id,
    ist.to_status_code,
    MIN(ist.transition_date) OVER (
      PARTITION BY ist.intervention_id, ist.to_status_code
    ) as first_reached_at
  FROM intervention_status_transitions ist
  INNER JOIN interventions i ON i.id = ist.intervention_id
  WHERE ist.transition_date >= :period_start
    AND ist.transition_date <= :period_end
    AND (:agence_id IS NULL OR i.agence_id = :agence_id)
    AND (:gestionnaire_id IS NULL OR i.assigned_user_id = :gestionnaire_id)
    AND (:metier_id IS NULL OR i.metier_id = :metier_id)
),
counts AS (
  SELECT
    'DEMANDE' as status_code,
    COUNT(*) as count,
    NULL::numeric as conversion_rate_from_previous
  FROM status_reached
  WHERE to_status_code = 'DEMANDE'

  UNION ALL

  SELECT
    'DEVIS_ENVOYE' as status_code,
    COUNT(*) as count,
    ROUND(
      COUNT(*) * 100.0 / NULLIF(
        (SELECT COUNT(*) FROM status_reached WHERE to_status_code = 'DEMANDE'),
        0
      ), 1
    ) as conversion_rate_from_previous
  FROM status_reached
  WHERE to_status_code = 'DEVIS_ENVOYE'

  UNION ALL

  SELECT
    'ACCEPTE' as status_code,
    COUNT(*) as count,
    ROUND(
      COUNT(*) * 100.0 / NULLIF(
        (SELECT COUNT(*) FROM status_reached WHERE to_status_code = 'DEVIS_ENVOYE'),
        0
      ), 1
    ) as conversion_rate_from_previous
  FROM status_reached
  WHERE to_status_code = 'ACCEPTE'

  UNION ALL

  SELECT
    'INTER_EN_COURS' as status_code,
    COUNT(*) as count,
    ROUND(
      COUNT(*) * 100.0 / NULLIF(
        (SELECT COUNT(*) FROM status_reached WHERE to_status_code = 'ACCEPTE'),
        0
      ), 1
    ) as conversion_rate_from_previous
  FROM status_reached
  WHERE to_status_code IN ('INTER_EN_COURS', 'EN_COURS')

  UNION ALL

  SELECT
    'INTER_TERMINEE' as status_code,
    COUNT(*) as count,
    ROUND(
      COUNT(*) * 100.0 / NULLIF(
        (SELECT COUNT(*) FROM status_reached WHERE to_status_code IN ('INTER_EN_COURS', 'EN_COURS')),
        0
      ), 1
    ) as conversion_rate_from_previous
  FROM status_reached
  WHERE to_status_code IN ('INTER_TERMINEE', 'TERMINE')
)
SELECT
  status_code,
  count,
  conversion_rate_from_previous,
  CASE
    WHEN conversion_rate_from_previous IS NULL THEN 'Entry point'
    WHEN conversion_rate_from_previous > 100 THEN 'ERROR: >100% (broken funnel!)'
    WHEN conversion_rate_from_previous >= 85 THEN 'Good'
    WHEN conversion_rate_from_previous >= 70 THEN 'Medium'
    ELSE 'Critical'
  END as evaluation
FROM counts
ORDER BY
  CASE status_code
    WHEN 'DEMANDE' THEN 1
    WHEN 'DEVIS_ENVOYE' THEN 2
    WHEN 'ACCEPTE' THEN 3
    WHEN 'INTER_EN_COURS' THEN 4
    WHEN 'INTER_TERMINEE' THEN 5
  END;

-- =====================================================
-- STEP 5: Lost interventions between each step
-- =====================================================
\echo ''
\echo '=========================================='
\echo 'STEP 5: Interventions lost between each step (CURRENT LOGIC - BROKEN!)'
\echo '=========================================='

WITH status_reached AS (
  SELECT
    DISTINCT ON (ist.intervention_id, ist.to_status_code)
    ist.intervention_id,
    ist.to_status_code,
    MIN(ist.transition_date) OVER (
      PARTITION BY ist.intervention_id, ist.to_status_code
    ) as first_reached_at
  FROM intervention_status_transitions ist
  INNER JOIN interventions i ON i.id = ist.intervention_id
  WHERE ist.transition_date >= :period_start
    AND ist.transition_date <= :period_end
    AND (:agence_id IS NULL OR i.agence_id = :agence_id)
    AND (:gestionnaire_id IS NULL OR i.assigned_user_id = :gestionnaire_id)
    AND (:metier_id IS NULL OR i.metier_id = :metier_id)
),
demande_ids AS (
  SELECT DISTINCT intervention_id FROM status_reached WHERE to_status_code = 'DEMANDE'
),
devis_ids AS (
  SELECT DISTINCT intervention_id FROM status_reached WHERE to_status_code = 'DEVIS_ENVOYE'
),
accepte_ids AS (
  SELECT DISTINCT intervention_id FROM status_reached WHERE to_status_code = 'ACCEPTE'
),
en_cours_ids AS (
  SELECT DISTINCT intervention_id FROM status_reached WHERE to_status_code IN ('INTER_EN_COURS', 'EN_COURS')
),
termine_ids AS (
  SELECT DISTINCT intervention_id FROM status_reached WHERE to_status_code IN ('INTER_TERMINEE', 'TERMINE')
)
SELECT
  'DEMANDE -> DEVIS_ENVOYE' as transition,
  (SELECT COUNT(*) FROM demande_ids) as count_start,
  (SELECT COUNT(*) FROM devis_ids) as count_end,
  (SELECT COUNT(*) FROM demande_ids) - (SELECT COUNT(*) FROM devis_ids) as lost,
  ROUND(((SELECT COUNT(*) FROM devis_ids)::numeric / NULLIF((SELECT COUNT(*) FROM demande_ids), 0)) * 100, 1) as conversion_rate

UNION ALL

SELECT
  'DEVIS_ENVOYE -> ACCEPTE',
  (SELECT COUNT(*) FROM devis_ids),
  (SELECT COUNT(*) FROM accepte_ids),
  (SELECT COUNT(*) FROM devis_ids) - (SELECT COUNT(*) FROM accepte_ids),
  ROUND(((SELECT COUNT(*) FROM accepte_ids)::numeric / NULLIF((SELECT COUNT(*) FROM devis_ids), 0)) * 100, 1)

UNION ALL

SELECT
  'ACCEPTE -> EN_COURS',
  (SELECT COUNT(*) FROM accepte_ids),
  (SELECT COUNT(*) FROM en_cours_ids),
  (SELECT COUNT(*) FROM accepte_ids) - (SELECT COUNT(*) FROM en_cours_ids),
  ROUND(((SELECT COUNT(*) FROM en_cours_ids)::numeric / NULLIF((SELECT COUNT(*) FROM accepte_ids), 0)) * 100, 1)

UNION ALL

SELECT
  'EN_COURS -> TERMINE',
  (SELECT COUNT(*) FROM en_cours_ids),
  (SELECT COUNT(*) FROM termine_ids),
  (SELECT COUNT(*) FROM en_cours_ids) - (SELECT COUNT(*) FROM termine_ids),
  ROUND(((SELECT COUNT(*) FROM termine_ids)::numeric / NULLIF((SELECT COUNT(*) FROM en_cours_ids), 0)) * 100, 1);

-- =====================================================
-- STEP 6: Interventions that skip steps
-- =====================================================
\echo ''
\echo '=========================================='
\echo 'STEP 6: Interventions that do not follow the complete path'
\echo '=========================================='

WITH status_reached AS (
  SELECT
    DISTINCT ON (ist.intervention_id, ist.to_status_code)
    ist.intervention_id,
    i.id_inter,
    ist.to_status_code
  FROM intervention_status_transitions ist
  INNER JOIN interventions i ON i.id = ist.intervention_id
  WHERE ist.transition_date >= :period_start
    AND ist.transition_date <= :period_end
    AND (:agence_id IS NULL OR i.agence_id = :agence_id)
    AND (:gestionnaire_id IS NULL OR i.assigned_user_id = :gestionnaire_id)
    AND (:metier_id IS NULL OR i.metier_id = :metier_id)
),
intervention_statuses AS (
  SELECT
    intervention_id,
    id_inter,
    BOOL_OR(to_status_code = 'DEMANDE') as reached_demande,
    BOOL_OR(to_status_code = 'DEVIS_ENVOYE') as reached_devis,
    BOOL_OR(to_status_code = 'ACCEPTE') as reached_accepte,
    BOOL_OR(to_status_code IN ('INTER_EN_COURS', 'EN_COURS')) as reached_en_cours,
    BOOL_OR(to_status_code IN ('INTER_TERMINEE', 'TERMINE')) as reached_termine
  FROM status_reached
  GROUP BY intervention_id, id_inter
)
SELECT
  id_inter,
  CASE WHEN reached_demande THEN 'YES DEMANDE' ELSE 'NO DEMANDE' END as demande,
  CASE WHEN reached_devis THEN 'YES DEVIS' ELSE 'NO DEVIS' END as devis,
  CASE WHEN reached_accepte THEN 'YES ACCEPTE' ELSE 'NO ACCEPTE' END as accepte,
  CASE WHEN reached_en_cours THEN 'YES EN_COURS' ELSE 'NO EN_COURS' END as en_cours,
  CASE WHEN reached_termine THEN 'YES TERMINE' ELSE 'NO TERMINE' END as termine,
  CASE
    WHEN NOT reached_devis AND reached_accepte THEN 'WARNING: Skipped DEVIS'
    WHEN NOT reached_accepte AND reached_en_cours THEN 'WARNING: Skipped ACCEPTE'
    WHEN NOT reached_en_cours AND reached_termine THEN 'WARNING: Skipped EN_COURS'
    WHEN reached_termine AND reached_demande AND reached_devis AND reached_accepte AND reached_en_cours THEN 'OK: Complete path'
    ELSE 'Incomplete path'
  END as path_type
FROM intervention_statuses
ORDER BY
  CASE
    WHEN NOT reached_devis AND reached_accepte THEN 1
    WHEN NOT reached_accepte AND reached_en_cours THEN 2
    WHEN NOT reached_en_cours AND reached_termine THEN 3
    ELSE 4
  END,
  id_inter
LIMIT 100;

-- =====================================================
-- STEP 7: CORRECTED FUNNEL - Following transition chains
-- =====================================================
\echo ''
\echo '=========================================='
\echo 'STEP 7: CORRECTED FUNNEL - Following actual transition chains'
\echo '=========================================='

WITH status_reached AS (
  SELECT
    DISTINCT ON (ist.intervention_id, ist.to_status_code)
    ist.intervention_id,
    i.id_inter,
    ist.to_status_code,
    MIN(ist.transition_date) OVER (
      PARTITION BY ist.intervention_id, ist.to_status_code
    ) as first_reached_at
  FROM intervention_status_transitions ist
  INNER JOIN interventions i ON i.id = ist.intervention_id
  WHERE ist.transition_date >= :period_start
    AND ist.transition_date <= :period_end
    AND (:agence_id IS NULL OR i.agence_id = :agence_id)
    AND (:gestionnaire_id IS NULL OR i.assigned_user_id = :gestionnaire_id)
    AND (:metier_id IS NULL OR i.metier_id = :metier_id)
),
intervention_statuses AS (
  SELECT
    intervention_id,
    id_inter,
    BOOL_OR(to_status_code = 'DEMANDE') as reached_demande,
    BOOL_OR(to_status_code = 'DEVIS_ENVOYE') as reached_devis,
    BOOL_OR(to_status_code = 'ACCEPTE') as reached_accepte,
    BOOL_OR(to_status_code IN ('INTER_EN_COURS', 'EN_COURS')) as reached_en_cours,
    BOOL_OR(to_status_code IN ('INTER_TERMINEE', 'TERMINE')) as reached_termine
  FROM status_reached
  GROUP BY intervention_id, id_inter
),
funnel_counts AS (
  SELECT
    COUNT(*) FILTER (WHERE reached_demande) as count_demande,
    COUNT(*) FILTER (WHERE reached_demande AND reached_devis) as count_demande_to_devis,
    COUNT(*) FILTER (WHERE reached_demande AND reached_devis AND reached_accepte) as count_devis_to_accepte,
    COUNT(*) FILTER (WHERE reached_demande AND reached_devis AND reached_accepte AND reached_en_cours) as count_accepte_to_en_cours,
    COUNT(*) FILTER (WHERE reached_demande AND reached_devis AND reached_accepte AND reached_en_cours AND reached_termine) as count_en_cours_to_termine
  FROM intervention_statuses
)
SELECT
  'DEMANDE' as status_code,
  count_demande as count,
  NULL::numeric as conversion_rate,
  'Entry point' as evaluation
FROM funnel_counts

UNION ALL

SELECT
  'DEVIS_ENVOYE',
  count_demande_to_devis,
  ROUND((count_demande_to_devis::numeric / NULLIF(count_demande, 0)) * 100, 1),
  CASE
    WHEN ROUND((count_demande_to_devis::numeric / NULLIF(count_demande, 0)) * 100, 1) >= 85 THEN 'Good'
    WHEN ROUND((count_demande_to_devis::numeric / NULLIF(count_demande, 0)) * 100, 1) >= 70 THEN 'Medium'
    ELSE 'Critical'
  END
FROM funnel_counts

UNION ALL

SELECT
  'ACCEPTE',
  count_devis_to_accepte,
  ROUND((count_devis_to_accepte::numeric / NULLIF(count_demande_to_devis, 0)) * 100, 1),
  CASE
    WHEN ROUND((count_devis_to_accepte::numeric / NULLIF(count_demande_to_devis, 0)) * 100, 1) >= 85 THEN 'Good'
    WHEN ROUND((count_devis_to_accepte::numeric / NULLIF(count_demande_to_devis, 0)) * 100, 1) >= 70 THEN 'Medium'
    ELSE 'Critical'
  END
FROM funnel_counts

UNION ALL

SELECT
  'EN_COURS',
  count_accepte_to_en_cours,
  ROUND((count_accepte_to_en_cours::numeric / NULLIF(count_devis_to_accepte, 0)) * 100, 1),
  CASE
    WHEN ROUND((count_accepte_to_en_cours::numeric / NULLIF(count_devis_to_accepte, 0)) * 100, 1) >= 85 THEN 'Good'
    WHEN ROUND((count_accepte_to_en_cours::numeric / NULLIF(count_devis_to_accepte, 0)) * 100, 1) >= 70 THEN 'Medium'
    ELSE 'Critical'
  END
FROM funnel_counts

UNION ALL

SELECT
  'TERMINE',
  count_en_cours_to_termine,
  ROUND((count_en_cours_to_termine::numeric / NULLIF(count_accepte_to_en_cours, 0)) * 100, 1),
  CASE
    WHEN ROUND((count_en_cours_to_termine::numeric / NULLIF(count_accepte_to_en_cours, 0)) * 100, 1) >= 85 THEN 'Good'
    WHEN ROUND((count_en_cours_to_termine::numeric / NULLIF(count_accepte_to_en_cours, 0)) * 100, 1) >= 70 THEN 'Medium'
    ELSE 'Critical'
  END
FROM funnel_counts;

-- =====================================================
-- SUMMARY
-- =====================================================
\echo ''
\echo '=========================================='
\echo 'SUMMARY'
\echo '=========================================='
\echo 'This script allows you to:'
\echo '1. See all raw transitions'
\echo '2. Understand the status_reached CTE'
\echo '3. Count interventions by status'
\echo '4. See the BROKEN funnel (current logic with >100% rates)'
\echo '5. Analyze lost interventions between steps'
\echo '6. Identify interventions that skip steps'
\echo '7. See the CORRECTED funnel following actual chains'
\echo ''
\echo 'To adjust the period or filters, modify the variables at the beginning of the file.'
\echo ''
\echo 'KEY FINDINGS:'
\echo '- STEP 4 shows the BROKEN funnel (current implementation)'
\echo '- STEP 7 shows the CORRECTED funnel (following transition chains)'
\echo '- Compare both to see the difference!'
\echo ''
