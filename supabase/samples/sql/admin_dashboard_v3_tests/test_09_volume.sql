-- ============================================
-- TEST: Volume by Status V3
-- ============================================
-- Fonction testée: get_dashboard_volume_by_status_v3
-- Description: Test de la fonction qui retourne les données quotidiennes
--              de volumétrie par statut pour le Stacked Bar Chart
-- ============================================

\echo ''
\echo '=================================================='
\echo '   TEST: VOLUME BY STATUS V3'
\echo '=================================================='
\echo ''

-- ============================================
-- TEST 1: Données volume par statut - Période complète
-- ============================================

\echo ''
\echo '=================================================='
\echo '   TEST 1: Volume par statut - Année 2025'
\echo '=================================================='
\echo ''

SELECT jsonb_pretty(
  get_dashboard_volume_by_status_v3(
    '2025-01-01 00:00:00'::timestamp,
    '2025-12-31 23:59:59'::timestamp,
    NULL, -- toutes agences
    NULL, -- tous métiers
    NULL  -- tous gestionnaires
  )
) AS "📊 Volume par Statut (premiers jours)";

\echo ''
\echo 'Note: Les données sont retournées par jour avec le décompte'
\echo '      pour chaque statut (demande, devis_envoye, accepte, en_cours, termine)'
\echo ''

-- ============================================
-- TEST 2: Période courte (7 jours)
-- ============================================

\echo ''
\echo '=================================================='
\echo '   TEST 2: Volume par statut - 7 jours'
\echo '=================================================='
\echo ''

SELECT jsonb_pretty(
  get_dashboard_volume_by_status_v3(
    '2025-01-01 00:00:00'::timestamp,
    '2025-01-07 23:59:59'::timestamp,
    NULL, NULL, NULL
  )
) AS "📊 Volume par Statut (7 jours)";

\echo ''

-- ============================================
-- TEST 3: Format tableau pour vérification
-- ============================================

\echo ''
\echo '=================================================='
\echo '   TEST 3: Vérification données (format tableau)'
\echo '=================================================='
\echo ''

WITH volume_data AS (
  SELECT jsonb_array_elements(
    get_dashboard_volume_by_status_v3(
      '2025-01-01 00:00:00'::timestamp,
      '2025-01-31 23:59:59'::timestamp,
      NULL, NULL, NULL
    )
  ) AS jour
)
SELECT
  (jour->>'date')::date AS "Date",
  (jour->>'demande')::integer AS "Demandé",
  (jour->>'devis_envoye')::integer AS "Devis Envoyé",
  (jour->>'accepte')::integer AS "Accepté",
  (jour->>'en_cours')::integer AS "En Cours",
  (jour->>'termine')::integer AS "Terminé",
  (
    (jour->>'demande')::integer +
    (jour->>'devis_envoye')::integer +
    (jour->>'accepte')::integer +
    (jour->>'en_cours')::integer +
    (jour->>'termine')::integer
  ) AS "Total"
FROM volume_data
ORDER BY (jour->>'date')::date
LIMIT 10; -- Afficher seulement premiers 10 jours

\echo ''
\echo 'Note: Seuls les 10 premiers jours sont affichés'
\echo ''

-- ============================================
-- TEST 4: Vérification série continue de dates
-- ============================================

\echo ''
\echo '=================================================='
\echo '   TEST 4: Vérification continuité dates'
\echo '=================================================='
\echo ''

WITH volume_data AS (
  SELECT jsonb_array_elements(
    get_dashboard_volume_by_status_v3(
      '2025-01-01 00:00:00'::timestamp,
      '2025-01-15 23:59:59'::timestamp,
      NULL, NULL, NULL
    )
  ) AS jour
),
dates_extraites AS (
  SELECT
    (jour->>'date')::date AS date_jour,
    ROW_NUMBER() OVER (ORDER BY (jour->>'date')::date) AS row_num
  FROM volume_data
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
-- TEST 5: Vérification cohérence totaux
-- ============================================

\echo ''
\echo '=================================================='
\echo '   TEST 5: Cohérence totaux volume vs KPI'
\echo '=================================================='
\echo ''

WITH volume_sum AS (
  SELECT
    SUM((jour->>'demande')::integer) AS total_demande,
    SUM((jour->>'devis_envoye')::integer) AS total_devis_envoye,
    SUM((jour->>'accepte')::integer) AS total_accepte,
    SUM((jour->>'en_cours')::integer) AS total_en_cours,
    SUM((jour->>'termine')::integer) AS total_termine
  FROM (
    SELECT jsonb_array_elements(
      get_dashboard_volume_by_status_v3(
        '2025-01-01 00:00:00'::timestamp,
        '2025-12-31 23:59:59'::timestamp,
        NULL, NULL, NULL
      )
    ) AS jour
  ) v
),
kpi_main AS (
  SELECT
    (get_dashboard_kpi_main_v3(
      '2025-01-01 00:00:00'::timestamp,
      '2025-12-31 23:59:59'::timestamp,
      NULL, NULL, NULL
    )->>'nb_interventions_demandees')::integer AS total_kpi_demandees,
    (get_dashboard_kpi_main_v3(
      '2025-01-01 00:00:00'::timestamp,
      '2025-12-31 23:59:59'::timestamp,
      NULL, NULL, NULL
    )->>'nb_interventions_terminees')::integer AS total_kpi_terminees
)
SELECT
  k.total_kpi_demandees AS "KPI Demandées",
  v.total_demande AS "Volume Demandé",
  CASE
    WHEN k.total_kpi_demandees = v.total_demande THEN '✅'
    ELSE '❌'
  END AS "Cohérence demandées",
  k.total_kpi_terminees AS "KPI Terminées",
  v.total_termine AS "Volume Terminé",
  CASE
    WHEN k.total_kpi_terminees = v.total_termine THEN '✅'
    ELSE '❌'
  END AS "Cohérence terminées"
FROM kpi_main k, volume_sum v;

\echo ''

-- ============================================
-- TEST 6: Vérification structure des données
-- ============================================

\echo ''
\echo '=================================================='
\echo '   TEST 6: Vérification structure JSON'
\echo '=================================================='
\echo ''

WITH volume_data AS (
  SELECT jsonb_array_elements(
    get_dashboard_volume_by_status_v3(
      '2025-01-01 00:00:00'::timestamp,
      '2025-01-05 23:59:59'::timestamp,
      NULL, NULL, NULL
    )
  ) AS jour
)
SELECT
  CASE
    WHEN jour ? 'date' THEN '✅'
    ELSE '❌'
  END AS "Champ 'date'",
  CASE
    WHEN jour ? 'demande' THEN '✅'
    ELSE '❌'
  END AS "Champ 'demande'",
  CASE
    WHEN jour ? 'devis_envoye' THEN '✅'
    ELSE '❌'
  END AS "Champ 'devis_envoye'",
  CASE
    WHEN jour ? 'accepte' THEN '✅'
    ELSE '❌'
  END AS "Champ 'accepte'",
  CASE
    WHEN jour ? 'en_cours' THEN '✅'
    ELSE '❌'
  END AS "Champ 'en_cours'",
  CASE
    WHEN jour ? 'termine' THEN '✅'
    ELSE '❌'
  END AS "Champ 'termine'"
FROM volume_data
LIMIT 1;

\echo ''

-- ============================================
-- TEST 7: Avec filtre agence
-- ============================================

\echo ''
\echo '=================================================='
\echo '   TEST 7: Volume par statut - Filtre agence'
\echo '=================================================='
\echo ''

-- Afficher l'agence testée
SELECT '🏢 Agence testée: ' || label AS info
FROM agencies
WHERE label IS NOT NULL
ORDER BY label
LIMIT 1;

\echo ''

WITH volume_data AS (
  SELECT jsonb_array_elements(
    get_dashboard_volume_by_status_v3(
      '2025-01-01 00:00:00'::timestamp,
      '2025-01-31 23:59:59'::timestamp,
      (SELECT id FROM agencies WHERE label IS NOT NULL ORDER BY label LIMIT 1),
      NULL,
      NULL
    )
  ) AS jour
)
SELECT
  (jour->>'date')::date AS "Date",
  (jour->>'demande')::integer AS "Demandé",
  (jour->>'termine')::integer AS "Terminé",
  (
    (jour->>'demande')::integer +
    (jour->>'devis_envoye')::integer +
    (jour->>'accepte')::integer +
    (jour->>'en_cours')::integer +
    (jour->>'termine')::integer
  ) AS "Total"
FROM volume_data
ORDER BY (jour->>'date')::date
LIMIT 5;

\echo ''

-- ============================================
-- TEST 8: Vérification jours sans données
-- ============================================

\echo ''
\echo '=================================================='
\echo '   TEST 8: Vérification jours sans données'
\echo '=================================================='
\echo ''

WITH volume_data AS (
  SELECT jsonb_array_elements(
    get_dashboard_volume_by_status_v3(
      '2025-01-01 00:00:00'::timestamp,
      '2025-01-10 23:59:59'::timestamp,
      NULL, NULL, NULL
    )
  ) AS jour
)
SELECT
  (jour->>'date')::date AS "Date",
  CASE
    WHEN (
      (jour->>'demande')::integer +
      (jour->>'devis_envoye')::integer +
      (jour->>'accepte')::integer +
      (jour->>'en_cours')::integer +
      (jour->>'termine')::integer
    ) = 0 THEN '⚠️ Aucune donnée'
    ELSE '✅ Données présentes'
  END AS "État",
  (
    (jour->>'demande')::integer +
    (jour->>'devis_envoye')::integer +
    (jour->>'accepte')::integer +
    (jour->>'en_cours')::integer +
    (jour->>'termine')::integer
  ) AS "Total"
FROM volume_data
ORDER BY (jour->>'date')::date;

\echo ''
\echo 'Note: Les jours sans données doivent retourner 0 pour tous les statuts'
\echo ''

-- ============================================
-- TEST 9: Comparaison avec status breakdown
-- ============================================

\echo ''
\echo '=================================================='
\echo '   TEST 9: Comparaison avec status breakdown'
\echo '=================================================='
\echo ''

WITH volume_sum AS (
  SELECT
    SUM((jour->>'demande')::integer) AS total_demande,
    SUM((jour->>'devis_envoye')::integer) AS total_devis_envoye,
    SUM((jour->>'accepte')::integer) AS total_accepte,
    SUM((jour->>'en_cours')::integer) AS total_en_cours,
    SUM((jour->>'termine')::integer) AS total_termine
  FROM (
    SELECT jsonb_array_elements(
      get_dashboard_volume_by_status_v3(
        '2025-01-01 00:00:00'::timestamp,
        '2025-12-31 23:59:59'::timestamp,
        NULL, NULL, NULL
      )
    ) AS jour
  ) v
),
status_breakdown AS (
  SELECT jsonb_array_elements(
    get_dashboard_status_breakdown_v3(
      '2025-01-01 00:00:00'::timestamp,
      '2025-12-31 23:59:59'::timestamp,
      NULL, NULL, NULL
    )
  ) AS data
)
SELECT
  'VOLUME BY STATUS' as source,
  'DEMANDE' as status_code,
  v.total_demande as count
FROM volume_sum v
UNION ALL
SELECT
  'VOLUME BY STATUS' as source,
  'DEVIS_ENVOYE' as status_code,
  v.total_devis_envoye as count
FROM volume_sum v
UNION ALL
SELECT
  'VOLUME BY STATUS' as source,
  'ACCEPTE' as status_code,
  v.total_accepte as count
FROM volume_sum v
UNION ALL
SELECT
  'VOLUME BY STATUS' as source,
  'INTER_EN_COURS' as status_code,
  v.total_en_cours as count
FROM volume_sum v
UNION ALL
SELECT
  'VOLUME BY STATUS' as source,
  'INTER_TERMINEE' as status_code,
  v.total_termine as count
FROM volume_sum v
UNION ALL
SELECT
  'STATUS BREAKDOWN' as source,
  (data->>'status_code') as status_code,
  (data->>'count')::integer as count
FROM status_breakdown
WHERE (data->>'status_code') IN ('DEMANDE', 'DEVIS_ENVOYE', 'ACCEPTE', 'INTER_EN_COURS', 'INTER_TERMINEE')
ORDER BY status_code, source;

\echo ''
\echo 'Note: Les totaux doivent être cohérents entre les deux fonctions'
\echo '      (Volume by Status = somme quotidienne, Status Breakdown = état actuel)'
\echo ''

\echo ''
\echo '=================================================='
\echo '✅ Tests terminés'
\echo '=================================================='
\echo ''

