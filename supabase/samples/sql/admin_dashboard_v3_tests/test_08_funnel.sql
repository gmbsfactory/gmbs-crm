-- ============================================
-- TEST: Conversion Funnel V3
-- ============================================
-- Description: Test de la fonction get_dashboard_conversion_funnel_v3
-- Date: 2025-11-30
-- ============================================

\echo ''
\echo '============================================'
\echo 'TEST: CONVERSION FUNNEL V3'
\echo '============================================'
\echo ''

-- ============================================
-- TEST 1: Funnel complet (toute la période)
-- ============================================

\echo '🔄 TEST 1: Funnel de conversion complet'
\echo '--------------------------------------------'

SELECT jsonb_pretty(
  get_dashboard_conversion_funnel_v3(
    '2025-10-01T00:00:00'::timestamp,
    '2025-10-30T23:59:59'::timestamp,
    NULL::uuid[],  -- ou simplement NULL
    NULL::uuid[],
    NULL::uuid[]
  )
) AS funnel_complet;

\echo ''
\echo 'Explication du funnel:'
\echo '  - DEMANDE: Toutes les interventions créées dans la période'
\echo '  - DEVIS_ENVOYE: Interventions ayant atteint au moins ce statut'
\echo '  - ACCEPTE: Interventions ayant atteint au moins ce statut'
\echo '  - INTER_EN_COURS: Interventions ayant atteint au moins ce statut'
\echo '  - INTER_TERMINEE: Interventions terminées'
\echo ''
\echo 'Note: C\'est un funnel CUMULATIF (progression)'
\echo ''

-- ============================================
-- TEST 2: Status Breakdown (pour comparaison)
-- ============================================

\echo '📋 TEST 2: Status Breakdown (état actuel)'
\echo '--------------------------------------------'

SELECT jsonb_pretty(
  get_dashboard_status_breakdown_v3(
    '2025-11-01T00:00:00'::timestamp,
    '2025-11-30T23:59:59'::timestamp,
    NULL::uuid,  -- p_agence_id
    NULL::uuid,  -- p_metier_id
    NULL::uuid   -- p_gestionnaire_id
  )
) AS status_actuel;

\echo ''
\echo 'Note: Montre le statut ACTUEL des interventions'
\echo ''

-- ============================================
-- TEST 3: Comparaison Funnel vs Status
-- ============================================

\echo '🔍 TEST 3: Comparaison Funnel vs Status'
\echo '--------------------------------------------'

WITH funnel AS (
  SELECT jsonb_array_elements(
    get_dashboard_conversion_funnel_v3(
      '2025-11-01T00:00:00'::timestamp,
      '2025-11-30T23:59:59'::timestamp,
      NULL, NULL, NULL
    )
  ) AS data
),
breakdown AS (
  SELECT jsonb_array_elements(
    get_dashboard_status_breakdown_v3(
      '2025-11-01T00:00:00'::timestamp,
      '2025-11-30T23:59:59'::timestamp,
      NULL, NULL, NULL
    )
  ) AS data
)
SELECT
  'FUNNEL (progression)' as source,
  (data->>'status_code') as status_code,
  (data->>'count')::integer as count
FROM funnel
UNION ALL
SELECT
  'STATUS (état actuel)' as source,
  (data->>'status_code') as status_code,
  (data->>'count')::integer as count
FROM breakdown
ORDER BY status_code, source;

\echo ''
\echo '============================================'
\echo 'DIFFÉRENCE FUNNEL vs STATUS:'
\echo '--------------------------------------------'
\echo 'FUNNEL:'
\echo '  Montre combien d\'interventions ont ATTEINT'
\echo '  chaque étape (progression maximale)'
\echo ''
\echo 'STATUS:'
\echo '  Montre combien d\'interventions SONT'
\echo '  actuellement à chaque étape'
\echo '============================================'
\echo ''

-- ============================================
-- TEST 4: Calcul du taux de conversion
-- ============================================

\echo '📊 TEST 4: Taux de conversion par étape'
\echo '--------------------------------------------'

WITH funnel_data AS (
  SELECT jsonb_array_elements(
    get_dashboard_conversion_funnel_v3(
      '2025-11-01T00:00:00'::timestamp,
      '2025-11-30T23:59:59'::timestamp,
      NULL, NULL, NULL
    )
  ) AS data
),
funnel_parsed AS (
  SELECT
    (data->>'status_code') as status_code,
    (data->>'count')::integer as count
  FROM funnel_data
)
SELECT
  status_code,
  count as nb_interventions,
  CASE
    WHEN LAG(count) OVER (ORDER BY
      CASE status_code
        WHEN 'DEMANDE' THEN 1
        WHEN 'DEVIS_ENVOYE' THEN 2
        WHEN 'ACCEPTE' THEN 3
        WHEN 'INTER_EN_COURS' THEN 4
        WHEN 'INTER_TERMINEE' THEN 5
      END
    ) IS NOT NULL
    THEN ROUND(
      (count::numeric / LAG(count) OVER (ORDER BY
        CASE status_code
          WHEN 'DEMANDE' THEN 1
          WHEN 'DEVIS_ENVOYE' THEN 2
          WHEN 'ACCEPTE' THEN 3
          WHEN 'INTER_EN_COURS' THEN 4
          WHEN 'INTER_TERMINEE' THEN 5
        END
      )::numeric) * 100,
      2
    )
    ELSE NULL
  END as taux_conversion_pct
FROM funnel_parsed
ORDER BY
  CASE status_code
    WHEN 'DEMANDE' THEN 1
    WHEN 'DEVIS_ENVOYE' THEN 2
    WHEN 'ACCEPTE' THEN 3
    WHEN 'INTER_EN_COURS' THEN 4
    WHEN 'INTER_TERMINEE' THEN 5
  END;

\echo ''
\echo '============================================'
\echo 'FIN DES TESTS'
\echo '============================================'