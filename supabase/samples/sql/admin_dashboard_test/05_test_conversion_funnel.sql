-- =====================================================
-- TEST: Analyse détaillée du Conversion Funnel
-- =====================================================
-- Ce fichier permet d'analyser les données du funnel
-- et de comprendre comment les interventions se répartissent
-- =====================================================

-- Définir la période de test (ajuster selon vos besoins)
-- Par défaut: dernier mois complet
\set period_start '''2025-01-01'''::timestamptz
\set period_end '''2025-12-31'''::timestamptz

-- Filtres optionnels (NULL = pas de filtre)
\set agence_id NULL
\set gestionnaire_id NULL
\set metier_id NULL

-- =====================================================
-- ÉTAPE 1: Voir toutes les transitions pendant la période
-- =====================================================
\echo '=========================================='
\echo 'ÉTAPE 1: Toutes les transitions de la période'
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
-- ÉTAPE 2: CTE status_reached (logique actuelle du funnel)
-- =====================================================
\echo ''
\echo '=========================================='
\echo 'ÉTAPE 2: CTE status_reached - Première fois que chaque intervention atteint un statut'
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

-- =========================i============================
-- ÉTAPE 3: Compter les interventions par statut atteint
-- =====================================================
\echo ''
\echo '=========================================='
\echo 'ÉTAPE 3: Nombre d''interventions ayant ATTEINT chaque statut'
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
-- ÉTAPE 4: Funnel complet avec taux de conversion
-- =====================================================
\echo ''
\echo '=========================================='
\echo 'ÉTAPE 4: Funnel complet avec taux de conversion (logique actuelle)'
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
    WHEN conversion_rate_from_previous IS NULL THEN '⚪ Entrée'
    WHEN conversion_rate_from_previous >= 85 THEN '🟢 Bon'
    WHEN conversion_rate_from_previous >= 70 THEN '🟠 Moyen'
    ELSE '🔴 Critique'
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
-- ÉTAPE 5: Analyse des "perdus" entre chaque étape
-- =====================================================
\echo ''
\echo '=========================================='
\echo 'ÉTAPE 5: Interventions perdues entre chaque étape'
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
  'DEMANDE → DEVIS_ENVOYE' as transition,
  (SELECT COUNT(*) FROM demande_ids) as count_start,
  (SELECT COUNT(*) FROM devis_ids) as count_end,
  (SELECT COUNT(*) FROM demande_ids) - (SELECT COUNT(*) FROM devis_ids) as lost,
  ROUND(((SELECT COUNT(*) FROM devis_ids)::numeric / NULLIF((SELECT COUNT(*) FROM demande_ids), 0)) * 100, 1) as conversion_rate

UNION ALL

SELECT
  'DEVIS_ENVOYE → ACCEPTE',
  (SELECT COUNT(*) FROM devis_ids),
  (SELECT COUNT(*) FROM accepte_ids),
  (SELECT COUNT(*) FROM devis_ids) - (SELECT COUNT(*) FROM accepte_ids),
  ROUND(((SELECT COUNT(*) FROM accepte_ids)::numeric / NULLIF((SELECT COUNT(*) FROM devis_ids), 0)) * 100, 1)

UNION ALL

SELECT
  'ACCEPTE → EN_COURS',
  (SELECT COUNT(*) FROM accepte_ids),
  (SELECT COUNT(*) FROM en_cours_ids),
  (SELECT COUNT(*) FROM accepte_ids) - (SELECT COUNT(*) FROM en_cours_ids),
  ROUND(((SELECT COUNT(*) FROM en_cours_ids)::numeric / NULLIF((SELECT COUNT(*) FROM accepte_ids), 0)) * 100, 1)

UNION ALL

SELECT
  'EN_COURS → TERMINE',
  (SELECT COUNT(*) FROM en_cours_ids),
  (SELECT COUNT(*) FROM termine_ids),
  (SELECT COUNT(*) FROM en_cours_ids) - (SELECT COUNT(*) FROM termine_ids),
  ROUND(((SELECT COUNT(*) FROM termine_ids)::numeric / NULLIF((SELECT COUNT(*) FROM en_cours_ids), 0)) * 100, 1);

-- =====================================================
-- ÉTAPE 6: Exemple d'interventions qui "sautent" des étapes
-- =====================================================
\echo ''
\echo '=========================================='
\echo 'ÉTAPE 6: Interventions qui ne suivent pas le parcours complet'
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
  CASE
    WHEN reached_demande THEN '✓ DEMANDE' ELSE '✗ DEMANDE'
  END as demande,
  CASE
    WHEN reached_devis THEN '✓ DEVIS' ELSE '✗ DEVIS'
  END as devis,
  CASE
    WHEN reached_accepte THEN '✓ ACCEPTE' ELSE '✗ ACCEPTE'
  END as accepte,
  CASE
    WHEN reached_en_cours THEN '✓ EN_COURS' ELSE '✗ EN_COURS'
  END as en_cours,
  CASE
    WHEN reached_termine THEN '✓ TERMINE' ELSE '✗ TERMINE'
  END as termine,
  CASE
    WHEN NOT reached_devis AND reached_accepte THEN '⚠️ Sauté DEVIS'
    WHEN NOT reached_accepte AND reached_en_cours THEN '⚠️ Sauté ACCEPTE'
    WHEN NOT reached_en_cours AND reached_termine THEN '⚠️ Sauté EN_COURS'
    WHEN reached_termine AND reached_demande AND reached_devis AND reached_accepte AND reached_en_cours THEN '✅ Parcours complet'
    ELSE '🔸 Parcours incomplet'
  END as parcours_type
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
-- ÉTAPE 7: Statut ACTUEL des interventions (comparaison)
-- =====================================================
\echo ''
\echo '=========================================='
\echo 'ÉTAPE 7: Statut ACTUEL vs Statuts ATTEINTS (comparaison)'
\echo '=========================================='

WITH interventions_periode AS (
  SELECT i.id, i.id_inter, i.statut_id, i.date
  FROM interventions i
  WHERE i.is_active = true
    AND i.date >= :period_start
    AND i.date < :period_end
    AND (:agence_id IS NULL OR i.agence_id = :agence_id)
    AND (:metier_id IS NULL OR i.metier_id = :metier_id)
    AND (:gestionnaire_id IS NULL OR i.assigned_user_id = :gestionnaire_id)
),
status_actuel AS (
  SELECT
    s.code as status_code,
    s.label as status_label,
    COUNT(ip.id) as count_actuel
  FROM interventions_periode ip
  LEFT JOIN statuses s ON s.id = ip.statut_id
  GROUP BY s.code, s.label
),
status_reached AS (
  SELECT
    DISTINCT ON (ist.intervention_id, ist.to_status_code)
    ist.intervention_id,
    ist.to_status_code
  FROM intervention_status_transitions ist
  INNER JOIN interventions_periode ip ON ip.id = ist.intervention_id
  WHERE ist.transition_date >= :period_start
    AND ist.transition_date <= :period_end
),
status_atteints AS (
  SELECT
    to_status_code as status_code,
    COUNT(DISTINCT intervention_id) as count_atteint
  FROM status_reached
  GROUP BY to_status_code
)
SELECT
  COALESCE(sa.status_code, st.status_code) as status_code,
  sa.status_label,
  COALESCE(sa.count_actuel, 0) as "📸 État actuel",
  COALESCE(st.count_atteint, 0) as "🔄 Ont atteint ce statut",
  COALESCE(st.count_atteint, 0) - COALESCE(sa.count_actuel, 0) as "Δ Différence"
FROM status_actuel sa
FULL OUTER JOIN status_atteints st ON sa.status_code = st.status_code
ORDER BY COALESCE(st.count_atteint, 0) DESC;

-- =====================================================
-- RÉSUMÉ
-- =====================================================
\echo ''
\echo '=========================================='
\echo 'RÉSUMÉ'
\echo '=========================================='
\echo 'Ce script vous permet de:'
\echo '1. Voir toutes les transitions brutes'
\echo '2. Comprendre le CTE status_reached'
\echo '3. Compter les interventions par statut'
\echo '4. Voir le funnel complet avec taux de conversion'
\echo '5. Analyser les interventions perdues entre étapes'
\echo '6. Identifier les interventions qui sautent des étapes'
\echo '7. Comparer statut ACTUEL vs statuts ATTEINTS'
\echo ''
\echo 'Pour ajuster la période ou les filtres, modifiez les variables au début du fichier.'
\echo ''