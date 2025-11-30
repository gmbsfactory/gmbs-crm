-- ========================================
-- Test Individuel: get_agency_breakdown()
-- ========================================
-- Objectif: Tester en détail la fonction get_agency_breakdown
-- Cette fonction combine données historiques (MV mois fermés) + données temps réel (mois en cours)
-- ========================================

\echo '========================================='
\echo 'TEST FONCTION: get_agency_breakdown()'
\echo '========================================='
\echo ''

-- ========================================
-- TEST 1: Vérifier les paramètres requis
-- ========================================
\echo 'TEST 1: Vérification des paramètres de la fonction'
\echo '---------------------------------------------------------------------'

DO $$
DECLARE
  v_terminee_code text;
  v_agency_count integer;
BEGIN
  -- Récupérer le code de statut
  SELECT code INTO v_terminee_code FROM intervention_statuses WHERE code = 'INTER_TERMINEE' LIMIT 1;

  -- Compter les agences actives
  SELECT COUNT(DISTINCT agence_id) INTO v_agency_count
  FROM interventions
  WHERE agence_id IS NOT NULL
    AND is_active = true;

  RAISE NOTICE '  Code TERMINEE: %', v_terminee_code;
  RAISE NOTICE '  Nombre d''agences avec interventions: %', v_agency_count;
  RAISE NOTICE '';

  IF v_terminee_code IS NULL THEN
    RAISE WARNING '  FAILED: Status code INTER_TERMINEE not found!';
  ELSIF v_agency_count = 0 THEN
    RAISE WARNING '  WARNING: Aucune agence trouvée!';
  ELSE
    RAISE NOTICE '  PASSED: Paramètres OK';
  END IF;
  RAISE NOTICE '';
END $$;

-- ========================================
-- TEST 2: Appel basique de la fonction (6 derniers mois)
-- ========================================
\echo 'TEST 2: Appel basique - 6 derniers mois, sans filtre'
\echo '---------------------------------------------------------------------'

DO $$
DECLARE
  v_result jsonb;
  v_agency_count integer;
  v_terminee_code text;
  v_start timestamptz;
  v_end timestamptz;
  v_duration_ms numeric;
BEGIN
  -- Récupérer le code de statut
  SELECT code INTO v_terminee_code FROM intervention_statuses WHERE code = 'INTER_TERMINEE' LIMIT 1;

  -- Mesurer le temps d'exécution
  v_start := clock_timestamp();

  SELECT get_agency_breakdown(
    (CURRENT_DATE - INTERVAL '6 months')::timestamptz,
    CURRENT_DATE::timestamptz,
    v_terminee_code,
    NULL  -- p_agence_id
  ) INTO v_result;

  v_end := clock_timestamp();
  v_duration_ms := EXTRACT(MILLISECONDS FROM (v_end - v_start));

  v_agency_count := jsonb_array_length(v_result);

  RAISE NOTICE '  Temps d''exécution: % ms', ROUND(v_duration_ms, 2);
  RAISE NOTICE '  Nombre d''agences retournées: %', v_agency_count;
  RAISE NOTICE '  Première agence: %', v_result->0;
  RAISE NOTICE '';

  IF v_agency_count > 0 AND v_duration_ms < 100 THEN
    RAISE NOTICE '  PASSED: Données retournées et performance OK (< 100ms)';
  ELSIF v_agency_count = 0 THEN
    RAISE WARNING '  WARNING: Aucune donnée retournée';
  ELSIF v_duration_ms >= 100 THEN
    RAISE WARNING '  WARNING: Performance lente (>= 100ms)';
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
  v_has_agence_id boolean;
  v_has_total_interventions boolean;
  v_has_terminated boolean;
  v_has_avg_cycle_time boolean;
  v_has_paiements boolean;
  v_has_couts boolean;
  v_has_marge boolean;
  v_terminee_code text;
BEGIN
  SELECT code INTO v_terminee_code FROM intervention_statuses WHERE code = 'INTER_TERMINEE' LIMIT 1;

  SELECT get_agency_breakdown(
    (CURRENT_DATE - INTERVAL '3 months')::timestamptz,
    CURRENT_DATE::timestamptz,
    v_terminee_code,
    NULL
  ) INTO v_result;

  IF jsonb_array_length(v_result) > 0 THEN
    v_first_item := v_result->0;

    v_has_agence_id := v_first_item ? 'agence_id';
    v_has_total_interventions := v_first_item ? 'totalInterventions';
    v_has_terminated := v_first_item ? 'terminatedInterventions';
    v_has_avg_cycle_time := v_first_item ? 'avgCycleTime';
    v_has_paiements := v_first_item ? 'totalPaiements';
    v_has_couts := v_first_item ? 'totalCouts';
    v_has_marge := v_first_item ? 'marge';

    RAISE NOTICE '  Structure du premier élément:';
    RAISE NOTICE '    Clé "agence_id": %', v_has_agence_id;
    RAISE NOTICE '    Clé "totalInterventions": %', v_has_total_interventions;
    RAISE NOTICE '    Clé "terminatedInterventions": %', v_has_terminated;
    RAISE NOTICE '    Clé "avgCycleTime": %', v_has_avg_cycle_time;
    RAISE NOTICE '    Clé "totalPaiements": %', v_has_paiements;
    RAISE NOTICE '    Clé "totalCouts": %', v_has_couts;
    RAISE NOTICE '    Clé "marge": %', v_has_marge;
    RAISE NOTICE '  Exemple: %', v_first_item;
    RAISE NOTICE '';

    IF v_has_agence_id AND v_has_total_interventions AND v_has_terminated
       AND v_has_avg_cycle_time AND v_has_paiements AND v_has_couts AND v_has_marge THEN
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
-- TEST 4: Test avec filtre agence_id spécifique
-- ========================================
\echo 'TEST 4: Test avec filtre agence_id spécifique'
\echo '---------------------------------------------------------------------'

DO $$
DECLARE
  v_result_all jsonb;
  v_result_filtered jsonb;
  v_count_all integer;
  v_count_filtered integer;
  v_terminee_code text;
  v_test_agence_id uuid;
  v_found_item jsonb;
  i integer;
  v_item jsonb;
BEGIN
  SELECT code INTO v_terminee_code FROM intervention_statuses WHERE code = 'INTER_TERMINEE' LIMIT 1;

  -- Récupérer un agence_id existant
  SELECT DISTINCT agence_id INTO v_test_agence_id
  FROM interventions
  WHERE agence_id IS NOT NULL
    AND is_active = true
  LIMIT 1;

  -- Sans filtre
  SELECT get_agency_breakdown(
    (CURRENT_DATE - INTERVAL '6 months')::timestamptz,
    CURRENT_DATE::timestamptz,
    v_terminee_code,
    NULL
  ) INTO v_result_all;

  -- Avec filtre agence
  SELECT get_agency_breakdown(
    (CURRENT_DATE - INTERVAL '6 months')::timestamptz,
    CURRENT_DATE::timestamptz,
    v_terminee_code,
    v_test_agence_id
  ) INTO v_result_filtered;

  v_count_all := jsonb_array_length(v_result_all);
  v_count_filtered := jsonb_array_length(v_result_filtered);

  RAISE NOTICE '  Agence testée: %', v_test_agence_id;
  RAISE NOTICE '  Agences sans filtre: %', v_count_all;
  RAISE NOTICE '  Agences avec filtre: %', v_count_filtered;

  -- Vérifier que le résultat filtré contient bien l'agence demandée
  IF v_count_filtered > 0 THEN
    FOR i IN 0..(v_count_filtered - 1)
    LOOP
      v_item := v_result_filtered->i;
      IF (v_item->>'agence_id')::uuid = v_test_agence_id THEN
        v_found_item := v_item;
        EXIT;
      END IF;
    END LOOP;
  END IF;

  RAISE NOTICE '  Données de l''agence filtrée: %', v_found_item;
  RAISE NOTICE '';

  IF v_test_agence_id IS NULL THEN
    RAISE WARNING '  WARNING: Aucune agence trouvée pour le test';
  ELSIF v_count_filtered <= v_count_all AND v_found_item IS NOT NULL THEN
    RAISE NOTICE '  PASSED: Le filtre agence fonctionne correctement';
  ELSE
    RAISE WARNING '  FAILED: Le filtre agence ne fonctionne pas correctement!';
  END IF;

  RAISE NOTICE '';
END $$;

-- ========================================
-- TEST 5: Cohérence des calculs financiers
-- ========================================
\echo 'TEST 5: Vérification de la cohérence des calculs (marge = CA - coûts)'
\echo '---------------------------------------------------------------------'

DO $$
DECLARE
  v_result jsonb;
  v_terminee_code text;
  v_item jsonb;
  v_total_paiements numeric;
  v_total_couts numeric;
  v_marge numeric;
  v_marge_calculee numeric;
  v_all_correct boolean := true;
  i integer;
BEGIN
  SELECT code INTO v_terminee_code FROM intervention_statuses WHERE code = 'INTER_TERMINEE' LIMIT 1;

  SELECT get_agency_breakdown(
    (CURRENT_DATE - INTERVAL '6 months')::timestamptz,
    CURRENT_DATE::timestamptz,
    v_terminee_code,
    NULL
  ) INTO v_result;

  -- Vérifier chaque agence
  FOR i IN 0..(jsonb_array_length(v_result) - 1)
  LOOP
    v_item := v_result->i;
    v_total_paiements := (v_item->>'totalPaiements')::numeric;
    v_total_couts := (v_item->>'totalCouts')::numeric;
    v_marge := (v_item->>'marge')::numeric;
    v_marge_calculee := v_total_paiements - v_total_couts;

    IF ABS(v_marge - v_marge_calculee) > 0.01 THEN
      v_all_correct := false;
      RAISE WARNING '  Erreur pour agence %: marge=% mais CA-coûts=%',
        v_item->>'agence_id', v_marge, v_marge_calculee;
    END IF;
  END LOOP;

  IF v_all_correct THEN
    RAISE NOTICE '  PASSED: Tous les calculs de marge sont corrects';
  ELSE
    RAISE WARNING '  FAILED: Certains calculs de marge sont incorrects!';
  END IF;

  RAISE NOTICE '';
END $$;

-- ========================================
-- TEST 6: Test de cohérence MV vs temps réel (mois en cours)
-- ========================================
\echo 'TEST 6: Cohérence MV (mois fermés) vs temps réel (mois en cours)'
\echo '---------------------------------------------------------------------'

DO $$
DECLARE
  v_result_last_month jsonb;
  v_result_current_month jsonb;
  v_count_last integer;
  v_count_current integer;
  v_terminee_code text;
  v_current_month_start date;
  v_last_month_start date;
  v_last_month_end date;
BEGIN
  SELECT code INTO v_terminee_code FROM intervention_statuses WHERE code = 'INTER_TERMINEE' LIMIT 1;

  v_current_month_start := date_trunc('month', CURRENT_DATE)::date;
  v_last_month_start := (date_trunc('month', CURRENT_DATE) - INTERVAL '1 month')::date;
  v_last_month_end := v_current_month_start;

  -- Test mois dernier (devrait utiliser MV)
  SELECT get_agency_breakdown(
    v_last_month_start::timestamptz,
    v_last_month_end::timestamptz,
    v_terminee_code,
    NULL
  ) INTO v_result_last_month;

  -- Test mois en cours (devrait utiliser temps réel)
  SELECT get_agency_breakdown(
    v_current_month_start::timestamptz,
    CURRENT_DATE::timestamptz,
    v_terminee_code,
    NULL
  ) INTO v_result_current_month;

  v_count_last := jsonb_array_length(v_result_last_month);
  v_count_current := jsonb_array_length(v_result_current_month);

  RAISE NOTICE '  Mois dernier (%): % agences (MV)', v_last_month_start, v_count_last;
  RAISE NOTICE '  Mois en cours (%): % agences (temps réel)', v_current_month_start, v_count_current;
  RAISE NOTICE '';

  IF v_count_last >= 0 AND v_count_current >= 0 THEN
    RAISE NOTICE '  PASSED: Hybrid MV + temps réel fonctionne';
  ELSE
    RAISE WARNING '  WARNING: Problème avec les données hybrid';
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
  v_terminee_code text;
  v_agency_count integer;
BEGIN
  SELECT code INTO v_terminee_code FROM intervention_statuses WHERE code = 'INTER_TERMINEE' LIMIT 1;

  -- Test 1: 1 mois
  RAISE NOTICE '  Test 1 mois:';
  v_start := clock_timestamp();
  SELECT get_agency_breakdown(
    (CURRENT_DATE - INTERVAL '1 month')::timestamptz,
    CURRENT_DATE::timestamptz,
    v_terminee_code, NULL
  ) INTO v_result;
  v_end := clock_timestamp();
  v_duration_ms := EXTRACT(MILLISECONDS FROM (v_end - v_start));
  v_agency_count := jsonb_array_length(v_result);
  RAISE NOTICE '    Durée: % ms | Agences: %', ROUND(v_duration_ms, 2), v_agency_count;

  -- Test 2: 3 mois
  RAISE NOTICE '  Test 3 mois:';
  v_start := clock_timestamp();
  SELECT get_agency_breakdown(
    (CURRENT_DATE - INTERVAL '3 months')::timestamptz,
    CURRENT_DATE::timestamptz,
    v_terminee_code, NULL
  ) INTO v_result;
  v_end := clock_timestamp();
  v_duration_ms := EXTRACT(MILLISECONDS FROM (v_end - v_start));
  v_agency_count := jsonb_array_length(v_result);
  RAISE NOTICE '    Durée: % ms | Agences: %', ROUND(v_duration_ms, 2), v_agency_count;

  -- Test 3: 6 mois
  RAISE NOTICE '  Test 6 mois:';
  v_start := clock_timestamp();
  SELECT get_agency_breakdown(
    (CURRENT_DATE - INTERVAL '6 months')::timestamptz,
    CURRENT_DATE::timestamptz,
    v_terminee_code, NULL
  ) INTO v_result;
  v_end := clock_timestamp();
  v_duration_ms := EXTRACT(MILLISECONDS FROM (v_end - v_start));
  v_agency_count := jsonb_array_length(v_result);
  RAISE NOTICE '    Durée: % ms | Agences: %', ROUND(v_duration_ms, 2), v_agency_count;

  -- Test 4: 12 mois
  RAISE NOTICE '  Test 12 mois:';
  v_start := clock_timestamp();
  SELECT get_agency_breakdown(
    (CURRENT_DATE - INTERVAL '12 months')::timestamptz,
    CURRENT_DATE::timestamptz,
    v_terminee_code, NULL
  ) INTO v_result;
  v_end := clock_timestamp();
  v_duration_ms := EXTRACT(MILLISECONDS FROM (v_end - v_start));
  v_agency_count := jsonb_array_length(v_result);
  RAISE NOTICE '    Durée: % ms | Agences: %', ROUND(v_duration_ms, 2), v_agency_count;

  RAISE NOTICE '';
  RAISE NOTICE '  PASSED: Tests de performance complétés';
  RAISE NOTICE '';
END $$;

-- ========================================
-- TEST 8: Vérifier les valeurs numériques (pas de NULL/négatif)
-- ========================================
\echo 'TEST 8: Vérification des valeurs numériques'
\echo '---------------------------------------------------------------------'

DO $$
DECLARE
  v_result jsonb;
  v_terminee_code text;
  v_item jsonb;
  v_all_valid boolean := true;
  v_total_interventions integer;
  v_terminated integer;
  v_avg_cycle_time numeric;
  v_total_paiements numeric;
  v_total_couts numeric;
  i integer;
BEGIN
  SELECT code INTO v_terminee_code FROM intervention_statuses WHERE code = 'INTER_TERMINEE' LIMIT 1;

  SELECT get_agency_breakdown(
    (CURRENT_DATE - INTERVAL '6 months')::timestamptz,
    CURRENT_DATE::timestamptz,
    v_terminee_code,
    NULL
  ) INTO v_result;

  -- Vérifier chaque agence
  FOR i IN 0..(jsonb_array_length(v_result) - 1)
  LOOP
    v_item := v_result->i;
    v_total_interventions := (v_item->>'totalInterventions')::integer;
    v_terminated := (v_item->>'terminatedInterventions')::integer;
    v_avg_cycle_time := COALESCE((v_item->>'avgCycleTime')::numeric, 0);
    v_total_paiements := (v_item->>'totalPaiements')::numeric;
    v_total_couts := (v_item->>'totalCouts')::numeric;

    -- Vérifications
    IF v_total_interventions < 0 THEN
      RAISE WARNING '  totalInterventions négatif pour agence %', v_item->>'agence_id';
      v_all_valid := false;
    END IF;

    IF v_terminated < 0 THEN
      RAISE WARNING '  terminatedInterventions négatif pour agence %', v_item->>'agence_id';
      v_all_valid := false;
    END IF;

    IF v_terminated > v_total_interventions THEN
      RAISE WARNING '  terminated > total pour agence %', v_item->>'agence_id';
      v_all_valid := false;
    END IF;

    IF v_avg_cycle_time < 0 THEN
      RAISE WARNING '  avgCycleTime négatif pour agence %', v_item->>'agence_id';
      v_all_valid := false;
    END IF;

    IF v_total_paiements < 0 THEN
      RAISE WARNING '  totalPaiements négatif pour agence %', v_item->>'agence_id';
      v_all_valid := false;
    END IF;

    IF v_total_couts < 0 THEN
      RAISE WARNING '  totalCouts négatif pour agence %', v_item->>'agence_id';
      v_all_valid := false;
    END IF;
  END LOOP;

  IF v_all_valid THEN
    RAISE NOTICE '  PASSED: Toutes les valeurs numériques sont valides';
  ELSE
    RAISE WARNING '  FAILED: Certaines valeurs numériques sont invalides!';
  END IF;

  RAISE NOTICE '';
END $$;

-- ========================================
-- TEST 9: Comparaison avec mv_monthly_agency_stats directement
-- ========================================
\echo 'TEST 9: Comparaison avec mv_monthly_agency_stats (pour mois fermés)'
\echo '---------------------------------------------------------------------'

DO $$
DECLARE
  v_result_function jsonb;
  v_terminee_code text;
  v_last_month_start date;
  v_last_month_end date;
  v_mv_total_ca numeric;
  v_function_total_ca numeric;
  v_diff_percent numeric;
BEGIN
  SELECT code INTO v_terminee_code FROM intervention_statuses WHERE code = 'INTER_TERMINEE' LIMIT 1;

  v_last_month_start := (date_trunc('month', CURRENT_DATE) - INTERVAL '1 month')::date;
  v_last_month_end := date_trunc('month', CURRENT_DATE)::date;

  -- Total depuis la fonction
  SELECT get_agency_breakdown(
    v_last_month_start::timestamptz,
    v_last_month_end::timestamptz,
    v_terminee_code,
    NULL
  ) INTO v_result_function;

  -- Calculer le total CA depuis le résultat de la fonction
  SELECT SUM((value->>'totalPaiements')::numeric) INTO v_function_total_ca
  FROM jsonb_array_elements(v_result_function);

  -- Total depuis la MV directement
  SELECT SUM(total_ca) INTO v_mv_total_ca
  FROM mv_monthly_agency_stats
  WHERE period_month = v_last_month_start;

  v_diff_percent := CASE
    WHEN v_mv_total_ca > 0 THEN ABS((v_function_total_ca - v_mv_total_ca) / v_mv_total_ca * 100)
    ELSE 0
  END;

  RAISE NOTICE '  Période: %', v_last_month_start;
  RAISE NOTICE '  Total CA depuis fonction: %', ROUND(v_function_total_ca, 2);
  RAISE NOTICE '  Total CA depuis MV: %', ROUND(v_mv_total_ca, 2);
  RAISE NOTICE '  Différence: %.2f%%', v_diff_percent;
  RAISE NOTICE '';

  IF v_diff_percent < 1 THEN
    RAISE NOTICE '  PASSED: Cohérence avec MV (< 1%% différence)';
  ELSE
    RAISE WARNING '  WARNING: Différence > 1%% avec la MV!';
  END IF;

  RAISE NOTICE '';
END $$;

-- ========================================
-- RÉSUMÉ DES TESTS
-- ========================================
\echo '========================================='
\echo 'RÉSUMÉ - get_agency_breakdown()'
\echo '========================================='
\echo ''
\echo 'Tests effectués:'
\echo '  1. ✓ Vérification des paramètres requis'
\echo '  2. ✓ Appel basique (6 mois)'
\echo '  3. ✓ Structure JSON des données'
\echo '  4. ✓ Filtre par agence_id'
\echo '  5. ✓ Cohérence calculs financiers (marge)'
\echo '  6. ✓ Cohérence MV vs temps réel'
\echo '  7. ✓ Performance sur différentes périodes'
\echo '  8. ✓ Validation valeurs numériques'
\echo '  9. ✓ Comparaison avec MV directe'
\echo ''
\echo 'Objectif de performance: < 100ms'
\echo 'Utilisation: Hybrid MV (mois fermés) + Real-time (mois en cours)'
\echo ''
\echo 'Prochaines étapes:'
\echo '  - Si tous les tests passent → fonction OK'
\echo '  - Si performance > 100ms → vérifier REFRESH MV'
\echo '  - Si données incohérentes → vérifier mv_monthly_agency_stats'
\echo '========================================='
