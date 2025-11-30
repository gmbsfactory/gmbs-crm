-- ========================================
-- Test: Calcul du Cycle Moyen (Cycle Time)
-- ========================================
-- Objectif: Reprendre la logique exacte du calcul du cycle moyen
-- et identifier les problèmes (valeurs négatives, NULL, etc.)
-- ========================================

\echo '========================================='
\echo 'TEST: Calcul du Cycle Moyen'
\echo '========================================='
\echo ''

-- Paramètres de test (mêmes que dans 00_test_complete_rpc.sql)
DO $$
DECLARE
  p_period_start timestamptz := '2025-01-01T00:00:00Z'::timestamptz;
  p_period_end timestamptz := '2026-01-01T00:00:00Z'::timestamptz;
  p_demande_status_code text := 'DEMANDE';
  p_devis_status_code text := 'DEVIS_ENVOYE';
  p_accepte_status_code text := 'ACCEPTE';
  p_en_cours_status_code text := 'INTER_EN_COURS';
  p_terminee_status_code text := 'INTER_TERMINEE';
  p_att_acompte_status_code text := 'ATT_ACOMPTE';
  p_valid_status_codes text[] := ARRAY['DEVIS_ENVOYE', 'ACCEPTE', 'INTER_EN_COURS', 'INTER_TERMINEE', 'ATT_ACOMPTE'];
  p_agence_id uuid := NULL;
  p_gestionnaire_id uuid := NULL;
  p_metier_id uuid := NULL;

  -- Variables pour les résultats
  v_avg_cycle_time_from_rpc numeric;
  v_avg_cycle_time_manual numeric;
  v_count_total integer;
  v_count_positive integer;
  v_count_negative integer;
  v_count_null integer;
  v_min_cycle_time numeric;
  v_max_cycle_time numeric;
BEGIN

  -- ========================================
  -- TEST 1: Récupérer le cycle moyen depuis la fonction RPC
  -- ========================================
  RAISE NOTICE 'TEST 1: Cycle moyen depuis la fonction RPC';
  RAISE NOTICE '---------------------------------------------------------------------';

  SELECT (result->'mainStats'->>'avgCycleTime')::numeric INTO v_avg_cycle_time_from_rpc
  FROM (
    SELECT public.get_admin_dashboard_stats_v2(
      p_period_start,
      p_period_end,
      p_demande_status_code,
      p_devis_status_code,
      p_accepte_status_code,
      p_en_cours_status_code,
      p_terminee_status_code,
      p_att_acompte_status_code,
      p_valid_status_codes,
      p_agence_id,
      p_gestionnaire_id,
      p_metier_id
    ) as result
  ) rpc;

  RAISE NOTICE '  Cycle moyen (RPC): % jours', v_avg_cycle_time_from_rpc;
  RAISE NOTICE '';

  -- ========================================
  -- TEST 2: Reprendre la logique exacte du calcul
  -- ========================================
  RAISE NOTICE 'TEST 2: Reprendre la logique exacte du calcul';
  RAISE NOTICE '---------------------------------------------------------------------';

  WITH
  -- Reprendre les mêmes CTEs que dans la fonction RPC
  interventions_crees_periode AS (
    SELECT i.id, i.agence_id, i.metier_id, i.assigned_user_id
    FROM interventions i
    INNER JOIN intervention_costs_cache icc ON icc.intervention_id = i.id
    WHERE i.is_active = true
      AND i.date >= p_period_start AND i.date < p_period_end
      AND (p_agence_id IS NULL OR i.agence_id = p_agence_id)
      AND (p_metier_id IS NULL OR i.metier_id = p_metier_id)
      AND (p_gestionnaire_id IS NULL OR i.assigned_user_id = p_gestionnaire_id)
  ),

  transitions_periode AS (
    SELECT ist.intervention_id, ist.to_status_code
    FROM intervention_status_transitions ist
    INNER JOIN interventions_crees_periode ip ON ip.id = ist.intervention_id
    WHERE ist.transition_date >= p_period_start AND ist.transition_date <= p_period_end
  ),

  -- Logique exacte du calcul du cycle moyen
  autres_metriques AS (
    SELECT
      COUNT(DISTINCT CASE WHEN tp.to_status_code = p_devis_status_code THEN tp.intervention_id END)::int as nb_devis,
      COUNT(DISTINCT CASE WHEN tp.to_status_code = ANY(p_valid_status_codes) THEN tp.intervention_id END)::int as nb_valides,
      COALESCE(AVG(isc.cycle_time_days), 0)::numeric(10,2) as avg_cycle_time_days
    FROM transitions_periode tp
    LEFT JOIN intervention_status_cache isc ON isc.intervention_id = tp.intervention_id
      AND tp.to_status_code = p_terminee_status_code
  )

  SELECT avg_cycle_time_days INTO v_avg_cycle_time_manual
  FROM autres_metriques;

  RAISE NOTICE '  Cycle moyen (logique manuelle): % jours', v_avg_cycle_time_manual;
  RAISE NOTICE '';

  -- Vérifier la cohérence
  IF ABS(COALESCE(v_avg_cycle_time_from_rpc, 0) - COALESCE(v_avg_cycle_time_manual, 0)) < 0.01 THEN
    RAISE NOTICE '  ✓ PASSED: Les deux calculs sont cohérents';
  ELSE
    RAISE WARNING '  ✗ WARNING: Différence entre RPC et logique manuelle!';
    RAISE NOTICE '    Différence: % jours', ABS(v_avg_cycle_time_from_rpc - v_avg_cycle_time_manual);
  END IF;
  RAISE NOTICE '';

  -- ========================================
  -- TEST 3: Analyser les cycle_time_days dans le cache
  -- ========================================
  RAISE NOTICE 'TEST 3: Analyse détaillée des cycle_time_days';
  RAISE NOTICE '---------------------------------------------------------------------';

  -- Créer une table temporaire pour réutiliser les données
  CREATE TEMP TABLE temp_cycle_times_analysis AS
  WITH
  interventions_crees_periode AS (
    SELECT i.id, i.agence_id, i.metier_id, i.assigned_user_id
    FROM interventions i
    INNER JOIN intervention_costs_cache icc ON icc.intervention_id = i.id
    WHERE i.is_active = true
      AND i.date >= p_period_start AND i.date < p_period_end
      AND (p_agence_id IS NULL OR i.agence_id = p_agence_id)
      AND (p_metier_id IS NULL OR i.metier_id = p_metier_id)
      AND (p_gestionnaire_id IS NULL OR i.assigned_user_id = p_gestionnaire_id)
  ),
  transitions_periode AS (
    SELECT ist.intervention_id, ist.to_status_code
    FROM intervention_status_transitions ist
    INNER JOIN interventions_crees_periode ip ON ip.id = ist.intervention_id
    WHERE ist.transition_date >= p_period_start AND ist.transition_date <= p_period_end
      AND ist.to_status_code = p_terminee_status_code
  ),
  cycle_times_analysis AS (
    SELECT
      tp.intervention_id,
      isc.cycle_time_days,
      isc.first_demande_date,
      isc.first_terminee_date,
      CASE
        WHEN isc.cycle_time_days IS NULL THEN 'NULL'
        WHEN isc.cycle_time_days < 0 THEN 'NEGATIF'
        WHEN isc.cycle_time_days = 0 THEN 'ZERO'
        ELSE 'POSITIF'
      END as category
    FROM transitions_periode tp
    LEFT JOIN intervention_status_cache isc ON isc.intervention_id = tp.intervention_id
  )
  SELECT * FROM cycle_times_analysis;

  SELECT COUNT(*)::int INTO v_count_total FROM temp_cycle_times_analysis;
  SELECT COUNT(*)::int INTO v_count_positive FROM temp_cycle_times_analysis WHERE category = 'POSITIF';
  SELECT COUNT(*)::int INTO v_count_negative FROM temp_cycle_times_analysis WHERE category = 'NEGATIF';
  SELECT COUNT(*)::int INTO v_count_null FROM temp_cycle_times_analysis WHERE category = 'NULL';
  SELECT MIN(cycle_time_days) INTO v_min_cycle_time FROM temp_cycle_times_analysis WHERE cycle_time_days IS NOT NULL;
  SELECT MAX(cycle_time_days) INTO v_max_cycle_time FROM temp_cycle_times_analysis WHERE cycle_time_days IS NOT NULL;

  RAISE NOTICE '  Interventions terminées dans la période: %', v_count_total;
  RAISE NOTICE '  - Cycle time positif: %', v_count_positive;
  RAISE NOTICE '  - Cycle time négatif: %', v_count_negative;
  RAISE NOTICE '  - Cycle time NULL: %', v_count_null;
  RAISE NOTICE '  - Cycle time min: % jours', v_min_cycle_time;
  RAISE NOTICE '  - Cycle time max: % jours', v_max_cycle_time;
  RAISE NOTICE '';

  IF v_count_negative > 0 THEN
    RAISE WARNING '  ✗ WARNING: % interventions avec cycle time négatif!', v_count_negative;
    RAISE NOTICE '    Cela peut expliquer un cycle moyen négatif ou anormal.';
  END IF;
  RAISE NOTICE '';

  -- ========================================
  -- TEST 4: Détails des interventions avec cycle time négatif
  -- ========================================
  RAISE NOTICE 'TEST 4: Détails des interventions avec cycle time négatif';
  RAISE NOTICE '---------------------------------------------------------------------';

  WITH
  interventions_crees_periode AS (
    SELECT i.id, i.agence_id, i.metier_id, i.assigned_user_id, i.id_inter
    FROM interventions i
    INNER JOIN intervention_costs_cache icc ON icc.intervention_id = i.id
    WHERE i.is_active = true
      AND i.date >= p_period_start AND i.date < p_period_end
      AND (p_agence_id IS NULL OR i.agence_id = p_agence_id)
      AND (p_metier_id IS NULL OR i.metier_id = p_metier_id)
      AND (p_gestionnaire_id IS NULL OR i.assigned_user_id = p_gestionnaire_id)
  ),
  transitions_periode AS (
    SELECT ist.intervention_id, ist.to_status_code
    FROM intervention_status_transitions ist
    INNER JOIN interventions_crees_periode ip ON ip.id = ist.intervention_id
    WHERE ist.transition_date >= p_period_start AND ist.transition_date <= p_period_end
      AND ist.to_status_code = p_terminee_status_code
  ),
  negative_cycles AS (
    SELECT
      tp.intervention_id,
      i.id_inter,
      isc.cycle_time_days,
      isc.first_demande_date,
      isc.first_terminee_date,
      EXTRACT(EPOCH FROM (isc.first_terminee_date - isc.first_demande_date)) / 86400.0 as manual_calculation
    FROM transitions_periode tp
    LEFT JOIN intervention_status_cache isc ON isc.intervention_id = tp.intervention_id
    LEFT JOIN interventions i ON i.id = tp.intervention_id
    WHERE isc.cycle_time_days IS NOT NULL
      AND isc.cycle_time_days < 0
    ORDER BY isc.cycle_time_days ASC
    LIMIT 10
  )
  SELECT
    intervention_id,
    id_inter,
    cycle_time_days,
    first_demande_date,
    first_terminee_date,
    manual_calculation
  FROM negative_cycles;

  IF v_count_negative > 0 THEN
    RAISE NOTICE '';
    RAISE NOTICE '  → Les 10 premières interventions avec cycle time négatif sont affichées ci-dessus.';
    RAISE NOTICE '  → Vérifiez si first_terminee_date < first_demande_date (problème de données).';
  ELSE
    RAISE NOTICE '  ✓ Aucune intervention avec cycle time négatif trouvée.';
  END IF;
  RAISE NOTICE '';

  -- ========================================
  -- TEST 5: Vérification de la cohérence des dates
  -- ========================================
  RAISE NOTICE 'TEST 5: Vérification de la cohérence des dates';
  RAISE NOTICE '---------------------------------------------------------------------';

  WITH
  interventions_crees_periode AS (
    SELECT i.id
    FROM interventions i
    INNER JOIN intervention_costs_cache icc ON icc.intervention_id = i.id
    WHERE i.is_active = true
      AND i.date >= p_period_start AND i.date < p_period_end
      AND (p_agence_id IS NULL OR i.agence_id = p_agence_id)
      AND (p_metier_id IS NULL OR i.metier_id = p_metier_id)
      AND (p_gestionnaire_id IS NULL OR i.assigned_user_id = p_gestionnaire_id)
  ),
  transitions_periode AS (
    SELECT ist.intervention_id, ist.to_status_code
    FROM intervention_status_transitions ist
    INNER JOIN interventions_crees_periode ip ON ip.id = ist.intervention_id
    WHERE ist.transition_date >= p_period_start AND ist.transition_date <= p_period_end
      AND ist.to_status_code = p_terminee_status_code
  ),
  date_consistency AS (
    SELECT
      tp.intervention_id,
      isc.first_demande_date,
      isc.first_terminee_date,
      CASE
        WHEN isc.first_demande_date IS NULL THEN 'DEMANDE_MANQUANTE'
        WHEN isc.first_terminee_date IS NULL THEN 'TERMINEE_MANQUANTE'
        WHEN isc.first_terminee_date < isc.first_demande_date THEN 'TERMINEE_AVANT_DEMANDE'
        WHEN isc.first_terminee_date = isc.first_demande_date THEN 'MEME_DATE'
        ELSE 'OK'
      END as status
    FROM transitions_periode tp
    LEFT JOIN intervention_status_cache isc ON isc.intervention_id = tp.intervention_id
  )
  SELECT
    status,
    COUNT(*)::int as count
  FROM date_consistency
  GROUP BY status
  ORDER BY count DESC;

  RAISE NOTICE '';
  RAISE NOTICE '  → Analyse de la cohérence des dates pour les interventions terminées.';
  RAISE NOTICE '';

  -- ========================================
  -- TEST 6: Calcul manuel du cycle moyen (sans valeurs négatives)
  -- ========================================
  RAISE NOTICE 'TEST 6: Calcul manuel du cycle moyen (sans valeurs négatives)';
  RAISE NOTICE '---------------------------------------------------------------------';

  WITH
  interventions_crees_periode AS (
    SELECT i.id
    FROM interventions i
    INNER JOIN intervention_costs_cache icc ON icc.intervention_id = i.id
    WHERE i.is_active = true
      AND i.date >= p_period_start AND i.date < p_period_end
      AND (p_agence_id IS NULL OR i.agence_id = p_agence_id)
      AND (p_metier_id IS NULL OR i.metier_id = p_metier_id)
      AND (p_gestionnaire_id IS NULL OR i.assigned_user_id = p_gestionnaire_id)
  ),
  transitions_periode AS (
    SELECT ist.intervention_id, ist.to_status_code
    FROM intervention_status_transitions ist
    INNER JOIN interventions_crees_periode ip ON ip.id = ist.intervention_id
    WHERE ist.transition_date >= p_period_start AND ist.transition_date <= p_period_end
      AND ist.to_status_code = p_terminee_status_code
  ),
  filtered_cycle_times AS (
    SELECT
      isc.cycle_time_days
    FROM transitions_periode tp
    LEFT JOIN intervention_status_cache isc ON isc.intervention_id = tp.intervention_id
    WHERE isc.cycle_time_days IS NOT NULL
      AND isc.cycle_time_days >= 0  -- Exclure les valeurs négatives
  )
  SELECT
    COUNT(*)::int as count_valid,
    COALESCE(AVG(cycle_time_days), 0)::numeric(10,2) as avg_cycle_time_filtered,
    COALESCE(MIN(cycle_time_days), 0)::numeric(10,2) as min_cycle_time,
    COALESCE(MAX(cycle_time_days), 0)::numeric(10,2) as max_cycle_time,
    COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY cycle_time_days), 0)::numeric(10,2) as median_cycle_time
  FROM filtered_cycle_times;

  RAISE NOTICE '';
  RAISE NOTICE '  → Ce calcul exclut les valeurs négatives et NULL.';
  RAISE NOTICE '  → Comparez avec le cycle moyen de la RPC pour identifier le problème.';
  RAISE NOTICE '';

  -- Nettoyer la table temporaire
  DROP TABLE IF EXISTS temp_cycle_times_analysis;

END $$;

-- ========================================
-- Résumé et recommandations
-- ========================================
\echo '========================================='
\echo 'RÉSUMÉ'
\echo '========================================='
\echo ''
\echo 'Si le cycle moyen est négatif (-40.1j), vérifiez:'
\echo '  1. Les interventions avec first_terminee_date < first_demande_date'
\echo '  2. Les transitions de statut dans intervention_status_transitions'
\echo '  3. La cohérence du cache intervention_status_cache'
\echo ''
\echo 'Pour corriger:'
\echo '  - Vérifier les dates dans intervention_status_transitions'
\echo '  - Recalculer le cache: REFRESH intervention_status_cache'
\echo '  - Ou filtrer les valeurs négatives dans le calcul du cycle moyen'
\echo ''