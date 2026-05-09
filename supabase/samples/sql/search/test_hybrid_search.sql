-- ============================================================================
-- Tests manuels : Hybrid Search (search_global + buffer live)
-- ============================================================================
--
-- Suit le pattern des autres test_*.sql de ce dossier.
-- À exécuter manuellement dans psql ou Supabase SQL editor sur dev/staging.
-- Chaque bloc est indépendant et nettoie ses données à la fin.
-- ============================================================================

-- ============================================================================
-- TEST 1 : Buffer live — une intervention créée AVANT le prochain refresh
--          du cron doit être trouvable IMMÉDIATEMENT par search_global.
-- ============================================================================

DO $$
DECLARE
  v_test_id_inter text := 'TEST-HYBRID-' || extract(epoch from now())::bigint;
  v_intervention_id uuid;
  v_results record;
  v_count int;
BEGIN
  -- 1. Forcer un refresh propre pour avoir un last_refresh récent
  PERFORM refresh_search_views_if_needed();

  -- 2. Insérer une intervention APRÈS le refresh
  --    (pour le test on insert un row minimal — adapter aux NOT NULL réels)
  INSERT INTO interventions (id_inter, contexte_intervention, is_active)
  VALUES (v_test_id_inter, 'Test buffer live hybride', true)
  RETURNING id INTO v_intervention_id;

  -- 3. Chercher IMMÉDIATEMENT (avant tout refresh cron)
  SELECT count(*) INTO v_count
  FROM search_global(v_test_id_inter, 20, 0, 'intervention')
  WHERE entity_id = v_intervention_id;

  IF v_count = 1 THEN
    RAISE NOTICE 'TEST 1 OK : intervention fraîche trouvée via buffer live (%)', v_test_id_inter;
  ELSE
    RAISE WARNING 'TEST 1 FAIL : intervention introuvable, attendu 1 résultat, trouvé %', v_count;
  END IF;

  -- Cleanup
  DELETE FROM interventions WHERE id = v_intervention_id;
END;
$$;

-- ============================================================================
-- TEST 2 : Déduplication — une intervention présente dans la MV ET dans le
--          buffer ne doit apparaître qu'UNE seule fois, et la version live
--          doit gagner (priority 0 vs 1).
-- ============================================================================

DO $$
DECLARE
  v_test_id_inter text := 'TEST-DEDUP-' || extract(epoch from now())::bigint;
  v_intervention_id uuid;
  v_count int;
BEGIN
  -- 1. Insérer une intervention
  INSERT INTO interventions (id_inter, contexte_intervention, is_active)
  VALUES (v_test_id_inter, 'Test dedup MV vs live', true)
  RETURNING id INTO v_intervention_id;

  -- 2. Forcer le refresh pour la mettre dans la MV
  PERFORM refresh_search_views_if_needed();

  -- 3. UPDATE pour la repasser dans le buffer live (updated_at > last_refresh)
  UPDATE interventions
  SET commentaire_agent = 'Touched after refresh'
  WHERE id = v_intervention_id;

  -- 4. Chercher : doit ressortir UNE SEULE fois malgré la double présence
  SELECT count(*) INTO v_count
  FROM search_global(v_test_id_inter, 20, 0, 'intervention')
  WHERE entity_id = v_intervention_id;

  IF v_count = 1 THEN
    RAISE NOTICE 'TEST 2 OK : dédup fonctionne (1 résultat unique)';
  ELSE
    RAISE WARNING 'TEST 2 FAIL : attendu 1 résultat, trouvé %', v_count;
  END IF;

  -- Cleanup
  DELETE FROM interventions WHERE id = v_intervention_id;
END;
$$;

-- ============================================================================
-- TEST 3 : Type de retour — `rank` doit être double precision et la
--          fonction ne doit jamais lever d'erreur 42804 (UNION mismatch).
--          Régression : ce bug s'était produit avec rank `real` + littéraux
--          double precision dans le GREATEST.
-- ============================================================================

DO $$
DECLARE
  v_results record;
  v_rank_type text;
BEGIN
  -- Vérifier le type de retour de la fonction
  SELECT format_type(t.atttypid, t.atttypmod) INTO v_rank_type
  FROM pg_proc p
  JOIN pg_type rt ON rt.oid = p.prorettype
  JOIN pg_attribute t ON t.attrelid = rt.typrelid AND t.attname = 'rank'
  WHERE p.proname = 'search_global'
  LIMIT 1;

  IF v_rank_type = 'double precision' THEN
    RAISE NOTICE 'TEST 3 OK : rank typé double precision';
  ELSE
    RAISE WARNING 'TEST 3 FAIL : rank typé % (attendu double precision)', v_rank_type;
  END IF;

  -- Lancer une recherche pour s'assurer qu'aucune erreur runtime ne lève
  BEGIN
    PERFORM * FROM search_global('test', 5, 0, NULL);
    RAISE NOTICE 'TEST 3 OK : exécution sans erreur';
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'TEST 3 FAIL : erreur runtime — % (%)', SQLERRM, SQLSTATE;
  END;
END;
$$;

-- ============================================================================
-- TEST 4 : Bornage du buffer — LIMIT 500 sur les CTEs recent_*.
--          On ne peut pas observer ça directement de l'extérieur, mais on
--          vérifie que la fonction ne timeout pas même si beaucoup de rows
--          sont récentes (simulation : forcer last_refresh à epoch).
-- ============================================================================

DO $$
DECLARE
  v_start timestamptz;
  v_elapsed_ms numeric;
BEGIN
  -- Forcer un last_refresh ancien pour faire entrer toute la table dans le buffer
  UPDATE search_views_refresh_flags
  SET last_refresh = '1970-01-01'::timestamptz
  WHERE id = 'global_search_mv';

  v_start := clock_timestamp();
  PERFORM * FROM search_global('a', 20, 0, NULL);
  v_elapsed_ms := extract(epoch from clock_timestamp() - v_start) * 1000;

  IF v_elapsed_ms < 2000 THEN
    RAISE NOTICE 'TEST 4 OK : recherche < 2s avec buffer ouvert (%.0f ms)', v_elapsed_ms;
  ELSE
    RAISE WARNING 'TEST 4 FAIL : recherche trop lente (%.0f ms) — LIMIT 500 absent ?', v_elapsed_ms;
  END IF;

  -- Restaurer un last_refresh sain
  PERFORM refresh_search_views_if_needed();
END;
$$;
