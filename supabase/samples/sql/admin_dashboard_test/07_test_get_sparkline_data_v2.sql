-- ========================================
-- SCRIPT ÉTAPE PAR ÉTAPE: Analyse get_sparkline_data()
-- ========================================
-- Objectif: Comprendre comment les données sparkline sont récupérées
-- Ce script décompose la fonction en étapes pour voir les résultats intermédiaires
-- ========================================

-- ========================================
-- ÉTAPE 0: Configuration des paramètres
-- ========================================
-- Vous pouvez modifier ces valeurs pour tester différentes périodes
\echo '========================================='
\echo 'ÉTAPE 0: Configuration des paramètres'
\echo '========================================='

DO $$
DECLARE
  v_period_start date := CURRENT_DATE - INTERVAL '7 days';  -- Modifier ici pour changer la période
  v_period_end date := CURRENT_DATE;
  v_today date := CURRENT_DATE;
  v_demande_code text := 'DEMANDE';
  v_terminee_code text := 'INTER_TERMINEE';
  v_agence_id uuid := NULL;  -- Mettre un UUID spécifique pour filtrer par agence
  v_gestionnaire_id uuid := NULL;  -- Mettre un UUID spécifique pour filtrer par gestionnaire
BEGIN
  RAISE NOTICE '📅 Date début période: %', v_period_start;
  RAISE NOTICE '📅 Date fin période: %', v_period_end;
  RAISE NOTICE '📅 Date aujourd''hui: %', v_today;
  RAISE NOTICE '📋 Code DEMANDE: %', v_demande_code;
  RAISE NOTICE '📋 Code TERMINEE: %', v_terminee_code;
  RAISE NOTICE '🏢 Agence ID: %', COALESCE(v_agence_id::text, 'NULL (toutes)');
  RAISE NOTICE '👤 Gestionnaire ID: %', COALESCE(v_gestionnaire_id::text, 'NULL (tous)');
  RAISE NOTICE '';
END $$;

-- ========================================
-- ÉTAPE 1: Génération de la série temporelle
-- ========================================
-- Cette étape génère tous les jours de la période
\echo '========================================='
\echo 'ÉTAPE 1: Série temporelle (tous les jours)'
\echo '========================================='

SELECT 
  date,
  TO_CHAR(date, 'DD/MM/YYYY') as date_formatee,
  EXTRACT(DOW FROM date) as jour_semaine  -- 0=dimanche, 1=lundi, etc.
FROM (
  SELECT generate_series(
    (CURRENT_DATE - INTERVAL '7 days')::date,
    CURRENT_DATE::date,
    interval '1 day'
  )::date as date
) time_series
ORDER BY date;

\echo '';
\echo '✅ Cette série contient tous les jours de la période, même sans données';
\echo '';

-- ========================================
-- ÉTAPE 2: Données historiques (Vue Matérialisée)
-- ========================================
-- Données depuis la vue matérialisée (hier et avant)
\echo '========================================='
\echo 'ÉTAPE 2: Données historiques (MV)'
\echo '========================================='
\echo 'Source: mv_daily_status_transitions'
\echo 'Période: du début jusqu''à hier (excluant aujourd''hui)'
\echo '';

SELECT 
  transition_date as date,
  TO_CHAR(transition_date, 'DD/MM/YYYY') as date_formatee,
  SUM(CASE WHEN to_status_code = 'DEMANDE' THEN nb_transitions ELSE 0 END)::integer as count_demandees,
  SUM(CASE WHEN to_status_code = 'INTER_TERMINEE' THEN nb_transitions ELSE 0 END)::integer as count_terminees,
  COUNT(*) as nb_lignes_mv  -- Nombre de lignes dans la MV pour cette date
FROM public.mv_daily_status_transitions
WHERE transition_date >= (CURRENT_DATE - INTERVAL '7 days')::date
  AND transition_date < CURRENT_DATE  -- Exclut aujourd'hui
  AND (NULL IS NULL OR agence_id = NULL)  -- Modifier si filtre agence
  AND (NULL IS NULL OR gestionnaire_id = NULL)  -- Modifier si filtre gestionnaire
GROUP BY transition_date
ORDER BY transition_date;

\echo '';
\echo '✅ Ces données proviennent de la vue matérialisée (rapide, mais pas à jour pour aujourd''hui)';
\echo '';

-- ========================================
-- ÉTAPE 3: Données temps réel (Aujourd'hui)
-- ========================================
-- Données calculées en temps réel pour aujourd'hui
\echo '========================================='
\echo 'ÉTAPE 3: Données temps réel (Aujourd''hui)'
\echo '========================================='
\echo 'Source: intervention_status_transitions (temps réel)'
\echo 'Période: uniquement aujourd''hui'
\echo '';

SELECT 
  CURRENT_DATE as date,
  TO_CHAR(CURRENT_DATE, 'DD/MM/YYYY') as date_formatee,
  COUNT(DISTINCT CASE WHEN ist.to_status_code = 'DEMANDE' THEN ist.intervention_id END)::integer as count_demandees,
  COUNT(DISTINCT CASE WHEN ist.to_status_code = 'INTER_TERMINEE' THEN ist.intervention_id END)::integer as count_terminees,
  COUNT(*) as nb_transitions_aujourdhui
FROM public.intervention_status_transitions ist
INNER JOIN public.interventions i ON i.id = ist.intervention_id
WHERE date_trunc('day', ist.transition_date) = CURRENT_DATE
  AND i.is_active = true
  AND (NULL IS NULL OR i.agence_id = NULL)  -- Modifier si filtre agence
  AND (NULL IS NULL OR i.assigned_user_id = NULL);  -- Modifier si filtre gestionnaire

\echo '';
\echo '✅ Ces données sont calculées en temps réel depuis la table (à jour pour aujourd''hui)';
\echo '';

-- ========================================
-- ÉTAPE 4: Combinaison historique + temps réel
-- ========================================
-- Union des données historiques et d'aujourd'hui
\echo '========================================='
\echo 'ÉTAPE 4: Combinaison historique + temps réel'
\echo '========================================='

WITH historical AS (
  SELECT
    transition_date as date,
    SUM(CASE WHEN to_status_code = 'DEMANDE' THEN nb_transitions ELSE 0 END)::integer as count_demandees,
    SUM(CASE WHEN to_status_code = 'INTER_TERMINEE' THEN nb_transitions ELSE 0 END)::integer as count_terminees,
    'MV' as source
  FROM public.mv_daily_status_transitions
  WHERE transition_date >= (CURRENT_DATE - INTERVAL '7 days')::date
    AND transition_date < CURRENT_DATE
    AND (NULL IS NULL OR agence_id = NULL)
    AND (NULL IS NULL OR gestionnaire_id = NULL)
  GROUP BY transition_date
),
realtime_today AS (
  SELECT
    CURRENT_DATE as date,
    COUNT(DISTINCT CASE WHEN ist.to_status_code = 'DEMANDE' THEN ist.intervention_id END)::integer as count_demandees,
    COUNT(DISTINCT CASE WHEN ist.to_status_code = 'INTER_TERMINEE' THEN ist.intervention_id END)::integer as count_terminees,
    'REALTIME' as source
  FROM public.intervention_status_transitions ist
  INNER JOIN public.interventions i ON i.id = ist.intervention_id
  WHERE date_trunc('day', ist.transition_date) = CURRENT_DATE
    AND i.is_active = true
    AND (NULL IS NULL OR i.agence_id = NULL)
    AND (NULL IS NULL OR i.assigned_user_id = NULL)
),
combined_counts AS (
  SELECT * FROM historical
  UNION ALL
  SELECT * FROM realtime_today WHERE date <= CURRENT_DATE
)
SELECT 
  date,
  TO_CHAR(date, 'DD/MM/YYYY') as date_formatee,
  count_demandees,
  count_terminees,
  source
FROM combined_counts
ORDER BY date;

\echo '';
\echo '✅ Données combinées: historique (MV) + aujourd''hui (temps réel)';
\echo '';

-- ========================================
-- ÉTAPE 5: Données financières (CA et Marge)
-- ========================================
-- Calcul du chiffre d'affaires et de la marge par jour
\echo '========================================='
\echo 'ÉTAPE 5: Données financières (CA et Marge)'
\echo '========================================='
\echo 'Source: intervention_status_transitions + intervention_costs'
\echo 'Date utilisée: date de transition vers INTER_TERMINEE'
\echo '';

SELECT
  date_trunc('day', ist.transition_date)::date as date,
  TO_CHAR(date_trunc('day', ist.transition_date)::date, 'DD/MM/YYYY') as date_formatee,
  COUNT(DISTINCT ist.intervention_id) as nb_interventions_terminees,
  COALESCE(SUM(CASE WHEN ic.cost_type = 'intervention' THEN ic.amount ELSE 0 END), 0)::numeric as chiffre_affaires,
  COALESCE(SUM(CASE WHEN ic.cost_type IN ('sst', 'materiel') THEN ic.amount ELSE 0 END), 0)::numeric as couts,
  COALESCE(SUM(CASE WHEN ic.cost_type = 'intervention' THEN ic.amount ELSE 0 END), 0)::numeric 
    - COALESCE(SUM(CASE WHEN ic.cost_type IN ('sst', 'materiel') THEN ic.amount ELSE 0 END), 0)::numeric as marge
FROM public.intervention_status_transitions ist
INNER JOIN public.interventions i ON i.id = ist.intervention_id
LEFT JOIN public.intervention_costs ic ON ic.intervention_id = ist.intervention_id
WHERE ist.to_status_code = 'INTER_TERMINEE'
  AND ist.transition_date >= (CURRENT_DATE - INTERVAL '7 days')::timestamptz
  AND ist.transition_date <= CURRENT_DATE::timestamptz + INTERVAL '1 day' - INTERVAL '1 second'
  AND i.is_active = true
  AND (NULL IS NULL OR i.agence_id = NULL)
  AND (NULL IS NULL OR i.assigned_user_id = NULL)
GROUP BY date_trunc('day', ist.transition_date)::date
ORDER BY date;

\echo '';
\echo '✅ Données financières basées sur la date de transition vers INTER_TERMINEE';
\echo '';

-- ========================================
-- ÉTAPE 6: Combinaison finale (série + compteurs + financier)
-- ========================================
-- Jointure de la série temporelle avec toutes les données
\echo '========================================='
\echo 'ÉTAPE 6: Combinaison finale'
\echo '========================================='
\echo 'Série temporelle + compteurs + données financières'
\echo '';

WITH time_series AS (
  SELECT generate_series(
    (CURRENT_DATE - INTERVAL '7 days')::date,
    CURRENT_DATE::date,
    interval '1 day'
  )::date as date
),
historical AS (
  SELECT
    transition_date as date,
    SUM(CASE WHEN to_status_code = 'DEMANDE' THEN nb_transitions ELSE 0 END)::integer as count_demandees,
    SUM(CASE WHEN to_status_code = 'INTER_TERMINEE' THEN nb_transitions ELSE 0 END)::integer as count_terminees
  FROM public.mv_daily_status_transitions
  WHERE transition_date >= (CURRENT_DATE - INTERVAL '7 days')::date
    AND transition_date < CURRENT_DATE
    AND (NULL IS NULL OR agence_id = NULL)
    AND (NULL IS NULL OR gestionnaire_id = NULL)
  GROUP BY transition_date
),
realtime_today AS (
  SELECT
    CURRENT_DATE as date,
    COUNT(DISTINCT CASE WHEN ist.to_status_code = 'DEMANDE' THEN ist.intervention_id END)::integer as count_demandees,
    COUNT(DISTINCT CASE WHEN ist.to_status_code = 'INTER_TERMINEE' THEN ist.intervention_id END)::integer as count_terminees
  FROM public.intervention_status_transitions ist
  INNER JOIN public.interventions i ON i.id = ist.intervention_id
  WHERE date_trunc('day', ist.transition_date) = CURRENT_DATE
    AND i.is_active = true
    AND (NULL IS NULL OR i.agence_id = NULL)
    AND (NULL IS NULL OR i.assigned_user_id = NULL)
),
combined_counts AS (
  SELECT * FROM historical
  UNION ALL
  SELECT * FROM realtime_today WHERE date <= CURRENT_DATE
),
financial_data AS (
  SELECT
    date_trunc('day', ist.transition_date)::date as date,
    COALESCE(SUM(CASE WHEN ic.cost_type = 'intervention' THEN ic.amount ELSE 0 END), 0)::numeric as chiffre_affaires,
    COALESCE(SUM(CASE WHEN ic.cost_type = 'intervention' THEN ic.amount ELSE 0 END), 0)::numeric 
      - COALESCE(SUM(CASE WHEN ic.cost_type IN ('sst', 'materiel') THEN ic.amount ELSE 0 END), 0)::numeric as marge
  FROM public.intervention_status_transitions ist
  INNER JOIN public.interventions i ON i.id = ist.intervention_id
  LEFT JOIN public.intervention_costs ic ON ic.intervention_id = ist.intervention_id
  WHERE ist.to_status_code = 'INTER_TERMINEE'
    AND ist.transition_date >= (CURRENT_DATE - INTERVAL '7 days')::timestamptz
    AND ist.transition_date <= CURRENT_DATE::timestamptz + INTERVAL '1 day' - INTERVAL '1 second'
    AND i.is_active = true
    AND (NULL IS NULL OR i.agence_id = NULL)
    AND (NULL IS NULL OR i.assigned_user_id = NULL)
  GROUP BY date_trunc('day', ist.transition_date)::date
),
combined AS (
  SELECT
    ts.date,
    COALESCE(cc.count_demandees, 0)::integer as count_demandees,
    COALESCE(cc.count_terminees, 0)::integer as count_terminees,
    COALESCE(fd.chiffre_affaires, 0)::numeric as chiffre_affaires,
    COALESCE(fd.marge, 0)::numeric as marge
  FROM time_series ts
  LEFT JOIN combined_counts cc ON ts.date = cc.date
  LEFT JOIN financial_data fd ON ts.date = fd.date
)
SELECT 
  date,
  TO_CHAR(date, 'DD/MM/YYYY') as date_formatee,
  count_demandees,
  count_terminees,
  ROUND(chiffre_affaires::numeric, 2) as chiffre_affaires,
  ROUND(marge::numeric, 2) as marge
FROM combined
WHERE date >= (CURRENT_DATE - INTERVAL '7 days')::date 
  AND date <= CURRENT_DATE
ORDER BY date;

\echo '';
\echo '✅ Résultat final: tous les jours de la période avec leurs valeurs';
\echo '';

-- ========================================
-- ÉTAPE 7: Résultat JSON (comme la fonction)
-- ========================================
-- Format final JSON identique à celui retourné par get_sparkline_data()
\echo '========================================='
\echo 'ÉTAPE 7: Résultat JSON final'
\echo '========================================='
\echo 'Format identique à get_sparkline_data()'
\echo '';

WITH time_series AS (
  SELECT generate_series(
    (CURRENT_DATE - INTERVAL '7 days')::date,
    CURRENT_DATE::date,
    interval '1 day'
  )::date as date
),
historical AS (
  SELECT
    transition_date as date,
    SUM(CASE WHEN to_status_code = 'DEMANDE' THEN nb_transitions ELSE 0 END)::integer as count_demandees,
    SUM(CASE WHEN to_status_code = 'INTER_TERMINEE' THEN nb_transitions ELSE 0 END)::integer as count_terminees
  FROM public.mv_daily_status_transitions
  WHERE transition_date >= (CURRENT_DATE - INTERVAL '7 days')::date
    AND transition_date < CURRENT_DATE
    AND (NULL IS NULL OR agence_id = NULL)
    AND (NULL IS NULL OR gestionnaire_id = NULL)
  GROUP BY transition_date
),
realtime_today AS (
  SELECT
    CURRENT_DATE as date,
    COUNT(DISTINCT CASE WHEN ist.to_status_code = 'DEMANDE' THEN ist.intervention_id END)::integer as count_demandees,
    COUNT(DISTINCT CASE WHEN ist.to_status_code = 'INTER_TERMINEE' THEN ist.intervention_id END)::integer as count_terminees
  FROM public.intervention_status_transitions ist
  INNER JOIN public.interventions i ON i.id = ist.intervention_id
  WHERE date_trunc('day', ist.transition_date) = CURRENT_DATE
    AND i.is_active = true
    AND (NULL IS NULL OR i.agence_id = NULL)
    AND (NULL IS NULL OR i.assigned_user_id = NULL)
),
combined_counts AS (
  SELECT * FROM historical
  UNION ALL
  SELECT * FROM realtime_today WHERE date <= CURRENT_DATE
),
financial_data AS (
  SELECT
    date_trunc('day', ist.transition_date)::date as date,
    COALESCE(SUM(CASE WHEN ic.cost_type = 'intervention' THEN ic.amount ELSE 0 END), 0)::numeric as chiffre_affaires,
    COALESCE(SUM(CASE WHEN ic.cost_type = 'intervention' THEN ic.amount ELSE 0 END), 0)::numeric 
      - COALESCE(SUM(CASE WHEN ic.cost_type IN ('sst', 'materiel') THEN ic.amount ELSE 0 END), 0)::numeric as marge
  FROM public.intervention_status_transitions ist
  INNER JOIN public.interventions i ON i.id = ist.intervention_id
  LEFT JOIN public.intervention_costs ic ON ic.intervention_id = ist.intervention_id
  WHERE ist.to_status_code = 'INTER_TERMINEE'
    AND ist.transition_date >= (CURRENT_DATE - INTERVAL '7 days')::timestamptz
    AND ist.transition_date <= CURRENT_DATE::timestamptz + INTERVAL '1 day' - INTERVAL '1 second'
    AND i.is_active = true
    AND (NULL IS NULL OR i.agence_id = NULL)
    AND (NULL IS NULL OR i.assigned_user_id = NULL)
  GROUP BY date_trunc('day', ist.transition_date)::date
),
combined AS (
  SELECT
    ts.date,
    COALESCE(cc.count_demandees, 0)::integer as count_demandees,
    COALESCE(cc.count_terminees, 0)::integer as count_terminees,
    COALESCE(fd.chiffre_affaires, 0)::numeric as chiffre_affaires,
    COALESCE(fd.marge, 0)::numeric as marge
  FROM time_series ts
  LEFT JOIN combined_counts cc ON ts.date = cc.date
  LEFT JOIN financial_data fd ON ts.date = fd.date
)
SELECT jsonb_pretty(jsonb_agg(
  jsonb_build_object(
    'date', c.date,
    'countDemandees', c.count_demandees,
    'countTerminees', c.count_terminees,
    'chiffreAffaires', c.chiffre_affaires,
    'marge', c.marge
  ) ORDER BY c.date
)) as sparkline_data_json
FROM combined c
WHERE c.date >= (CURRENT_DATE - INTERVAL '7 days')::date 
  AND c.date <= CURRENT_DATE;

\echo '';
\echo '✅ Format JSON final identique à get_sparkline_data()';
\echo '';

-- ========================================
-- ÉTAPE 8: Comparaison avec la fonction réelle
-- ========================================
-- Appel de la fonction pour comparer
\echo '========================================='
\echo 'ÉTAPE 8: Comparaison avec la fonction réelle'
\echo '========================================='

DO $$
DECLARE
  v_result jsonb;
  v_data_points integer;
BEGIN
  SELECT get_sparkline_data(
    (CURRENT_DATE - INTERVAL '7 days')::timestamptz,
    CURRENT_DATE::timestamptz,
    'DEMANDE',
    'INTER_TERMINEE',
    NULL,
    NULL
  ) INTO v_result;

  v_data_points := jsonb_array_length(v_result);

  RAISE NOTICE 'Nombre de points de données: %', v_data_points;
  RAISE NOTICE 'Premier élément: %', v_result->0;
  RAISE NOTICE 'Dernier élément: %', v_result->(v_data_points - 1);
  RAISE NOTICE '';
  RAISE NOTICE 'Résultat complet (prettified):';
  RAISE NOTICE '%', jsonb_pretty(v_result);
END $$;

\echo '';
\echo '✅ Comparaison terminée';
\echo '';

-- ========================================
-- RÉSUMÉ
-- ========================================
\echo '========================================='
\echo 'RÉSUMÉ'
\echo '========================================='
\echo '1. Série temporelle: génère tous les jours de la période'
\echo '2. Données historiques: depuis mv_daily_status_transitions (hier et avant)'
\echo '3. Données temps réel: depuis intervention_status_transitions (aujourd''hui)'
\echo '4. Données financières: basées sur la date de transition vers INTER_TERMINEE'
\echo '5. Combinaison: série temporelle + compteurs + financier'
\echo '6. Format JSON: résultat final pour le frontend'
\echo ''
\echo 'Dates importantes:'
\echo '  - transition_date: date de changement de statut (utilisée pour historique et financier)'
\echo '  - CURRENT_DATE: date du jour (utilisée pour temps réel)'
\echo '  - p_period_start / p_period_end: période demandée par l''utilisateur'
\echo '========================================='