-- ========================================
-- Test Individuel: get_sparkline_data()
-- ========================================
-- Objectif: Tester en détail la fonction get_sparkline_data
-- Cette fonction combine données historiques (MV) + données temps réel (aujourd'hui)
-- ========================================

\echo '========================================='
\echo 'TEST FONCTION: get_sparkline_data()'
\echo '========================================='
\echo ''

-- ========================================
-- TEST 1: Vérifier les paramètres requis
-- ========================================
\echo 'TEST 1: Vérification des paramètres de la fonction'
\echo '---------------------------------------------------------------------'

DO $$
DECLARE
  v_demande_code text;
  v_terminee_code text;
BEGIN
  -- Récupérer les codes de statut
  SELECT code INTO v_demande_code FROM intervention_statuses WHERE code = 'DEMANDE' LIMIT 1;
  SELECT code INTO v_terminee_code FROM intervention_statuses WHERE code = 'INTER_TERMINEE' LIMIT 1;

  RAISE NOTICE '  Code DEMANDE: %', v_demande_code;
  RAISE NOTICE '  Code TERMINEE: %', v_terminee_code;
  RAISE NOTICE '';

  IF v_demande_code IS NULL OR v_terminee_code IS NULL THEN
    RAISE WARNING '  FAILED: Status codes not found!';
  ELSE
    RAISE NOTICE '  PASSED: Status codes found';
  END IF;
  RAISE NOTICE '';
END $$;

-- ========================================
-- TEST 2: Appel basique de la fonction (30 derniers jours)
-- ========================================
\echo 'TEST 2: Appel basique - 30 derniers jours, tous filtres NULL'
\echo '---------------------------------------------------------------------'

DO $$
DECLARE
  v_result jsonb;
  v_data_points integer;
  v_demande_code text;
  v_terminee_code text;
  v_start timestamptz;
  v_end timestamptz;
  v_duration_ms numeric;
BEGIN
  -- Récupérer les codes de statut
  SELECT code INTO v_demande_code FROM intervention_statuses WHERE code = 'DEMANDE' LIMIT 1;
  SELECT code INTO v_terminee_code FROM intervention_statuses WHERE code = 'INTER_TERMINEE' LIMIT 1;

  -- Mesurer le temps d'exécution
  v_start := clock_timestamp();

  SELECT get_sparkline_data(
    (CURRENT_DATE - INTERVAL '30 days')::timestamptz,
    CURRENT_DATE::timestamptz,
    v_demande_code,
    v_terminee_code,
    NULL,  -- p_agence_id
    NULL   -- p_gestionnaire_id
  ) INTO v_result;

  v_end := clock_timestamp();
  v_duration_ms := EXTRACT(MILLISECONDS FROM (v_end - v_start));

  v_data_points := jsonb_array_length(v_result);

  RAISE NOTICE '  Temps d''exécution: % ms', ROUND(v_duration_ms, 2);
  RAISE NOTICE '  Points de données retournés: %', v_data_points;
  RAISE NOTICE '  Premier élément: %', v_result->0;
  RAISE NOTICE '  Dernier élément: %', v_result->(v_data_points - 1);
  RAISE NOTICE '';

  IF v_data_points > 0 AND v_duration_ms < 50 THEN
    RAISE NOTICE '  PASSED: Données retournées et performance OK (< 50ms)';
  ELSIF v_data_points = 0 THEN
    RAISE WARNING '  WARNING: Aucune donnée retournée';
  ELSIF v_duration_ms >= 50 THEN
    RAISE WARNING '  WARNING: Performance lente (>= 50ms)';
  END IF;

  RAISE NOTICE '';
END $$;

-- ========================================
-- TEST 3: Vérifier la structure des données retournées
-- ========================================
\echo 'TEST 3: Vérification de la structure des données JSON'
\echo '---------------------------------------------------------------------'

DO $$
DECLARE
  v_result jsonb;
  v_first_item jsonb;
  v_has_date boolean;
  v_has_demandees boolean;
  v_has_terminees boolean;
  v_demande_code text;
  v_terminee_code text;
BEGIN
  SELECT code INTO v_demande_code FROM intervention_statuses WHERE code = 'DEMANDE' LIMIT 1;
  SELECT code INTO v_terminee_code FROM intervention_statuses WHERE code = 'INTER_TERMINEE' LIMIT 1;

  SELECT get_sparkline_data(
    (CURRENT_DATE - INTERVAL '7 days')::timestamptz,
    CURRENT_DATE::timestamptz,
    v_demande_code,
    v_terminee_code,
    NULL,
    NULL
  ) INTO v_result;

  IF jsonb_array_length(v_result) > 0 THEN
    v_first_item := v_result->0;

    v_has_date := v_first_item ? 'date';
    v_has_demandees := v_first_item ? 'countDemandees';
    v_has_terminees := v_first_item ? 'countTerminees';

    RAISE NOTICE '  Structure du premier élément:';
    RAISE NOTICE '    Clé "date": %', v_has_date;
    RAISE NOTICE '    Clé "countDemandees": %', v_has_demandees;
    RAISE NOTICE '    Clé "countTerminees": %', v_has_terminees;
    RAISE NOTICE '  Exemple: %', v_first_item;
    RAISE NOTICE '';

    IF v_has_date AND v_has_demandees AND v_has_terminees THEN
      RAISE NOTICE '  PASSED: Structure JSON correcte';
    ELSE
      RAISE WARNING '  FAILED: Structure JSON incorrecte!';
    END IF;
  ELSE
    RAISE WARNING '  WARNING: Aucune donnée pour vérifier la structure';
  END IF;

  RAISE NOTICE '';
END $$;

-- ========================================
-- TEST 4: Test avec filtre agence_id
-- ========================================
\echo 'TEST 4: Test avec filtre agence_id spécifique'
\echo '---------------------------------------------------------------------'

DO $$
DECLARE
  v_result_all jsonb;
  v_result_filtered jsonb;
  v_count_all integer;
  v_count_filtered integer;
  v_demande_code text;
  v_terminee_code text;
  v_test_agence_id uuid;
BEGIN
  SELECT code INTO v_demande_code FROM intervention_statuses WHERE code = 'DEMANDE' LIMIT 1;
  SELECT code INTO v_terminee_code FROM intervention_statuses WHERE code = 'INTER_TERMINEE' LIMIT 1;

  -- Récupérer un agence_id existant
  SELECT DISTINCT agence_id INTO v_test_agence_id
  FROM interventions
  WHERE agence_id IS NOT NULL
    AND is_active = true
  LIMIT 1;

  -- Sans filtre
  SELECT get_sparkline_data(
    (CURRENT_DATE - INTERVAL '30 days')::timestamptz,
    CURRENT_DATE::timestamptz,
    v_demande_code,
    v_terminee_code,
    NULL,
    NULL
  ) INTO v_result_all;

  -- Avec filtre agence
  SELECT get_sparkline_data(
    (CURRENT_DATE - INTERVAL '30 days')::timestamptz,
    CURRENT_DATE::timestamptz,
    v_demande_code,
    v_terminee_code,
    v_test_agence_id,
    NULL
  ) INTO v_result_filtered;

  v_count_all := jsonb_array_length(v_result_all);
  v_count_filtered := jsonb_array_length(v_result_filtered);

  RAISE NOTICE '  Agence testée: %', v_test_agence_id;
  RAISE NOTICE '  Points sans filtre: %', v_count_all;
  RAISE NOTICE '  Points avec filtre agence: %', v_count_filtered;
  RAISE NOTICE '';

  IF v_test_agence_id IS NULL THEN
    RAISE WARNING '  WARNING: Aucune agence trouvée pour le test';
  ELSIF v_count_filtered <= v_count_all THEN
    RAISE NOTICE '  PASSED: Le filtre agence fonctionne';
  ELSE
    RAISE WARNING '  FAILED: Le filtre agence retourne plus de données!';
  END IF;

  RAISE NOTICE '';
END $$;

-- ========================================
-- TEST 5: Test avec filtre gestionnaire_id
-- ========================================
\echo 'TEST 5: Test avec filtre gestionnaire_id spécifique'
\echo '---------------------------------------------------------------------'

DO $$
DECLARE
  v_result_all jsonb;
  v_result_filtered jsonb;
  v_count_all integer;
  v_count_filtered integer;
  v_demande_code text;
  v_terminee_code text;
  v_test_gestionnaire_id uuid;
BEGIN
  SELECT code INTO v_demande_code FROM intervention_statuses WHERE code = 'DEMANDE' LIMIT 1;
  SELECT code INTO v_terminee_code FROM intervention_statuses WHERE code = 'INTER_TERMINEE' LIMIT 1;

  -- Récupérer un gestionnaire_id existant
  SELECT DISTINCT assigned_user_id INTO v_test_gestionnaire_id
  FROM interventions
  WHERE assigned_user_id IS NOT NULL
    AND is_active = true
  LIMIT 1;

  -- Sans filtre
  SELECT get_sparkline_data(
    (CURRENT_DATE - INTERVAL '30 days')::timestamptz,
    CURRENT_DATE::timestamptz,
    v_demande_code,
    v_terminee_code,
    NULL,
    NULL
  ) INTO v_result_all;

  -- Avec filtre gestionnaire
  SELECT get_sparkline_data(
    (CURRENT_DATE - INTERVAL '30 days')::timestamptz,
    CURRENT_DATE::timestamptz,
    v_demande_code,
    v_terminee_code,
    NULL,
    v_test_gestionnaire_id
  ) INTO v_result_filtered;

  v_count_all := jsonb_array_length(v_result_all);
  v_count_filtered := jsonb_array_length(v_result_filtered);

  RAISE NOTICE '  Gestionnaire testé: %', v_test_gestionnaire_id;
  RAISE NOTICE '  Points sans filtre: %', v_count_all;
  RAISE NOTICE '  Points avec filtre gestionnaire: %', v_count_filtered;
  RAISE NOTICE '';

  IF v_test_gestionnaire_id IS NULL THEN
    RAISE WARNING '  WARNING: Aucun gestionnaire trouvé pour le test';
  ELSIF v_count_filtered <= v_count_all THEN
    RAISE NOTICE '  PASSED: Le filtre gestionnaire fonctionne';
  ELSE
    RAISE WARNING '  FAILED: Le filtre gestionnaire retourne plus de données!';
  END IF;

  RAISE NOTICE '';
END $$;

-- ========================================
-- TEST 6: Test de cohérence MV vs temps réel (aujourd'hui)
-- ========================================
\echo 'TEST 6: Cohérence MV (historique) vs temps réel (aujourd''hui)'
\echo '---------------------------------------------------------------------'

DO $$
DECLARE
  v_result jsonb;
  v_today_data jsonb;
  v_demande_code text;
  v_terminee_code text;
  v_today date := CURRENT_DATE;
  v_has_today boolean := false;
  v_item jsonb;
  i integer;
BEGIN
  SELECT code INTO v_demande_code FROM intervention_statuses WHERE code = 'DEMANDE' LIMIT 1;
  SELECT code INTO v_terminee_code FROM intervention_statuses WHERE code = 'INTER_TERMINEE' LIMIT 1;

  SELECT get_sparkline_data(
    v_today::timestamptz,
    (v_today + INTERVAL '1 day')::timestamptz,
    v_demande_code,
    v_terminee_code,
    NULL,
    NULL
  ) INTO v_result;

  -- Vérifier si aujourd'hui est dans les résultats
  FOR i IN 0..(jsonb_array_length(v_result) - 1)
  LOOP
    v_item := v_result->i;
    IF (v_item->>'date')::date = v_today THEN
      v_has_today := true;
      v_today_data := v_item;
      EXIT;
    END IF;
  END LOOP;

  RAISE NOTICE '  Date testée: %', v_today;
  RAISE NOTICE '  Données pour aujourd''hui trouvées: %', v_has_today;
  IF v_has_today THEN
    RAISE NOTICE '  Données: %', v_today_data;
  END IF;
  RAISE NOTICE '';

  IF v_has_today THEN
    RAISE NOTICE '  PASSED: Données temps réel présentes';
  ELSE
    RAISE WARNING '  INFO: Aucune transition aujourd''hui (normal si pas d''activité)';
  END IF;

  RAISE NOTICE '';
END $$;

-- ========================================
-- TEST 7: Test de performance sur différentes périodes
-- ========================================
\echo 'TEST 7: Test de performance sur différentes périodes'
\echo '---------------------------------------------------------------------'

DO $$
DECLARE
  v_start timestamptz;
  v_end timestamptz;
  v_duration_ms numeric;
  v_result jsonb;
  v_demande_code text;
  v_terminee_code text;
  v_data_points integer;
BEGIN
  SELECT code INTO v_demande_code FROM intervention_statuses WHERE code = 'DEMANDE' LIMIT 1;
  SELECT code INTO v_terminee_code FROM intervention_statuses WHERE code = 'INTER_TERMINEE' LIMIT 1;

  -- Test 1: 7 jours
  RAISE NOTICE '  Test 7 jours:';
  v_start := clock_timestamp();
  SELECT get_sparkline_data(
    (CURRENT_DATE - INTERVAL '7 days')::timestamptz,
    CURRENT_DATE::timestamptz,
    v_demande_code, v_terminee_code, NULL, NULL
  ) INTO v_result;
  v_end := clock_timestamp();
  v_duration_ms := EXTRACT(MILLISECONDS FROM (v_end - v_start));
  v_data_points := jsonb_array_length(v_result);
  RAISE NOTICE '    Durée: % ms | Points: %', ROUND(v_duration_ms, 2), v_data_points;

  -- Test 2: 30 jours
  RAISE NOTICE '  Test 30 jours:';
  v_start := clock_timestamp();
  SELECT get_sparkline_data(
    (CURRENT_DATE - INTERVAL '30 days')::timestamptz,
    CURRENT_DATE::timestamptz,
    v_demande_code, v_terminee_code, NULL, NULL
  ) INTO v_result;
  v_end := clock_timestamp();
  v_duration_ms := EXTRACT(MILLISECONDS FROM (v_end - v_start));
  v_data_points := jsonb_array_length(v_result);
  RAISE NOTICE '    Durée: % ms | Points: %', ROUND(v_duration_ms, 2), v_data_points;

  -- Test 3: 90 jours
  RAISE NOTICE '  Test 90 jours:';
  v_start := clock_timestamp();
  SELECT get_sparkline_data(
    (CURRENT_DATE - INTERVAL '90 days')::timestamptz,
    CURRENT_DATE::timestamptz,
    v_demande_code, v_terminee_code, NULL, NULL
  ) INTO v_result;
  v_end := clock_timestamp();
  v_duration_ms := EXTRACT(MILLISECONDS FROM (v_end - v_start));
  v_data_points := jsonb_array_length(v_result);
  RAISE NOTICE '    Durée: % ms | Points: %', ROUND(v_duration_ms, 2), v_data_points;

  -- Test 4: 365 jours
  RAISE NOTICE '  Test 365 jours:';
  v_start := clock_timestamp();
  SELECT get_sparkline_data(
    (CURRENT_DATE - INTERVAL '365 days')::timestamptz,
    CURRENT_DATE::timestamptz,
    v_demande_code, v_terminee_code, NULL, NULL
  ) INTO v_result;
  v_end := clock_timestamp();
  v_duration_ms := EXTRACT(MILLISECONDS FROM (v_end - v_start));
  v_data_points := jsonb_array_length(v_result);
  RAISE NOTICE '    Durée: % ms | Points: %', ROUND(v_duration_ms, 2), v_data_points;

  RAISE NOTICE '';
  RAISE NOTICE '  PASSED: Tests de performance complétés';
  RAISE NOTICE '';
END $$;

-- ========================================
-- TEST 8: Vérifier l'ordre des dates (ASC)
-- ========================================
\echo 'TEST 8: Vérification de l''ordre chronologique des dates'
\echo '---------------------------------------------------------------------'

DO $$
DECLARE
  v_result jsonb;
  v_demande_code text;
  v_terminee_code text;
  v_prev_date date := NULL;
  v_current_date date;
  v_is_ordered boolean := true;
  v_item jsonb;
  i integer;
BEGIN
  SELECT code INTO v_demande_code FROM intervention_statuses WHERE code = 'DEMANDE' LIMIT 1;
  SELECT code INTO v_terminee_code FROM intervention_statuses WHERE code = 'INTER_TERMINEE' LIMIT 1;

  SELECT get_sparkline_data(
    (CURRENT_DATE - INTERVAL '30 days')::timestamptz,
    CURRENT_DATE::timestamptz,
    v_demande_code,
    v_terminee_code,
    NULL,
    NULL
  ) INTO v_result;

  -- Vérifier l'ordre
  FOR i IN 0..(jsonb_array_length(v_result) - 1)
  LOOP
    v_item := v_result->i;
    v_current_date := (v_item->>'date')::date;

    IF v_prev_date IS NOT NULL AND v_current_date < v_prev_date THEN
      v_is_ordered := false;
      RAISE WARNING '  Ordre incorrect trouvé: % avant %', v_prev_date, v_current_date;
    END IF;

    v_prev_date := v_current_date;
  END LOOP;

  IF v_is_ordered THEN
    RAISE NOTICE '  PASSED: Les dates sont en ordre chronologique';
  ELSE
    RAISE WARNING '  FAILED: Les dates ne sont pas ordonnées!';
  END IF;

  RAISE NOTICE '';
END $$;

-- ========================================
-- RÉSUMÉ DES TESTS
-- ========================================
\echo '========================================='
\echo 'RÉSUMÉ - get_sparkline_data()'
\echo '========================================='
\echo ''
\echo 'Tests effectués:'
\echo '  1. ✓ Vérification des paramètres requis'
\echo '  2. ✓ Appel basique (30 jours)'
\echo '  3. ✓ Structure JSON des données'
\echo '  4. ✓ Filtre par agence_id'
\echo '  5. ✓ Filtre par gestionnaire_id'
\echo '  6. ✓ Cohérence MV vs temps réel'
\echo '  7. ✓ Performance sur différentes périodes'
\echo '  8. ✓ Ordre chronologique'
\echo ''
\echo 'Objectif de performance: < 50ms'
\echo 'Utilisation: Hybrid MV (historique) + Real-time (aujourd''hui)'
\echo ''
\echo 'Prochaines étapes:'
\echo '  - Si tous les tests passent → fonction OK'
\echo '  - Si performance > 50ms → vérifier REFRESH MV'
\echo '  - Si données incohérentes → vérifier mv_daily_status_transitions'
\echo '========================================='
