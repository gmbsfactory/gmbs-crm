-- ========================================
-- Tests Phase 1: Level 1 Cache (intervention_status_cache)
-- ========================================
-- Objective: Validate that cache is properly populated and synchronized
-- Run after migration 00017_level1_cache_status_transitions.sql
-- ========================================

\echo '========================================='
\echo 'LEVEL 1 TESTS: intervention_status_cache'
\echo '========================================='
\echo ''

-- ========================================
-- TEST 1: Cache Completeness
-- ========================================
\echo 'TEST 1: Verify all active interventions are in cache'
\echo '---------------------------------------------------------------------'

DO $$
DECLARE
  v_total_interventions integer;
  v_cached_interventions integer;
  v_missing integer;
BEGIN
  -- Count active interventions
  SELECT COUNT(*) INTO v_total_interventions
  FROM public.interventions
  WHERE is_active = true;

  -- Count cached interventions
  SELECT COUNT(*) INTO v_cached_interventions
  FROM public.intervention_status_cache;

  v_missing := v_total_interventions - v_cached_interventions;

  RAISE NOTICE '  Total active interventions: %', v_total_interventions;
  RAISE NOTICE '  Cached interventions: %', v_cached_interventions;
  RAISE NOTICE '  Missing: %', v_missing;
  RAISE NOTICE '';

  IF v_missing > 0 THEN
    RAISE WARNING '  WARNING: % interventions missing from cache!', v_missing;
    RAISE NOTICE '  -> Run: SELECT i.id, i.id_inter FROM interventions i LEFT JOIN intervention_status_cache isc ON isc.intervention_id = i.id WHERE i.is_active = true AND isc.intervention_id IS NULL;';
  ELSE
    RAISE NOTICE '  PASSED: Cache complete (%/%)', v_cached_interventions, v_total_interventions;
  END IF;

  RAISE NOTICE '';
END $$;

-- ========================================
-- TEST 2: Cycle Time Accuracy
-- ========================================
\echo 'TEST 2: Verify cycle time calculation accuracy'
\echo '---------------------------------------------------------------------'

DO $$
DECLARE
  v_total_checked integer;
  v_matching integer;
  v_discrepancies integer;
  v_avg_diff numeric;
  v_max_diff numeric;
BEGIN
  -- Compare cycle_time_days from cache vs manual calculation
  CREATE TEMP TABLE comparison_temp AS
  WITH cache_cycle AS (
    SELECT intervention_id, cycle_time_days
    FROM intervention_status_cache
    WHERE cycle_time_days IS NOT NULL
    LIMIT 1000
  ),
  manual_cycle AS (
    SELECT
      ist_t.intervention_id,
      EXTRACT(EPOCH FROM (ist_t.first_terminee - ist_d.first_demande)) / 86400.0 as cycle_time
    FROM (
      SELECT intervention_id, MIN(transition_date) as first_demande
      FROM intervention_status_transitions
      WHERE to_status_code = 'DEMANDE'
      GROUP BY intervention_id
    ) ist_d
    INNER JOIN (
      SELECT intervention_id, MIN(transition_date) as first_terminee
      FROM intervention_status_transitions
      WHERE to_status_code = 'INTER_TERMINEE'
      GROUP BY intervention_id
    ) ist_t ON ist_t.intervention_id = ist_d.intervention_id
  )
  SELECT
    c.intervention_id,
    c.cycle_time_days as cache_value,
    m.cycle_time as manual_value,
    ABS(c.cycle_time_days - m.cycle_time) as diff
  FROM cache_cycle c
  INNER JOIN manual_cycle m ON m.intervention_id = c.intervention_id;

  SELECT COUNT(*) INTO v_total_checked FROM comparison_temp;
  SELECT COUNT(*) INTO v_matching FROM comparison_temp WHERE diff < 0.01;
  SELECT COUNT(*) INTO v_discrepancies FROM comparison_temp WHERE diff >= 0.01;
  SELECT AVG(diff) INTO v_avg_diff FROM comparison_temp;
  SELECT MAX(diff) INTO v_max_diff FROM comparison_temp;

  DROP TABLE comparison_temp;

  RAISE NOTICE '  Interventions checked: %', v_total_checked;
  RAISE NOTICE '  Exact matches: % (%.1f%%)', v_matching, (v_matching::numeric / NULLIF(v_total_checked, 0) * 100);
  RAISE NOTICE '  Average difference: % days', ROUND(v_avg_diff, 4);
  RAISE NOTICE '  Maximum difference: % days', ROUND(v_max_diff, 4);
  RAISE NOTICE '';

  IF v_discrepancies > 0 THEN
    RAISE WARNING '  WARNING: % interventions with difference > 0.01 days', v_discrepancies;
  ELSE
    RAISE NOTICE '  PASSED: All cycle times are accurate';
  END IF;

  RAISE NOTICE '';
END $$;

-- ========================================
-- TEST 3: Trigger Performance
-- ========================================
\echo 'TEST 3: Verify trigger performance (target < 10ms)'
\echo '---------------------------------------------------------------------'

DO $$
DECLARE
  v_start timestamptz;
  v_end timestamptz;
  v_duration_ms numeric;
  v_test_intervention_id uuid;
  v_test_status_id uuid;
BEGIN
  -- Get test intervention
  SELECT id INTO v_test_intervention_id
  FROM interventions
  WHERE is_active = true
  LIMIT 1;

  -- Get INTER_TERMINEE status ID
  SELECT id INTO v_test_status_id
  FROM intervention_statuses
  WHERE code = 'INTER_TERMINEE';

  -- Measure trigger execution time
  v_start := clock_timestamp();

  -- Insert test transition (will be rolled back)
  BEGIN
    INSERT INTO intervention_status_transitions (
      intervention_id,
      to_status_id,
      to_status_code,
      transition_date,
      source
    )
    VALUES (
      v_test_intervention_id,
      v_test_status_id,
      'INTER_TERMINEE',
      now(),
      'api'
    );

    v_end := clock_timestamp();
    v_duration_ms := EXTRACT(MILLISECONDS FROM (v_end - v_start));

    -- Rollback test transaction
    RAISE EXCEPTION 'ROLLBACK_TEST' USING ERRCODE = 'TSTRB';
  EXCEPTION
    WHEN SQLSTATE 'TSTRB' THEN
      -- This is our intentional rollback
      NULL;
  END;

  RAISE NOTICE '  Trigger execution time: % ms', ROUND(v_duration_ms, 2);
  RAISE NOTICE '';

  IF v_duration_ms > 10 THEN
    RAISE WARNING '  WARNING: Trigger slower than target (> 10ms)';
  ELSE
    RAISE NOTICE '  PASSED: Performance acceptable (< 10ms)';
  END IF;

  RAISE NOTICE '';
END $$;

-- ========================================
-- TEST 4: Current Status Validation
-- ========================================
\echo 'TEST 4: Verify current_status_code matches real status'
\echo '---------------------------------------------------------------------'

DO $$
DECLARE
  v_total_checked integer;
  v_matching integer;
  v_mismatches integer;
BEGIN
  CREATE TEMP TABLE comparison_status_temp AS
  SELECT
    i.id,
    isc.current_status_code as cache_status,
    ist_current.code as real_status
  FROM interventions i
  INNER JOIN intervention_statuses ist_current ON ist_current.id = i.statut_id
  LEFT JOIN intervention_status_cache isc ON isc.intervention_id = i.id
  WHERE i.is_active = true;

  SELECT COUNT(*) INTO v_total_checked FROM comparison_status_temp;
  SELECT COUNT(*) INTO v_matching FROM comparison_status_temp WHERE cache_status = real_status;
  SELECT COUNT(*) INTO v_mismatches FROM comparison_status_temp WHERE cache_status IS NULL OR cache_status != real_status;

  DROP TABLE comparison_status_temp;

  RAISE NOTICE '  Interventions checked: %', v_total_checked;
  RAISE NOTICE '  Matching statuses: % (%.1f%%)', v_matching, (v_matching::numeric / NULLIF(v_total_checked, 0) * 100);
  RAISE NOTICE '  Mismatches: %', v_mismatches;
  RAISE NOTICE '';

  IF v_mismatches > 0 THEN
    RAISE WARNING '  WARNING: % interventions with incorrect status!', v_mismatches;
  ELSE
    RAISE NOTICE '  PASSED: All current statuses are correct';
  END IF;

  RAISE NOTICE '';
END $$;

-- ========================================
-- TEST 5: CA Validation (intervention_costs_cache)
-- ========================================
\echo 'TEST 5: Verify intervention_costs_cache synchronization'
\echo '---------------------------------------------------------------------'

DO $$
DECLARE
  v_total_checked integer;
  v_ok_count integer;
  v_out_of_sync integer;
  v_missing_cache integer;
BEGIN
  CREATE TEMP TABLE validation_temp AS
  SELECT status FROM validate_intervention_ca();

  SELECT COUNT(*) INTO v_total_checked FROM validation_temp;
  SELECT COUNT(*) INTO v_ok_count FROM validation_temp WHERE status = 'OK';
  SELECT COUNT(*) INTO v_out_of_sync FROM validation_temp WHERE status = 'OUT_OF_SYNC';
  SELECT COUNT(*) INTO v_missing_cache FROM validation_temp WHERE status = 'CACHE_MISSING';

  DROP TABLE validation_temp;

  RAISE NOTICE '  Interventions checked: %', v_total_checked;
  RAISE NOTICE '  Synchronized (OK): % (%.1f%%)', v_ok_count, (v_ok_count::numeric / NULLIF(v_total_checked, 0) * 100);
  RAISE NOTICE '  Out of sync: %', v_out_of_sync;
  RAISE NOTICE '  Missing cache: %', v_missing_cache;
  RAISE NOTICE '';

  IF v_out_of_sync > 0 THEN
    RAISE WARNING '  WARNING: % interventions with unsynchronized CA!', v_out_of_sync;
    RAISE NOTICE '  -> Run: SELECT refresh_dashboard_cache();';
  ELSIF v_missing_cache > 0 THEN
    RAISE WARNING '  WARNING: % interventions missing from costs_cache!', v_missing_cache;
  ELSE
    RAISE NOTICE '  PASSED: CA cache perfectly synchronized';
  END IF;

  RAISE NOTICE '';
END $$;

-- ========================================
-- TEST 6: Cache Statistics
-- ========================================
\echo 'TEST 6: General cache statistics'
\echo '---------------------------------------------------------------------'

SELECT
  'Total interventions in cache' as metric,
  COUNT(*)::text as value
FROM intervention_status_cache

UNION ALL

SELECT
  'With cycle time calculated',
  COUNT(*)::text
FROM intervention_status_cache
WHERE cycle_time_days IS NOT NULL

UNION ALL

SELECT
  'With first demande',
  COUNT(*)::text
FROM intervention_status_cache
WHERE first_demande_date IS NOT NULL

UNION ALL

SELECT
  'With first terminee',
  COUNT(*)::text
FROM intervention_status_cache
WHERE first_terminee_date IS NOT NULL

UNION ALL

SELECT
  'Average cycle time (days)',
  ROUND(AVG(cycle_time_days), 2)::text
FROM intervention_status_cache
WHERE cycle_time_days IS NOT NULL

UNION ALL

SELECT
  'Median cycle time (days)',
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY cycle_time_days)::numeric, 2)::text
FROM intervention_status_cache
WHERE cycle_time_days IS NOT NULL

UNION ALL

SELECT
  'Oldest cache entry',
  TO_CHAR(MIN(updated_at), 'YYYY-MM-DD HH24:MI:SS')
FROM intervention_status_cache

UNION ALL

SELECT
  'Newest cache entry',
  TO_CHAR(MAX(updated_at), 'YYYY-MM-DD HH24:MI:SS')
FROM intervention_status_cache;

\echo ''

-- ========================================
-- TEST 7: Index Coverage
-- ========================================
\echo 'TEST 7: Verify all indexes are created'
\echo '---------------------------------------------------------------------'

SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'intervention_status_cache'
ORDER BY indexname;

\echo ''

-- ========================================
-- TEST SUMMARY
-- ========================================
\echo '========================================='
\echo 'LEVEL 1 TEST SUMMARY'
\echo '========================================='
\echo ''
\echo 'If all tests PASSED:'
\echo '  -> Phase 1 validated, ready for Phase 2 (materialized views)'
\echo ''
\echo 'If tests failed:'
\echo '  -> Check WARNINGS above'
\echo '  -> Resynchronize if needed (see suggestions)'
\echo ''
\echo 'Next steps:'
\echo '  1. Apply migration: psql < 00017_level1_cache_status_transitions.sql'
\echo '  2. Run tests: psql < 02_test_level1_cache.sql'
\echo '  3. If OK -> Move to Phase 2 (00018_level2_materialized_views.sql)'
\echo '========================================='
