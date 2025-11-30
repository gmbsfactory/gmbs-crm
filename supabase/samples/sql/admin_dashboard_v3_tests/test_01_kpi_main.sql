-- ============================================
-- TEST: KPIs Principaux Dashboard Admin V3
-- ============================================
-- Fonction testée: get_dashboard_kpi_main_v3
-- ============================================

\echo ''
\echo '=================================================='
\echo '   TEST 1: KPIs Janvier 2024 (toutes agences)'
\echo '=================================================='
\echo ''

SELECT jsonb_pretty(
  get_dashboard_kpi_main_v3(
    '2025-01-01 00:00:00'::timestamp,
    '2026-01-31 23:59:59'::timestamp,
    NULL, -- agence_id
    NULL, -- gestionnaire_id
    NULL  -- metier_id
  )
) AS "📊 KPIs Janvier 2024";

\echo ''
\echo 'Résultats attendus:'
\echo '- nb_interventions_demandees: nombre total créées en janvier'
\echo '- nb_interventions_terminees: nombre avec statut INTER_TERMINEE'
\echo '- taux_transformation: (terminées / demandées) × 100'
\echo '- ca_total: somme paiements reçus (interventions terminées)'
\echo '- couts_total: intervention - (sst + materiel)'
\echo '- marge_total: ca_total - couts_total'
\echo '- taux_marge: (marge / ca) × 100'
\echo ''

-- ============================================
-- TEST 2: Période avec filtres spécifiques
-- ============================================

\echo ''
\echo '=================================================='
\echo '   TEST 2: KPIs avec filtre agence'
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
  get_dashboard_kpi_main_v3(
    '2025-01-01 00:00:00'::timestamp,
    '2025-12-31 00:00:00'::timestamp,
    (SELECT id FROM agencies WHERE label IS NOT NULL ORDER BY label LIMIT 1),
    NULL,
    NULL
  )
) AS "📊 KPIs Janvier 2024 (avec filtre agence)";

\echo ''

-- ============================================
-- TEST 3: Comparaison périodes
-- ============================================

\echo ''
\echo '=================================================='
\echo '   TEST 3: Comparaison Janvier vs Décembre 2023'
\echo '=================================================='
\echo ''

WITH janvier AS (
  SELECT get_dashboard_kpi_main_v3(
    '2025-01-01 00:00:00'::timestamp,
    '2025-12-31 00:00:00'::timestamp,
    NULL, NULL, NULL
  ) AS data
),
decembre AS (
  SELECT get_dashboard_kpi_main_v3(
    '2023-12-01 00:00:00'::timestamp,
    '2023-12-31 23:59:59'::timestamp,
    NULL, NULL, NULL
  ) AS data
)
SELECT jsonb_pretty(
  jsonb_build_object(
    'janvier_2024', (SELECT data FROM janvier),
    'decembre_2023', (SELECT data FROM decembre),
    'evolution', jsonb_build_object(
      'interventions_diff',
        ((SELECT data->'nb_interventions_demandees' FROM janvier)::numeric -
         (SELECT data->'nb_interventions_demandees' FROM decembre)::numeric),
      'ca_diff',
        ((SELECT data->'ca_total' FROM janvier)::numeric -
         (SELECT data->'ca_total' FROM decembre)::numeric),
      'marge_diff',
        ((SELECT data->'marge_total' FROM janvier)::numeric -
         (SELECT data->'marge_total' FROM decembre)::numeric)
    )
  )
) AS "📈 Comparaison Janvier vs Décembre";

\echo ''

-- ============================================
-- TEST 4: Vérification formule coûts
-- ============================================

\echo ''
\echo '=================================================='
\echo '   TEST 4: Vérification formule coûts'
\echo '   (intervention - sst - materiel)'
\echo '=================================================='
\echo ''

-- Afficher détail des coûts pour une intervention terminée
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
  COALESCE(SUM(CASE WHEN ic.cost_type = 'intervention' THEN ic.amount ELSE 0 END), 0) AS "Coût intervention",
  COALESCE(SUM(CASE WHEN ic.cost_type = 'sst' THEN ic.amount ELSE 0 END), 0) AS "Coût SST",
  COALESCE(SUM(CASE WHEN ic.cost_type = 'materiel' THEN ic.amount ELSE 0 END), 0) AS "Coût matériel",
  COALESCE(
    SUM(CASE WHEN ic.cost_type = 'intervention' THEN ic.amount ELSE 0 END)
    - SUM(CASE WHEN ic.cost_type = 'sst' THEN ic.amount ELSE 0 END)
    - SUM(CASE WHEN ic.cost_type = 'materiel' THEN ic.amount ELSE 0 END),
    0
  ) AS "Coût réel (formule)"
FROM sample_intervention si
LEFT JOIN intervention_costs ic ON si.id = ic.intervention_id;

\echo ''
\echo '✅ Tests terminés'
\echo ''
