-- ========================================
-- Tests Phase 2: Level 2 Materialized Views
-- ========================================
-- Objective: Validate MVs are properly created, populated, and performant
-- Run after migration 00018_level2_materialized_views.sql
-- ========================================

\echo '========================================='
\echo 'LEVEL 2 TESTS: Materialized Views + Helpers'
\echo '========================================='
\echo ''

-- ========================================
-- TEST 1: Verify Materialized Views Creation
-- ========================================
\echo 'TEST 1: Verify all 3 materialized views exist and are populated'
\echo '---------------------------------------------------------------------'

DO $$
DECLARE
  v_mv_count integer;
  v_daily_populated boolean;
  v_agency_populated boolean;
  v_gestionnaire_populated boolean;
BEGIN
  -- Check MVs exist
  SELECT COUNT(*) INTO v_mv_count
  FROM pg_matviews
  WHERE matviewname IN (
    'mv_daily_status_transitions',
    'mv_monthly_agency_stats',
    'mv_monthly_gestionnaire_stats'
  );

  -- Check population status
  SELECT ispopulated INTO v_daily_populated
  FROM pg_matviews WHERE matviewname = 'mv_daily_status_transitions';

  SELECT ispopulated INTO v_agency_populated
  FROM pg_matviews WHERE matviewname = 'mv_monthly_agency_stats';

  SELECT ispopulated INTO v_gestionnaire_populated
  FROM pg_matviews WHERE matviewname = 'mv_monthly_gestionnaire_stats';

  RAISE NOTICE '  Materialized views found: %/3', v_mv_count;
  RAISE NOTICE '  mv_daily_status_transitions populated: %', v_daily_populated;
  RAISE NOTICE '  mv_monthly_agency_stats populated: %', v_agency_populated;
  RAISE NOTICE '  mv_monthly_gestionnaire_stats populated: %', v_gestionnaire_populated;
  RAISE NOTICE '';

  IF v_mv_count = 3 AND v_daily_populated AND v_agency_populated AND v_gestionnaire_populated THEN
    RAISE NOTICE '  PASSED: All MVs created and populated';
  ELSE
    RAISE WARNING '  WARNING: Some MVs missing or not populated!';
  END IF;

  RAISE NOTICE '';
END $$;

-- ========================================
-- TEST 2: Data Freshness Check
-- ========================================
\echo 'TEST 2: Verify MV data freshness (should be within 1 day)'
\echo '---------------------------------------------------------------------'

DO $$
DECLARE
  v_max_date date;
  v_age_days integer;
  v_row_count integer;
BEGIN
  -- Check daily transitions freshness
  SELECT MAX(transition_date) INTO v_max_date
  FROM public.mv_daily_status_transitions;

  SELECT COUNT(*) INTO v_row_count
  FROM public.mv_daily_status_transitions;

  v_age_days := CURRENT_DATE - v_max_date;

  RAISE NOTICE '  mv_daily_status_transitions:';
  RAISE NOTICE '    Max date: %', v_max_date;
  RAISE NOTICE '    Age: % days', v_age_days;
  RAISE NOTICE '    Total rows: %', v_row_count;
  RAISE NOTICE '';

  IF v_age_days > 1 THEN
    RAISE WARNING '  WARNING: Daily transitions MV is stale (> 1 day old)';
    RAISE NOTICE '  -> Run: REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_daily_status_transitions;';
  ELSE
    RAISE NOTICE '  PASSED: Daily transitions MV is fresh';
  END IF;

  -- Check monthly agency stats freshness
  SELECT MAX(period_month) INTO v_max_date
  FROM public.mv_monthly_agency_stats;

  SELECT COUNT(*) INTO v_row_count
  FROM public.mv_monthly_agency_stats;

  RAISE NOTICE '';
  RAISE NOTICE '  mv_monthly_agency_stats:';
  RAISE NOTICE '    Max month: %', v_max_date;
  RAISE NOTICE '    Total rows: %', v_row_count;
  RAISE NOTICE '';

  -- Check monthly gestionnaire stats freshness
  SELECT MAX(period_month) INTO v_max_date
  FROM public.mv_monthly_gestionnaire_stats;

  SELECT COUNT(*) INTO v_row_count
  FROM public.mv_monthly_gestionnaire_stats;

  RAISE NOTICE '  mv_monthly_gestionnaire_stats:';
  RAISE NOTICE '    Max month: %', v_max_date;
  RAISE NOTICE '    Total rows: %', v_row_count;
  RAISE NOTICE '';
END $$;

-- ========================================
-- TEST 3: Performance Test - Sparklines
-- ========================================
\echo 'TEST 3: Performance test for get_sparkline_data() (target < 50ms)'
\echo '---------------------------------------------------------------------'

DO $$
DECLARE
  v_start timestamptz;
  v_end timestamptz;
  v_duration_ms numeric;
  v_result jsonb;
  v_data_points integer;
  v_demande_code text;
  v_terminee_code text;
BEGIN
  -- Get status codes
  SELECT code INTO v_demande_code FROM intervention_statuses WHERE code = 'DEMANDE' LIMIT 1;
  SELECT code INTO v_terminee_code FROM intervention_statuses WHERE code = 'INTER_TERMINEE' LIMIT 1;

  -- Measure execution time
  v_start := clock_timestamp();

  SELECT get_sparkline_data(
    (CURRENT_DATE - INTERVAL '365 days')::timestamptz,
    CURRENT_DATE::timestamptz,
    v_demande_code,
    v_terminee_code,
    NULL,
    NULL
  ) INTO v_result;

  v_end := clock_timestamp();
  v_duration_ms := EXTRACT(MILLISECONDS FROM (v_end - v_start));

  v_data_points := jsonb_array_length(v_result);

  RAISE NOTICE '  Execution time: % ms', ROUND(v_duration_ms, 2);
  RAISE NOTICE '  Data points returned: %', v_data_points;
  RAISE NOTICE '';

  IF v_duration_ms > 50 THEN
    RAISE WARNING '  WARNING: Slower than target (> 50ms)';
  ELSE
    RAISE NOTICE '  PASSED: Performance acceptable (< 50ms)';
  END IF;

  RAISE NOTICE '';
END $$;

-- ========================================
-- TEST 4: Data Consistency - MV vs Source
-- ========================================
\echo 'TEST 4: Verify data consistency between MV and source tables'
\echo '---------------------------------------------------------------------'

DO $$
DECLARE
  v_mv_count integer;
  v_source_count integer;
  v_diff integer;
  v_diff_percent numeric;
  v_test_date date;
BEGIN
  v_test_date := CURRENT_DATE - INTERVAL '30 days';

  -- Count from MV
  SELECT SUM(nb_transitions)::integer INTO v_mv_count
  FROM mv_daily_status_transitions
  WHERE transition_date >= v_test_date
    AND transition_date < v_test_date + INTERVAL '7 days'
    AND to_status_code = 'DEMANDE';

  -- Count from source
  CREATE TEMP TABLE temp_source_count AS
  SELECT COUNT(DISTINCT ist.intervention_id) as cnt
  FROM intervention_status_transitions ist
  INNER JOIN interventions i ON i.id = ist.intervention_id
  WHERE date_trunc('day', ist.transition_date)::date >= v_test_date
    AND date_trunc('day', ist.transition_date)::date < v_test_date + INTERVAL '7 days'
    AND ist.to_status_code = 'DEMANDE'
    AND i.is_active = true;

  SELECT cnt INTO v_source_count FROM temp_source_count;
  DROP TABLE temp_source_count;

  v_diff := ABS(v_mv_count - v_source_count);
  v_diff_percent := CASE
    WHEN v_source_count > 0 THEN (v_diff::numeric / v_source_count * 100)
    ELSE 0
  END;

  RAISE NOTICE '  Period tested: % to %', v_test_date, v_test_date + INTERVAL '7 days';
  RAISE NOTICE '  MV count: %', v_mv_count;
  RAISE NOTICE '  Source count: %', v_source_count;
  RAISE NOTICE '  Difference: % (%.2f%%)', v_diff, v_diff_percent;
  RAISE NOTICE '';

  IF v_diff_percent > 5 THEN
    RAISE WARNING '  WARNING: Difference > 5%% - MV may need refresh';
    RAISE NOTICE '  -> Run: REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_daily_status_transitions;';
  ELSE
    RAISE NOTICE '  PASSED: Data consistency OK (< 5%% difference)';
  END IF;

  RAISE NOTICE '';
END $$;

-- ========================================
-- TEST 5: Verify pg_cron Jobs
-- ========================================
\echo 'TEST 5: Verify pg_cron jobs are scheduled and active'
\echo '---------------------------------------------------------------------'

DO $$
DECLARE
  v_jobs_count integer;
  v_all_active boolean;
BEGIN
  -- Check if jobs exist and are active
  SELECT COUNT(*) INTO v_jobs_count
  FROM cron.job
  WHERE jobname LIKE 'refresh_mv_%';

  SELECT bool_and(active) INTO v_all_active
  FROM cron.job
  WHERE jobname LIKE 'refresh_mv_%';

  RAISE NOTICE '  Cron jobs found: %/3', v_jobs_count;
  RAISE NOTICE '  All jobs active: %', COALESCE(v_all_active, false);
  RAISE NOTICE '';

  IF v_jobs_count = 3 AND v_all_active THEN
    RAISE NOTICE '  PASSED: All refresh jobs scheduled and active';
  ELSE
    RAISE WARNING '  WARNING: Some refresh jobs missing or inactive!';
  END IF;

  RAISE NOTICE '';
END $$;

-- Show job details
SELECT
  jobname,
  schedule,
  active,
  LEFT(command, 60) || '...' as command_preview
FROM cron.job
WHERE jobname LIKE 'refresh_mv_%'
ORDER BY jobname;

\echo ''

-- ========================================
-- TEST 6: Test REFRESH CONCURRENTLY
-- ========================================
\echo 'TEST 6: Test REFRESH CONCURRENTLY (should complete without blocking)'
\echo '---------------------------------------------------------------------'

DO $$
DECLARE
  v_start timestamptz;
  v_end timestamptz;
  v_duration_ms numeric;
BEGIN
  RAISE NOTICE '  Testing REFRESH CONCURRENTLY on mv_daily_status_transitions...';

  v_start := clock_timestamp();

  -- This should complete without blocking reads
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_daily_status_transitions;

  v_end := clock_timestamp();
  v_duration_ms := EXTRACT(MILLISECONDS FROM (v_end - v_start));

  RAISE NOTICE '  Refresh duration: % ms', ROUND(v_duration_ms, 2);
  RAISE NOTICE '  PASSED: REFRESH CONCURRENTLY completed successfully';
  RAISE NOTICE '';
END $$;

-- ========================================
-- TEST 7: Performance Test - Breakdown Helpers
-- ========================================
\echo 'TEST 7: Performance test for agency/gestionnaire breakdown helpers'
\echo '---------------------------------------------------------------------'

DO $$
DECLARE
  v_start timestamptz;
  v_end timestamptz;
  v_duration_ms numeric;
  v_result jsonb;
  v_terminee_code text;
BEGIN
  -- Get status code
  SELECT code INTO v_terminee_code FROM intervention_statuses WHERE code = 'INTER_TERMINEE' LIMIT 1;

  -- Test agency breakdown
  RAISE NOTICE '  Testing get_agency_breakdown()...';
  v_start := clock_timestamp();

  SELECT get_agency_breakdown(
    (CURRENT_DATE - INTERVAL '6 months')::timestamptz,
    CURRENT_DATE::timestamptz,
    v_terminee_code,
    NULL
  ) INTO v_result;

  v_end := clock_timestamp();
  v_duration_ms := EXTRACT(MILLISECONDS FROM (v_end - v_start));

  RAISE NOTICE '    Execution time: % ms', ROUND(v_duration_ms, 2);

  IF v_duration_ms > 100 THEN
    RAISE WARNING '    WARNING: Slower than target (> 100ms)';
  ELSE
    RAISE NOTICE '    PASSED: Performance acceptable (< 100ms)';
  END IF;

  -- Test gestionnaire breakdown
  RAISE NOTICE '';
  RAISE NOTICE '  Testing get_gestionnaire_breakdown()...';
  v_start := clock_timestamp();

  SELECT get_gestionnaire_breakdown(
    (CURRENT_DATE - INTERVAL '6 months')::timestamptz,
    CURRENT_DATE::timestamptz,
    v_terminee_code,
    NULL
  ) INTO v_result;

  v_end := clock_timestamp();
  v_duration_ms := EXTRACT(MILLISECONDS FROM (v_end - v_start));

  RAISE NOTICE '    Execution time: % ms', ROUND(v_duration_ms, 2);

  IF v_duration_ms > 100 THEN
    RAISE WARNING '    WARNING: Slower than target (> 100ms)';
  ELSE
    RAISE NOTICE '    PASSED: Performance acceptable (< 100ms)';
  END IF;

  RAISE NOTICE '';
END $$;

-- ========================================
-- TEST 8: Index Coverage
-- ========================================
\echo 'TEST 8: Verify all required indexes exist on materialized views'
\echo '---------------------------------------------------------------------'

DO $$
DECLARE
  v_daily_indexes integer;
  v_agency_indexes integer;
  v_gestionnaire_indexes integer;
  v_daily_unique boolean;
  v_agency_unique boolean;
  v_gestionnaire_unique boolean;
BEGIN
  -- Count indexes per MV
  SELECT COUNT(*) INTO v_daily_indexes
  FROM pg_indexes
  WHERE tablename = 'mv_daily_status_transitions';

  SELECT COUNT(*) INTO v_agency_indexes
  FROM pg_indexes
  WHERE tablename = 'mv_monthly_agency_stats';

  SELECT COUNT(*) INTO v_gestionnaire_indexes
  FROM pg_indexes
  WHERE tablename = 'mv_monthly_gestionnaire_stats';

  -- Check for UNIQUE indexes (required for REFRESH CONCURRENTLY)
  SELECT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'mv_daily_status_transitions'
      AND indexdef LIKE '%UNIQUE%'
  ) INTO v_daily_unique;

  SELECT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'mv_monthly_agency_stats'
      AND indexdef LIKE '%UNIQUE%'
  ) INTO v_agency_unique;

  SELECT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'mv_monthly_gestionnaire_stats'
      AND indexdef LIKE '%UNIQUE%'
  ) INTO v_gestionnaire_unique;

  RAISE NOTICE '  mv_daily_status_transitions: % indexes (UNIQUE: %)', v_daily_indexes, v_daily_unique;
  RAISE NOTICE '  mv_monthly_agency_stats: % indexes (UNIQUE: %)', v_agency_indexes, v_agency_unique;
  RAISE NOTICE '  mv_monthly_gestionnaire_stats: % indexes (UNIQUE: %)', v_gestionnaire_indexes, v_gestionnaire_unique;
  RAISE NOTICE '';

  IF v_daily_unique AND v_agency_unique AND v_gestionnaire_unique THEN
    RAISE NOTICE '  PASSED: All MVs have required UNIQUE indexes';
  ELSE
    RAISE WARNING '  WARNING: Some MVs missing UNIQUE indexes!';
    RAISE NOTICE '  -> REFRESH CONCURRENTLY will not work without UNIQUE indexes';
  END IF;

  RAISE NOTICE '';
END $$;

-- Show all indexes
SELECT
  tablename,
  indexname,
  CASE WHEN indexdef LIKE '%UNIQUE%' THEN 'YES' ELSE 'NO' END as is_unique
FROM pg_indexes
WHERE tablename LIKE 'mv_%'
ORDER BY tablename, indexname;

\echo ''

-- ========================================
-- TEST SUMMARY
-- ========================================
\echo '========================================='
\echo 'LEVEL 2 TEST SUMMARY'
\echo '========================================='
\echo ''
\echo 'If all tests PASSED:'
\echo '  -> Phase 2 validated, MVs are working correctly'
\echo '  -> Automatic refresh is scheduled (runs daily at 1am)'
\echo '  -> Ready for Phase 3 (RPC refactoring)'
\echo ''
\echo 'If tests failed:'
\echo '  -> Check WARNINGS above'
\echo '  -> Refresh MVs manually if needed:'
\echo '     REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_daily_status_transitions;'
\echo '     REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_monthly_agency_stats;'
\echo '     REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_monthly_gestionnaire_stats;'
\echo ''
\echo 'Performance targets:'
\echo '  - Sparklines: < 50ms (vs 400ms before)'
\echo '  - Agency breakdown: < 100ms (vs 150ms before)'
\echo '  - Gestionnaire breakdown: < 100ms (vs 150ms before)'
\echo ''
\echo 'Next steps:'
\echo '  1. Apply migration: psql < 00018_level2_materialized_views.sql'
\echo '  2. Run tests: psql < 03_test_level2_mvs.sql'
\echo '  3. Monitor first automatic refresh (next day at 1am)'
\echo '  4. If OK -> Move to Phase 3 (00019_level3_rpc_refactor.sql)'
\echo '========================================='
