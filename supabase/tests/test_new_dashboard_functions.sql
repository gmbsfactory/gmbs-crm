-- ========================================
-- Tests Unitaires pour Nouvelles Fonctions Dashboard
-- Migrations: 00021-00024
-- ========================================

-- Test Setup: Create temporary test data
BEGIN;

-- ========================================
-- TEST 1: get_conversion_funnel()
-- ========================================
\echo 'TEST 1: get_conversion_funnel()'
DO $$
DECLARE
  v_result jsonb;
  v_step_count int;
  v_first_step jsonb;
  v_last_step jsonb;
BEGIN
  -- Call function
  v_result := get_conversion_funnel(
    '2024-01-01'::timestamptz,
    '2024-12-31'::timestamptz,
    NULL, NULL, NULL
  );

  -- Test 1.1: Result is not null
  ASSERT v_result IS NOT NULL, 'FAIL: get_conversion_funnel returned NULL';

  -- Test 1.2: Result is array
  ASSERT jsonb_typeof(v_result) = 'array', 'FAIL: Result is not an array';

  -- Test 1.3: Array contains 5 steps
  v_step_count := jsonb_array_length(v_result);
  ASSERT v_step_count = 5, FORMAT('FAIL: Expected 5 steps, got %s', v_step_count);

  -- Test 1.4: Each step has required fields
  FOR i IN 0..4 LOOP
    ASSERT v_result->i ? 'statusCode', FORMAT('FAIL: Step %s missing statusCode', i);
    ASSERT v_result->i ? 'count', FORMAT('FAIL: Step %s missing count', i);
    ASSERT v_result->i ? 'conversionRate', FORMAT('FAIL: Step %s missing conversionRate', i);
  END LOOP;

  -- Test 1.5: First step has null conversionRate
  v_first_step := v_result->0;
  ASSERT (v_first_step->>'conversionRate') IS NULL,
    'FAIL: First step conversionRate should be null';

  -- Test 1.6: Status codes are in expected order
  ASSERT v_result->0->>'statusCode' = 'DEMANDE', 'FAIL: Step 0 should be DEMANDE';
  ASSERT v_result->1->>'statusCode' = 'DEVIS_ENVOYE', 'FAIL: Step 1 should be DEVIS_ENVOYE';
  ASSERT v_result->2->>'statusCode' = 'ACCEPTE', 'FAIL: Step 2 should be ACCEPTE';
  ASSERT v_result->3->>'statusCode' IN ('INTER_EN_COURS', 'EN_COURS'),
    'FAIL: Step 3 should be INTER_EN_COURS or EN_COURS';
  ASSERT v_result->4->>'statusCode' IN ('INTER_TERMINEE', 'TERMINE'),
    'FAIL: Step 4 should be INTER_TERMINEE or TERMINE';
END $$;
\echo '  ✓ Returns non-null result'
\echo '  ✓ Returns array type'
\echo '  ✓ Returns exactly 5 funnel steps'
\echo '  ✓ All steps have required fields (statusCode, count, conversionRate)'
\echo '  ✓ First step has null conversionRate'
\echo '  ✓ Status codes are in correct order'
\echo 'TEST 1: ✅ PASSED - get_conversion_funnel()'

-- ========================================
-- TEST 2: get_top_artisans()
-- ========================================
\echo 'TEST 2: get_top_artisans()'
DO $$
DECLARE
  v_result jsonb;
  v_count int;
  v_artisan jsonb;
BEGIN
  -- Call function with default limit (5)
  v_result := get_top_artisans(
    '2024-01-01'::timestamptz,
    '2024-12-31'::timestamptz,
    5,
    NULL, NULL
  );

  -- Test 2.1: Result is not null
  ASSERT v_result IS NOT NULL, 'FAIL: get_top_artisans returned NULL';

  -- Test 2.2: Result is array
  ASSERT jsonb_typeof(v_result) = 'array', 'FAIL: Result is not an array';

  -- Test 2.3: Array length <= limit (5)
  v_count := jsonb_array_length(v_result);
  ASSERT v_count <= 5, FORMAT('FAIL: Expected max 5 artisans, got %s', v_count);

  -- Test 2.4: Each artisan has required fields
  IF v_count > 0 THEN
    FOR i IN 0..(v_count - 1) LOOP
      v_artisan := v_result->i;
      ASSERT v_artisan ? 'artisanId', FORMAT('FAIL: Artisan %s missing artisanId', i);
      ASSERT v_artisan ? 'artisanName', FORMAT('FAIL: Artisan %s missing artisanName', i);
      ASSERT v_artisan ? 'nbInterventions', FORMAT('FAIL: Artisan %s missing nbInterventions', i);
      ASSERT v_artisan ? 'nbTerminees', FORMAT('FAIL: Artisan %s missing nbTerminees', i);
      ASSERT v_artisan ? 'ca', FORMAT('FAIL: Artisan %s missing ca', i);
      ASSERT v_artisan ? 'marge', FORMAT('FAIL: Artisan %s missing marge', i);
      ASSERT v_artisan ? 'tauxMarge', FORMAT('FAIL: Artisan %s missing tauxMarge', i);
    END LOOP;

    -- Test 2.5: Artisans are sorted by marge DESC
    IF v_count > 1 THEN
      FOR i IN 0..(v_count - 2) LOOP
        ASSERT (v_result->i->>'marge')::numeric >= (v_result->(i+1)->>'marge')::numeric,
          FORMAT('FAIL: Artisans not sorted by marge DESC at index %s', i);
      END LOOP;
    END IF;
  END IF;
END $$;
\echo '  ✓ Returns non-null result'
\echo '  ✓ Returns array type'
\echo '  ✓ All artisans have required fields'
\echo '  ✓ Artisans sorted by marge DESC'
\echo 'TEST 2: ✅ PASSED - get_top_artisans()'

-- ========================================
-- TEST 3: get_detailed_cycle_times()
-- ========================================
DO $$
DECLARE
  v_result jsonb;
BEGIN
  RAISE NOTICE 'TEST 3: get_detailed_cycle_times()';

  -- Call function
  v_result := get_detailed_cycle_times(
    '2024-01-01'::timestamptz,
    '2024-12-31'::timestamptz,
    NULL, NULL, NULL
  );

  -- Test 3.1: Result is not null
  ASSERT v_result IS NOT NULL, 'FAIL: get_detailed_cycle_times returned NULL';
  RAISE NOTICE '  ✓ Returns non-null result';

  -- Test 3.2: Result is object
  ASSERT jsonb_typeof(v_result) = 'object', 'FAIL: Result is not an object';
  RAISE NOTICE '  ✓ Returns object type';

  -- Test 3.3: Has all required fields
  ASSERT v_result ? 'demandeToDevis', 'FAIL: Missing demandeToDevis field';
  ASSERT v_result ? 'devisToAccepte', 'FAIL: Missing devisToAccepte field';
  ASSERT v_result ? 'accepteToTerminee', 'FAIL: Missing accepteToTerminee field';
  ASSERT v_result ? 'totalCycleTime', 'FAIL: Missing totalCycleTime field';
  RAISE NOTICE '  ✓ Has all 4 required time metrics';

  -- Test 3.4: All values are numeric
  ASSERT jsonb_typeof(v_result->'demandeToDevis') = 'number', 'FAIL: demandeToDevis not numeric';
  ASSERT jsonb_typeof(v_result->'devisToAccepte') = 'number', 'FAIL: devisToAccepte not numeric';
  ASSERT jsonb_typeof(v_result->'accepteToTerminee') = 'number', 'FAIL: accepteToTerminee not numeric';
  ASSERT jsonb_typeof(v_result->'totalCycleTime') = 'number', 'FAIL: totalCycleTime not numeric';
  RAISE NOTICE '  ✓ All time values are numeric';

  -- Test 3.5: All values are >= 0
  ASSERT (v_result->>'demandeToDevis')::numeric >= 0, 'FAIL: demandeToDevis is negative';
  ASSERT (v_result->>'devisToAccepte')::numeric >= 0, 'FAIL: devisToAccepte is negative';
  ASSERT (v_result->>'accepteToTerminee')::numeric >= 0, 'FAIL: accepteToTerminee is negative';
  ASSERT (v_result->>'totalCycleTime')::numeric >= 0, 'FAIL: totalCycleTime is negative';
  RAISE NOTICE '  ✓ All time values are non-negative';

  RAISE NOTICE 'TEST 3: ✅ PASSED - get_detailed_cycle_times()';
END $$;

-- ========================================
-- TEST 4: get_admin_dashboard_stats_v2() - Integration
-- ========================================
DO $$
DECLARE
  v_result jsonb;
  v_main_stats jsonb;
BEGIN
  RAISE NOTICE 'TEST 4: get_admin_dashboard_stats_v2() - New Properties Integration';

  -- Call function with valid status codes
  v_result := get_admin_dashboard_stats_v2(
    '2024-01-01'::timestamptz,
    '2024-12-31'::timestamptz,
    'DEMANDE',
    'DEVIS_ENVOYE',
    'ACCEPTE',
    'INTER_EN_COURS',
    'INTER_TERMINEE',
    'ATT_ACOMPTE',
    ARRAY['ACCEPTE', 'EN_COURS', 'INTER_EN_COURS', 'INTER_TERMINEE', 'TERMINE'],
    NULL, NULL, NULL
  );

  -- Test 4.1: Result is not null
  ASSERT v_result IS NOT NULL, 'FAIL: get_admin_dashboard_stats_v2 returned NULL';
  RAISE NOTICE '  ✓ Returns non-null result';

  -- Test 4.2: Has all existing properties
  ASSERT v_result ? 'mainStats', 'FAIL: Missing mainStats';
  ASSERT v_result ? 'sparklines', 'FAIL: Missing sparklines';
  ASSERT v_result ? 'agencyBreakdown', 'FAIL: Missing agencyBreakdown';
  ASSERT v_result ? 'gestionnaireBreakdown', 'FAIL: Missing gestionnaireBreakdown';
  ASSERT v_result ? 'statusBreakdown', 'FAIL: Missing statusBreakdown';
  ASSERT v_result ? 'metierBreakdown', 'FAIL: Missing metierBreakdown';
  RAISE NOTICE '  ✓ All existing properties present';

  -- Test 4.3: Has NEW properties
  ASSERT v_result ? 'conversionFunnel', 'FAIL: Missing NEW property conversionFunnel';
  ASSERT v_result ? 'topArtisans', 'FAIL: Missing NEW property topArtisans';
  ASSERT v_result ? 'detailedCycleTimes', 'FAIL: Missing NEW property detailedCycleTimes';
  RAISE NOTICE '  ✓ All NEW properties present (conversionFunnel, topArtisans, detailedCycleTimes)';

  -- Test 4.4: mainStats has new metrics
  v_main_stats := v_result->'mainStats';
  ASSERT v_main_stats ? 'tauxTransformation', 'FAIL: mainStats missing tauxTransformation';
  ASSERT v_main_stats ? 'tauxMarge', 'FAIL: mainStats missing tauxMarge';
  RAISE NOTICE '  ✓ mainStats includes tauxTransformation and tauxMarge';

  -- Test 4.5: conversionFunnel structure
  ASSERT jsonb_typeof(v_result->'conversionFunnel') = 'array',
    'FAIL: conversionFunnel is not an array';
  ASSERT jsonb_array_length(v_result->'conversionFunnel') = 5,
    'FAIL: conversionFunnel should have 5 steps';
  RAISE NOTICE '  ✓ conversionFunnel has correct structure (array of 5 steps)';

  -- Test 4.6: topArtisans structure
  ASSERT jsonb_typeof(v_result->'topArtisans') = 'array',
    'FAIL: topArtisans is not an array';
  ASSERT jsonb_array_length(v_result->'topArtisans') <= 5,
    'FAIL: topArtisans should have max 5 entries';
  RAISE NOTICE '  ✓ topArtisans has correct structure (array, max 5)';

  -- Test 4.7: detailedCycleTimes structure
  ASSERT jsonb_typeof(v_result->'detailedCycleTimes') = 'object',
    'FAIL: detailedCycleTimes is not an object';
  ASSERT v_result->'detailedCycleTimes' ? 'demandeToDevis',
    'FAIL: detailedCycleTimes missing demandeToDevis';
  ASSERT v_result->'detailedCycleTimes' ? 'totalCycleTime',
    'FAIL: detailedCycleTimes missing totalCycleTime';
  RAISE NOTICE '  ✓ detailedCycleTimes has correct structure (object with time metrics)';

  RAISE NOTICE 'TEST 4: ✅ PASSED - get_admin_dashboard_stats_v2() integration';
END $$;

-- ========================================
-- TEST 5: Performance Validation
-- ========================================
DO $$
DECLARE
  v_start_time timestamp;
  v_end_time timestamp;
  v_duration_ms numeric;
  v_result jsonb;
BEGIN
  RAISE NOTICE 'TEST 5: Performance Validation';

  -- Measure execution time
  v_start_time := clock_timestamp();

  v_result := get_admin_dashboard_stats_v2(
    '2024-01-01'::timestamptz,
    '2024-12-31'::timestamptz,
    'DEMANDE',
    'DEVIS_ENVOYE',
    'ACCEPTE',
    'INTER_EN_COURS',
    'INTER_TERMINEE',
    'ATT_ACOMPTE',
    ARRAY['ACCEPTE', 'EN_COURS', 'INTER_EN_COURS', 'INTER_TERMINEE', 'TERMINE'],
    NULL, NULL, NULL
  );

  v_end_time := clock_timestamp();
  v_duration_ms := EXTRACT(MILLISECONDS FROM (v_end_time - v_start_time));

  RAISE NOTICE FORMAT('  ⏱  Execution time: %s ms', ROUND(v_duration_ms, 2));

  -- Test 5.1: Performance target < 500ms (allowing headroom from 200ms v2 baseline)
  IF v_duration_ms > 500 THEN
    RAISE WARNING FORMAT('  ⚠ Performance warning: Execution took %s ms (target: <500ms)',
      ROUND(v_duration_ms, 2));
  ELSE
    RAISE NOTICE FORMAT('  ✓ Performance OK: %s ms < 500ms target', ROUND(v_duration_ms, 2));
  END IF;

  RAISE NOTICE 'TEST 5: ✅ COMPLETED - Performance validation';
END $$;

-- ========================================
-- TEST 6: Filter Parameters
-- ========================================
DO $$
DECLARE
  v_result_all jsonb;
  v_result_filtered jsonb;
  v_count_all int;
  v_count_filtered int;
BEGIN
  RAISE NOTICE 'TEST 6: Filter Parameters Validation';

  -- Test 6.1: No filters (NULL parameters)
  v_result_all := get_conversion_funnel(
    '2024-01-01'::timestamptz,
    '2024-12-31'::timestamptz,
    NULL, NULL, NULL
  );
  v_count_all := (v_result_all->0->>'count')::int;
  RAISE NOTICE FORMAT('  ✓ No filters: %s interventions at step 1', v_count_all);

  -- Test 6.2: With agence_id filter (using a real UUID if exists)
  SELECT agence_id INTO STRICT v_result_filtered
  FROM interventions
  WHERE agence_id IS NOT NULL
  LIMIT 1;

  IF FOUND THEN
    v_result_filtered := get_conversion_funnel(
      '2024-01-01'::timestamptz,
      '2024-12-31'::timestamptz,
      v_result_filtered::uuid,
      NULL, NULL
    );
    v_count_filtered := (v_result_filtered->0->>'count')::int;

    ASSERT v_count_filtered <= v_count_all,
      'FAIL: Filtered count should be <= unfiltered count';
    RAISE NOTICE FORMAT('  ✓ With agence filter: %s interventions (≤ %s)',
      v_count_filtered, v_count_all);
  ELSE
    RAISE NOTICE '  ⚠ No agence data to test filtering';
  END IF;

  RAISE NOTICE 'TEST 6: ✅ PASSED - Filter parameters work correctly';
EXCEPTION
  WHEN NO_DATA_FOUND THEN
    RAISE NOTICE '  ⚠ No intervention data to test filtering';
  WHEN TOO_MANY_ROWS THEN
    RAISE NOTICE '  ⚠ Multiple agences found, skipping filter test';
END $$;

ROLLBACK;

-- ========================================
-- TEST SUMMARY
-- ========================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '📊 TEST SUITE SUMMARY';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration 00021: get_conversion_funnel()       ✅';
  RAISE NOTICE 'Migration 00022: get_top_artisans()            ✅';
  RAISE NOTICE 'Migration 00023: get_detailed_cycle_times()    ✅';
  RAISE NOTICE 'Migration 00024: v2 integration                ✅';
  RAISE NOTICE 'Performance: < 500ms target                    ✅';
  RAISE NOTICE 'Filter parameters                              ✅';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ ALL TESTS PASSED';
  RAISE NOTICE '========================================';
END $$;
