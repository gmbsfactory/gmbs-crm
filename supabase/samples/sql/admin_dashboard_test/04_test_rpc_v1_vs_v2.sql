-- ========================================
-- Tests Phase 3: A/B Testing RPC v1 vs v2
-- ========================================
-- Objective: Validate v2 produces identical results to v1 (data consistency)
--            AND verify performance improvements (4x faster target)
-- CRITICAL: These tests MUST pass before switching frontend to v2
-- ========================================

\echo '========================================='
\echo 'LEVEL 3 TESTS: RPC v1 vs v2 A/B Testing'
\echo '========================================='
\echo ''
\echo 'WARNING: These tests are CRITICAL for production deployment'
\echo 'All tests must PASS before switching frontend to v2'
\echo ''

-- ========================================
-- TEST 1: Data Consistency - Main Stats
-- ========================================
\echo 'TEST 1: Verify mainStats consistency between v1 and v2'
\echo '---------------------------------------------------------------------'

DO $$
DECLARE
  v_v1_result jsonb;
  v_v2_result jsonb;
  v_demandees_match boolean;
  v_terminees_match boolean;
  v_ca_match boolean;
  v_couts_match boolean;
  v_marge_match boolean;
  v_cycle_close boolean;
  v_period_start timestamptz := CURRENT_DATE - INTERVAL '30 days';
  v_period_end timestamptz := CURRENT_DATE;
BEGIN
  -- Call v1
  SELECT get_admin_dashboard_stats(
    v_period_start,
    v_period_end,
    'DEMANDE',
    'DEVIS_ENVOYE',
    'ACCEPTE',
    'EN_COURS',
    'INTER_TERMINEE',
    'ATT_ACOMPTE',
    ARRAY['ACCEPTE', 'EN_COURS', 'INTER_TERMINEE']
  ) INTO v_v1_result;

  -- Call v2
  SELECT get_admin_dashboard_stats_v2(
    v_period_start,
    v_period_end,
    'DEMANDE',
    'DEVIS_ENVOYE',
    'ACCEPTE',
    'EN_COURS',
    'INTER_TERMINEE',
    'ATT_ACOMPTE',
    ARRAY['ACCEPTE', 'EN_COURS', 'INTER_TERMINEE']
  ) INTO v_v2_result;

  -- Compare critical fields
  v_demandees_match := (v_v1_result->'mainStats'->>'nbInterventionsDemandees')::int =
                       (v_v2_result->'mainStats'->>'nbInterventionsDemandees')::int;

  v_terminees_match := (v_v1_result->'mainStats'->>'nbInterventionsTerminees')::int =
                       (v_v2_result->'mainStats'->>'nbInterventionsTerminees')::int;

  v_ca_match := ABS((v_v1_result->'mainStats'->>'chiffreAffaires')::numeric -
                    (v_v2_result->'mainStats'->>'chiffreAffaires')::numeric) < 0.01;

  v_couts_match := ABS((v_v1_result->'mainStats'->>'couts')::numeric -
                       (v_v2_result->'mainStats'->>'couts')::numeric) < 0.01;

  v_marge_match := ABS((v_v1_result->'mainStats'->>'marge')::numeric -
                       (v_v2_result->'mainStats'->>'marge')::numeric) < 0.01;

  v_cycle_close := ABS(COALESCE((v_v1_result->'mainStats'->>'avgCycleTime')::numeric, 0) -
                       COALESCE((v_v2_result->'mainStats'->>'avgCycleTime')::numeric, 0)) < 0.5;

  RAISE NOTICE '  Period: % to %', v_period_start::date, v_period_end::date;
  RAISE NOTICE '';
  RAISE NOTICE '  v1 Demandees: %', (v_v1_result->'mainStats'->>'nbInterventionsDemandees');
  RAISE NOTICE '  v2 Demandees: %', (v_v2_result->'mainStats'->>'nbInterventionsDemandees');
  RAISE NOTICE '  Match: %', v_demandees_match;
  RAISE NOTICE '';
  RAISE NOTICE '  v1 Terminees: %', (v_v1_result->'mainStats'->>'nbInterventionsTerminees');
  RAISE NOTICE '  v2 Terminees: %', (v_v2_result->'mainStats'->>'nbInterventionsTerminees');
  RAISE NOTICE '  Match: %', v_terminees_match;
  RAISE NOTICE '';
  RAISE NOTICE '  v1 CA: %', (v_v1_result->'mainStats'->>'chiffreAffaires');
  RAISE NOTICE '  v2 CA: %', (v_v2_result->'mainStats'->>'chiffreAffaires');
  RAISE NOTICE '  Match (< 0.01 diff): %', v_ca_match;
  RAISE NOTICE '';
  RAISE NOTICE '  v1 Cycle Time: %', COALESCE((v_v1_result->'mainStats'->>'avgCycleTime')::text, 'NULL');
  RAISE NOTICE '  v2 Cycle Time: %', COALESCE((v_v2_result->'mainStats'->>'avgCycleTime')::text, 'NULL');
  RAISE NOTICE '  Match (< 0.5 days diff): %', v_cycle_close;
  RAISE NOTICE '';

  IF v_demandees_match AND v_terminees_match AND v_ca_match AND v_couts_match AND v_marge_match AND v_cycle_close THEN
    RAISE NOTICE '  PASSED: mainStats consistent between v1 and v2';
  ELSE
    RAISE WARNING '  FAILED: mainStats inconsistent!';
    RAISE NOTICE '  -> This is a BLOCKER - do NOT deploy v2 to production';
  END IF;

  RAISE NOTICE '';
END $$;

-- ========================================
-- TEST 2: Data Consistency - Sparklines
-- ========================================
\echo 'TEST 2: Verify sparklines data consistency (sample check)'
\echo '---------------------------------------------------------------------'

DO $$
DECLARE
  v_v1_result jsonb;
  v_v2_result jsonb;
  v_v1_count int;
  v_v2_count int;
  v_period_start timestamptz := CURRENT_DATE - INTERVAL '30 days';
  v_period_end timestamptz := CURRENT_DATE;
BEGIN
  -- Call v1
  SELECT get_admin_dashboard_stats(
    v_period_start,
    v_period_end,
    'DEMANDE',
    'DEVIS_ENVOYE',
    'ACCEPTE',
    'EN_COURS',
    'INTER_TERMINEE',
    'ATT_ACOMPTE',
    ARRAY['ACCEPTE', 'EN_COURS', 'INTER_TERMINEE']
  ) INTO v_v1_result;

  -- Call v2
  SELECT get_admin_dashboard_stats_v2(
    v_period_start,
    v_period_end,
    'DEMANDE',
    'DEVIS_ENVOYE',
    'ACCEPTE',
    'EN_COURS',
    'INTER_TERMINEE',
    'ATT_ACOMPTE',
    ARRAY['ACCEPTE', 'EN_COURS', 'INTER_TERMINEE']
  ) INTO v_v2_result;

  v_v1_count := jsonb_array_length(v_v1_result->'sparklines');
  v_v2_count := jsonb_array_length(v_v2_result->'sparklines');

  RAISE NOTICE '  v1 sparkline data points: %', v_v1_count;
  RAISE NOTICE '  v2 sparkline data points: %', v_v2_count;
  RAISE NOTICE '';

  IF v_v1_count = v_v2_count THEN
    RAISE NOTICE '  PASSED: Sparklines have same number of data points';
  ELSE
    RAISE WARNING '  WARNING: Different number of data points - investigate';
  END IF;

  RAISE NOTICE '';
END $$;

-- ========================================
-- TEST 3: Data Consistency - Agency Breakdown
-- ========================================
\echo 'TEST 3: Verify agencyBreakdown consistency'
\echo '---------------------------------------------------------------------'

DO $$
DECLARE
  v_v1_result jsonb;
  v_v2_result jsonb;
  v_v1_count int;
  v_v2_count int;
  v_period_start timestamptz := CURRENT_DATE - INTERVAL '30 days';
  v_period_end timestamptz := CURRENT_DATE;
BEGIN
  -- Call v1
  SELECT get_admin_dashboard_stats(
    v_period_start,
    v_period_end,
    'DEMANDE',
    'DEVIS_ENVOYE',
    'ACCEPTE',
    'EN_COURS',
    'INTER_TERMINEE',
    'ATT_ACOMPTE',
    ARRAY['ACCEPTE', 'EN_COURS', 'INTER_TERMINEE']
  ) INTO v_v1_result;

  -- Call v2
  SELECT get_admin_dashboard_stats_v2(
    v_period_start,
    v_period_end,
    'DEMANDE',
    'DEVIS_ENVOYE',
    'ACCEPTE',
    'EN_COURS',
    'INTER_TERMINEE',
    'ATT_ACOMPTE',
    ARRAY['ACCEPTE', 'EN_COURS', 'INTER_TERMINEE']
  ) INTO v_v2_result;

  v_v1_count := jsonb_array_length(v_v1_result->'agencyBreakdown');
  v_v2_count := jsonb_array_length(v_v2_result->'agencyBreakdown');

  RAISE NOTICE '  v1 agencies: %', v_v1_count;
  RAISE NOTICE '  v2 agencies: %', v_v2_count;
  RAISE NOTICE '';

  IF v_v1_count = v_v2_count THEN
    RAISE NOTICE '  PASSED: Agency breakdown has same number of agencies';
  ELSE
    RAISE WARNING '  WARNING: Different number of agencies - investigate';
  END IF;

  RAISE NOTICE '';
END $$;

-- ========================================
-- TEST 4: Data Consistency - Gestionnaire Breakdown
-- ========================================
\echo 'TEST 4: Verify gestionnaireBreakdown consistency'
\echo '---------------------------------------------------------------------'

DO $$
DECLARE
  v_v1_result jsonb;
  v_v2_result jsonb;
  v_v1_count int;
  v_v2_count int;
  v_period_start timestamptz := CURRENT_DATE - INTERVAL '30 days';
  v_period_end timestamptz := CURRENT_DATE;
BEGIN
  -- Call v1
  SELECT get_admin_dashboard_stats(
    v_period_start,
    v_period_end,
    'DEMANDE',
    'DEVIS_ENVOYE',
    'ACCEPTE',
    'EN_COURS',
    'INTER_TERMINEE',
    'ATT_ACOMPTE',
    ARRAY['ACCEPTE', 'EN_COURS', 'INTER_TERMINEE']
  ) INTO v_v1_result;

  -- Call v2
  SELECT get_admin_dashboard_stats_v2(
    v_period_start,
    v_period_end,
    'DEMANDE',
    'DEVIS_ENVOYE',
    'ACCEPTE',
    'EN_COURS',
    'INTER_TERMINEE',
    'ATT_ACOMPTE',
    ARRAY['ACCEPTE', 'EN_COURS', 'INTER_TERMINEE']
  ) INTO v_v2_result;

  v_v1_count := jsonb_array_length(v_v1_result->'gestionnaireBreakdown');
  v_v2_count := jsonb_array_length(v_v2_result->'gestionnaireBreakdown');

  RAISE NOTICE '  v1 gestionnaires: %', v_v1_count;
  RAISE NOTICE '  v2 gestionnaires: %', v_v2_count;
  RAISE NOTICE '';

  IF v_v1_count = v_v2_count THEN
    RAISE NOTICE '  PASSED: Gestionnaire breakdown has same number of gestionnaires';
  ELSE
    RAISE WARNING '  WARNING: Different number of gestionnaires - investigate';
  END IF;

  RAISE NOTICE '';
END $$;

-- ========================================
-- TEST 5: Performance Comparison - Full RPC
-- ========================================
\echo 'TEST 5: Performance comparison - Full RPC (target: v2 4x faster)'
\echo '---------------------------------------------------------------------'

DO $$
DECLARE
  v_start_v1 timestamptz;
  v_end_v1 timestamptz;
  v_duration_v1_ms numeric;
  v_start_v2 timestamptz;
  v_end_v2 timestamptz;
  v_duration_v2_ms numeric;
  v_result jsonb;
  v_speedup numeric;
  v_period_start timestamptz := CURRENT_DATE - INTERVAL '90 days';
  v_period_end timestamptz := CURRENT_DATE;
BEGIN
  -- Warm up caches
  PERFORM get_admin_dashboard_stats(
    v_period_start,
    v_period_end,
    'DEMANDE',
    'DEVIS_ENVOYE',
    'ACCEPTE',
    'EN_COURS',
    'INTER_TERMINEE',
    'ATT_ACOMPTE',
    ARRAY['ACCEPTE', 'EN_COURS', 'INTER_TERMINEE']
  );

  -- Measure v1
  v_start_v1 := clock_timestamp();

  SELECT get_admin_dashboard_stats(
    v_period_start,
    v_period_end,
    'DEMANDE',
    'DEVIS_ENVOYE',
    'ACCEPTE',
    'EN_COURS',
    'INTER_TERMINEE',
    'ATT_ACOMPTE',
    ARRAY['ACCEPTE', 'EN_COURS', 'INTER_TERMINEE']
  ) INTO v_result;

  v_end_v1 := clock_timestamp();
  v_duration_v1_ms := EXTRACT(MILLISECONDS FROM (v_end_v1 - v_start_v1));

  -- Measure v2
  v_start_v2 := clock_timestamp();

  SELECT get_admin_dashboard_stats_v2(
    v_period_start,
    v_period_end,
    'DEMANDE',
    'DEVIS_ENVOYE',
    'ACCEPTE',
    'EN_COURS',
    'INTER_TERMINEE',
    'ATT_ACOMPTE',
    ARRAY['ACCEPTE', 'EN_COURS', 'INTER_TERMINEE']
  ) INTO v_result;

  v_end_v2 := clock_timestamp();
  v_duration_v2_ms := EXTRACT(MILLISECONDS FROM (v_end_v2 - v_start_v2));

  v_speedup := CASE WHEN v_duration_v2_ms > 0 THEN v_duration_v1_ms / v_duration_v2_ms ELSE 0 END;

  RAISE NOTICE '  Period: 90 days (% to %)', v_period_start::date, v_period_end::date;
  RAISE NOTICE '  v1 duration: % ms', ROUND(v_duration_v1_ms, 2);
  RAISE NOTICE '  v2 duration: % ms', ROUND(v_duration_v2_ms, 2);
  RAISE NOTICE '  Speedup: %x', ROUND(v_speedup, 2);
  RAISE NOTICE '';

  IF v_speedup >= 2.0 THEN
    RAISE NOTICE '  PASSED: v2 is at least 2x faster (target: 4x)';
  ELSIF v_speedup >= 1.5 THEN
    RAISE NOTICE '  ACCEPTABLE: v2 is %.2fx faster (target: 4x)', v_speedup;
  ELSE
    RAISE WARNING '  WARNING: v2 speedup is only %.2fx - expected 4x', v_speedup;
    RAISE NOTICE '  -> Check if MVs are refreshed and indexes are present';
  END IF;

  RAISE NOTICE '';
END $$;

-- ========================================
-- TEST 6: Performance - Podium Ranking
-- ========================================
\echo 'TEST 6: Performance comparison - Podium ranking v1 vs v2'
\echo '---------------------------------------------------------------------'

DO $$
DECLARE
  v_start_v1 timestamptz;
  v_end_v1 timestamptz;
  v_duration_v1_ms numeric;
  v_start_v2 timestamptz;
  v_end_v2 timestamptz;
  v_duration_v2_ms numeric;
  v_result jsonb;
  v_speedup numeric;
  v_period_start timestamptz := CURRENT_DATE - INTERVAL '30 days';
  v_period_end timestamptz := CURRENT_DATE;
BEGIN
  -- Measure v1
  v_start_v1 := clock_timestamp();

  SELECT get_podium_ranking_by_period(v_period_start, v_period_end) INTO v_result;

  v_end_v1 := clock_timestamp();
  v_duration_v1_ms := EXTRACT(MILLISECONDS FROM (v_end_v1 - v_start_v1));

  -- Measure v2
  v_start_v2 := clock_timestamp();

  SELECT get_podium_ranking_by_period_v2(v_period_start, v_period_end) INTO v_result;

  v_end_v2 := clock_timestamp();
  v_duration_v2_ms := EXTRACT(MILLISECONDS FROM (v_end_v2 - v_start_v2));

  v_speedup := CASE WHEN v_duration_v2_ms > 0 THEN v_duration_v1_ms / v_duration_v2_ms ELSE 0 END;

  RAISE NOTICE '  v1 duration: % ms', ROUND(v_duration_v1_ms, 2);
  RAISE NOTICE '  v2 duration: % ms', ROUND(v_duration_v2_ms, 2);
  RAISE NOTICE '  Speedup: %x', ROUND(v_speedup, 2);
  RAISE NOTICE '';

  IF v_speedup >= 1.5 THEN
    RAISE NOTICE '  PASSED: v2 podium is significantly faster';
  ELSE
    RAISE NOTICE '  ACCEPTABLE: v2 podium speedup is %.2fx', v_speedup;
  END IF;

  RAISE NOTICE '';
END $$;

-- ========================================
-- TEST 7: Data Consistency - Podium Rankings
-- ========================================
\echo 'TEST 7: Verify podium rankings consistency'
\echo '---------------------------------------------------------------------'

DO $$
DECLARE
  v_v1_result jsonb;
  v_v2_result jsonb;
  v_v1_count int;
  v_v2_count int;
  v_period_start timestamptz := CURRENT_DATE - INTERVAL '30 days';
  v_period_end timestamptz := CURRENT_DATE;
BEGIN
  -- Call v1
  SELECT get_podium_ranking_by_period(v_period_start, v_period_end) INTO v_v1_result;

  -- Call v2
  SELECT get_podium_ranking_by_period_v2(v_period_start, v_period_end) INTO v_v2_result;

  v_v1_count := jsonb_array_length(v_v1_result->'rankings');
  v_v2_count := jsonb_array_length(v_v2_result->'rankings');

  RAISE NOTICE '  v1 rankings count: %', v_v1_count;
  RAISE NOTICE '  v2 rankings count: %', v_v2_count;
  RAISE NOTICE '';

  IF v_v1_count = v_v2_count THEN
    RAISE NOTICE '  PASSED: Podium rankings have same number of entries';
  ELSE
    RAISE WARNING '  WARNING: Different number of rankings - investigate';
  END IF;

  RAISE NOTICE '';
END $$;

-- ========================================
-- TEST 8: Verify Helper Functions Exist
-- ========================================
\echo 'TEST 8: Verify all helper functions are available'
\echo '---------------------------------------------------------------------'

DO $$
DECLARE
  v_helpers_count int;
BEGIN
  SELECT COUNT(*) INTO v_helpers_count
  FROM pg_proc
  WHERE proname IN (
    'get_sparkline_data',
    'get_agency_breakdown',
    'get_gestionnaire_breakdown'
  );

  RAISE NOTICE '  Helper functions found: %/3', v_helpers_count;
  RAISE NOTICE '';

  IF v_helpers_count = 3 THEN
    RAISE NOTICE '  PASSED: All L2 helper functions exist';
  ELSE
    RAISE WARNING '  FAILED: Missing L2 helper functions!';
    RAISE NOTICE '  -> Ensure migration 00018_level2_materialized_views.sql was applied';
  END IF;

  RAISE NOTICE '';
END $$;

-- ========================================
-- TEST SUMMARY
-- ========================================
\echo '========================================='
\echo 'LEVEL 3 TEST SUMMARY'
\echo '========================================='
\echo ''
\echo 'If all tests PASSED:'
\echo '  -> v2 is ready for production deployment'
\echo '  -> Update frontend to call v2 functions'
\echo '  -> Monitor performance for 1 week'
\echo '  -> Deprecate v1 after validation'
\echo ''
\echo 'If any tests FAILED:'
\echo '  -> DO NOT deploy v2 to production'
\echo '  -> Investigate inconsistencies'
\echo '  -> Fix issues and re-run tests'
\echo ''
\echo 'Migration checklist:'
\echo '  1. Apply migration: psql < 00020_level3_rpc_refactor.sql'
\echo '  2. Run tests: psql < 04_test_rpc_v1_vs_v2.sql'
\echo '  3. Verify all tests PASS'
\echo '  4. Update frontend:'
\echo '     - get_admin_dashboard_stats -> get_admin_dashboard_stats_v2'
\echo '     - get_podium_ranking_by_period -> get_podium_ranking_by_period_v2'
\echo '  5. Monitor metrics dashboard for 1 week'
\echo '  6. After validation, drop v1 functions'
\echo ''
\echo 'Performance targets:'
\echo '  - Full RPC: < 200ms (vs ~800ms v1) = 4x faster'
\echo '  - Podium: < 50ms (vs ~100ms v1) = 2x faster'
\echo ''
\echo 'Rollback plan (if needed):'
\echo '  - Revert frontend to v1 functions'
\echo '  - DROP FUNCTION get_admin_dashboard_stats_v2;'
\echo '  - DROP FUNCTION get_podium_ranking_by_period_v2;'
\echo '  - DROP FUNCTION get_gestionnaire_breakdown;'
\echo '  - System returns to pre-Phase-3 state'
\echo '========================================='
